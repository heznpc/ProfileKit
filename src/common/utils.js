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

function parseIntSafe(value, defaultValue) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? defaultValue : n;
}

function parseFloatSafe(value, defaultValue) {
  const n = parseFloat(value);
  return Number.isNaN(n) ? defaultValue : n;
}

function parseColor(value) {
  if (!value) return undefined;
  return value.startsWith("#") ? value : `#${value}`;
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

function errorCacheHeaders() {
  return "public, max-age=120, s-maxage=120, stale-while-revalidate=120";
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
  makeRng,
  truncate,
  cacheHeaders,
  errorCacheHeaders,
};
