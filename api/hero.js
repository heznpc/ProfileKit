const { renderHeroCard } = require("../src/cards/hero");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const { parseColor, parseIntSafe, cacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);

  const svg = renderHeroCard({
    ...opts,
    name: params.get("name") || "Hello, World",
    subtitle: params.get("subtitle"),
    bg: params.get("bg") || "gradient",
    color: parseColor(params.get("color")),
    width: parseIntSafe(params.get("width"), 1200),
    height: parseIntSafe(params.get("height"), 280),
    align: params.get("align") || "center",
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
