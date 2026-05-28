// User-controlled URL input on /api/posts means we need both a hard timeout
// (slow remote shouldn't block the serverless function until Vercel kills it)
// and a body cap (a 100 MB feed would OOM the function). The timer must stay
// alive across the body read — drip-fed responses can otherwise hold the
// connection open after fetch() resolves.
// Both this file and src/common/theme-url.js use the same 5s fetch timeout
// and the same streaming byte-count cap (different size: 2 MB here, 256 KB
// for theme palettes — they're intentionally different). If a third
// user-controlled fetch surface appears, co-locate the constants in a
// dedicated fetch-config module — NOT in utils.js, which has fanout to
// every endpoint and shouldn't inherit network concerns.
const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 2_000_000;
const HEADERS = { "User-Agent": "profilekit-posts-card" };

// Allowlist for `?source=rss&url=` and `?source=medium&url=` — a fixed set
// of public blogging hosts. Entries match either the full hostname or any
// subdomain (`user.medium.com` matches `medium.com`). This is a textbook
// SSRF control: without it a user-controlled URL could resolve to internal
// IPs (169.254.169.254 metadata service, 127.0.0.1, 10.x, .internal DNS),
// loopback-mounted services, or cloud provider instance metadata. The host
// allowlist plus `redirect: "error"` (set in fetchCapped) plus scheme check
// in validateFeedUrl closes the three classic SSRF bypass routes (direct,
// redirect, scheme smuggling). hashnode.dev is kept for `source=rss`
// against a Hashnode blog's /rss feed; the retired gql.hashnode.com is no
// longer hit by any code path.
const ALLOWED_FEED_HOSTS = [
  "medium.com",
  "dev.to",
  "hashnode.dev",
  "hashnode.com",
  "substack.com",
  "github.io",
  "wordpress.com",
  "blogger.com",
  "blogspot.com",
  "ghost.io",
  "bearblog.dev",
  "write.as",
];

function isAllowedFeedHost(hostname) {
  if (!hostname) return false;
  const lower = hostname.toLowerCase();
  return ALLOWED_FEED_HOSTS.some(
    (h) => lower === h || lower.endsWith(`.${h}`)
  );
}

// Validate a user-controlled feed URL against the SSRF posture: https only,
// host must be on the allowlist, URL must parse. Throws a `Error` whose
// message is safe to surface in the error card (no internal hosts leaked).
function validateFeedUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid feed URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Feed URL must use https://");
  }
  if (!isAllowedFeedHost(url.hostname)) {
    throw new Error(
      `Feed host not allowed: ${url.hostname}. Allowed suffixes: ${ALLOWED_FEED_HOSTS.join(", ")}`
    );
  }
  return url;
}

async function fetchCapped(url, init = {}, opts) {
  // Guard against callers passing `null` as the options bag — destructure
  // defaults only kick in for `undefined`. `opts || {}` lets `null` and
  // `{ fetchImpl: null }` both fall back to the real fetch.
  const { fetchImpl, timeoutMs } = opts || {};
  const realFetch = fetchImpl || globalThis.fetch;
  const timeout = typeof timeoutMs === "number" ? timeoutMs : FETCH_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    // `redirect: "error"` defends against a classic SSRF bypass where an
    // allowlisted host returns a 302 pointing at an internal resource — we
    // refuse to follow any redirect at all. Caller's init is spread FIRST so
    // `redirect` and `signal` are non-overridable — any future caller passing
    // `{ redirect: "follow" }` or `{ signal: theirOwn }` cannot weaken these.
    const res = await realFetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    // Pre-read cap. Sanitized as non-negative integer so a malformed
    // `Content-Length: -1` or `Content-Length: 1.5e10` from a buggy or
    // hostile upstream cannot bypass the check via NaN / negative-comparison.
    const declaredLen = Number(res.headers.get("content-length"));
    if (Number.isInteger(declaredLen) && declaredLen >= 0 && declaredLen > MAX_BODY_BYTES) {
      throw new Error(`Response too large: ${declaredLen} bytes`);
    }
    // Streaming byte counter — caps real bytes (not UTF-16 code units), and
    // prevents OOM mid-read for chunked / no-content-length responses by
    // aborting the controller the moment the cap is crossed.
    return await readBodyCapped(res, controller);
  } catch (e) {
    // Distinguish timer-induced aborts from upstream-surfaced AbortErrors
    // by consulting the controller, not just the duck-typed error name.
    // Undici can throw AbortError for non-timeout reasons (mid-stream
    // server reset); mislabeling those as "timed out" sends the operator
    // chasing a phantom slowness bug.
    if (controller.signal.aborted && (e.name === "AbortError" || e.message === "aborted")) {
      throw new Error(`Fetch timed out after ${timeout}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Stream-read a Response body, throwing if the running byte count exceeds
// MAX_BODY_BYTES. Falls back to res.text() for mock responses (and pre-fetch
// Response shapes) that don't expose a streamable body; the cap is then
// applied post-read against UTF-8 byte length.
async function readBodyCapped(res, controller) {
  if (!res.body || typeof res.body.getReader !== "function") {
    const text = await res.text();
    const byteLen = Buffer.byteLength(text, "utf8");
    if (byteLen > MAX_BODY_BYTES) {
      throw new Error(`Response too large: ${byteLen} bytes`);
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
        throw new Error(`Response too large: ${bytes} bytes`);
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}

function decodeEntities(str) {
  if (!str) return "";
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(text, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = text.match(re);
  return m ? decodeEntities(m[1]) : "";
}

function extractAttr(text, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\b${attr}="([^"]*)"`, "i");
  const m = text.match(re);
  return m ? m[1] : "";
}

function parseRss(xml) {
  const items = [];

  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const body = m[1];
    items.push({
      title: extractTag(body, "title"),
      url: extractTag(body, "link") || extractAttr(body, "link", "href"),
      published: extractTag(body, "pubDate") || extractTag(body, "dc:date"),
      description: extractTag(body, "description"),
    });
  }

  if (items.length > 0) return items;

  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((m = entryRegex.exec(xml)) !== null) {
    const body = m[1];
    items.push({
      title: extractTag(body, "title"),
      url: extractAttr(body, "link", "href") || extractTag(body, "link"),
      published: extractTag(body, "published") || extractTag(body, "updated"),
      description: extractTag(body, "summary") || extractTag(body, "content"),
    });
  }

  return items;
}

