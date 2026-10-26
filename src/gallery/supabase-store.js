const { GalleryError } = require("./errors");
const { validId } = require("./file-store");

const RESPONSE_LIMIT = 12 * 1024 * 1024;
const PAGE_SIZE = 200;

function configuration(message) { return new GalleryError(503, "gallery_configuration", message); }

function serviceOrigin(value, allowInsecureLocalhost) {
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(allowInsecureLocalhost && local && url.protocol === "http:"))
      || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch { throw configuration("PROFILEKIT_GALLERY_SUPABASE_URL must be the HTTPS origin of the configured Supabase project"); }
}

async function boundedJSON(response) {
  if (Number(response.headers.get("content-length")) > RESPONSE_LIMIT) throw new Error("Oversized storage response");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body || []) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > RESPONSE_LIMIT) throw new Error("Oversized storage response");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// Implements the same adapter contract as FileGalleryStore. The callback runs
// against a snapshot; the RPC compares that complete snapshot under a row lock
// and commits the manifest and immutable revision in one database transaction.
class SupabaseGalleryStore {
  constructor(url, serviceKey, { fetchImpl = globalThis.fetch, allowInsecureLocalhost = false, timeoutMs = 15000 } = {}) {
    this.origin = serviceOrigin(url, allowInsecureLocalhost);
    if (typeof serviceKey !== "string" || serviceKey.length < 16 || serviceKey.length > 8192
      || /[^\x21-\x7e]/.test(serviceKey) || serviceKey.startsWith("sb_publishable_")) {
      throw configuration("Set PROFILEKIT_GALLERY_SUPABASE_SERVICE_KEY to a server secret or service_role key");
    }
    this.serviceKey = serviceKey;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(resource, query = {}, body) {
    const url = new URL(`/rest/v1/${resource}`, this.origin);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, String(value));
    // New sb_secret keys are API keys, not JWT bearer tokens. Legacy JWT
    // service_role keys also require Authorization when talking to PostgREST.
    const headers = { apikey: this.serviceKey, Accept: "application/json" };
    if (!this.serviceKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${this.serviceKey}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    try {
      const response = await this.fetch(url, { method: body === undefined ? "GET" : "POST", headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: "error", signal: AbortSignal.timeout(this.timeoutMs) });
      let data;
      try { data = await boundedJSON(response); } catch { throw new GalleryError(503, "gallery_storage_error", "Gallery storage returned an invalid response"); }
      if (!response.ok) {
        if (response.status === 409 || ["PT409", "23505"].includes(data?.code)) throw new GalleryError(409, "version_conflict", "The entry changed. Load the latest revision before updating");
        if ([401, 403].includes(response.status)) throw new GalleryError(503, "gallery_storage_auth", "Gallery storage authorization failed; check the server secret and gallery SQL migration");
        throw new GalleryError(503, "gallery_storage_error", "Gallery storage could not complete the request; check the gallery SQL migration and service availability");
      }
      return data;
    } catch (error) {
      if (error instanceof GalleryError) throw error;
      // Never reflect upstream messages, URLs, headers or database diagnostics
      // into a public endpoint response: they may contain server credentials.
      throw new GalleryError(503, "gallery_storage_unavailable", "Gallery storage is unavailable; retry shortly");
    }
  }

  async get(id) {
    validId(id);
    const rows = await this.request("gallery_entries", { select: "manifest", id: `eq.${id}`, limit: 1 });
    if (!Array.isArray(rows) || rows.length > 1) throw new GalleryError(503, "gallery_storage_error", "Gallery storage returned an invalid entry");
    return rows[0]?.manifest || null;
  }

  async list() {
    const entries = [];
    let cursor;
    for (;;) {
      const rows = await this.request("gallery_entries", { select: "manifest", order: "id.asc", limit: PAGE_SIZE,
        ...(cursor ? { id: `gt.${cursor}` } : {}) });
      if (!Array.isArray(rows)) throw new GalleryError(503, "gallery_storage_error", "Gallery storage returned an invalid listing");
      if (!rows.length) return entries;
      for (const row of rows) {
        const id = row?.manifest?.id;
        if (typeof id !== "string" || !/^[a-f0-9]{32}$/.test(id) || (cursor && id <= cursor)) throw new GalleryError(503, "gallery_storage_error", "Gallery storage returned an invalid listing order");
        entries.push(row.manifest);
        cursor = id;
      }
      // Supabase may cap a page below our requested size. Continue by primary
      // key until empty, so a deployment's row limit never silently hides data.
    }
  }

  async readRevision(id, version) {
    validId(id);
    if (!Number.isSafeInteger(version) || version < 1 || version > 100) return null;
    const rows = await this.request("gallery_revisions", { select: "revision", entry_id: `eq.${id}`, version: `eq.${version}`, limit: 1 });
    if (!Array.isArray(rows) || rows.length > 1) throw new GalleryError(503, "gallery_storage_error", "Gallery storage returned an invalid revision");
    return rows[0]?.revision || null;
  }

  async transaction(id, operation) {
    validId(id);
    const expected = await this.get(id);
    const result = await operation(structuredClone(expected));
    if (!result?.manifest || result.manifest.id !== id) throw new Error("Gallery transaction must return a matching manifest");
    const committed = await this.request("rpc/profilekit_gallery_commit", {}, { p_id: id, p_expected: expected,
      p_manifest: result.manifest, p_revision: result.revision || null });
    if (!committed || committed.id !== id || committed.metadata?.version !== result.manifest.metadata?.version
      || committed.ownerHash !== result.manifest.ownerHash) throw new GalleryError(503, "gallery_storage_error", "Gallery storage did not confirm the commit");
    return committed;
  }
}

module.exports = { SupabaseGalleryStore };
