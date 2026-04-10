const { fetchRepo } = require("../src/fetchers/pin");
const { renderPinCard } = require("../src/cards/pin");
const { renderError } = require("../src/common/card");
const { getTheme } = require("../src/common/themes");
const {
  parseBoolean,
  parseIntSafe,
  parseRadius,
  cacheHeaders,
  errorCacheHeaders,
} = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const font = params.get("font");
  const username = params.get("username");
  const repo = params.get("repo");
  const theme = params.get("theme") || "dark";
  const hideBorder = parseBoolean(params.get("hide_border"));
  const hideBar = parseBoolean(params.get("hide_bar"));
  const borderRadius = parseRadius(params.get("border_radius"), undefined);
  const cardWidth = params.has("card_width")
    ? parseIntSafe(params.get("card_width"), 400)
    : undefined;
  const description = params.get("description");

  const colors = getTheme(theme, {
    bg: params.get("bg_color"),
    text: params.get("text_color"),
    title: params.get("title_color"),
    icon: params.get("icon_color"),
    border: params.get("border_color"),
    accent: params.get("accent_color"),
  });

  res.setHeader("Content-Type", "image/svg+xml");

  if (!username || !repo) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("Missing ?username= and ?repo= parameters", { colors, width: cardWidth, font }));
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN not configured");

    const repoData = await fetchRepo(username, repo, token);
    const svg = renderPinCard(repoData, {
      colors,
      hideBorder,
      hideBar,
      borderRadius,
      cardWidth,
      description,
      font,
    });

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError(err.message, { colors, width: cardWidth, font }));
  }
};
