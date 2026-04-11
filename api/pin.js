const { fetchRepo } = require("../src/fetchers/pin");
const { renderPinCard } = require("../src/cards/pin");
const { renderError } = require("../src/common/card");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const { cacheHeaders, errorCacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);
  const { colors, font, cardWidth } = opts;

  const username = params.get("username");
  const repo = params.get("repo");
  const description = params.get("description");

  res.setHeader("Content-Type", "image/svg+xml");

  if (!username || !repo) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(
      renderError("Missing ?username= and ?repo= parameters", { colors, width: cardWidth, font })
    );
  }

  try {
    // Token pool resolution lives inside fetchRepo via withRotation.
    const repoData = await fetchRepo(username, repo);
    const svg = renderPinCard(repoData, { ...opts, description });

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError(err.message, { colors, width: cardWidth, font }));
  }
};
