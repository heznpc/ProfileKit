const { renderTypingCard } = require("../src/cards/typing");
const { renderError } = require("../src/common/card");
const { getTheme } = require("../src/common/themes");
const {
  parseBoolean,
  parseColor,
  parseArray,
  parseIntSafe,
  parseRadius,
  cacheHeaders,
  errorCacheHeaders,
} = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const lines = parseArray(params.get("lines"));
  const theme = params.get("theme") || "dark";
  const font = params.get("font");
  // bg_color is consumed via the bgColor prop on the card, not as a getTheme
  // override — routing it through both creates a double meaning.
  const colors = getTheme(theme, {
    text: params.get("text_color"),
    title: params.get("title_color"),
    icon: params.get("icon_color"),
    border: params.get("border_color"),
    accent: params.get("accent_color"),
  });

  res.setHeader("Content-Type", "image/svg+xml");

  if (lines.length === 0) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("Missing ?lines= parameter", { colors, font }));
  }

  const svg = renderTypingCard({
    lines,
    font,
    size: parseIntSafe(params.get("size"), 20),
    weight: parseIntSafe(params.get("weight"), 400),
    color: parseColor(params.get("color")),
    bgColor: parseColor(params.get("bg_color")),
    width: parseIntSafe(params.get("width"), 500),
    height: parseIntSafe(params.get("height"), 50),
    speed: parseIntSafe(params.get("speed"), 100),
    pause: parseIntSafe(params.get("pause"), 1500),
    loop: params.get("loop") !== null ? parseBoolean(params.get("loop")) : true,
    cursor: params.get("cursor") !== null ? parseBoolean(params.get("cursor")) : true,
    cursorColor: parseColor(params.get("cursor_color")),
    cursorWidth: parseIntSafe(params.get("cursor_width"), 2),
    align: params.get("align") || "left",
    frame: parseBoolean(params.get("frame")),
    hideBorder: parseBoolean(params.get("hide_border")),
    hideBar: parseBoolean(params.get("hide_bar")),
    borderRadius: parseRadius(params.get("border_radius"), undefined),
    colors,
  });

  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
