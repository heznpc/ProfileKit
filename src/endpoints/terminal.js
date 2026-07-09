const { renderTerminalCard } = require("../cards/terminal");
const { parseSearchParams, resolveCardOptions, parseSvgWidth } = require("../common/options");
const {
  parseColor,
  parseIntSafe,
  parseArray,
  cacheHeaders,
} = require("../common/utils");

const MAX_COMMANDS = 8;

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const commands = parseArray(params.get("commands")).slice(0, MAX_COMMANDS);
  if (commands.length === 0) {
    commands.push("whoami", "ls -la");
  }

  const svg = renderTerminalCard({
    ...opts,
    commands,
    prompt: params.get("prompt") || "$",
    windowTitle: params.get("window_title") || "bash",
    color: parseColor(params.get("color")),
    width: parseSvgWidth(params.get("width"), 600),
    speed: parseIntSafe(params.get("speed"), 70, 10, 500),
    pause: parseIntSafe(params.get("pause"), 600, 0, 5000),
    fontSize: parseIntSafe(params.get("size"), 14, 8, 32),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};

module.exports.MAX_COMMANDS = MAX_COMMANDS;
