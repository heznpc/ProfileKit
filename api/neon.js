const { renderNeonCard } = require("../src/cards/neon");
const { parseSearchParams, resolveCardOptions } = require("../src/common/options");
const { parseColor, parseIntSafe, cacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const svg = renderNeonCard({
    ...opts,
    text: params.get("text") || "NEON",
    color: parseColor(params.get("color")),
    size: parseIntSafe(params.get("size"), 64),
    width: parseIntSafe(params.get("width"), 600),
    height: parseIntSafe(params.get("height"), 160),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
