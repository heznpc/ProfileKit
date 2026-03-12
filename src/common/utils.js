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
  cacheHeaders,
  errorCacheHeaders,
};
