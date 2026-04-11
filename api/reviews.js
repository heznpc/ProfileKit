const { fetchReviews } = require("../src/fetchers/reviews");
const { renderReviewsCard } = require("../src/cards/reviews");
const { renderError } = require("../src/common/card");
const { parseSearchParams, resolveCardOptions } = require("../src/common/options");
const {
  cacheHeaders,
  errorCacheHeaders,
  classifyError,
} = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);
  const { colors, font } = opts;

  const username = params.get("username");

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);

  if (!username) {
    res.setHeader("Cache-Control", errorCacheHeaders("bad_input"));
    return res.send(renderError("Missing ?username= parameter", { colors, font }));
  }

  try {
    // Token pool resolution lives inside fetchReviews via withRotation.
    const stats = await fetchReviews(username);
    const svg = renderReviewsCard(stats, opts);

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders(classifyError(err)));
    return res.send(renderError(err.message, { colors, font }));
  }
};
