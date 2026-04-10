const { renderTimelineCard } = require("../src/cards/timeline");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const { cacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);

  const svg = renderTimelineCard(params.get("items"), opts);

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
