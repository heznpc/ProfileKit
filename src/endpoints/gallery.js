const { timingSafeEqual } = require("node:crypto");
const { FileGalleryStore } = require("../gallery/file-store");
const { SupabaseGalleryStore } = require("../gallery/supabase-store");
const { GalleryService, LICENSES, LIMITS } = require("../gallery/service");
const { GalleryError } = require("../gallery/errors");
const { buildDesign } = require("./design");

function header(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return typeof value === "string" ? value : "";
}
function sendJSON(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.send(JSON.stringify(value));
}
function numberQuery(value, label) {
  if (!/^[1-9][0-9]{0,8}$/.test(value || "")) throw new GalleryError(400, "invalid_query", `${label} must be a positive integer`);
  return Number(value);
}
function originSetting(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error();
    return parsed.origin;
  } catch { throw new GalleryError(503, "gallery_configuration", "PROFILEKIT_PUBLIC_ORIGIN must be a single HTTP(S) origin"); }
}
function validateWriteOrigin(req, publicOrigin) {
  const site = header(req, "sec-fetch-site");
  if (site && !["same-origin", "none"].includes(site)) throw new GalleryError(403, "cross_origin", "Gallery writes must come from the same origin");
  const origin = header(req, "origin");
  if (origin && (publicOrigin ? origin !== publicOrigin : site !== "same-origin")) {
    throw new GalleryError(403, "cross_origin", "Gallery write origin was not accepted. Configure PROFILEKIT_PUBLIC_ORIGIN for this deployment");
  }
}
function authorizePublish(req, publishKey) {
  if (!publishKey) return;
  const submitted = header(req, "x-profilekit-publish-key");
  const actual = Buffer.from(submitted);
  const expected = Buffer.from(publishKey);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new GalleryError(403, "publish_key_required", "This deployment requires its gallery publish key");
}
function ownerToken(req) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header(req, "authorization"));
  if (!match) throw new GalleryError(401, "owner_required", "Use the edit token as a Bearer authorization header");
  return match[1];
}
async function readBody(req) {
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?\s*$/i.test(header(req, "content-type"))) throw new GalleryError(415, "json_required", "Send application/json with UTF-8 encoding");
  if (header(req, "content-encoding") && header(req, "content-encoding").toLowerCase() !== "identity") throw new GalleryError(415, "encoding_not_supported", "Compressed gallery request bodies are not supported");
  const length = header(req, "content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > LIMITS.maxBodyBytes)) throw new GalleryError(413, "body_too_large", "Gallery request exceeds the upload limit");
  let serialized;
  if (req.body !== undefined) {
    try { serialized = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : typeof req.body === "string" ? req.body : JSON.stringify(req.body); }
    catch { throw new GalleryError(400, "invalid_json", "Body must be a JSON object"); }
  } else {
    const chunks = [];
    let bytes = 0;
    const stream = typeof req.iterator === "function" ? req.iterator({ destroyOnReturn: false }) : req;
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > LIMITS.maxBodyBytes) {
        // Drain without retaining the remainder so a real HTTP response can
        // still deliver the 413 instead of destroying the request socket.
        if (typeof req.resume === "function") req.resume();
        throw new GalleryError(413, "body_too_large", "Gallery request exceeds the upload limit");
      }
      chunks.push(buffer);
    }
    serialized = Buffer.concat(chunks).toString("utf8");
  }
  if (typeof serialized !== "string" || Buffer.byteLength(serialized) > LIMITS.maxBodyBytes) throw new GalleryError(413, "body_too_large", "Gallery request exceeds the upload limit");
  try { return JSON.parse(serialized); }
  catch { throw new GalleryError(400, "invalid_json", "Body must contain valid JSON"); }
}

