const { renderRadarCard } = require("../cards/radar");
const { parseSearchParams, resolveCardOptions, parseSvgWidth, parseSvgHeight } = require("../common/options");
const {
  parseColor,
  parseFloatSafe,
  parseIntSafe,
  cacheHeaders,
} = require("../common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const svg = renderRadarCard({
    ...opts,
    text: params.get("text"),
    color: parseColor(params.get("color")),
    width: parseSvgWidth(params.get("width"), 300),
    height: parseSvgHeight(params.get("height"), 300),
    blips: parseIntSafe(params.get("blips"), 5, 0, 20),
    speed: parseFloatSafe(params.get("speed"), 4, 1, 60),
    seed: parseIntSafe(params.get("seed"), 23),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
