// /api/stack — compose multiple cards into a single vertically-stacked SVG.
// Top-level params apply to every card; `?<card>.<param>=` overrides one
// card. Per-card failures render an inline error in that slot only. Card
// list and syntax are documented in the README "Composition" section; the
// authoritative supported list is `SUPPORTED_CARDS` (= keys of `BUILDERS`).

const { renderHeroCard } = require("../src/cards/hero");
const { renderSectionCard } = require("../src/cards/section");
const { renderDividerCard } = require("../src/cards/divider");
const { renderNowCard, NOW_FIELDS } = require("../src/cards/now");
const { renderTimelineCard } = require("../src/cards/timeline");
const { renderTagsCard } = require("../src/cards/tags");
const { renderTocCard } = require("../src/cards/toc");
const { renderStatsCard } = require("../src/cards/stats");
const { renderLanguagesCard } = require("../src/cards/languages");

const { fetchStats } = require("../src/fetchers/stats");
const { fetchLanguages } = require("../src/fetchers/languages");

const { renderError } = require("../src/common/card");
const { stackVertical } = require("../src/common/stack");
const {
  parseSearchParams,
  resolveCardOptions,
} = require("../src/common/options");
const {
  parseArray,
  parseColor,
  parseIntSafe,
  cacheHeaders,
  errorCacheHeaders,
} = require("../src/common/utils");

const BUILDERS = {
  hero: async (params, opts) =>
    renderHeroCard({
      ...opts,
      name: params.get("name") || "Hello, World",
      subtitle: params.get("subtitle"),
      bg: params.get("bg") || "gradient",
      color: parseColor(params.get("color")),
      width: parseIntSafe(params.get("width"), 1200),
      height: parseIntSafe(params.get("height"), 280),
      align: params.get("align") || "center",
    }),

  section: async (params, opts) =>
    renderSectionCard({
      ...opts,
      title: params.get("title") || "Section",
      subtitle: params.get("subtitle"),
      align: params.get("align") || "left",
      color: parseColor(params.get("color")),
      width: parseIntSafe(params.get("width"), 800),
      height: params.has("height") ? parseIntSafe(params.get("height"), 70) : null,
      icon: params.get("icon"),
    }),

  divider: async (params, opts) =>
    renderDividerCard({
      ...opts,
      style: params.get("style") || "line",
      color: parseColor(params.get("color")),
      width: parseIntSafe(params.get("width"), 800),
      height: parseIntSafe(params.get("height"), 30),
    }),

  now: async (params, opts) => {
    const values = {};
    for (const f of NOW_FIELDS) {
      const v = params.get(f.key);
      if (v) values[f.key] = v;
    }
    return renderNowCard(values, opts);
  },

  timeline: async (params, opts) =>
    renderTimelineCard(params.get("items"), opts),

  tags: async (params, opts) => renderTagsCard(params.get("tags"), opts),

  toc: async (params, opts) => renderTocCard(params.get("items"), opts),

  stats: async (params, opts) => {
    const username = params.get("username");
    if (!username) throw new Error("missing username");
    // Token pool resolution lives inside fetchStats (withRotation). A
    // missing pool throws "GITHUB_TOKEN not configured" which the per-slot
    // error handler renders as an inline error card.
    const data = await fetchStats(username);
    return renderStatsCard(data, {
      ...opts,
      hide: parseArray(params.get("hide")),
      layout: params.get("layout"),
    });
  },

  languages: async (params, opts) => {
    const username = params.get("username");
    if (!username) throw new Error("missing username");
    const langsCount = parseIntSafe(params.get("langs_count"), 6, 1, 10);
    const hide = parseArray(params.get("hide"));
    const excludeRepo = parseArray(params.get("exclude_repo"));
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
    return renderLanguagesCard(languages, {
      ...opts,
      layout: params.get("layout"),
    });
  },
};

