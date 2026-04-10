const { renderCard } = require("../common/card");
const { bodyStartY } = require("../common/tokens");
const { escapeHtml } = require("../common/utils");

function parseItems(raw) {
  if (!raw) return [];
  return raw
    .split("|")
    .map((chunk) => {
      const parts = chunk.split(";").map((s) => s.trim());
      return {
        when: parts[0] || "",
        title: parts[1] || "",
        desc: parts[2] || "",
      };
    })
    .filter((it) => it.when || it.title);
}

function renderTimelineCard(rawItems, opts) {
  const { colors, hideBorder, hideTitle, hideBar, borderRadius, title, cardWidth, font } = opts;
  const items = parseItems(rawItems);
  const width = cardWidth || 495;
  const startY = bodyStartY(hideTitle);
  const itemHeight = 58;
  const height = startY + Math.max(items.length, 1) * itemHeight + 10;
  const lineX = 45;
  const accent = colors.accent || "#58a6ff";

  // Each item's node circle sits at nodeY; "when" / title / desc baselines are
  // chosen so the title's vertical center aligns with the node center.
  const nodeOffset = 16;
  const verticalLine =
    items.length > 1
      ? `<line x1="${lineX}" y1="${startY + nodeOffset}" x2="${lineX}" y2="${startY + (items.length - 1) * itemHeight + nodeOffset}"
            stroke="${colors.border}" stroke-width="2"/>`
      : "";

  const nodes = items.length
    ? items
        .map((item, i) => {
          const y = startY + i * itemHeight;
          const nodeY = y + nodeOffset;
          const delay = i * 150;
          const desc = item.desc
            ? `<text x="${lineX + 22}" y="${y + 42}" class="lang-pct">${escapeHtml(item.desc)}</text>`
            : "";
          return `<g class="stagger" style="animation-delay: ${delay}ms">
      <circle cx="${lineX}" cy="${nodeY}" r="7" fill="${colors.bg}" stroke="${accent}" stroke-width="2.5"/>
      <circle cx="${lineX}" cy="${nodeY}" r="3" fill="${accent}"/>
      <text x="${lineX + 22}" y="${y + 12}" class="lang-pct" fill="${accent}">${escapeHtml(item.when)}</text>
      <text x="${lineX + 22}" y="${y + 28}" class="stat-value">${escapeHtml(item.title)}</text>
      ${desc}
    </g>`;
        })
        .join("\n  ")
    : `<text x="25" y="${startY}" class="stat-label" fill="${colors.muted}">No items</text>`;

  return renderCard({
    width,
    height,
    title: title || "Timeline",
    colors,
    hideBorder,
    hideTitle,
    hideBar,
    borderRadius,
    body: verticalLine + nodes,
    font,
  });
}

module.exports = { renderTimelineCard };
