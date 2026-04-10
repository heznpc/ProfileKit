// User-controlled URL input on /api/posts means we need both a hard timeout
// (slow remote shouldn't block the serverless function until Vercel kills it)
// and a body cap (a 100 MB feed would OOM the function). The timer must stay
// alive across the body read — drip-fed responses can otherwise hold the
// connection open after fetch() resolves.
const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 2_000_000;
const HEADERS = { "User-Agent": "profilekit-posts-card" };

async function fetchCapped(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
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

async function fetchRssUrl(url, count) {
  const xml = await fetchCapped(url, { headers: HEADERS }).catch((e) => {
    throw new Error(`RSS fetch error: ${e.message}`);
  });
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
      const handle = username.startsWith("@") ? username : `@${username}`;
      feedUrl = `https://medium.com/feed/${handle}`;
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

module.exports = { fetchPosts };
