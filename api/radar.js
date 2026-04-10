const { renderRadarCard } = require("../src/cards/radar");
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

  const svg = renderRadarCard({
    text: params.get("text"),
    color: parseColor(params.get("color")),
    width: parseIntSafe(params.get("width"), 300),
    height: parseIntSafe(params.get("height"), 300),
    blips: parseIntSafe(params.get("blips"), 5),
    speed: parseFloatSafe(params.get("speed"), 4),
    colors,
    borderRadius: parseRadius(params.get("border_radius"), undefined),
    hideBorder: parseBoolean(params.get("hide_border")),
    seed: parseIntSafe(params.get("seed"), 23),
    font: params.get("font"),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
