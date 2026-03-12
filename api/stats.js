const { fetchStats } = require("../src/fetchers/stats");
const { renderStatsCard } = require("../src/cards/stats");
const { renderError } = require("../src/common/card");
const { getTheme } = require("../src/common/themes");
const {
  parseBoolean,
  parseArray,
  parseIntSafe,
  cacheHeaders,
  errorCacheHeaders,
} = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const username = params.get("username");
  const theme = params.get("theme") || "dark";
  const hide = parseArray(params.get("hide"));
  const hideBorder = parseBoolean(params.get("hide_border"));
  const hideTitle = parseBoolean(params.get("hide_title"));
  const hideBar = parseBoolean(params.get("hide_bar"));
  const borderRadius = params.has("border_radius") ? parseIntSafe(params.get("border_radius"), 6) : undefined;
  const title = params.get("title");

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
    return res.send(renderError("Missing ?username= parameter", colors));
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN not configured");

    const stats = await fetchStats(username, token);
    const svg = renderStatsCard(stats, { colors, hide, hideBorder, hideTitle, hideBar, borderRadius, title });

    res.setHeader("Cache-Control", cacheHeaders());
    return res.send(svg);
  } catch (err) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(renderError(err.message, colors));
  }
};
