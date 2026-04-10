const { renderTimelineCard } = require("../src/cards/timeline");
const { getTheme } = require("../src/common/themes");
const {
  parseBoolean,
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

  const svg = renderTimelineCard(params.get("items"), {
    colors,
    hideBorder: parseBoolean(params.get("hide_border")),
    hideTitle: parseBoolean(params.get("hide_title")),
    hideBar: parseBoolean(params.get("hide_bar")),
    borderRadius: parseRadius(params.get("border_radius"), undefined),
    title: params.get("title"),
    cardWidth: params.has("card_width")
      ? parseIntSafe(params.get("card_width"), 495)
      : undefined,
    font: params.get("font"),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
