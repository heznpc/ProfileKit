const { renderCard } = require("../common/card");
const { escapeHtml } = require("../common/utils");

function parseItems(raw) {
  if (!raw) return [];
  return raw
    .split("|")
    .map((chunk) => chunk.split(";")[0].trim())
    .filter(Boolean);
}

function renderTocCard(rawItems, opts) {
  const { colors, hideBorder, hideTitle, hideBar, borderRadius, title, cardWidth } = opts;
  const items = parseItems(rawItems);
  const width = cardWidth || 495;
  const startY = hideTitle ? 30 : 55;
  const rowHeight = 28;
  const height = startY + Math.max(items.length, 1) * rowHeight + 15;
  const accent = colors.accent || "#58a6ff";

  const rows = items.length
    ? items
        .map((text, i) => {
          const y = startY + i * rowHeight;
          const num = String(i + 1).padStart(2, "0");
          const delay = i * 80;
          const dotsX1 = 60 + text.length * 7.2 + 5;
          const dotsX2 = width - 35;
          return `<g class="stagger" style="animation-delay: ${delay}ms">
      <text x="25" y="${y}" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="12" fill="${accent}">${num}</text>
      <text x="56" y="${y}" class="stat-label">${escapeHtml(text)}</text>
      ${dotsX2 > dotsX1 ? `<line x1="${dotsX1}" y1="${y - 4}" x2="${dotsX2}" y2="${y - 4}" stroke="${colors.border}" stroke-width="1" stroke-dasharray="2,3" opacity="0.6"/>` : ""}
    </g>`;
        })
        .join("\n  ")
    : `<text x="25" y="${startY}" class="stat-label" fill="${colors.muted}">No items</text>`;

  return renderCard({
    width,
    height,
    title: title || "Contents",
    colors,
    hideBorder,
    hideTitle,
    hideBar,
    borderRadius,
    body: rows,
  });
}

module.exports = { renderTocCard };
