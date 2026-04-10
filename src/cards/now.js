const { renderCard } = require("../common/card");
const { bodyStartY } = require("../common/tokens");
const { escapeHtml } = require("../common/utils");

const NOW_FIELDS = [
  { key: "coding", label: "Coding", icon: "&lt;/&gt;" },
  { key: "building", label: "Building", icon: "✦" },
  { key: "learning", label: "Learning", icon: "✱" },
  { key: "reading", label: "Reading", icon: "❡" },
  { key: "listening", label: "Listening", icon: "♪" },
  { key: "watching", label: "Watching", icon: "▶" },
  { key: "playing", label: "Playing", icon: "◆" },
];

function renderNowCard(values, opts) {
  const { colors, hideBorder, hideTitle, hideBar, borderRadius, title, cardWidth, font } = opts;
  const items = NOW_FIELDS.filter((f) => values[f.key]);
  const width = cardWidth || 495;
  const startY = bodyStartY(hideTitle);
  // 36 leaves ~4px breathing room between the bottom of one row's value text
  // and the top of the next row's icon box.
  const rowHeight = 36;
  const height = startY + Math.max(items.length, 1) * rowHeight + 15;

  const accent = colors.accent || "#58a6ff";

  const rows = items.length
    ? items
        .map((item, i) => {
          const y = startY + i * rowHeight;
          const delay = i * 100;
          return `<g transform="translate(25, ${y})" class="stagger" style="animation-delay: ${delay}ms">
      <rect x="0" y="-14" width="22" height="22" rx="5" fill="${accent}" fill-opacity="0.12"/>
      <text x="11" y="2" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="700" fill="${accent}">${item.icon}</text>
      <text x="36" y="-2" class="lang-pct">${item.label.toUpperCase()}</text>
      <text x="36" y="14" class="stat-label">${escapeHtml(values[item.key])}</text>
    </g>`;
        })
        .join("\n  ")
    : `<text x="25" y="${startY}" class="stat-label" fill="${colors.muted}">No activity set</text>`;

  return renderCard({
    width,
    height,
    title: title || "Currently",
    colors,
    hideBorder,
    hideTitle,
    hideBar,
    borderRadius,
    body: rows,
    font,
  });
}

module.exports = { renderNowCard, NOW_FIELDS };
