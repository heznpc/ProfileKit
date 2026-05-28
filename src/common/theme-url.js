// Optional external theme loader: ?theme_url=https://gist.githubusercontent.com/...
//
// Loads a theme palette JSON from an external URL so users can publish and
// share custom palettes without having to fork ProfileKit. The full schema is
// the same as the entries in `themes.js` — bg / title / text / muted / icon /
// border / accentStops.
//
// SSRF posture (this is a serverless function reaching out to arbitrary URLs,
// so the threat model matters):
//
//   1. Hard-coded host allowlist. Only `gist.githubusercontent.com` today.
//      Adding hosts is a deliberate choice that has to land in this file —
//      `?theme_url=` cannot reach internal IPs, private hosts, link-local
//      addresses, or any other public service through the parameter.
//   2. https-only. http:// is rejected outright.
//   3. `redirect: "error"`. Even if a request to the allowlisted host could
//      somehow respond with a redirect, we never follow it — preventing
//      "redirect to internal" SSRF tricks.
//   4. 5-second timeout via AbortController. Slow / hanging responses don't
//      hold the serverless function open.
//   5. Schema validation. The fetched JSON must contain the exact theme keys
//      with the right types — anything else throws and falls back to dark.
//
// Caching: in-memory Map keyed by URL with a 30-minute TTL. Serverless cold
// starts will re-fetch, but warm instances skip the round trip. The map is
// process-local so there's no cross-tenant cache poisoning surface.

const ALLOWED_HOSTS = new Set(["gist.githubusercontent.com"]);
const REQUIRED_KEYS = ["bg", "title", "text", "muted", "icon", "border", "accentStops"];
const TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
// Real theme palettes are ~500 bytes. 256 KB is a generous ceiling that still
// bounds the body buffer so a hostile or malformed gist cannot OOM the
// function via a multi-MB JSON payload.
const MAX_BODY_BYTES = 256 * 1024;
const MAX_CACHE_ENTRIES = 128;

// Insertion-ordered Map → cheapest possible LRU. On every set() we drop the
// oldest entry once we exceed MAX_CACHE_ENTRIES, capping memory growth even
// if a long-lived warm instance sees many distinct gist URLs.
const cache = new Map();

class ThemeUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = "ThemeUrlError";
  }
}

function validateUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ThemeUrlError("invalid theme_url");
  }
  if (url.protocol !== "https:") {
    throw new ThemeUrlError("theme_url must use https");
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new ThemeUrlError(
      `theme_url host not allowed: ${url.hostname}. Allowed: ${[...ALLOWED_HOSTS].join(", ")}`
    );
  }
  return url;
}

function validatePalette(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new ThemeUrlError("theme_url payload must be a JSON object");
  }
  // Pluck only recognized keys — extras are silently ignored so users can
  // include comments / metadata in their gist without breaking validation.
  const palette = {};
  for (const key of REQUIRED_KEYS) {
    if (!(key in json)) {
      throw new ThemeUrlError(`theme_url missing required key "${key}"`);
    }
    if (key === "accentStops") {
      if (!Array.isArray(json.accentStops) || json.accentStops.length < 2) {
        throw new ThemeUrlError("accentStops must be an array of at least 2 colors");
      }
      for (const stop of json.accentStops) {
        if (typeof stop !== "string" || !/^#[0-9a-fA-F]{3,8}$/.test(stop)) {
          throw new ThemeUrlError(`accentStops contains invalid color "${stop}"`);
        }
      }
    } else if (typeof json[key] !== "string") {
      throw new ThemeUrlError(`"${key}" must be a string`);
    }
    palette[key] = json[key];
  }
  return palette;
}

async function fetchExternalTheme(
  rawUrl,
  { now = Date.now, fetchImpl = globalThis.fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}
) {
  const url = validateUrl(rawUrl);
  const cached = cache.get(url.href);
  if (cached && cached.expiresAt > now()) {
    return cached.palette;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let palette;
  try {
    // The timer MUST stay alive across the body read — a drip-fed body would
    // otherwise hold the connection open after the fetch promise resolved.
    // Both the headers-only fetch AND the body read are inside this try;
    // clearTimeout fires in the outer finally only.
    const res = await fetchImpl(url.href, {
      headers: { "User-Agent": "ProfileKit/1.0 (+theme_url)" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ThemeUrlError(`theme_url fetch failed: HTTP ${res.status}`);
    }
    // Pre-read body cap. Sanitized as non-negative integer so a
    // `Content-Length: -1` from a buggy upstream can't bypass the check.
    const declaredLen = Number(res.headers.get("content-length"));
    if (Number.isInteger(declaredLen) && declaredLen >= 0 && declaredLen > MAX_BODY_BYTES) {
      throw new ThemeUrlError(`theme_url payload too large: ${declaredLen} bytes`);
    }
    // Streaming byte counter — caps memory even for chunked / lying-content-
    // length responses. Aborts mid-read once the cap is exceeded.
    const text = await readBodyCapped(res, controller);
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ThemeUrlError("theme_url payload is not valid JSON");
    }
    palette = validatePalette(json);
  } catch (err) {
    // Distinguish timer-induced aborts from upstream-surfaced AbortErrors by
    // consulting the controller, not just the duck-typed error name. Undici
    // can surface AbortError for non-timeout reasons (mid-stream server
    // reset) and we don't want to mislabel those as timeouts.
    if (controller.signal.aborted && err.name === "AbortError") {
      throw new ThemeUrlError("theme_url fetch timed out");
    }
    if (err instanceof ThemeUrlError) throw err;
    throw new ThemeUrlError(`theme_url fetch failed: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  cache.set(url.href, { palette, expiresAt: now() + TTL_MS });
  if (cache.size > MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  return palette;
}

// Read a Response body chunk by chunk, tracking bytes against the cap.
// Aborts the underlying controller and throws if the cap is exceeded mid-
// stream. Falls back to res.text() for mocks / older Response shapes that
// don't expose a streamable body — in that case the cap is enforced after
// the read using Buffer.byteLength (UTF-8), which is correct for bytes but
// only as good as the mock's willingness to materialize the whole body.
async function readBodyCapped(res, controller) {
  if (!res.body || typeof res.body.getReader !== "function") {
    const text = await res.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
      throw new ThemeUrlError(`theme_url payload too large: ${Buffer.byteLength(text, "utf8")} bytes`);
    }
    return text;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const parts = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        try { controller.abort(); } catch { /* ignore */ }
        throw new ThemeUrlError(`theme_url payload too large: ${bytes} bytes`);
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}

function clearCache() {
  cache.clear();
}

module.exports = {
  fetchExternalTheme,
  validateUrl,
  validatePalette,
  clearCache,
  ThemeUrlError,
  ALLOWED_HOSTS,
  REQUIRED_KEYS,
  TTL_MS,
  FETCH_TIMEOUT_MS,
  MAX_BODY_BYTES,
  MAX_CACHE_ENTRIES,
};
