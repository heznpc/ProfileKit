const { renderEqualizerCard } = require("../src/cards/equalizer");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const { parseColor, parseIntSafe, cacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);

  const svg = renderEqualizerCard({
    ...opts,
    bars: parseIntSafe(params.get("bars"), 24),
    color: parseColor(params.get("color")),
    label: params.get("label"),
    width: parseIntSafe(params.get("width"), 495),
    height: parseIntSafe(params.get("height"), 140),
    seed: parseIntSafe(params.get("seed"), 11),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
