const { renderSectionCard } = require("../src/cards/section");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const { parseColor, parseIntSafe, cacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);

  const svg = renderSectionCard({
    ...opts,
    title: params.get("title") || "Section",
    subtitle: params.get("subtitle"),
    align: params.get("align") || "left",
    color: parseColor(params.get("color")),
    width: parseIntSafe(params.get("width"), 800),
    height: params.has("height") ? parseIntSafe(params.get("height"), 70) : null,
    icon: params.get("icon"),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
