const { getRandomQuote, getDailyQuote } = require("../src/data/quotes");
const { renderQuoteCard } = require("../src/cards/quote");
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
  const hideBorder = parseBoolean(params.get("hide_border"));
  const hideBar = parseBoolean(params.get("hide_bar"));
  const borderRadius = parseRadius(params.get("border_radius"), undefined);
  const daily = parseBoolean(params.get("daily"));
  const width = parseIntSafe(params.get("width"), 495);

  const colors = getTheme(theme, {
    bg: params.get("bg_color"),
    text: params.get("text_color"),
    title: params.get("title_color"),
    icon: params.get("icon_color"),
    border: params.get("border_color"),
    accent: params.get("accent_color"),
  });

  const quote = daily ? getDailyQuote() : getRandomQuote();
  const svg = renderQuoteCard(quote, { colors, hideBorder, hideBar, borderRadius, width, font: params.get("font") });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader(
    "Cache-Control",
    daily
      ? "public, max-age=43200, s-maxage=43200"
      : cacheHeaders()
  );
  return res.send(svg);
};
