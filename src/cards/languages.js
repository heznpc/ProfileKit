const { renderCard } = require("../common/card");
const { bodyStartY } = require("../common/tokens");
const { escapeHtml } = require("../common/utils");

function renderLanguagesCard(languages, { colors, hideBorder, hideTitle, hideBar, borderRadius, title, compact, layout, cardWidth, font }) {
  const cardTitle = title || "Top Languages";
  const opts = { colors, hideBorder, hideTitle, hideBar, borderRadius, cardTitle, cardWidth, font };

  if (layout === "donut") return renderDonut(languages, opts);
  if (compact || layout === "compact") return renderCompact(languages, opts);
  return renderDefault(languages, opts);
}

function renderDefault(languages, { colors, hideBorder, hideTitle, hideBar, borderRadius, cardTitle, cardWidth, font }) {
  const width = cardWidth || 495;
  const rowHeight = 32;
  const startY = bodyStartY(hideTitle);
  const barWidth = Math.min(185, width - 310);
  const barX = width - barWidth - 90;
  const pctX = width - 75;
  const height = startY + languages.length * rowHeight + 15;

  const rows = languages
    .map((lang, i) => {
      const y = startY + i * rowHeight;
      const fillWidth = Math.max((barWidth * lang.percentage) / 100, 3);
      const delay = i * 150;
      return `<g transform="translate(25, ${y})" class="stagger" style="animation-delay: ${delay}ms">
      <circle cx="5" cy="7" r="5" fill="${lang.color}"/>
      <text x="18" y="11" class="lang-name">${escapeHtml(lang.name)}</text>
      <rect x="${barX}" y="1" width="${barWidth}" height="12" rx="6" fill="${colors.border}" opacity="0.4"/>
      <rect x="${barX}" y="1" width="${fillWidth}" height="12" rx="6" fill="${lang.color}"/>
      <text x="${pctX}" y="11" class="lang-pct">${lang.percentage}%</text>
    </g>`;
    })
    .join("\n  ");

  return renderCard({ width, height, title: cardTitle, colors, hideBorder, hideTitle, hideBar, borderRadius, body: rows, font, titleTarget: "username" });
}

function renderCompact(languages, { colors, hideBorder, hideTitle, hideBar, borderRadius, cardTitle, cardWidth, font }) {
  const width = cardWidth || 495;
  const barWidth = width - 50;
  const startY = bodyStartY(hideTitle);

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

  const colWidth = Math.floor((width - 50) / 4);
  const legendY = startY + 24;
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

  return renderCard({ width, height: totalHeight, title: cardTitle, colors, hideBorder, hideTitle, hideBar, borderRadius, body: `${barGroup}\n  ${legendItems}`, font, titleTarget: "username" });
}

function renderDonut(languages, { colors, hideBorder, hideTitle, hideBar, borderRadius, cardTitle, cardWidth, font }) {
  const width = cardWidth || 400;
  const startY = bodyStartY(hideTitle);
  const r = 55;
  const cx = 90;
  const cy = startY + r + 10;
  const circumference = 2 * Math.PI * r;
  const strokeWidth = 18;

  // Donut segments
  const totalPct = languages.reduce((sum, l) => sum + l.percentage, 0);
  let cumulative = 0;
  const segments = languages
    .map((lang) => {
      const pct = lang.percentage / totalPct;
      const segLen = circumference * pct;
      const gap = 2;
      const dashLen = Math.max(segLen - gap, 1);
      const offset = -(cumulative * circumference) + circumference * 0.25;
      cumulative += pct;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${lang.color}" stroke-width="${strokeWidth}"
        stroke-dasharray="${dashLen} ${circumference - dashLen}"
        stroke-dashoffset="${offset}"/>`;
    })
    .join("\n    ");

  // Legend on the right
  const legendX = cx + r + 50;
  const legendStartY = startY + 15;
  const legendItems = languages
    .map((lang, i) => {
      const y = legendStartY + i * 24;
      return `<g transform="translate(${legendX}, ${y})" class="stagger" style="animation-delay: ${i * 100}ms">
      <circle cx="5" cy="6" r="5" fill="${lang.color}"/>
      <text x="16" y="10" class="lang-name">${escapeHtml(lang.name)}</text>
      <text x="${width - legendX - 15}" y="10" class="stat-value" text-anchor="end" fill="${lang.color}">${lang.percentage}%</text>
    </g>`;
    })
    .join("\n    ");

  const contentHeight = Math.max((cy + r + 15) - startY, languages.length * 24 + 10);
  const height = startY + contentHeight + 10;

  const body = `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors.border}" stroke-width="${strokeWidth}" opacity="0.3"/>
    ${segments}
    ${legendItems}`;

  return renderCard({ width, height, title: cardTitle, colors, hideBorder, hideTitle, hideBar, borderRadius, body, font, titleTarget: "username" });
}

module.exports = { renderLanguagesCard };
