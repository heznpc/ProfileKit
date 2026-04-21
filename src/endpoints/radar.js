const { renderRadarCard } = require("../cards/radar");
const { parseSearchParams, resolveCardOptions } = require("../common/options");
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
    width: parseIntSafe(params.get("width"), 300),
    height: parseIntSafe(params.get("height"), 300),
    blips: parseIntSafe(params.get("blips"), 5),
    speed: parseFloatSafe(params.get("speed"), 4),
    seed: parseIntSafe(params.get("seed"), 23),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
