const { fetchStats } = require("../fetchers/stats");
const { renderStatsCard } = require("../cards/stats");
const { renderError } = require("../common/card");
const { parseSearchParams, resolveCardOptions } = require("../common/options");
const {
  parseArray,
  cacheHeaders,
  errorCacheHeaders,
  classifyError,
} = require("../common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);
  const { colors, font } = opts;

  const username = params.get("username");
  const hide = parseArray(params.get("hide"));
  const layout = params.get("layout");

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);

  if (!username) {
    res.setHeader("Cache-Control", errorCacheHeaders("bad_input"));
    return res.send(renderError("Missing ?username= parameter", { colors, font }));
  }

  try {
    // Token pool handling lives in src/common/github-token via withRotation
    // inside fetchStats — missing/invalid/rate-limited tokens are surfaced
    // here as thrown errors and rendered as the error card.
    const stats = await fetchStats(username);
    const svg = renderStatsCard(stats, { ...opts, hide, layout });

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders(classifyError(err)));
    return res.send(renderError(err.message, { colors, font }));
  }
};
