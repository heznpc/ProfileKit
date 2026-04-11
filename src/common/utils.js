const formatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatNumber(n) {
  return formatter.format(n);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseBoolean(value) {
  return value === "true" || value === "1" || value === "yes";
}

function parseArray(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Optional bounds clamp the parsed value into [min, max]; out-of-range values
// fall back to `defaultValue` instead of being silently clipped, so a caller
// that asks for card_width=999999 doesn't end up with a 1200-wide SVG it did
// not design for.
function parseIntSafe(value, defaultValue, min = -Infinity, max = Infinity) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return defaultValue;
  if (n < min || n > max) return defaultValue;
  return n;
}

function parseFloatSafe(value, defaultValue, min = -Infinity, max = Infinity) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return defaultValue;
  if (n < min || n > max) return defaultValue;
  return n;
}

// Strict hex validation: #RGB, #RRGGBB, #RRGGBBAA. Invalid values return
// `undefined` so callers fall back to the theme's base color instead of
// emitting something like fill="#zzz" which browsers ignore (or worse,
// interpret as attribute-value injection surface).
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function parseColor(value) {
  if (!value) return undefined;
  const hex = value.startsWith("#") ? value : `#${value}`;
  if (!HEX_COLOR_RE.test(hex)) return undefined;
  return hex;
}

// URL schemes we're willing to emit into an SVG `<a href>` attribute. The
// card renderer wraps this in escapeHtml, but escapeHtml only handles
// attribute-value injection — it doesn't reject `javascript:` / `data:` /
// `vbscript:` schemes that browsers still execute when the SVG is opened
// directly (as opposed to being embedded through `<img>`, which sandboxes
// scripts). ProfileKit URLs are accessed both ways (README via img, raw
// Vercel URL by humans / unfurl crawlers), so the renderer has to reject
// those schemes itself. Returns the canonical URL string on success, or
// `null` if the input is unparseable or uses a disallowed scheme.
const SAFE_URL_SCHEMES = new Set(["https:", "http:", "mailto:"]);

function sanitizeUrl(raw) {
  if (raw == null || raw === "") return null;
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    return null;
  }
  if (!SAFE_URL_SCHEMES.has(url.protocol)) return null;
  return url.toString();
}

// Re-export the token-aware radius parser from src/common/tokens so endpoints
// don't need a second require line. Spacing/type-size parsers will be added
// here when they pick up their first caller.
const { parseRadius } = require("./tokens");

function makeRng(seed) {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "\u2026" : str;
}

function cacheHeaders() {
  return "public, max-age=1800, s-maxage=1800, stale-while-revalidate=300";
}

// Error TTLs are intentionally coarse but distinct. A GitHub rate-limit
// response propagates for 10 minutes so one exhausted token doesn't spam
// every reader; network blips clear in a minute so transient failures
// recover fast; missing-param / bad-input cards survive longer because
// they only change when the README author fixes their URL.
const ERROR_TTL_SECONDS = {
  default: 120,
  network: 60,
  ratelimit: 600,
  bad_input: 300,
  not_found: 300,
};

function errorCacheHeaders(kind = "default") {
  const ttl = ERROR_TTL_SECONDS[kind] ?? ERROR_TTL_SECONDS.default;
  return `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${ttl}`;
}

// Classify a fetcher Error into one of the ERROR_TTL_SECONDS kinds. Keeps
// the catch blocks in each endpoint small — they just pass the caught err.
function classifyError(err) {
  const status = err && err.status;
  if (status === 429) return "ratelimit";
  if (status === 404) return "not_found";
  if (status === 401 || status === 403) return "ratelimit";
  const msg = err && err.message ? String(err.message) : "";
  if (/rate limit/i.test(msg)) return "ratelimit";
  if (/not found/i.test(msg)) return "not_found";
  if (/timed out|ETIMEDOUT|ECONNRESET|fetch failed/i.test(msg)) return "network";
  if (/GITHUB_TOKEN not configured/i.test(msg)) return "bad_input";
  return "default";
}

module.exports = {
  formatNumber,
  escapeHtml,
  parseBoolean,
  parseArray,
  parseIntSafe,
  parseFloatSafe,
  parseColor,
  parseRadius,
  sanitizeUrl,
  makeRng,
  truncate,
  cacheHeaders,
  errorCacheHeaders,
  classifyError,
  HEX_COLOR_RE,
  SAFE_URL_SCHEMES,
  ERROR_TTL_SECONDS,
};
