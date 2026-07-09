const { renderWaveCard } = require("../cards/wave");
const { parseSearchParams, resolveCardOptions, parseSvgWidth, parseSvgHeight } = require("../common/options");
const { parseColor, parseIntSafe, cacheHeaders } = require("../common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const svg = renderWaveCard({
    ...opts,
    text: params.get("text"),
    color: parseColor(params.get("color")),
    width: parseSvgWidth(params.get("width"), 800),
    height: parseSvgHeight(params.get("height"), 160),
    waves: parseIntSafe(params.get("waves"), 3, 1, 5),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
