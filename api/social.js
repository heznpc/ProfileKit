const { renderSocialCard } = require("../src/cards/social");
const { renderError } = require("../src/common/card");
const { getTheme } = require("../src/common/themes");
const {
  parseBoolean,
  parseIntSafe,
  cacheHeaders,
  errorCacheHeaders,
} = require("../src/common/utils");

function parseLinks(params) {
  const types = {
    github: (v) => ({ type: "github", label: v, url: `https://github.com/${v}` }),
    linkedin: (v) => ({ type: "linkedin", label: v, url: `https://linkedin.com/in/${v}` }),
    x: (v) => ({ type: "x", label: `@${v}`, url: `https://x.com/${v}` }),
    email: (v) => ({ type: "email", label: v, url: `mailto:${v}` }),
    website: (v) => ({ type: "website", label: v.replace(/^https?:\/\//, ""), url: v.startsWith("http") ? v : `https://${v}` }),
    youtube: (v) => ({ type: "youtube", label: v, url: `https://youtube.com/@${v}` }),
  };

  const links = [];
  for (const [key, builder] of Object.entries(types)) {
    const value = params.get(key);
    if (value) links.push(builder(value));
  }
  return links;
}

module.exports = async (req, res) => {
  const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const theme = params.get("theme") || "dark";
  const hideBorder = parseBoolean(params.get("hide_border"));
  const hideBar = parseBoolean(params.get("hide_bar"));
  const borderRadius = params.has("border_radius") ? parseIntSafe(params.get("border_radius"), 6) : undefined;
  const title = params.get("title");
  const layout = params.get("layout") || "default";

  const colors = getTheme(theme, {
    bg: params.get("bg_color"),
    text: params.get("text_color"),
    title: params.get("title_color"),
    icon: params.get("icon_color"),
    border: params.get("border_color"),
    accent: params.get("accent_color"),
  });

  res.setHeader("Content-Type", "image/svg+xml");

  const links = parseLinks(params);
  if (links.length === 0) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(
      renderError("No links provided. Use ?github=user&linkedin=user&...", colors)
    );
  }

  const svg = renderSocialCard(links, { colors, hideBorder, hideBar, borderRadius, title, layout });
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
