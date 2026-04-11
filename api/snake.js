const { renderSnakeCard } = require("../src/cards/snake");
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

  const svg = renderSnakeCard({
    ...opts,
    color: parseColor(params.get("color")),
    emptyColor: parseColor(params.get("empty_color")),
    width: params.has("width") ? parseIntSafe(params.get("width"), 0) : null,
    height: params.has("height") ? parseIntSafe(params.get("height"), 0) : null,
    cols: parseIntSafe(params.get("cols"), 53),
    rows: parseIntSafe(params.get("rows"), 7),
    cellSize: parseIntSafe(params.get("cell_size"), 11),
    cellGap: parseIntSafe(params.get("cell_gap"), 3),
    duration: parseFloatSafe(params.get("duration"), 24),
    seed: parseIntSafe(params.get("seed"), 7),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
