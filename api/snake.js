const { renderSnakeCard } = require("../src/cards/snake");
const { getTheme } = require("../src/common/themes");
const {
  parseBoolean,
  parseColor,
  parseFloatSafe,
  parseIntSafe,
  parseRadius,
  cacheHeaders,
} = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const theme = params.get("theme") || "dark";

  const colors = getTheme(theme, {
    bg: params.get("bg_color"),
    text: params.get("text_color"),
    title: params.get("title_color"),
    icon: params.get("icon_color"),
    border: params.get("border_color"),
    accent: params.get("accent_color"),
  });

  const svg = renderSnakeCard({
    color: parseColor(params.get("color")),
    emptyColor: parseColor(params.get("empty_color")),
    width: params.has("width") ? parseIntSafe(params.get("width"), 0) : null,
    height: params.has("height") ? parseIntSafe(params.get("height"), 0) : null,
    cols: parseIntSafe(params.get("cols"), 53),
    rows: parseIntSafe(params.get("rows"), 7),
    cellSize: parseIntSafe(params.get("cell_size"), 11),
    cellGap: parseIntSafe(params.get("cell_gap"), 3),
    duration: parseFloatSafe(params.get("duration"), 24),
    colors,
    borderRadius: parseRadius(params.get("border_radius"), undefined),
    hideBorder: parseBoolean(params.get("hide_border")),
    seed: parseIntSafe(params.get("seed"), 7),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
