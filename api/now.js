const { renderNowCard, NOW_FIELDS } = require("../src/cards/now");
const { parseSearchParams, resolveCardOptions } = require("../src/common/options");
const { cacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const values = {};
  for (const field of NOW_FIELDS) {
    const v = params.get(field.key);
    if (v) values[field.key] = v;
  }

  const svg = renderNowCard(values, opts);

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
