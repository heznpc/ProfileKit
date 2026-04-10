const { fetchPosts } = require("../src/fetchers/posts");
const { renderPostsCard } = require("../src/cards/posts");
const { renderError } = require("../src/common/card");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const { parseIntSafe, cacheHeaders, errorCacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);
  const { colors, font } = opts;

  const source = params.get("source") || "devto";
  const username = params.get("username");
  const url = params.get("url");
  const count = parseIntSafe(params.get("count"), 5);

  res.setHeader("Content-Type", "image/svg+xml");

  if ((source === "devto" || source === "hashnode") && !username) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("Missing ?username= parameter", { colors, font }));
  }
  if (source === "rss" && !url) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("Missing ?url= parameter", { colors, font }));
  }
  if (source === "medium" && !username && !url) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("Missing ?username= or ?url= parameter", { colors, font }));
  }

  try {
    const posts = await fetchPosts({ source, username, url, count });
    const svg = renderPostsCard(posts, opts);

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError(err.message, { colors, font }));
  }
};
