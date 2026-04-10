const { renderTypingCard } = require("../src/cards/typing");
const { renderError } = require("../src/common/card");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const {
  parseBoolean,
  parseColor,
  parseArray,
  parseIntSafe,
  cacheHeaders,
  errorCacheHeaders,
} = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);
  const { colors, font } = opts;

  const lines = parseArray(params.get("lines"));

  res.setHeader("Content-Type", "image/svg+xml");

  if (lines.length === 0) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("Missing ?lines= parameter", { colors, font }));
  }

  const svg = renderTypingCard({
    ...opts,
    lines,
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
  });

  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
