const { renderEqualizerCard } = require("../cards/equalizer");
const { parseSearchParams, resolveCardOptions, parseSvgWidth, parseSvgHeight } = require("../common/options");
const { parseColor, parseIntSafe, cacheHeaders } = require("../common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const svg = renderEqualizerCard({
    ...opts,
    bars: parseIntSafe(params.get("bars"), 24, 4, 60),
    color: parseColor(params.get("color")),
    label: params.get("label"),
    width: parseSvgWidth(params.get("width"), 495),
    height: parseSvgHeight(params.get("height"), 140),
    seed: parseIntSafe(params.get("seed"), 11),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
