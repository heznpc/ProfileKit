const { renderTypingCard } = require("../src/cards/typing");
const { getTheme } = require("../src/common/themes");
const {
  parseBoolean,
  parseColor,
  parseArray,
  parseIntSafe,
  cacheHeaders,
} = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const lines = parseArray(params.get("lines"));
  const theme = params.get("theme") || "dark";
  // Note: bg_color is consumed directly via the bgColor prop on the card, not
  // as a getTheme override. Routing it through both creates a double meaning.
  const colors = getTheme(theme, {
    text: params.get("text_color"),
    title: params.get("title_color"),
    icon: params.get("icon_color"),
    border: params.get("border_color"),
    accent: params.get("accent_color"),
  });

  if (lines.length === 0) {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(
      `<svg width="400" height="40" xmlns="http://www.w3.org/2000/svg">
        <text x="20" y="25" fill="#f85149" font-size="14" font-family="monospace">Missing ?lines= parameter</text>
      </svg>`
    );
  }

  const svg = renderTypingCard({
    lines,
    font: params.get("font") || "monospace",
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
    borderRadius: params.has("border_radius")
      ? parseIntSafe(params.get("border_radius"), 6)
      : undefined,
    colors,
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
