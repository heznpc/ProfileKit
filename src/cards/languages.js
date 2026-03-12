const { renderCard } = require("../common/card");
const { escapeHtml } = require("../common/utils");

function renderLanguagesCard(languages, { colors, hideBorder, hideTitle, title, compact }) {
  const cardTitle = title || "Top Languages";

  if (compact) {
    return renderCompact(languages, { colors, hideBorder, hideTitle, cardTitle });
  }
  return renderDefault(languages, { colors, hideBorder, hideTitle, cardTitle });
}

function renderDefault(languages, { colors, hideBorder, hideTitle, cardTitle }) {
  const rowHeight = 28;
  const startY = hideTitle ? 20 : 50;
  const barWidth = 120;
  const height = startY + languages.length * rowHeight + 15;

  const rows = languages
    .map((lang, i) => {
      const y = startY + i * rowHeight;
      const fillWidth = (barWidth * lang.percentage) / 100;
      const delay = i * 150;
      return `<g transform="translate(25, ${y})" class="stagger" style="animation-delay: ${delay}ms">
      <circle cx="5" cy="6" r="5" fill="${lang.color}"/>
      <text x="18" y="10" class="lang-name">${escapeHtml(lang.name)}</text>
      <rect x="140" y="0" width="${barWidth}" height="12" rx="2" fill="${colors.border}"/>
      <rect x="140" y="0" width="${fillWidth}" height="12" rx="2" fill="${lang.color}"/>
      <text x="270" y="10" class="lang-pct">${lang.percentage}%</text>
    </g>`;
    })
    .join("\n  ");

  return renderCard({
    width: 320,
    height,
    title: cardTitle,
    colors,
    hideBorder,
    hideTitle,
    body: rows,
  });
}

function renderCompact(languages, { colors, hideBorder, hideTitle, cardTitle }) {
  const barWidth = 270;
  const startY = hideTitle ? 20 : 50;
  const height = startY + 45;

  // Stacked bar
  let barX = 25;
  const barSegments = languages
    .map((lang) => {
      const w = (barWidth * lang.percentage) / 100;
      const segment = `<rect x="${barX}" y="${startY}" width="${w}" height="10" fill="${lang.color}"${barX === 25 ? ' rx="2"' : ""}/>`;
      barX += w;
      return segment;
    })
    .join("\n    ");

  // Last segment round right corner
  const barGroup = `<g>
    <rect x="25" y="${startY}" width="${barWidth}" height="10" rx="2" fill="${colors.border}"/>
    ${barSegments}
  </g>`;

  // Legend
  const legendY = startY + 22;
  const legendItems = languages
    .map((lang, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 25 + col * 95;
      const y = legendY + row * 18;
      return `<g transform="translate(${x}, ${y})">
      <circle cx="5" cy="5" r="4" fill="${lang.color}"/>
      <text x="14" y="9" class="lang-pct">${escapeHtml(lang.name)} ${lang.percentage}%</text>
    </g>`;
    })
    .join("\n    ");

  const legendRows = Math.ceil(languages.length / 3);
  const totalHeight = startY + 22 + legendRows * 18 + 10;

  return renderCard({
    width: 320,
    height: totalHeight,
    title: cardTitle,
    colors,
    hideBorder,
    hideTitle,
    body: `${barGroup}\n  ${legendItems}`,
  });
}

module.exports = { renderLanguagesCard };
