const { renderTagsCard } = require("../src/cards/tags");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const { cacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);

  const svg = renderTagsCard(params.get("tags"), opts);

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
