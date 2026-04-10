const { renderCard } = require("../common/card");
const { bodyStartY } = require("../common/tokens");
const { escapeHtml, parseArray } = require("../common/utils");

function parseTags(raw) {
  return parseArray(raw).map((t) => {
    const [name, color] = t.split(":");
    let c = color ? color.trim() : null;
    if (c && !c.startsWith("#")) c = `#${c}`;
    return { name: name.trim(), color: c };
  });
}

function renderTagsCard(rawTags, opts) {
  const { colors, hideBorder, hideTitle, hideBar, borderRadius, title, cardWidth, font } = opts;
  const tags = parseTags(rawTags);
  const width = cardWidth || 495;
  const padding = 25;
  const startY = bodyStartY(hideTitle);
  const tagHeight = 28;
  const tagSpacing = 8;
  const tagPadX = 14;
  const accent = colors.accent || "#58a6ff";

  let x = padding;
  let y = startY;
  const positioned = [];
  for (const tag of tags) {
    const tagWidth = Math.max(40, tag.name.length * 7.5 + tagPadX * 2);
    if (x + tagWidth > width - padding && x > padding) {
      x = padding;
      y += tagHeight + tagSpacing;
    }
    positioned.push({ ...tag, x, y, width: tagWidth });
    x += tagWidth + tagSpacing;
  }

  const height = (tags.length ? y + tagHeight : startY) + 20;

  const pills = tags.length
    ? positioned
        .map((tag, i) => {
          const c = tag.color || accent;
          const delay = i * 60;
          return `<g class="stagger" style="animation-delay: ${delay}ms">
      <rect x="${tag.x}" y="${tag.y}" width="${tag.width}" height="${tagHeight}" rx="14"
            fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-opacity="0.45" stroke-width="1"/>
      <text x="${tag.x + tag.width / 2}" y="${tag.y + tagHeight / 2 + 4.5}" text-anchor="middle"
            font-family="'Segoe UI', sans-serif" font-size="13" font-weight="500" fill="${c}">${escapeHtml(tag.name)}</text>
    </g>`;
        })
        .join("\n  ")
    : `<text x="25" y="${startY}" class="stat-label" fill="${colors.muted}">No tags</text>`;

  return renderCard({
    width,
    height,
    title: title || "Tech Stack",
    colors,
    hideBorder,
    hideTitle,
    hideBar,
    borderRadius,
    body: pills,
    font,
  });
}

module.exports = { renderTagsCard };