// Upper bound on cards per stack. Each card = up to one GitHub call, so
// `?cards=stats,stats,stats,...,stats` with no cap would burn a rate-limit
// bucket in one HTTP request. 8 is generous for real profiles (hero +
// section + stats + languages + now + timeline + tags + toc = 8).
const MAX_CARDS_PER_STACK = 8;

const SUPPORTED_CARDS = Object.keys(BUILDERS);

// Reserved at the top level — never propagate to per-card scopes.
const RESERVED_KEYS = new Set(["cards", "gap"]);
const CARD_KEY_SEPARATOR = ".";

// Build a per-card view of the search params: top-level keys (no separator)
// apply, then `<card>.<key>` keys override.
function scopeParams(params, cardName) {
  const out = new URLSearchParams();
  const prefix = `${cardName}${CARD_KEY_SEPARATOR}`;
  for (const [k, v] of params.entries()) {
    if (RESERVED_KEYS.has(k)) continue;
    if (k.includes(CARD_KEY_SEPARATOR)) continue;
    out.set(k, v);
  }
  for (const [k, v] of params.entries()) {
    if (k.startsWith(prefix)) {
      out.set(k.slice(prefix.length), v);
    }
  }
  return out;
}

async function buildStack(params) {
  const themeErrors = [];
  const { opts: baseOpts, themeError: baseThemeError } =
    await resolveCardOptions(params);
  if (baseThemeError) themeErrors.push(`base: ${baseThemeError}`);

  const cardList = parseArray(params.get("cards"));
  const gap = parseIntSafe(params.get("gap"), 16, 0, 200);

  if (!cardList.length) {
    return {
      svg: renderError(
        "Missing ?cards= parameter (comma-separated list)",
        baseOpts
      ),
      ok: false,
      themeErrors,
    };
  }

  if (cardList.length > MAX_CARDS_PER_STACK) {
    return {
      svg: renderError(
        `Too many cards in ?cards= (got ${cardList.length}, max ${MAX_CARDS_PER_STACK})`,
        baseOpts
      ),
      ok: false,
      themeErrors,
    };
  }

  // Resolve every card in parallel. Data builders (stats, languages) hit
  // GitHub independently, so a 2-data-card stack drops from ~600ms serial to
  // ~300ms. Pure builders cost ~nothing in parallel either way. Slot order
  // is preserved by the indexed Promise.all result.
  const slots = await Promise.all(
    cardList.map(async (cardName) => {
      const builder = BUILDERS[cardName];
      if (!builder) {
        return {
          svg: renderError(
            `Unknown card "${cardName}". Supported: ${SUPPORTED_CARDS.join(", ")}`,
            baseOpts
          ),
        };
      }
      const scoped = scopeParams(params, cardName);
      const { opts: cardOpts, themeError: cardThemeError } =
        await resolveCardOptions(scoped);
      try {
        const svg = await builder(scoped, cardOpts);
        return { svg, themeError: cardThemeError, cardName };
      } catch (err) {
        return {
          svg: renderError(`${cardName}: ${err.message}`, cardOpts),
          themeError: cardThemeError,
          cardName,
        };
      }
    })
  );

  for (const slot of slots) {
    if (slot.themeError) themeErrors.push(`${slot.cardName}: ${slot.themeError}`);
  }

  return {
    svg: stackVertical(slots.map((s) => s.svg), { gap }),
    ok: true,
    themeErrors,
  };
}

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { svg, ok, themeErrors } = await buildStack(params);

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", ok ? cacheHeaders() : errorCacheHeaders());
  if (themeErrors && themeErrors.length) {
    res.setHeader("X-Theme-Error", themeErrors.join("; "));
  }
  return res.send(svg);
};

// Exported for tests.
module.exports.buildStack = buildStack;
module.exports.SUPPORTED_CARDS = SUPPORTED_CARDS;
module.exports.scopeParams = scopeParams;
module.exports.MAX_CARDS_PER_STACK = MAX_CARDS_PER_STACK;
