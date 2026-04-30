# UI prototype: ProfileKit v3 Composer

You're redesigning the visual + interaction layer of a three-pane editor.
The data model, JavaScript, design tokens, and a working-but-ugly reference
implementation are all included in this single file. **Nothing is attached
separately. Everything you need is below.**

Return one self-contained HTML file (vanilla HTML/CSS/JS, no build step,
no external libraries except a CDN font if you really need one). Reuse the
JavaScript at the bottom of this brief verbatim — only the markup and CSS
need to change.

---

## 1. What ProfileKit is (30 seconds)

ProfileKit is a customizable SVG card service for GitHub READMEs and
similar surfaces (Notion covers, Hashnode banners, dev.to bios). 28 cards
(hero, stats, languages, pin, snake, matrix, terminal, …), every visual
property exposed as a `?query=parameter`. Cards render at
`https://profilekit.vercel.app/api/<card>?…` and are dropped into a
README via `<img>` or `<picture>` tags.

Stated ethos: **"no ratings, no rankings — just clean, customizable cards."**

The existing playground has two tabs:

- **Cards** — pick one card, tune its params with a live SVG preview, copy
  the URL.
- **Templates** — curated picks; click "Load" to copy a preset into the
  Cards editor.

You are designing **a third tab: Compose.**

---

## 2. What you're building

A **README composer**. The user assembles an entire README — multiple
cards plus markdown blocks — instead of just configuring one card at a
time. Mental model:

- **Sims 3 Create-A-Style** (UX reference, not brand): pick parts from an
  inventory, drop them on a canvas, tune slots in an inspector.
- **Naver blog skin editor**: slot pre-built widgets into a layout, then
  configure each one.

Two layers, both swappable:

1. **Intra-card slots** — each card declares its own slots
   (`bg`, `name`, `theme`, `font`, …); the user fills them.
2. **Inter-card composition** — the README is an ordered list of
   blocks (`card` or `markdown`); the user adds, reorders, removes.

The output is a README markdown snippet where each card is wrapped in a
`<picture>` element with a `prefers-color-scheme` source pair, so the
result auto-respects the reader's OS theme.

---

## 3. MVP scope (locked)

Only `hero` has slot declarations and a real inspector this round. The
other 27 cards still appear in the inventory and still render — they just
use endpoint defaults until v3.2 ships their slot decls.

| In scope | Out of scope (later milestones) |
|---|---|
| Three-pane editor (inventory, canvas, inspector) | Drag-from-inventory (v3.3) |
| Click-to-add blocks | Inline edit on the preview itself (v3.4) |
| Reorder via ↑↓ buttons | URL-share for full compositions (v3.1) |
| Hero slot inspector | Slot decls for the other 27 cards (v3.2) |
| Markdown blocks (passthrough textarea) | Backend / gallery / accounts (v4) |
| Composition defaults: theme + font | Ratings / rankings / remix lineage (永 — never) |
| `<picture>` dark/light pair output | |
| `localStorage` persistence | |

---

## 4. Layout

```
┌────────────┬──────────────────────────┬──────────────┐
│ INVENTORY  │  COMPOSITION             │ SLOT         │
│ ~240px     │  fluid                   │ INSPECTOR    │
│            │                          │ ~340px       │
│ Composition│  [hero card preview]  ⌃⌄ │              │
│ Blog       │  ## Foundation        ⌃⌄ │ bg: ▼ wave   │
│  · hero    │  [pin card preview]   ⌃⌄ │ name: ___    │
│  · section │                          │ theme: ▼ …   │
│ Data       │  [Clear] [Copy markdown] │ font: ▼ …    │
│  · stats   │                          │ width: 1200  │
│ Animations │                          │ height: 280  │
│  · matrix  │                          │ ─────────────│
│  · snake   │                          │ Composition  │
│            │                          │ defaults     │
│            │                          │ theme: ▼ …   │
│            │                          │ font:  ▼ …   │
└────────────┴──────────────────────────┴──────────────┘
```

Responsive:

- ≤ 1080px → 2 columns (inspector wraps under the canvas as a full-width
  bottom strip).
- ≤ 720px → 1 column (inventory becomes a horizontal scrolling chip strip
  at the top; inspector becomes a bottom sheet that opens on selection).

---

## 5. Visual direction

**Make it feel like a tool a designer would actually use.** Reference
products:

- **Linear** — pacing of inventory · canvas · inspector, the way selection
  state and chrome melt away.
- **Vercel dashboard** — chip + table + side-panel pattern, monochrome
  with a single accent.
- **Raycast extension store** — inventory tiles, badges, hover states.
- **Figma right-panel** — inspector information density without clutter.

**Hard aesthetic rules:**

