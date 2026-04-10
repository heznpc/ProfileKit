const { renderConstellationCard } = require("../src/cards/constellation");
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

  const svg = renderConstellationCard({
    ...opts,
    text: params.get("text"),
    color: parseColor(params.get("color")),
    width: parseIntSafe(params.get("width"), 600),
    height: parseIntSafe(params.get("height"), 200),
    density: parseFloatSafe(params.get("density"), 1),
    seed: parseIntSafe(params.get("seed"), 19),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
