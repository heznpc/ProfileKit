const { fetchPosts } = require("../fetchers/posts");
const { renderPostsCard } = require("../cards/posts");
const { renderError } = require("../common/card");
const { parseSearchParams, resolveCardOptions } = require("../common/options");
const {
  parseIntSafe,
  cacheHeaders,
  errorCacheHeaders,
  classifyError,
} = require("../common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);
  const { colors, font } = opts;

  const source = params.get("source") || "devto";
  const username = params.get("username");
  const url = params.get("url");
  const count = parseIntSafe(params.get("count"), 5, 1, 10);

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);

  if ((source === "devto" || source === "hashnode") && !username) {
    res.setHeader("Cache-Control", errorCacheHeaders("bad_input"));
    return res.send(renderError("Missing ?username= parameter", { colors, font }));
  }
  if (source === "rss" && !url) {
    res.setHeader("Cache-Control", errorCacheHeaders("bad_input"));
    return res.send(renderError("Missing ?url= parameter", { colors, font }));
  }
  if (source === "medium" && !username && !url) {
    res.setHeader("Cache-Control", errorCacheHeaders("bad_input"));
    return res.send(renderError("Missing ?username= or ?url= parameter", { colors, font }));
  }

  try {
    const posts = await fetchPosts({ source, username, url, count });
    const svg = renderPostsCard(posts, opts);

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders(classifyError(err)));
    return res.send(renderError(err.message, { colors, font }));
  }
};
