const test = require("node:test");
const assert = require("node:assert/strict");
const { renderSocialCard } = require("../src/cards/social");
const { getTheme } = require("../src/common/themes");

const baseOpts = {
  colors: getTheme("dark"),
  hideBorder: false,
  hideBar: false,
  borderRadius: 6,
  title: "Links",
  layout: "default",
  font: null,
};

test("renderSocialCard emits anchors for https URLs", () => {
  const svg = renderSocialCard(
    [{ type: "github", label: "user", url: "https://github.com/user" }],
    baseOpts
  );
  assert.match(svg, /<a[^>]*href="https:\/\/github\.com\/user"/);
});

test("renderSocialCard adds rel=noopener noreferrer to every anchor", () => {
  const svg = renderSocialCard(
    [{ type: "github", label: "user", url: "https://github.com/user" }],
    baseOpts
  );
  assert.match(svg, /rel="noopener noreferrer"/);
});

test("renderSocialCard drops the anchor wrapping when the URL uses javascript:", () => {
  const svg = renderSocialCard(
    [
      {
        type: "website",
        label: "evil",
        url: "javascript:alert(document.cookie)",
      },
    ],
    baseOpts
  );
  // No `<a href="javascript:...">` anywhere — the icon renders as decoration
  // without a clickable link.
  assert.equal(svg.includes("javascript:"), false);
  assert.equal(svg.includes('href="javascript'), false);
  // The icon group still renders so the card isn't empty.
  assert.match(svg, /<g transform="translate/);
});

test("renderSocialCard drops anchor on data: and vbscript: schemes", () => {
  const svg = renderSocialCard(
    [
      { type: "website", label: "a", url: "data:text/html,<script>alert(1)</script>" },
      { type: "website", label: "b", url: "vbscript:msgbox(1)" },
    ],
    baseOpts
  );
  assert.equal(svg.includes("data:text/html"), false);
  assert.equal(svg.includes("vbscript:"), false);
});

test("renderSocialCard drops anchor on unparseable URLs but keeps rendering", () => {
  const svg = renderSocialCard(
    [{ type: "website", label: "bad", url: "this is not a url at all" }],
    baseOpts
  );
  // No broken `<a href="this is not a url at all">` in output — sanitizeUrl
  // rejected it, the wrapLink helper emitted the bare inner group.
  assert.equal(svg.includes('href="this is not'), false);
});

test("renderSocialCard preserves mailto: links (a valid allowlisted scheme)", () => {
  const svg = renderSocialCard(
    [{ type: "email", label: "me", url: "mailto:me@example.com" }],
    baseOpts
  );
  assert.match(svg, /<a[^>]*href="mailto:me@example\.com"/);
});

test("compact layout also drops unsafe URLs", () => {
  const svg = renderSocialCard(
    [
      {
        type: "website",
        label: "evil",
        url: "javascript:alert(1)",
      },
    ],
    { ...baseOpts, layout: "compact" }
  );
  assert.equal(svg.includes("javascript:"), false);
});

test("compact layout emits rel=noopener noreferrer on safe anchors", () => {
  const svg = renderSocialCard(
    [{ type: "github", label: "user", url: "https://github.com/user" }],
    { ...baseOpts, layout: "compact" }
  );
  assert.match(svg, /rel="noopener noreferrer"/);
});
