const { fetchLanguages } = require("../fetchers/languages");
const { renderLanguagesCard } = require("../cards/languages");
const { renderError } = require("../common/card");
const { parseSearchParams, resolveCardOptions } = require("../common/options");
const {
  parseBoolean,
  parseArray,
  parseIntSafe,
  cacheHeaders,
  errorCacheHeaders,
  classifyError,
} = require("../common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);
  const { colors, font } = opts;

  const username = params.get("username");
  const langsCount = parseIntSafe(params.get("langs_count"), 6, 1, 10);
  const hide = parseArray(params.get("hide"));
  const excludeRepo = parseArray(params.get("exclude_repo"));
  const compact = parseBoolean(params.get("compact"));
  const layout = params.get("layout");

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);

  if (!username) {
    res.setHeader("Cache-Control", errorCacheHeaders("bad_input"));
    return res.send(renderError("Missing ?username= parameter", { colors, font }));
  }

  try {
    // Token pool resolution lives inside fetchLanguages via withRotation.
    let languages = await fetchLanguages(username, null, excludeRepo);

    if (hide.length > 0) {
      const lower = hide.map((h) => h.toLowerCase());
      languages = languages.filter((l) => !lower.includes(l.name.toLowerCase()));
      const total = languages.reduce((sum, l) => sum + l.size, 0);
      languages = languages.map((l) => ({
        ...l,
        percentage: total > 0 ? +((l.size / total) * 100).toFixed(1) : 0,
      }));
    }

    languages = languages.slice(0, langsCount);

    const svg = renderLanguagesCard(languages, { ...opts, compact, layout });

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders(classifyError(err)));
    return res.send(renderError(err.message, { colors, font }));
  }
};
