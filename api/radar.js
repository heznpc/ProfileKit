const { renderRadarCard } = require("../src/cards/radar");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const {
  parseColor,
  parseFloatSafe,
  parseIntSafe,
  cacheHeaders,
} = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);

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
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
