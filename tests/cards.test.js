// Cross-theme smoke test for every card renderer.
//
// For each registered theme, every card is rendered with minimum-viable
// inputs and the resulting SVG is checked for the common failure modes:
//   - missing required prop  → "undefined" in markup
//   - bad numeric calc       → "NaN" in markup
//   - object stringification → "[object Object]"
//   - non-SVG output         → wrong wrapper / missing closing tag
//
// The point is to catch "new theme breaks card N" or "renamed prop breaks
// destructuring" at test time instead of at deploy time. It is intentionally
// permissive about the *exact* output — visual regression is not the goal.

const test = require("node:test");
const assert = require("node:assert/strict");
const { themes, getTheme } = require("../src/common/themes");

const { renderStatsCard } = require("../src/cards/stats");
const { renderLanguagesCard } = require("../src/cards/languages");
const { renderReviewsCard } = require("../src/cards/reviews");
const { renderPinCard } = require("../src/cards/pin");
const { renderLeetcodeCard } = require("../src/cards/leetcode");
const { renderSocialCard } = require("../src/cards/social");
const { renderPostsCard } = require("../src/cards/posts");
const { renderQuoteCard } = require("../src/cards/quote");

const { renderHeroCard } = require("../src/cards/hero");
const { renderSectionCard } = require("../src/cards/section");
const { renderDividerCard } = require("../src/cards/divider");
const { renderNowCard } = require("../src/cards/now");
const { renderTimelineCard } = require("../src/cards/timeline");
const { renderTagsCard } = require("../src/cards/tags");
const { renderTocCard } = require("../src/cards/toc");

const { renderTypingCard } = require("../src/cards/typing");
const { renderWaveCard } = require("../src/cards/wave");
const { renderTerminalCard } = require("../src/cards/terminal");
const { renderNeonCard } = require("../src/cards/neon");
const { renderGlitchCard } = require("../src/cards/glitch");
const { renderMatrixCard } = require("../src/cards/matrix");
const { renderSnakeCard } = require("../src/cards/snake");
const { renderEqualizerCard } = require("../src/cards/equalizer");
const { renderHeartbeatCard } = require("../src/cards/heartbeat");
const { renderConstellationCard } = require("../src/cards/constellation");
const { renderRadarCard } = require("../src/cards/radar");

const STATS_DATA = {
  name: "Test",
  totalCommits: 1234,
  totalPRs: 56,
  totalIssues: 78,
  totalStars: 9000,
  totalRepos: 12,
  contributedTo: 34,
};

const LANGUAGES_DATA = [
  { name: "JavaScript", color: "#f1e05a", percentage: 60.5, size: 1000 },
  { name: "Go", color: "#00add8", percentage: 25.0, size: 400 },
  { name: "Python", color: "#3572A5", percentage: 14.5, size: 240 },
];

const REVIEWS_DATA = {
  name: "Test",
  totalReviews: 50,
  approved: 40,
  changesRequested: 10,
  reposReviewed: 8,
  approvalRate: 80,
};

const PIN_DATA = {
  name: "test-repo",
  description: "A small repository for tests",
  language: "JavaScript",
  languageColor: "#f1e05a",
  stars: 100,
  forks: 10,
};

const LEETCODE_DATA = {
  username: "test",
  totalSolved: 50,
  totalQuestions: 200,
  easy: { solved: 30, total: 100 },
  medium: { solved: 15, total: 80 },
  hard: { solved: 5, total: 20 },
};

const SOCIAL_DATA = [
  { type: "github", label: "user", url: "https://github.com/user" },
  { type: "linkedin", label: "user", url: "https://linkedin.com/in/user" },
];

const POSTS_DATA = [
  {
    title: "Hello world",
    url: "https://example.com/p/1",
    published: "2026-01-01T00:00:00Z",
    description: "An example post",
    readingTime: 3,
    reactions: 12,
  },
];

const QUOTE_DATA = { text: "Hello world", author: "Test Author" };

