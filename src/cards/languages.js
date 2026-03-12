const { renderCard } = require("../common/card");
const { escapeHtml } = require("../common/utils");

function renderLanguagesCard(languages, { colors, hideBorder, hideTitle, hideBar, borderRadius, title, compact }) {
  const cardTitle = title || "Top Languages";

  if (compact) {
    return renderCompact(languages, { colors, hideBorder, hideTitle, hideBar, borderRadius, cardTitle });
  }
  return renderDefault(languages, { colors, hideBorder, hideTitle, hideBar, borderRadius, cardTitle });
}

function renderDefault(languages, { colors, hideBorder, hideTitle, hideBar, borderRadius, cardTitle }) {
  const rowHeight = 32;
  const startY = hideTitle ? 25 : 55;
  const barWidth = 185;
  const height = startY + languages.length * rowHeight + 15;

  const rows = languages
    .map((lang, i) => {
      const y = startY + i * rowHeight;
      const fillWidth = Math.max((barWidth * lang.percentage) / 100, 3);
      const delay = i * 150;
      return `<g transform="translate(25, ${y})" class="stagger" style="animation-delay: ${delay}ms">
      <circle cx="5" cy="7" r="5" fill="${lang.color}"/>
      <text x="18" y="11" class="lang-name">${escapeHtml(lang.name)}</text>
      <rect x="220" y="1" width="${barWidth}" height="12" rx="6" fill="${colors.border}" opacity="0.4"/>
      <rect x="220" y="1" width="${fillWidth}" height="12" rx="6" fill="${lang.color}"/>
      <text x="420" y="11" class="lang-pct">${lang.percentage}%</text>
    </g>`;
    })
    .join("\n  ");

  return renderCard({
    width: 495,
    height,
    title: cardTitle,
    colors,
    hideBorder,
    hideTitle,
    hideBar,
    borderRadius,
    body: rows,
  });
}

function renderCompact(languages, { colors, hideBorder, hideTitle, hideBar, borderRadius, cardTitle }) {
  const barWidth = 445;
  const startY = hideTitle ? 25 : 55;

  const totalPct = languages.reduce((sum, l) => sum + l.percentage, 0);
  let barX = 25;
  const barSegments = languages
    .map((lang) => {
      const w = (barWidth * lang.percentage) / totalPct;
      const segment = `<rect x="${barX}" y="${startY}" width="${w}" height="10" fill="${lang.color}"/>`;
      barX += w;
      return segment;
    })
    .join("\n    ");

  const barGroup = `<defs>
    <clipPath id="bar-clip">
      <rect x="25" y="${startY}" width="${barWidth}" height="10" rx="5"/>
    </clipPath>
  </defs>
  <g clip-path="url(#bar-clip)">
    <rect x="25" y="${startY}" width="${barWidth}" height="10" fill="${colors.border}" opacity="0.4"/>
    ${barSegments}
  </g>`;

  const legendY = startY + 24;
  const colWidth = 110;
  const legendItems = languages
    .map((lang, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 25 + col * colWidth;
      const y = legendY + row * 20;
      return `<g transform="translate(${x}, ${y})">
      <circle cx="5" cy="5" r="4" fill="${lang.color}"/>
      <text x="14" y="9" class="lang-pct">${escapeHtml(lang.name)} ${lang.percentage}%</text>
    </g>`;
    })
    .join("\n    ");

  const legendRows = Math.ceil(languages.length / 4);
  const totalHeight = startY + 24 + legendRows * 20 + 12;

  return renderCard({
    width: 495,
    height: totalHeight,
    title: cardTitle,
    colors,
    hideBorder,
    hideTitle,
    hideBar,
    borderRadius,
    body: `${barGroup}\n  ${legendItems}`,
  });
}

module.exports = { renderLanguagesCard };
