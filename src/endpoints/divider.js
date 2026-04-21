const { renderDividerCard } = require("../cards/divider");
const { parseSearchParams, resolveCardOptions } = require("../common/options");
const { parseColor, parseIntSafe, cacheHeaders } = require("../common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const svg = renderDividerCard({
    ...opts,
    style: params.get("style") || "line",
    color: parseColor(params.get("color")),
    width: parseIntSafe(params.get("width"), 800),
    height: parseIntSafe(params.get("height"), 30),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
