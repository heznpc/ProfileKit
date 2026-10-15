/* Shared by Card Studio and README Builder. No browser or network state. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ProfileKitCards = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

const THEMES = ["dark", "dark_dimmed", "light", "tokyo_night", "nord", "gruvbox_dark", "catppuccin_mocha", "catppuccin_latte", "dracula", "monokai", "one_dark", "kanagawa", "synthwave", "solarized_dark", "solarized_light", "rose_pine", "rose_pine_dawn"];

const COMMON_FRAME = [
  { name: "theme", type: "select", options: THEMES },
  { name: "font", type: "select", options: ["", "inter", "space-grotesk", "jetbrains-mono", "ibm-plex-sans", "manrope"], placeholder: "(system)" },
  { name: "accent_color", type: "color" },
  { name: "border_radius", type: "select", options: ["", "none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"], placeholder: "(default)" },
  { name: "hide_border", type: "boolean" },
  { name: "hide_bar", type: "boolean" },
];

const COMMON_DECOR = [
  { name: "theme", type: "select", options: THEMES },
  { name: "font", type: "select", options: ["", "inter", "space-grotesk", "jetbrains-mono", "ibm-plex-sans", "manrope"], placeholder: "(system)" },
  { name: "color", type: "color" },
  { name: "border_radius", type: "select", options: ["", "none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"], placeholder: "(default)" },
  { name: "hide_border", type: "boolean" },
];

const CARDS = {
  stats: {
    label: "Stats",
    group: "Data",
    desc: "GitHub stats — commits, PRs, issues, stars, repos.",
    params: [
      { name: "username", type: "text", default: "heznpc", required: true },
      { name: "layout", type: "select", options: ["default", "compact"] },
      ...COMMON_FRAME,
    ],
  },
  languages: {
    label: "Languages",
    group: "Data",
    desc: "Top languages with bars or donut layout.",
    params: [
      { name: "username", type: "text", default: "heznpc", required: true },
      { name: "layout", type: "select", options: ["default", "compact", "donut"] },
      { name: "langs_count", type: "number", default: 6 },
      ...COMMON_FRAME,
    ],
  },
  reviews: {
    label: "Reviews",
    group: "Data",
    desc: "Code review stats with approval ring.",
    params: [
      { name: "username", type: "text", default: "heznpc", required: true },
      ...COMMON_FRAME,
    ],
  },
  pin: {
    label: "Pin",
    group: "Data",
    desc: "Repository card.",
    params: [
      { name: "username", type: "text", default: "heznpc", required: true },
      { name: "repo", type: "text", default: "ProfileKit", required: true },
      { name: "card_width", type: "number", default: 400 },
      { name: "max_desc_lines", type: "number", default: 3 },
      { name: "description", type: "text" },
      ...COMMON_FRAME,
    ],
  },
  leetcode: {
    label: "LeetCode",
    group: "Data",
    desc: "LeetCode problem stats.",
    params: [
      { name: "username", type: "text", default: "heznpc", required: true },
      ...COMMON_FRAME,
    ],
  },
  social: {
    label: "Social",
    group: "Data",
    desc: "Social links card.",
    params: [
      { name: "github", type: "text", default: "heznpc" },
      { name: "linkedin", type: "text" },
      { name: "x", type: "text" },
      { name: "email", type: "text" },
      { name: "website", type: "text" },
      { name: "layout", type: "select", options: ["default", "compact"] },
      ...COMMON_FRAME,
    ],
  },
  quote: {
    label: "Quote",
    group: "Data",
    desc: "Random or daily dev quote.",
    params: [
      { name: "daily", type: "boolean" },
      ...COMMON_FRAME,
    ],
  },
  hero: {
    label: "Hero",
    group: "Blog",
    desc: "Wide hero banner with animated background.",
    params: [
      { name: "name", type: "text", default: "Hello, World" },
      { name: "subtitle", type: "text", default: "Building things that ship" },
      { name: "bg", type: "select", options: ["gradient", "wave", "grid", "particles"] },
      { name: "align", type: "select", options: ["center", "left"] },
      { name: "width", type: "number", default: 1200 },
      { name: "height", type: "number", default: 280 },
      ...COMMON_DECOR,
    ],
  },
  section: {
    label: "Section",
    group: "Blog",
    desc: "Section header with animated underline.",
    params: [
      { name: "title", type: "text", default: "About" },
      { name: "subtitle", type: "text" },
      { name: "align", type: "select", options: ["left", "center"] },
      { name: "icon", type: "text", placeholder: "✦" },
      { name: "width", type: "number", default: 800 },
      ...COMMON_DECOR,
    ],
  },
  divider: {
    label: "Divider",
    group: "Blog",
    desc: "Decorative separator (6 styles).",
    params: [
      { name: "style", type: "select", options: ["line", "wave", "dots", "dashed", "gradient", "double"] },
      { name: "width", type: "number", default: 800 },
      { name: "height", type: "number", default: 30 },
      { name: "color", type: "color" },
      { name: "theme", type: "select", options: THEMES },
    ],
  },
  now: {
    label: "Now",
    group: "Blog",
    desc: "\"Currently\" status card.",
    params: [
      { name: "coding", type: "text", default: "ProfileKit" },
      { name: "reading", type: "text", default: "DDIA" },
      { name: "listening", type: "text", default: "Lo-fi" },
      { name: "building", type: "text" },
      ...COMMON_FRAME,
    ],
  },
  timeline: {
    label: "Timeline",
    group: "Blog",
    desc: "Vertical timeline of events.",
    params: [
      { name: "items", type: "text", default: "2024;Joined team;Working on AI|2023;Built ProfileKit;Open source" },
      ...COMMON_FRAME,
    ],
  },
  tags: {
    label: "Tags",
    group: "Blog",
    desc: "Tag cloud / skill pills.",
    params: [
      { name: "tags", type: "text", default: "React,TypeScript,Go:00add8,Python:3776ab,Rust:dea584" },
      ...COMMON_FRAME,
    ],
  },
  toc: {
    label: "TOC",
    group: "Blog",
    desc: "Table of contents.",
    params: [
      { name: "items", type: "text", default: "About|Stats|Projects|Contact" },
      ...COMMON_FRAME,
    ],
  },
  posts: {
    label: "Posts",
    group: "Blog",
    desc: "Latest posts from dev.to / Medium / RSS.",
    params: [
      { name: "source", type: "select", options: ["devto", "medium", "rss"] },
      { name: "username", type: "text", default: "ben" },
      { name: "url", type: "text" },
      { name: "count", type: "number", default: 5 },
      ...COMMON_FRAME,
    ],
  },
  typing: {
    label: "Typing",
    group: "Animation",
    desc: "Typewriter text animation.",
    params: [
      { name: "lines", type: "text", default: "ProfileKit,All-in-one+profile+cards" },
      { name: "color", type: "color" },
      { name: "size", type: "number", default: 20 },
      { name: "align", type: "select", options: ["left", "center", "right"] },
      { name: "width", type: "number", default: 500 },
      { name: "height", type: "number", default: 50 },
      { name: "frame", type: "boolean" },
      { name: "font", type: "select", options: ["", "inter", "space-grotesk", "jetbrains-mono", "ibm-plex-sans", "manrope"], placeholder: "(monospace)" },
      { name: "theme", type: "select", options: THEMES },
      { name: "border_radius", type: "select", options: ["", "none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"], placeholder: "(default)" },
      { name: "hide_border", type: "boolean" },
      { name: "hide_bar", type: "boolean" },
    ],
  },
  wave: {
    label: "Wave",
    group: "Animation",
    desc: "Layered animated sin waves.",
    params: [
      { name: "text", type: "text", default: "ProfileKit" },
      { name: "waves", type: "number", default: 3 },
      { name: "width", type: "number", default: 800 },
      { name: "height", type: "number", default: 160 },
      ...COMMON_DECOR,
    ],
  },
  terminal: {
    label: "Terminal",
    group: "Animation",
    desc: "Terminal window with auto-typing commands.",
    params: [
      { name: "commands", type: "text", default: "whoami,ls -la,git status" },
      { name: "prompt", type: "text", default: "$" },
      { name: "window_title", type: "text", default: "bash" },
      { name: "speed", type: "number", default: 70 },
      { name: "width", type: "number", default: 600 },
      ...COMMON_DECOR,
    ],
  },
  neon: {
    label: "Neon",
    group: "Animation",
    desc: "Neon glow with flicker.",
    params: [
      { name: "text", type: "text", default: "NEON" },
      { name: "size", type: "number", default: 64 },
      { name: "width", type: "number", default: 600 },
      { name: "height", type: "number", default: 160 },
      ...COMMON_DECOR,
    ],
  },
  glitch: {
    label: "Glitch",
    group: "Animation",
    desc: "RGB-split glitch text.",
    params: [
      { name: "text", type: "text", default: "GLITCH" },
      { name: "size", type: "number", default: 64 },
      { name: "width", type: "number", default: 600 },
      { name: "height", type: "number", default: 160 },
      ...COMMON_DECOR,
    ],
  },
  matrix: {
    label: "Matrix",
    group: "Animation",
    desc: "Matrix code rain.",
    params: [
      { name: "text", type: "text", default: "MATRIX" },
      { name: "density", type: "number", default: 1 },
      { name: "speed", type: "number", default: 1 },
      { name: "seed", type: "number", default: 42 },
      { name: "width", type: "number", default: 600 },
      { name: "height", type: "number", default: 200 },
      ...COMMON_DECOR,
    ],
  },
  snake: {
    label: "Snake",
    group: "Animation",
    desc: "Standalone snake on a contribution grid.",
    params: [
      { name: "cols", type: "number", default: 53 },
      { name: "rows", type: "number", default: 7 },
      { name: "duration", type: "number", default: 24 },
      { name: "seed", type: "number", default: 7 },
      ...COMMON_DECOR,
    ],
  },
  equalizer: {
    label: "Equalizer",
    group: "Animation",
    desc: "Audio EQ bars with LIVE indicator.",
    params: [
      { name: "label", type: "text", default: "Now Playing" },
      { name: "bars", type: "number", default: 24 },
      { name: "width", type: "number", default: 495 },
      { name: "height", type: "number", default: 140 },
      ...COMMON_DECOR,
    ],
  },
  heartbeat: {
    label: "Heartbeat",
    group: "Animation",
    desc: "EKG line + pulse.",
    params: [
      { name: "text", type: "text", default: "Still shipping" },
      { name: "bpm", type: "number", default: 72 },
      { name: "width", type: "number", default: 495 },
      { name: "height", type: "number", default: 140 },
      ...COMMON_DECOR,
    ],
  },
  constellation: {
    label: "Constellation",
    group: "Animation",
    desc: "Twinkling stars + connections.",
    params: [
      { name: "text", type: "text", default: "ProfileKit" },
      { name: "density", type: "number", default: 1 },
      { name: "seed", type: "number", default: 19 },
      { name: "width", type: "number", default: 600 },
      { name: "height", type: "number", default: 200 },
      ...COMMON_DECOR,
    ],
  },
  radar: {
    label: "Radar",
    group: "Animation",
    desc: "Rotating radar sweep with blips.",
    params: [
      { name: "text", type: "text", default: "SCANNING" },
      { name: "blips", type: "number", default: 5 },
      { name: "speed", type: "number", default: 4 },
      { name: "width", type: "number", default: 300 },
      { name: "height", type: "number", default: 300 },
      ...COMMON_DECOR,
    ],
  },
};

return { CARDS, THEMES };
});
