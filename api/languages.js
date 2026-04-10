const { fetchLanguages } = require("../src/fetchers/languages");
const { renderLanguagesCard } = require("../src/cards/languages");
const { renderError } = require("../src/common/card");
const { getTheme } = require("../src/common/themes");
const {
  parseBoolean,
  parseArray,
  parseIntSafe,
  parseRadius,
  cacheHeaders,
  errorCacheHeaders,
} = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const font = params.get("font");
  const username = params.get("username");
  const theme = params.get("theme") || "dark";
  const langsCount = parseIntSafe(params.get("langs_count"), 6);
  const hide = parseArray(params.get("hide"));
  const excludeRepo = parseArray(params.get("exclude_repo"));
  const hideBorder = parseBoolean(params.get("hide_border"));
  const hideTitle = parseBoolean(params.get("hide_title"));
  const hideBar = parseBoolean(params.get("hide_bar"));
  const borderRadius = parseRadius(params.get("border_radius"), undefined);
  const title = params.get("title");
  const compact = parseBoolean(params.get("compact"));
  const layout = params.get("layout");
  const cardWidth = params.has("card_width") ? parseIntSafe(params.get("card_width"), 495) : undefined;

  const colors = getTheme(theme, {
    bg: params.get("bg_color"),
    text: params.get("text_color"),
    title: params.get("title_color"),
    icon: params.get("icon_color"),
    border: params.get("border_color"),
    accent: params.get("accent_color"),
  });

  res.setHeader("Content-Type", "image/svg+xml");

  if (!username) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("Missing ?username= parameter", { colors, font }));
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN not configured");

    let languages = await fetchLanguages(username, token, excludeRepo);

    if (hide.length > 0) {
      const lower = hide.map((h) => h.toLowerCase());
      languages = languages.filter((l) => !lower.includes(l.name.toLowerCase()));
      const total = languages.reduce((sum, l) => sum + l.size, 0);
      languages = languages.map((l) => ({
        ...l,
        percentage: total > 0 ? +((l.size / total) * 100).toFixed(1) : 0,
      }));
    }

    languages = languages.slice(0, Math.min(langsCount, 10));

    const svg = renderLanguagesCard(languages, {
      colors,
      hideBorder,
      hideTitle,
      hideBar,
      borderRadius,
      title,
      compact,
      layout,
      cardWidth,
      font,
    });

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError(err.message, { colors, font }));
  }
};
