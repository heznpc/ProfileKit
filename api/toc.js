const { renderTocCard } = require("../src/cards/toc");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const { cacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);

  const svg = renderTocCard(params.get("items"), opts);

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