async function fetchDevTo(username, count) {
  const text = await fetchCapped(
    `https://dev.to/api/articles?username=${encodeURIComponent(username)}&per_page=${count}`,
    { headers: HEADERS }
  ).catch((e) => {
    throw new Error(`dev.to API error: ${e.message}`);
  });
  const json = JSON.parse(text);
  if (!Array.isArray(json)) throw new Error("Unexpected dev.to response");
  return json.map((p) => ({
    title: p.title,
    url: p.url,
    published: p.published_timestamp || p.published_at,
    description: p.description,
    readingTime: p.reading_time_minutes,
    reactions: p.positive_reactions_count,
  }));
}

// Hashnode retired the free public GraphQL API in 2026-05 — gql.hashnode.com
// now returns 301 to https://hashnode.com/announcements/graphql-api. There is
// no free path forward; the paid Pro-tier API requires per-user auth that
// ProfileKit's "drop URL in a README" model cannot supply. The source stays
// listed as removed (with a helpful error) instead of silently failing the
// fetch via redirect:error.
function fetchHashnodeRetired() {
  throw new Error(
    "hashnode source is retired (gql.hashnode.com requires Pro-tier auth as of 2026-05). Use source=rss with your Hashnode blog's /rss feed URL instead."
  );
}

async function fetchRssUrl(rawUrl, count) {
  // Validate before hitting fetchCapped so SSRF guard errors surface with
  // the host allowlist message instead of a generic "fetch failed".
  const validated = validateFeedUrl(rawUrl);
  const xml = await fetchCapped(validated.toString(), { headers: HEADERS }).catch(
    (e) => {
      throw new Error(`RSS fetch error: ${e.message}`);
    }
  );
  const items = parseRss(xml);
  if (items.length === 0) throw new Error("No items in feed");
  return items.slice(0, count);
}

async function fetchPosts({ source, username, url, count }) {
  const n = Math.max(1, Math.min(count, 10));
  if (source === "devto") return fetchDevTo(username, n);
  if (source === "hashnode") return fetchHashnodeRetired();
  if (source === "rss" || source === "medium") {
    let feedUrl = url;
    if (source === "medium" && username && !feedUrl) {
      // Medium username is controlled — we construct the URL ourselves so
      // it's guaranteed to be medium.com. Strip any leading @ so
      // `?username=@foo` and `?username=foo` both work; reject any handle
      // that contains characters that would escape the feed path.
      const handle = username.replace(/^@/, "");
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(handle)) {
        throw new Error("Invalid medium username");
      }
      feedUrl = `https://medium.com/feed/@${handle}`;
    }
    if (!feedUrl) {
      throw new Error(
        source === "medium"
          ? "Missing ?username= or ?url= for medium source"
          : "Missing ?url= for rss source"
      );
    }
    return fetchRssUrl(feedUrl, n);
  }
  throw new Error(`Unknown source: ${source}`);
}

module.exports = {
  fetchPosts,
  // Exported for the SSRF regression tests and for reuse by any future
  // fetcher that takes a user-controlled URL.
  validateFeedUrl,
  isAllowedFeedHost,
  ALLOWED_FEED_HOSTS,
  fetchCapped,
  FETCH_TIMEOUT_MS,
  MAX_BODY_BYTES,
};
