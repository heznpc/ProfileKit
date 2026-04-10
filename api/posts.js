const { fetchPosts } = require("../src/fetchers/posts");
const { renderPostsCard } = require("../src/cards/posts");
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
  const source = params.get("source") || "devto";
  const username = params.get("username");
  const url = params.get("url");
  const count = parseIntSafe(params.get("count"), 5);
  const theme = params.get("theme") || "dark";

  const colors = getTheme(theme, {
    bg: params.get("bg_color"),
    text: params.get("text_color"),
    title: params.get("title_color"),
    icon: params.get("icon_color"),
    border: params.get("border_color"),
    accent: params.get("accent_color"),
  });

  res.setHeader("Content-Type", "image/svg+xml");

  if ((source === "devto" || source === "hashnode") && !username) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("Missing ?username= parameter", { colors, font }));
  }
  if (source === "rss" && !url) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("Missing ?url= parameter", { colors, font }));
  }
  if (source === "medium" && !username && !url) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError("Missing ?username= or ?url= parameter", { colors, font }));
  }

  try {
    const posts = await fetchPosts({ source, username, url, count });
    const svg = renderPostsCard(posts, {
      colors,
      hideBorder: parseBoolean(params.get("hide_border")),
      hideTitle: parseBoolean(params.get("hide_title")),
      hideBar: parseBoolean(params.get("hide_bar")),
      borderRadius: parseRadius(params.get("border_radius"), undefined),
      title: params.get("title"),
      cardWidth: params.has("card_width")
        ? parseIntSafe(params.get("card_width"), 495)
        : undefined,
      font,
    });

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError(err.message, { colors, font }));
  }
};
