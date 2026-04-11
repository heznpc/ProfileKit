const { renderMatrixCard } = require("../src/cards/matrix");
const { parseSearchParams, resolveCardOptions } = require("../src/common/options");
const {
  parseColor,
  parseFloatSafe,
  parseIntSafe,
  cacheHeaders,
} = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const svg = renderMatrixCard({
    ...opts,
    text: params.get("text"),
    color: parseColor(params.get("color")),
    width: parseIntSafe(params.get("width"), 600),
    height: parseIntSafe(params.get("height"), 200),
    density: parseFloatSafe(params.get("density"), 1),
    speed: parseFloatSafe(params.get("speed"), 1),
    seed: parseIntSafe(params.get("seed"), 42),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
