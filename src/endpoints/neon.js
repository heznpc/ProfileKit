const { renderNeonCard } = require("../cards/neon");
const { parseSearchParams, resolveCardOptions, parseSvgWidth, parseSvgHeight } = require("../common/options");
const { parseColor, parseIntSafe, cacheHeaders } = require("../common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const svg = renderNeonCard({
    ...opts,
    text: params.get("text") || "NEON",
    color: parseColor(params.get("color")),
    size: parseIntSafe(params.get("size"), 64, 8, 160),
    width: parseSvgWidth(params.get("width"), 600),
    height: parseSvgHeight(params.get("height"), 160),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
