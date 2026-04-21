const { renderHeartbeatCard } = require("../cards/heartbeat");
const { parseSearchParams, resolveCardOptions } = require("../common/options");
const { parseColor, parseIntSafe, cacheHeaders } = require("../common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const svg = renderHeartbeatCard({
    ...opts,
    text: params.get("text"),
    color: parseColor(params.get("color")),
    bpm: parseIntSafe(params.get("bpm"), 72),
    width: parseIntSafe(params.get("width"), 495),
    height: parseIntSafe(params.get("height"), 140),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
