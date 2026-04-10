const { renderEqualizerCard } = require("../src/cards/equalizer");
const { getTheme } = require("../src/common/themes");
const {
  parseBoolean,
  parseColor,
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

  const svg = renderEqualizerCard({
    bars: parseIntSafe(params.get("bars"), 24),
    color: parseColor(params.get("color")),
    label: params.get("label"),
    width: parseIntSafe(params.get("width"), 495),
    height: parseIntSafe(params.get("height"), 140),
    colors,
    borderRadius: parseRadius(params.get("border_radius"), undefined),
    hideBorder: parseBoolean(params.get("hide_border")),
    seed: parseIntSafe(params.get("seed"), 11),
    font: params.get("font"),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
