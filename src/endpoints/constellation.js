const { renderConstellationCard } = require("../cards/constellation");
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
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
