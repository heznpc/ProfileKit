const { renderSocialCard } = require("../src/cards/social");
const { renderError } = require("../src/common/card");
const { parseSearchParams, parseCardOptions } = require("../src/common/options");
const { cacheHeaders, errorCacheHeaders } = require("../src/common/utils");

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
  const params = parseSearchParams(req);
  const opts = parseCardOptions(params);
  const { colors, font } = opts;

  const layout = params.get("layout") || "default";

  res.setHeader("Content-Type", "image/svg+xml");

  const links = parseLinks(params);
  if (links.length === 0) {
    res.setHeader("Cache-Control", errorCacheHeaders());
    return res.send(
      renderError("No links provided. Use ?github=user&linkedin=user&...", { colors, font })
    );
  }

  const svg = renderSocialCard(links, { ...opts, layout });
  res.setHeader("Cache-Control", cacheHeaders());
  return res.send(svg);
};
