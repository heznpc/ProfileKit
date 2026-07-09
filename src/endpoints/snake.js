const { renderSnakeCard } = require("../cards/snake");
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

  const svg = renderSnakeCard({
    ...opts,
    color: parseColor(params.get("color")),
    emptyColor: parseColor(params.get("empty_color")),
    width: params.has("width") ? parseSvgWidth(params.get("width"), 0) : null,
    height: params.has("height") ? parseSvgHeight(params.get("height"), 0) : null,
    cols: parseIntSafe(params.get("cols"), 53, 1, 100),
    rows: parseIntSafe(params.get("rows"), 7, 1, 20),
    cellSize: parseIntSafe(params.get("cell_size"), 11, 4, 24),
    cellGap: parseIntSafe(params.get("cell_gap"), 3, 0, 10),
    duration: parseFloatSafe(params.get("duration"), 24, 2, 120),
    seed: parseIntSafe(params.get("seed"), 7),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
