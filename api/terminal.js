const { renderTerminalCard } = require("../src/cards/terminal");
const { getTheme } = require("../src/common/themes");
const {
  parseBoolean,
  parseColor,
  parseIntSafe,
  parseArray,
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

  const commands = parseArray(params.get("commands"));
  if (commands.length === 0) {
    commands.push("whoami", "ls -la");
  }

  const svg = renderTerminalCard({
    commands,
    prompt: params.get("prompt") || "$",
    windowTitle: params.get("window_title") || "bash",
    color: parseColor(params.get("color")),
    width: parseIntSafe(params.get("width"), 600),
    speed: parseIntSafe(params.get("speed"), 70),
    pause: parseIntSafe(params.get("pause"), 600),
    font: params.get("font"),
    fontSize: parseIntSafe(params.get("size"), 14),
    colors,
    borderRadius: params.has("border_radius")
      ? parseIntSafe(params.get("border_radius"), 8)
      : undefined,
    hideBorder: parseBoolean(params.get("hide_border")),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
