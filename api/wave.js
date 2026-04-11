const { renderWaveCard } = require("../src/cards/wave");
const { parseSearchParams, resolveCardOptions } = require("../src/common/options");
const { parseColor, parseIntSafe, cacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const svg = renderWaveCard({
    ...opts,
    text: params.get("text"),
    color: parseColor(params.get("color")),
    width: parseIntSafe(params.get("width"), 800),
    height: parseIntSafe(params.get("height"), 160),
    waves: parseIntSafe(params.get("waves"), 3),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
