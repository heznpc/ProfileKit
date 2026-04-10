const { fetchReviews } = require("../src/fetchers/reviews");
const { renderReviewsCard } = require("../src/cards/reviews");
const { renderError } = require("../src/common/card");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const { cacheHeaders, errorCacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);
  const { colors, font } = opts;

  const username = params.get("username");

  res.setHeader("Content-Type", "image/svg+xml");

  if (!username) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("Missing ?username= parameter", { colors, font }));
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("GITHUB_TOKEN not configured", { colors, font }));
  }

  try {
    const stats = await fetchReviews(username, token);
    const svg = renderReviewsCard(stats, opts);

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError(err.message, { colors, font }));
  }
};
