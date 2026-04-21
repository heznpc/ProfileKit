const { renderTerminalCard } = require("../cards/terminal");
const { parseSearchParams, resolveCardOptions } = require("../common/options");
const {
  parseColor,
  parseIntSafe,
  parseArray,
  cacheHeaders,
} = require("../common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const commands = parseArray(params.get("commands"));
  if (commands.length === 0) {
    commands.push("whoami", "ls -la");
  }

  const svg = renderTerminalCard({
    ...opts,
    commands,
    prompt: params.get("prompt") || "$",
    windowTitle: params.get("window_title") || "bash",
    color: parseColor(params.get("color")),
    width: parseIntSafe(params.get("width"), 600),
    speed: parseIntSafe(params.get("speed"), 70),
    pause: parseIntSafe(params.get("pause"), 600),
    fontSize: parseIntSafe(params.get("size"), 14),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
