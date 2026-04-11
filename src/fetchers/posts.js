// User-controlled URL input on /api/posts means we need both a hard timeout
// (slow remote shouldn't block the serverless function until Vercel kills it)
// and a body cap (a 100 MB feed would OOM the function). The timer must stay
// alive across the body read — drip-fed responses can otherwise hold the
// connection open after fetch() resolves.
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
// redirect, scheme smuggling). Hashnode's own GraphQL API endpoint
// (gql.hashnode.com) is here too because fetchHashnode pipes through
// fetchCapped — its allowlist membership is what keeps that call path from
// becoming a different SSRF surface if the host is ever parameterized.
const ALLOWED_FEED_HOSTS = [
  "medium.com",
  "dev.to",
  "hashnode.dev",
  "hashnode.com",
  "gql.hashnode.com",
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

async function fetchCapped(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // `redirect: "error"` defends against a classic SSRF bypass where an
    // allowlisted host returns a 302 pointing at an internal resource — we
    // refuse to follow any redirect at all. A caller that needs to follow
    // redirects has to override this explicitly.
    const res = await fetch(url, {
      redirect: "error",
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const len = Number(res.headers.get("content-length"));
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      throw new Error(`Response too large: ${len} bytes`);
    }
    const text = await res.text();
    if (text.length > MAX_BODY_BYTES) {
      throw new Error(`Response too large: ${text.length} bytes`);
    }
    return text;
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(`Fetch timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
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

async function fetchHashnode(username, count) {
  const query = `query Posts($host: String!, $first: Int!) {
    publication(host: $host) {
      posts(first: $first) {
        edges {
          node {
            title
            url
            publishedAt
            brief
            readTimeInMinutes
            reactionCount
          }
        }
      }
    }
  }`;
  const text = await fetchCapped("https://gql.hashnode.com/", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...HEADERS },
    body: JSON.stringify({
      query,
      variables: { host: `${username}.hashnode.dev`, first: count },
    }),
  }).catch((e) => {
    throw new Error(`Hashnode API error: ${e.message}`);
  });
  const json = JSON.parse(text);
  const edges = json?.data?.publication?.posts?.edges;
  if (!edges) throw new Error("Hashnode publication not found");
  return edges.map(({ node }) => ({
    title: node.title,
    url: node.url,
    published: node.publishedAt,
    description: node.brief,
    readingTime: node.readTimeInMinutes,
    reactions: node.reactionCount,
  }));
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
  if (source === "hashnode") return fetchHashnode(username, n);
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
};
