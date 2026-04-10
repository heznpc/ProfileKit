const { renderMatrixCard } = require("../src/cards/matrix");
const { getTheme } = require("../src/common/themes");
const {
  parseBoolean,
  parseColor,
  parseFloatSafe,
  parseIntSafe,
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

  const svg = renderMatrixCard({
    text: params.get("text"),
    color: parseColor(params.get("color")),
    width: parseIntSafe(params.get("width"), 600),
    height: parseIntSafe(params.get("height"), 200),
    density: parseFloatSafe(params.get("density"), 1),
    speed: parseFloatSafe(params.get("speed"), 1),
    colors,
    borderRadius: params.has("border_radius")
      ? parseIntSafe(params.get("border_radius"), 6)
      : undefined,
    hideBorder: parseBoolean(params.get("hide_border")),
    seed: parseIntSafe(params.get("seed"), 42),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
