const { fetchLeetcode } = require("../src/fetchers/leetcode");
const { renderLeetcodeCard } = require("../src/cards/leetcode");
const { renderError } = require("../src/common/card");
const { parseSearchParams, resolveCardOptions } = require("../src/common/options");
const {
  cacheHeaders,
  errorCacheHeaders,
  classifyError,
} = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);
  const { colors, font } = opts;

  const username = params.get("username");

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);

  if (!username) {
    res.setHeader("Cache-Control", errorCacheHeaders("bad_input"));
    return res.send(renderError("Missing ?username= parameter", { colors, font }));
  }

  try {
    const stats = await fetchLeetcode(username);
    const svg = renderLeetcodeCard(stats, opts);

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders(classifyError(err)));
    return res.send(renderError(err.message, { colors, font }));
  }
};
