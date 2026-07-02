// Single source of truth for the common card option surface.
//
// Every endpoint accepts the same baseline params (theme, font, hide_*,
// border_radius, card_width, color overrides). Defining the parsing logic
// here means new themes / new common options propagate to all endpoints with
// one edit instead of N. Endpoints with extra params still parse those
// locally — `parseCardOptions` only owns the shared surface.

const { getTheme, applyOverrides } = require("./themes");
const { parseBoolean, parseIntSafe, parseRadius } = require("./utils");
const { fetchExternalTheme } = require("./theme-url");

// Maps the public ?<color>_color= query keys to the palette keys consumed by
// `applyOverrides`. Centralized so `parseCardOptions` and `resolveCardOptions`
// stay in sync when a new color slot is added.
const COLOR_OVERRIDE_PARAMS = {
  bg: "bg_color",
  text: "text_color",
  title: "title_color",
  icon: "icon_color",
  border: "border_color",
  accent: "accent_color",
};

function readColorOverrides(params) {
  const out = {};
  for (const [key, paramName] of Object.entries(COLOR_OVERRIDE_PARAMS)) {
    out[key] = params.get(paramName);
  }
  return out;
}

// Use a fixed base origin instead of `req.headers.host`. The host header is
// untrusted in serverless environments and we only want the path + query
// parts of `req.url` anyway, so passing a constant origin avoids any chance
// of host-header injection ever surfacing through `searchParams`.
const FIXED_PARSE_BASE = "http://profilekit.local";

function parseSearchParams(req) {
  return new URL(req.url, FIXED_PARSE_BASE).searchParams;
}

// Outer bounds on `?card_width=`. Anything outside this range falls back to
// the 495 default. The upper bound protects against ?card_width=99999 style
// DoS attempts (SVG memory + CDN bandwidth); the lower bound keeps the card
// wide enough to fit the fixed padding + title without clipping.
const CARD_WIDTH_MIN = 200;
const CARD_WIDTH_MAX = 1600;

// Outer bounds for the free-form ?width=/?height= params on the layout
// endpoints (hero / divider / section). Unlike card_width these feed SVG
// generators whose work scales with the dimension — e.g. the hero/divider
// `wave` paths loop across the width — so an unbounded ?width=1000000000 would
// build a giant path string and blow the function's memory/time budget.
// Out-of-range values fall back to each endpoint's default (parseIntSafe
// semantics), same as card_width.
const SVG_WIDTH_MIN = 200;
const SVG_WIDTH_MAX = 2400;
const SVG_HEIGHT_MIN = 8;
const SVG_HEIGHT_MAX = 1200;

function parseCardOptions(params) {
  const theme = params.get("theme") || "dark";
  const colors = getTheme(theme, readColorOverrides(params));

  return {
    theme,
    colors,
    font: params.get("font"),
    title: params.get("title"),
    hideBorder: parseBoolean(params.get("hide_border")),
    hideTitle: parseBoolean(params.get("hide_title")),
    hideBar: parseBoolean(params.get("hide_bar")),
    borderRadius: parseRadius(params.get("border_radius"), undefined),
    cardWidth: params.has("card_width")
      ? parseIntSafe(params.get("card_width"), 495, CARD_WIDTH_MIN, CARD_WIDTH_MAX)
      : undefined,
  };
}

// `prefetched` lets /api/stack avoid N+1 gist fetches: stack.js resolves the
// top-level theme_url once, then passes { url, palette } (or { url, error })
// here for every child slot whose theme_url matches. A child that overrides
// with `<card>.theme_url=<different>` falls through to the live fetch path.
async function resolveCardOptions(params, prefetched = null) {
  const opts = parseCardOptions(params);
  const themeUrl = params.get("theme_url");
  if (!themeUrl) return { opts, themeError: null };

  if (prefetched && prefetched.url === themeUrl) {
    if (prefetched.error) return { opts, themeError: prefetched.error };
    const colors = applyOverrides(prefetched.palette, readColorOverrides(params));
    return { opts: { ...opts, colors }, themeError: null };
  }

  try {
    const externalPalette = await fetchExternalTheme(themeUrl);
    // External palette becomes the base; per-param color overrides still
    // win on top, mirroring the precedence of `?bg_color=` over `?theme=`.
    const colors = applyOverrides(externalPalette, readColorOverrides(params));
    return { opts: { ...opts, colors }, themeError: null };
  } catch (err) {
    // Fall back to whatever parseCardOptions resolved (the built-in `?theme=`
    // or default dark). The handler surfaces `themeError` as an
    // `X-Theme-Error` response header so callers can debug their payload.
    return { opts, themeError: err.message };
  }
}

// Single-shot prefetch for a top-level theme_url. Used by /api/stack to
// resolve the gist once and reuse for every slot via `resolveCardOptions`'s
// `prefetched` arg.
async function prefetchExternalTheme(themeUrl) {
  if (!themeUrl) return null;
  try {
    const palette = await fetchExternalTheme(themeUrl);
    return { url: themeUrl, palette };
  } catch (err) {
    return { url: themeUrl, error: err.message };
  }
}

module.exports = {
  parseCardOptions,
  resolveCardOptions,
  prefetchExternalTheme,
  parseSearchParams,
  CARD_WIDTH_MIN,
  CARD_WIDTH_MAX,
  SVG_WIDTH_MIN,
  SVG_WIDTH_MAX,
  SVG_HEIGHT_MIN,
  SVG_HEIGHT_MAX,
};