// Each entry is `[name, () => svgString]`. The function is closed over a
// `colors` object so the harness below can re-bind it per theme.
function makeCardCases(opts) {
  const { colors } = opts;
  const base = { ...opts };
  return [
    ["stats", () => renderStatsCard(STATS_DATA, base)],
    ["languages default", () => renderLanguagesCard(LANGUAGES_DATA, base)],
    ["languages compact", () => renderLanguagesCard(LANGUAGES_DATA, { ...base, layout: "compact" })],
    ["languages donut", () => renderLanguagesCard(LANGUAGES_DATA, { ...base, layout: "donut" })],
    ["reviews", () => renderReviewsCard(REVIEWS_DATA, base)],
    ["pin", () => renderPinCard(PIN_DATA, base)],
    ["leetcode", () => renderLeetcodeCard(LEETCODE_DATA, base)],
    ["social default", () => renderSocialCard(SOCIAL_DATA, base)],
    ["social compact", () => renderSocialCard(SOCIAL_DATA, { ...base, layout: "compact" })],
    ["posts", () => renderPostsCard(POSTS_DATA, base)],
    ["quote", () => renderQuoteCard(QUOTE_DATA, { ...base, width: 495 })],

    ["hero default", () =>
      renderHeroCard({ ...base, name: "Hi", subtitle: "sub", bg: "gradient", width: 800, height: 200, align: "center" })],
    ["hero wave", () =>
      renderHeroCard({ ...base, name: "Hi", subtitle: "sub", bg: "wave", width: 800, height: 200, align: "center" })],
    ["hero grid", () =>
      renderHeroCard({ ...base, name: "Hi", subtitle: "sub", bg: "grid", width: 800, height: 200, align: "center" })],
    ["hero particles", () =>
      renderHeroCard({ ...base, name: "Hi", subtitle: "sub", bg: "particles", width: 800, height: 200, align: "center" })],
    ["section", () =>
      renderSectionCard({ ...base, title: "About", subtitle: "Hi", align: "left", width: 800, icon: "★" })],
    ["divider line", () => renderDividerCard({ ...base, style: "line", width: 800, height: 30 })],
    ["divider wave", () => renderDividerCard({ ...base, style: "wave", width: 800, height: 30 })],
    ["divider dots", () => renderDividerCard({ ...base, style: "dots", width: 800, height: 30 })],
    ["divider gradient", () => renderDividerCard({ ...base, style: "gradient", width: 800, height: 30 })],
    ["divider double", () => renderDividerCard({ ...base, style: "double", width: 800, height: 30 })],
    ["divider dashed", () => renderDividerCard({ ...base, style: "dashed", width: 800, height: 30 })],
    ["now", () =>
      renderNowCard({ coding: "ProfileKit", reading: "DDIA", listening: "Lo-fi" }, base)],
    ["timeline", () => renderTimelineCard("2024;Joined;Working|2023;Built;Open source", base)],
    ["tags", () => renderTagsCard("React,Go:00add8,Python", base)],
    ["toc", () => renderTocCard("About;about|Stats;stats", base)],

    ["typing", () =>
      renderTypingCard({ ...base, lines: ["hello", "world"], width: 500, height: 50 })],
    ["typing framed", () =>
      renderTypingCard({ ...base, lines: ["hello"], frame: true, width: 500, height: 50 })],
    ["wave", () =>
      renderWaveCard({ ...base, text: "ProfileKit", width: 800, height: 160, waves: 3 })],
    ["terminal", () =>
      renderTerminalCard({
        ...base,
        commands: ["whoami", "ls -la"],
        prompt: "$",
        windowTitle: "bash",
        width: 600,
        speed: 70,
        pause: 600,
        fontSize: 14,
      })],
    ["neon", () =>
      renderNeonCard({ ...base, text: "NEON", size: 64, width: 600, height: 160 })],
    ["glitch", () =>
      renderGlitchCard({ ...base, text: "GLITCH", size: 64, width: 600, height: 160 })],
    ["matrix", () =>
      renderMatrixCard({ ...base, text: "MATRIX", width: 600, height: 200, density: 1, speed: 1, seed: 42 })],
    ["snake", () =>
      renderSnakeCard({
        ...base,
        cols: 53,
        rows: 7,
        cellSize: 11,
        cellGap: 3,
        duration: 24,
        seed: 7,
      })],
    ["equalizer", () =>
      renderEqualizerCard({ ...base, bars: 24, label: "LIVE", width: 495, height: 140, seed: 11 })],
    ["heartbeat", () =>
      renderHeartbeatCard({ ...base, text: "Still shipping", bpm: 72, width: 495, height: 140 })],
    ["constellation", () =>
      renderConstellationCard({ ...base, text: "ProfileKit", width: 600, height: 200, density: 1, seed: 19 })],
    ["radar", () =>
      renderRadarCard({ ...base, text: "SCANNING", width: 300, height: 300, blips: 5, speed: 4, seed: 23 })],
  ];
}

function assertHealthySvg(name, svg) {
  assert.equal(typeof svg, "string", `${name} should return a string`);
  assert.ok(svg.startsWith("<svg") || svg.trimStart().startsWith("<svg"),
    `${name} should start with <svg, got: ${svg.slice(0, 40)}`);
  assert.ok(svg.includes("</svg>"),
    `${name} should contain </svg>`);
  assert.ok(!svg.includes("undefined"),
    `${name} should not contain "undefined"`);
  assert.ok(!svg.includes("NaN"),
    `${name} should not contain "NaN"`);
  assert.ok(!svg.includes("[object Object]"),
    `${name} should not contain "[object Object]"`);
}

// Test matrix: every theme × every card.
for (const themeName of Object.keys(themes)) {
  test(`smoke: every card renders under theme "${themeName}"`, () => {
    const colors = getTheme(themeName);
    const cases = makeCardCases({ colors });
    for (const [name, render] of cases) {
      let svg;
      try {
        svg = render();
      } catch (err) {
        assert.fail(`${name} threw under theme "${themeName}": ${err.message}`);
      }
      assertHealthySvg(`${name} (${themeName})`, svg);
    }
  });
}

// Sanity: also exercise the bundled font path so the embedded CSS still slots
// in cleanly across themes. One theme is enough — fonts are theme-independent.
test("smoke: bundled fonts render without errors", () => {
  const colors = getTheme("dark");
  const fonts = ["inter", "space-grotesk", "jetbrains-mono", "ibm-plex-sans", "manrope"];
  for (const font of fonts) {
    const svg = renderStatsCard(STATS_DATA, { colors, font });
    assertHealthySvg(`stats with font=${font}`, svg);
    assert.ok(svg.includes("@font-face"), `stats font=${font} should embed @font-face`);
  }
});

// Sanity: accent_color override collapses the gradient to a single color across
// every card that uses renderCard (the wrapper that applies the gradient).
test("smoke: accent_color override does not break renderCard cards", () => {
  const colors = getTheme("dark", { accent: "ff00aa" });
  const cases = makeCardCases({ colors });
  for (const [name, render] of cases) {
    const svg = render();
    assertHealthySvg(`${name} (accent override)`, svg);
  }
});