function createGalleryHandler(options = {}) {
  let service;
  let configurationError;
  let publicOrigin;
  let publishKey;
  try {
    publicOrigin = originSetting(options.publicOrigin ?? process.env.PROFILEKIT_PUBLIC_ORIGIN);
    publishKey = options.publishKey ?? process.env.PROFILEKIT_GALLERY_PUBLISH_KEY;
    const directory = options.directory ?? process.env.PROFILEKIT_GALLERY_DIR;
    const supabaseUrl = options.supabaseUrl ?? process.env.PROFILEKIT_GALLERY_SUPABASE_URL;
    const supabaseServiceKey = options.supabaseServiceKey ?? process.env.PROFILEKIT_GALLERY_SUPABASE_SERVICE_KEY;
    const storage = options.storage || (supabaseUrl || supabaseServiceKey
      ? new SupabaseGalleryStore(supabaseUrl, supabaseServiceKey)
      : directory ? new FileGalleryStore(directory) : null);
    if (storage) service = new GalleryService(storage, { now: options.now });
  } catch (error) { configurationError = error; }
  const renderDesign = options.renderDesign || buildDesign;
  const capabilities = { enabled: Boolean(service) && !configurationError, licenses: LICENSES, limits: LIMITS,
    publishKeyRequired: Boolean(publishKey), ownership: "edit-token", authorIdentity: "unverified-pseudonym" };

  return async function gallery(req, res) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    try {
      const method = req.method || "GET";
      if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
        res.setHeader("Allow", "GET, POST, PATCH, DELETE");
        throw new GalleryError(405, "method_not_allowed", "Use GET, POST, PATCH, or DELETE");
      }
      if (typeof req.url !== "string" || req.url.length > 4096) throw new GalleryError(400, "invalid_query", "Gallery request URL is invalid or too long");
      const query = new URL(req.url, "http://profilekit.invalid").searchParams;
      const allowed = method === "GET" ? ["id", "version", "format", "q", "tag", "cursor", "limit", "config"] : method === "POST" ? [] : ["id"];
      for (const key of query.keys()) if (!allowed.includes(key) || query.getAll(key).length !== 1) throw new GalleryError(400, "invalid_query", "Unsupported or repeated gallery query parameter");
      if (configurationError) throw configurationError;
      if (!service) {
        return sendJSON(res, 503, { ...capabilities, error: { code: "gallery_unavailable", message: "Shared gallery is not configured. Apply the gallery SQL migration and set PROFILEKIT_GALLERY_SUPABASE_URL plus PROFILEKIT_GALLERY_SUPABASE_SERVICE_KEY, or set PROFILEKIT_GALLERY_DIR to an absolute durable volume path" } });
      }
      if (method === "GET") {
        if (query.has("config")) {
          if (query.size !== 1 || query.get("config") !== "1") throw new GalleryError(400, "invalid_query", "Use ?config=1 for gallery capabilities");
          return sendJSON(res, 200, capabilities);
        }
        if (query.has("id")) {
          if ([...query.keys()].some((key) => !["id", "version", "format"].includes(key))) throw new GalleryError(400, "invalid_query", "Revision requests cannot include search parameters");
          const format = query.get("format") || "json";
          if (!["json", "svg"].includes(format)) throw new GalleryError(400, "invalid_format", "Choose json or svg format");
          const version = query.has("version") ? numberQuery(query.get("version"), "Version") : undefined;
          if (format === "svg" && version === undefined) throw new GalleryError(400, "version_required", "SVG embeds must specify an immutable revision version");
          const result = await service.get(query.get("id"), version);
          if (format === "svg") {
            const rendered = await renderDesign(result.document);
            for (const [name, value] of Object.entries(rendered.headers)) res.setHeader(name, value);
            res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
            res.setHeader("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
            return res.send(rendered.svg);
          }
          if (version !== undefined) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return sendJSON(res, 200, result);
        }
        if (query.has("version") || query.has("format")) throw new GalleryError(400, "invalid_query", "A revision requires an id");
        const result = await service.list({ q: query.get("q") || "", tag: query.get("tag") || "", cursor: query.get("cursor"),
          ...(query.has("limit") ? { limit: numberQuery(query.get("limit"), "Page size") } : {}) });
        return sendJSON(res, 200, result);
      }
      validateWriteOrigin(req, publicOrigin);
      if (method === "POST") {
        authorizePublish(req, publishKey);
        const result = await service.publish(await readBody(req));
        res.setHeader("Location", result.projectUrl);
        return sendJSON(res, 201, result);
      }
      const token = ownerToken(req);
      if (method === "PATCH") return sendJSON(res, 200, await service.update(query.get("id"), token, await readBody(req)));
      return sendJSON(res, 200, await service.withdraw(query.get("id"), token));
    } catch (error) {
      const status = error instanceof GalleryError ? error.status : 500;
      res.setHeader("Cache-Control", "no-store, max-age=0");
      return sendJSON(res, status, { error: { code: error instanceof GalleryError ? error.code : "gallery_error",
        message: error instanceof GalleryError ? error.message : "Gallery storage could not complete the request" } });
    }
  };
}

// Resolve configuration on first request, allowing host adapters to configure
// their environment before dispatch without creating any implicit local store.
let defaultHandler;
module.exports = (req, res) => {
  if (!defaultHandler) defaultHandler = createGalleryHandler();
  return defaultHandler(req, res);
};
module.exports.createGalleryHandler = createGalleryHandler;
module.exports.readBody = readBody;
