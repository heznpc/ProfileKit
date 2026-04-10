const { renderGlitchCard } = require("../src/cards/glitch");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const { parseColor, parseIntSafe, cacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);

  const svg = renderGlitchCard({
    ...opts,
    text: params.get("text") || "GLITCH",
    color: parseColor(params.get("color")),
    size: parseIntSafe(params.get("size"), 64),
    width: parseIntSafe(params.get("width"), 600),
    height: parseIntSafe(params.get("height"), 160),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
