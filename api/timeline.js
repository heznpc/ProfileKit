const { renderTimelineCard } = require("../src/cards/timeline");
const { parseSearchParams, resolveCardOptions } = require("../src/common/options");
const { cacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const svg = renderTimelineCard(params.get("items"), opts);

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
