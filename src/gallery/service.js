const { randomBytes, createHash, timingSafeEqual } = require("node:crypto");
const Model = require("../../public/editor-model");
const { GalleryError } = require("./errors");
const { validId } = require("./file-store");

const LICENSES = Object.freeze(["CC0-1.0", "CC-BY-4.0"]);
const LIMITS = Object.freeze({ maxBodyBytes: Model.LIMITS.MAX_FILE_BYTES + 16 * 1024, maxDocumentBytes: Model.LIMITS.MAX_FILE_BYTES,
  maxImageBytes: Model.LIMITS.MAX_IMAGE_BYTES, maxTags: 8, maxRevisions: 100, maxAttributions: 32, maxPageSize: 40 });
const SECRET_KEY = /(?:token|secret|password|credential|authorization|api[_-]?key|access[_-]?key)/i;
const SECRET_VALUE = /\b(?:gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|sk-(?:proj-)?[a-zA-Z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/;

function bad(message, code = "invalid_request") { throw new GalleryError(400, code, message); }
function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) bad(`${label} must be an object`);
  return value;
}
function keys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) bad(`${label} contains an unsupported field`);
}
function text(value, maximum, label, required = false) {
  if (typeof value !== "string" || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) bad(`${label} must be text of at most ${maximum} characters`);
  const result = value.trim().normalize("NFC");
  if (required && !result) bad(`${label} is required`);
  return result;
}
function versionNumber(value) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) bad("Version must be a positive integer", "invalid_version");
  return value;
}
function hashToken(token) { return createHash("sha256").update(token).digest("hex"); }
function equalTokenHash(token, expected) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[a-f0-9]{64}$/.test(expected || "")) return false;
  return timingSafeEqual(Buffer.from(hashToken(token), "hex"), Buffer.from(expected, "hex"));
}
function rejectSecrets(value) {
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) return;
    if (SECRET_VALUE.test(value)) bad("Remove credentials before publishing a public project", "public_secret");
    for (const candidate of value.match(/https?:\/\/[^\s<>"']+/g) || []) {
      let url;
      try { url = new URL(candidate); } catch { continue; }
      if (url.username || url.password || Array.from(url.searchParams.keys()).some((key) => SECRET_KEY.test(key))) bad("Public project URLs cannot contain credentials or secret query parameters", "public_secret");
    }
  } else if (Array.isArray(value)) value.forEach(rejectSecrets);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) bad("Public projects cannot contain secret fields", "public_secret");
      rejectSecrets(child);
    }
  }
}
function normalizeInput(raw, updating = false) {
  object(raw, "Publish request");
  keys(raw, ["title", "description", "author", "tags", "license", "document", "source", ...(updating ? ["expectedVersion"] : [])], "Publish request");
  const metadata = {
    title: text(raw.title, 120, "Title", true),
    description: text(raw.description ?? "", 2000, "Description"),
    author: text(raw.author, 80, "Author pseudonym", true),
    tags: [], license: raw.license,
  };
  if (!LICENSES.includes(metadata.license)) bad("Choose CC0-1.0 or CC-BY-4.0", "invalid_license");
  if (raw.tags !== undefined && (!Array.isArray(raw.tags) || raw.tags.length > LIMITS.maxTags)) bad("Use at most eight tags");
  metadata.tags = [...new Set((raw.tags || []).map((tag) => text(tag, 32, "Tag", true).toLocaleLowerCase("en-US")))];
  let document;
  try { document = Model.normalizeDocument(raw.document); }
  catch (error) { bad(error.message, "invalid_document"); }
  rejectSecrets({ ...metadata, document });
  return { metadata, document };
}
function publicMetadata(metadata) {
  const base = `/api/gallery?id=${metadata.id}&version=${metadata.version}`;
  return { ...metadata, projectUrl: base, svgUrl: `${base}&format=svg` };
}
function attribution(metadata) {
  return { id: metadata.id, version: metadata.version, title: metadata.title, author: metadata.author, license: metadata.license };
}
function cursorValue(value) {
  if (!value) return null;
  if (typeof value !== "string" || value.length > 512 || !/^[a-zA-Z0-9_-]+$/.test(value)) bad("Gallery cursor is invalid", "invalid_cursor");
  let decoded;
  try { decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")); } catch { bad("Gallery cursor is invalid", "invalid_cursor"); }
  if (!Array.isArray(decoded) || decoded.length !== 2 || typeof decoded[0] !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(decoded[0])) bad("Gallery cursor is invalid", "invalid_cursor");
  validId(decoded[1]);
  return decoded;
}

class GalleryService {
  constructor(storage, { now = () => new Date().toISOString() } = {}) {
    this.storage = storage;
    this.now = now;
  }

  async get(id, version) {
    validId(id);
    let requested = version;
    if (requested === undefined) {
      const current = await this.storage.get(id);
      if (!current || current.withdrawnAt) throw new GalleryError(404, "not_found", "Gallery entry was not found");
      requested = current.metadata.version;
    }
    versionNumber(requested);
    const revision = await this.storage.readRevision(id, requested);
    if (!revision) throw new GalleryError(404, "not_found", "Gallery revision was not found");
    return { ...publicMetadata(revision.metadata), document: revision.document };
  }

  async list({ q = "", tag = "", cursor, limit = 20 } = {}) {
    q = text(q, 120, "Search query").toLocaleLowerCase("en-US");
    tag = text(tag, 32, "Tag filter").toLocaleLowerCase("en-US");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > LIMITS.maxPageSize) bad(`Page size must be between 1 and ${LIMITS.maxPageSize}`);
    const after = cursorValue(cursor);
    const entries = (await this.storage.list()).filter((entry) => !entry.withdrawnAt).map((entry) => entry.metadata)
      .filter((item) => (!tag || item.tags.includes(tag)) && (!q || [item.title, item.description, item.author, ...item.tags].join(" ").toLocaleLowerCase("en-US").includes(q)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .filter((item) => !after || item.createdAt < after[0] || (item.createdAt === after[0] && item.id < after[1]));
    const page = entries.slice(0, limit);
    const last = page[page.length - 1];
    return { items: page.map(publicMetadata), nextCursor: entries.length > limit ? Buffer.from(JSON.stringify([last.createdAt, last.id])).toString("base64url") : null };
  }

  async publish(raw) {
    const { metadata, document } = normalizeInput(raw);
    let source = null;
    let attributions = [];
    if (raw.source !== undefined && raw.source !== null) {
      object(raw.source, "Remix source");
      keys(raw.source, ["id", "version"], "Remix source");
      const original = await this.get(raw.source.id, versionNumber(raw.source.version));
      source = attribution(original);
      attributions = [...(original.attributions || []), source];
      if (attributions.length > LIMITS.maxAttributions) bad("This remix has reached the supported attribution depth");
    }
    const id = randomBytes(16).toString("hex");
    const editToken = randomBytes(32).toString("base64url");
    const createdAt = this.now();
    const publicData = { id, version: 1, ...metadata, createdAt, updatedAt: createdAt, source, attributions };
    await this.storage.transaction(id, async (current) => {
      if (current) throw new GalleryError(409, "id_conflict", "Please retry publishing");
      return { manifest: { id, ownerHash: hashToken(editToken), metadata: publicData, withdrawnAt: null },
        revision: { version: 1, metadata: publicData, document } };
    });
    return { ...publicMetadata(publicData), editToken };
  }

  async update(id, token, raw) {
    validId(id);
    // Fail before creating a lock/directory or processing a large document for
    // an arbitrary unauthenticated ID; verify again inside the transaction.
    this.authorize(await this.storage.get(id), token);
    object(raw, "Update request");
    const expectedVersion = versionNumber(raw.expectedVersion);
    const { metadata, document } = normalizeInput(raw, true);
    const result = await this.storage.transaction(id, async (current) => {
      this.authorize(current, token);
      if (current.withdrawnAt) throw new GalleryError(410, "withdrawn", "This entry was withdrawn; publish a new entry to share it again");
      if (current.metadata.version !== expectedVersion) throw new GalleryError(409, "version_conflict", "The entry changed. Load the latest revision before updating");
      if (expectedVersion >= LIMITS.maxRevisions) throw new GalleryError(409, "revision_limit", "This entry reached its revision limit; publish a new entry");
      if (metadata.author !== current.metadata.author) bad("The publishing pseudonym cannot be changed on existing entries");
      if (raw.source !== undefined) {
        const previous = current.metadata.source;
        if (raw.source === null ? previous !== null : !previous || raw.source.id !== previous.id || raw.source.version !== previous.version || Object.keys(raw.source).some((key) => !["id", "version"].includes(key))) {
          bad("Original remix attribution cannot be replaced", "immutable_source");
        }
      }
      const publicData = { ...current.metadata, ...metadata, version: expectedVersion + 1, updatedAt: this.now() };
      return { manifest: { ...current, metadata: publicData }, revision: { version: publicData.version, metadata: publicData, document } };
    });
    return publicMetadata(result.metadata);
  }

  authorize(current, token) {
    if (!current) throw new GalleryError(404, "not_found", "Gallery entry was not found");
    if (!equalTokenHash(token, current.ownerHash)) throw new GalleryError(403, "owner_required", "A valid edit token is required for this entry");
  }

  async withdraw(id, token) {
    validId(id);
    this.authorize(await this.storage.get(id), token);
    const result = await this.storage.transaction(id, async (current) => {
      this.authorize(current, token);
      return { manifest: { ...current, withdrawnAt: current.withdrawnAt || this.now() } };
    });
    return { id, withdrawn: true, version: result.metadata.version };
  }
}

module.exports = { GalleryService, LICENSES, LIMITS, versionNumber, equalTokenHash };
