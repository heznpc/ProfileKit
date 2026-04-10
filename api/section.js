const { renderSectionCard } = require("../src/cards/section");
const { getTheme } = require("../src/common/themes");
const { parseColor, parseIntSafe, cacheHeaders } = require("../src/common/utils");

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

  const svg = renderSectionCard({
    title: params.get("title") || "Section",
    subtitle: params.get("subtitle"),
    align: params.get("align") || "left",
    color: parseColor(params.get("color")),
    width: parseIntSafe(params.get("width"), 800),
    height: params.has("height") ? parseIntSafe(params.get("height"), 70) : null,
    icon: params.get("icon"),
    colors,
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