- Match the existing playground's surface. A user moving between Cards and
  Compose should feel one product, not two. Use the design tokens in §6
  unless you have a specific reason to refine a value.
- Dark mode is primary. Ship a `prefers-color-scheme: light` variant.
- One accent color (`--accent`). No competing accents.
- Sharp 6–8px radii, 1px hairline borders, generous whitespace.
- Mono font for parameter values, URL previews, and code-shaped data.
- Animations only on meaningful state changes (selection, drag, copy
  toast). 120–180ms ease-out. **No idle motion.** No shimmer, no pulses,
  no breathing.

**Anti-patterns (these read as "AI-generated UI"):**

- Inline emoji decorations.
- Gradient backgrounds on hero text.
- Frosted glass / glassmorphism.
- Drop shadows on every surface.
- Skeuomorphic raised buttons.
- Multiple competing accent colors.
- Decorative SVG curlicues in empty states.

**Interaction details that matter:**

- The empty canvas is what 90% of users see first. Make it inviting and
  instructive without preaching. A nudge toward `hero` ("try this first,
  it's the MVP") is appropriate.
- Block selection must be obvious from a glance — not a 1px border-color
  flip. Linear uses a left accent rail; Vercel uses a subtle background
  bump. Pick one and commit.
- Inspector empty state should look intentional, not missing. A small
  illustration is fine; an apologetic paragraph is not.
- The "Copy README markdown" CTA is the success moment. Primary button +
  a clean modal with the output. Linear's command-palette modal is a
  great reference for the modal aesthetic.

---

## 6. Design tokens (use these — already shared with the existing playground)

```css
:root {
  --bg:           #0d1117;
  --surface:      #161b22;
  --surface-2:    #1c222b;
  --surface-3:    #232a35;
  --border:       #21262d;
  --border-strong:#30363d;
  --text:         #e6edf3;
  --muted:        #8b949e;
  --muted-2:      #6e7681;
  --accent:       #58a6ff;
  --accent-soft:  rgba(88, 166, 255, 0.12);
  --warn:         #d29922;
  --danger:       #f85149;
  --radius:       8px;
  --radius-sm:    5px;
  --mono:         ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --sans:         -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
}
```

For the light variant, derive matched tokens (don't invent a new palette).
The accent stays `#58a6ff` (GitHub blue) in both modes.

---

## 7. Data model & JavaScript (paste verbatim into your file)

This is the entire data + behavior layer. Wire your new HTML to it via the
IDs/classes referenced inside (or rename the selectors and update the JS
accordingly — your call). Don't change the data shape, the URL builder,
the markdown serializer, the storage key, or the slot decl format —
those are downstream contracts the v3.1+ milestones will read.

```html
<script>
const API_BASE = "https://profilekit.vercel.app/api";

// Theme pairing for <picture> dark/light output. Theme names match
// src/common/themes.js in the production codebase.
const THEME_PAIR = {
  dark:               "light",
  dark_dimmed:        "light",
  tokyo_night:        "rose_pine_dawn",
  nord:               "rose_pine_dawn",
  gruvbox_dark:       "solarized_light",
  catppuccin_mocha:   "catppuccin_latte",
  dracula:            "rose_pine_dawn",
  monokai:            "solarized_light",
  one_dark:           "rose_pine_dawn",
  kanagawa:           "rose_pine_dawn",
  synthwave:          "solarized_light",
  solarized_dark:     "solarized_light",
  rose_pine:          "rose_pine_dawn",
  light:              "dark",
  catppuccin_latte:   "catppuccin_mocha",
  solarized_light:    "solarized_dark",
  rose_pine_dawn:     "rose_pine",
};
const ALL_THEMES = Object.keys(THEME_PAIR);
const ALL_FONTS  = ["", "inter", "space-grotesk", "jetbrains-mono", "ibm-plex-sans", "manrope"];

// MVP-C: only hero has slot decls. Others render with endpoint defaults.
const SLOT_DECLS = {
  hero: {
    bg:       { type: "enum",   options: ["gradient", "wave", "grid", "particles"], default: "wave" },
    name:     { type: "text",   default: "Hi, I'm Ren" },
    subtitle: { type: "text",   default: "I build small sharp tools" },
    theme:    { type: "enum",   options: ALL_THEMES, default: null },
    font:     { type: "enum",   options: ALL_FONTS,  default: null },
    width:    { type: "number", default: 1200, range: [400, 1600] },
    height:   { type: "number", default: 280,  range: [120, 480]  },
  },
};

const INVENTORY = [
  { group: "Composition", items: [
    { id: "markdown", label: "Markdown", desc: "Raw markdown text", type: "markdown", status: "live" },
  ]},
  { group: "Blog Layout", items: [
    { id: "hero",     label: "Hero",     desc: "Banner with name + bg",   type: "card", status: "live" },
    { id: "section",  label: "Section",  desc: "Section header",           type: "card", status: "soon" },
    { id: "divider",  label: "Divider",  desc: "Visual separator",         type: "card", status: "soon" },
    { id: "now",      label: "Now",      desc: "What I'm working on",      type: "card", status: "soon" },
    { id: "timeline", label: "Timeline", desc: "Career / life timeline",   type: "card", status: "soon" },
    { id: "tags",     label: "Tags",     desc: "Tech stack pills",         type: "card", status: "soon" },
    { id: "toc",      label: "TOC",      desc: "Table of contents",        type: "card", status: "soon" },
    { id: "quote",    label: "Quote",    desc: "Pull-quote block",         type: "card", status: "soon" },
    { id: "posts",    label: "Posts",    desc: "Latest blog posts",        type: "card", status: "soon" },
  ]},
  { group: "Data", items: [
    { id: "stats",     label: "Stats",     desc: "GitHub stats",      type: "card", status: "soon" },
    { id: "languages", label: "Languages", desc: "Top languages",     type: "card", status: "soon" },
    { id: "pin",       label: "Pin",       desc: "Repository card",   type: "card", status: "soon" },
    { id: "leetcode",  label: "LeetCode",  desc: "LeetCode stats",    type: "card", status: "soon" },
    { id: "reviews",   label: "Reviews",   desc: "Code review stats", type: "card", status: "soon" },
    { id: "social",    label: "Social",    desc: "Social link strip", type: "card", status: "soon" },
  ]},
  { group: "Animations", items: [
    { id: "typing",        label: "Typing",        desc: "Typewriter effect",          type: "card", status: "soon" },
    { id: "wave",          label: "Wave",          desc: "Animated waves",             type: "card", status: "soon" },
    { id: "terminal",      label: "Terminal",      desc: "Terminal animation",         type: "card", status: "soon" },
    { id: "neon",          label: "Neon",          desc: "Neon sign text",             type: "card", status: "soon" },
    { id: "glitch",        label: "Glitch",        desc: "Glitch text effect",         type: "card", status: "soon" },
    { id: "matrix",        label: "Matrix",        desc: "Matrix rain",                type: "card", status: "soon" },
    { id: "snake",         label: "Snake",         desc: "Snake on contribution grid", type: "card", status: "soon" },
    { id: "equalizer",     label: "Equalizer",     desc: "Audio equalizer bars",       type: "card", status: "soon" },
    { id: "heartbeat",     label: "Heartbeat",     desc: "Heartbeat trace",            type: "card", status: "soon" },
    { id: "constellation", label: "Constellation", desc: "Star constellation",         type: "card", status: "soon" },
    { id: "radar",         label: "Radar",         desc: "Radar sweep",                type: "card", status: "soon" },
  ]},
];

// State shape:
//   {
//     defaults:   { theme: string, font: string },
//     blocks:     [{ _id, type: "card"|"markdown", card_type?, slots?, content? }],
//     selectedId: number | null,
//   }
const STORAGE_KEY = "profilekit.composition.draft";
const state = loadState() || {
  defaults:   { theme: "tokyo_night", font: "space-grotesk" },
  blocks:     [],
  selectedId: null,
};
let blockIdCounter = state.blocks.reduce((m, b) => Math.max(m, b._id || 0), 0);
const nextId = () => ++blockIdCounter;

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}
function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) { return null; }
}

function buildCardUrl(block, themeOverride) {
  const params = new URLSearchParams();
  const slots  = block.slots || {};
  for (const [k, v] of Object.entries(slots)) {
    if (v === null || v === undefined || v === "") continue;
    if (k === "theme" && themeOverride) continue;
    params.set(k, String(v));
  }
  if (!params.has("theme")) params.set("theme", themeOverride || state.defaults.theme);
  if (!params.has("font") && state.defaults.font) params.set("font", state.defaults.font);
  return `${API_BASE}/${block.card_type}?${params.toString()}`;
}

function isDarkTheme(name) {
  return /(?:^|_)(dark|night|mocha|dracula|monokai|kanagawa|synthwave|nord|gruvbox|tokyo|rose_pine$|one_dark)/.test(name);
}

function blockToMarkdown(block) {
  if (block.type === "markdown") return block.content || "";
  const userTheme  = (block.slots && block.slots.theme) || state.defaults.theme;
  const pairTheme  = THEME_PAIR[userTheme] || userTheme;
  const userIsDark = isDarkTheme(userTheme);
  const darkUrl    = buildCardUrl(block, userIsDark ? userTheme : pairTheme);
  const lightUrl   = buildCardUrl(block, userIsDark ? pairTheme : userTheme);
  return [
    `<picture>`,
    `  <source media="(prefers-color-scheme: dark)"  srcset="${darkUrl}">`,
    `  <source media="(prefers-color-scheme: light)" srcset="${lightUrl}">`,
    `  <img alt="${block.card_type} card" src="${darkUrl}">`,
    `</picture>`,
  ].join("\n");
}
function compositionToMarkdown() {
  return state.blocks.map(blockToMarkdown).join("\n\n");
}

function addBlock(itemId, type) {
  const id = nextId();
  let block;
  if (type === "markdown") {
    block = { _id: id, type: "markdown", content: "## Foundation\n\nA short note about this section." };
  } else {
    const decl  = SLOT_DECLS[itemId];
    const slots = {};
    if (decl) {
      for (const [k, s] of Object.entries(decl)) {
        if (s.default !== null && s.default !== undefined) slots[k] = s.default;
      }
    }
    block = { _id: id, type: "card", card_type: itemId, slots };
  }
  state.blocks.push(block);
  state.selectedId = id;
  saveState();
}
function removeBlock(id) {
  const idx = state.blocks.findIndex(b => b._id === id);
  if (idx < 0) return;
  state.blocks.splice(idx, 1);
  if (state.selectedId === id) state.selectedId = null;
  saveState();
}
function moveBlock(id, dir) {
  const idx = state.blocks.findIndex(b => b._id === id);
  if (idx < 0) return;
  const j = idx + dir;
  if (j < 0 || j >= state.blocks.length) return;
  [state.blocks[idx], state.blocks[j]] = [state.blocks[j], state.blocks[idx]];
  saveState();
}
function selectBlock(id) {
  state.selectedId = id;
}

// Expose so your render code can call them.
window.PK = {
  API_BASE, THEME_PAIR, ALL_THEMES, ALL_FONTS, SLOT_DECLS, INVENTORY,
  state, saveState,
  buildCardUrl, blockToMarkdown, compositionToMarkdown, isDarkTheme,
  addBlock, removeBlock, moveBlock, selectBlock,
};
</script>
```

---

## 8. Output format example

For a composition `[hero(name=Ren, bg=wave) → markdown("## Foundation") → pin(repo=ProfileKit)]`
with composition defaults `{ theme: "tokyo_night", font: "space-grotesk" }`,
the Copy markdown button must produce exactly this:

```html
<picture>
  <source media="(prefers-color-scheme: dark)"  srcset="https://profilekit.vercel.app/api/hero?bg=wave&name=Ren&width=1200&height=280&theme=tokyo_night&font=space-grotesk">
  <source media="(prefers-color-scheme: light)" srcset="https://profilekit.vercel.app/api/hero?bg=wave&name=Ren&width=1200&height=280&theme=rose_pine_dawn&font=space-grotesk">
  <img alt="hero card" src="https://profilekit.vercel.app/api/hero?bg=wave&name=Ren&width=1200&height=280&theme=tokyo_night&font=space-grotesk">
</picture>

## Foundation

<picture>
  <source media="(prefers-color-scheme: dark)"  srcset="https://profilekit.vercel.app/api/pin?repo=ProfileKit&theme=tokyo_night&font=space-grotesk">
  <source media="(prefers-color-scheme: light)" srcset="https://profilekit.vercel.app/api/pin?repo=ProfileKit&theme=rose_pine_dawn&font=space-grotesk">
  <img alt="pin card" src="https://profilekit.vercel.app/api/pin?repo=ProfileKit&theme=tokyo_night&font=space-grotesk">
</picture>
```

`compositionToMarkdown()` in §7 already does this — call it from your
copy button and you're done.

---

## 9. Deliverable

A single HTML file. It must:

1. Open straight in a browser (`file://` or static server) — no build, no
   npm install, no bundler.
2. Render real card images from `https://profilekit.vercel.app/api/...`
   so previews are live.
3. Persist composition state to `localStorage["profilekit.composition.draft"]`
   exactly as the JS in §7 does (so reload preserves the user's work).
4. Pass a basic visual review at 1440 × 900, 1024 × 768, and 390 × 844.
5. Use the design tokens in §6.

---

## 10. Hard non-goals

- Don't redesign the Cards or Templates tabs. Compose is additive.
- Don't add a backend, account system, ratings, rankings, remix lineage,
  or marketplace. The ethos is *"no ratings, no rankings."*
- Don't change the `/api/*` endpoints or the SVG output.
- Don't modify the data shape, URL builder, markdown serializer, or
  storage key in §7. Those are downstream contracts.
- Don't introduce brand language like "human craft layer" or "Sims 3 CAS
  for devs" — Sims is a UX reference internally, not customer-facing copy.
- Don't add idle motion, shimmer, pulses, glassmorphism, gradient text,
  emoji decorations, or competing accent colors.
