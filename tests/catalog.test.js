const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCatalogResponse,
  UNIVERSAL_PARAMS,
  CARDS,
} = require("../src/endpoints/catalog");

// /api/catalog is the machine-readable discovery surface consumed by
// @heznpc/profilekit-mcp and any client that doesn't scrape README. The
// README promise of "theme_url on every card endpoint" has to be reflected
// here too — otherwise discovery clients silently disagree with the docs.

test("buildCatalogResponse advertises theme_url on every card endpoint", () => {
  const { cards } = buildCatalogResponse();
  for (const [name, entry] of Object.entries(cards)) {
    if (name === "health" || name === "catalog") continue;
    assert.ok(
      entry.common_params.includes("theme_url"),
      `card "${name}" must list theme_url in common_params`
    );
  }
});

test("buildCatalogResponse advertises the full universal param set on every card", () => {
  const { cards } = buildCatalogResponse();
  for (const [name, entry] of Object.entries(cards)) {
    if (name === "health" || name === "catalog") continue;
    for (const p of UNIVERSAL_PARAMS) {
      assert.ok(
        entry.common_params.includes(p),
        `card "${name}" missing universal param "${p}"`
      );
    }
  }
});

test("buildCatalogResponse preserves card-specific common_params alongside universals", () => {
  // stats had username, hide, layout, etc. — none of those should disappear.
  const { cards } = buildCatalogResponse();
  const originalStats = CARDS.stats.common_params || [];
  for (const p of originalStats) {
    assert.ok(
      cards.stats.common_params.includes(p),
      `stats common_params lost original "${p}"`
    );
  }
});

test("buildCatalogResponse does NOT add card params to the health endpoint", () => {
  // health is a diagnostic endpoint — it doesn't render cards and shouldn't
  // pretend to accept the universal palette params.
  const { cards } = buildCatalogResponse();
  assert.deepEqual(
    cards.health.common_params,
    CARDS.health.common_params,
    "health should not inherit card universal params"
  );
});

test("buildCatalogResponse deduplicates if a card already listed a universal param", () => {
  // hero's common_params already include "theme" and "font". The merge must
  // not produce duplicates.
  const { cards } = buildCatalogResponse();
  const set = new Set();
  for (const p of cards.hero.common_params) {
    assert.ok(!set.has(p), `hero common_params has duplicate "${p}"`);
    set.add(p);
  }
});

test("posts source description no longer claims hashnode works directly", () => {
  // README + catalog have to agree: hashnode source is retired. The catalog
  // description should not say "devto/hashnode/medium" without the retirement
  // note — otherwise a discovery client offers a dead option.
  assert.match(
    CARDS.posts.description,
    /retired|rss/i,
    "posts description must signal that hashnode is no longer a direct source"
  );
});
