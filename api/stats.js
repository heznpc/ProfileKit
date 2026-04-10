const { fetchStats } = require("../src/fetchers/stats");
const { renderStatsCard } = require("../src/cards/stats");
const { renderError } = require("../src/common/card");
const { parseSearchParams, resolveCardOptions } = require("../src/common/options");
const { parseArray, cacheHeaders, errorCacheHeaders } = require("../src/common/utils");

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
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("Missing ?username= parameter", { colors, font }));
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN not configured");

    const stats = await fetchStats(username, token);
    const svg = renderStatsCard(stats, { ...opts, hide, layout });

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError(err.message, { colors, font }));
  }
};
