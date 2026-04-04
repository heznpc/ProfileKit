const { renderCard } = require("../common/card");
const { icons } = require("../common/icons");
const { formatNumber, escapeHtml } = require("../common/utils");

function wrapText(text, maxChars) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function renderPinCard(repo, { colors, hideBorder, hideBar, borderRadius, cardWidth, description }) {
  const width = cardWidth || 400;
  const maxChars = Math.floor((width - 50) / 7);
  const desc = description || repo.description;
  const descLines = wrapText(desc, maxChars);

  const nameY = 35;
  const descStartY = 58;
  const descLineHeight = 18;
  const footerY = descStartY + Math.max(descLines.length, 1) * descLineHeight + 15;
  const height = footerY + 30;

  const nameMarkup = `
    <g transform="translate(25, ${nameY})">
      <svg x="0" y="-12" viewBox="0 0 16 16" width="16" height="16" fill="${colors.icon}">
        ${icons.repos}
      </svg>
      <text x="22" y="0" class="header">${escapeHtml(repo.name)}</text>
    </g>`;

  const descMarkup = descLines
    .map((line, i) => {
      const y = descStartY + i * descLineHeight;
      return `<text x="25" y="${y}" class="stat-label">${escapeHtml(line)}</text>`;
    })
    .join("\n    ");

  const footerParts = [];
  let fx = 25;

  if (repo.language) {
    const langColor = repo.languageColor || colors.muted;
    footerParts.push(
      `<circle cx="${fx + 6}" cy="${footerY}" r="6" fill="${langColor}"/>`,
      `<text x="${fx + 18}" y="${footerY + 4}" class="lang-name">${escapeHtml(repo.language)}</text>`
    );
    fx += 18 + repo.language.length * 7.5 + 20;
  }

  if (repo.stars > 0) {
    footerParts.push(
      `<svg x="${fx}" y="${footerY - 8}" viewBox="0 0 16 16" width="16" height="16" fill="${colors.muted}">${icons.stars}</svg>`,
      `<text x="${fx + 20}" y="${footerY + 4}" class="lang-pct">${formatNumber(repo.stars)}</text>`
    );
    fx += 20 + String(formatNumber(repo.stars)).length * 7 + 20;
  }

  if (repo.forks > 0) {
    footerParts.push(
      `<svg x="${fx}" y="${footerY - 8}" viewBox="0 0 16 16" width="16" height="16" fill="${colors.muted}">${icons.forks}</svg>`,
      `<text x="${fx + 20}" y="${footerY + 4}" class="lang-pct">${formatNumber(repo.forks)}</text>`
    );
  }

  const body = `
    ${nameMarkup}
    ${descMarkup}
    ${footerParts.join("\n    ")}
  `;

  return renderCard({
    width,
    height,
    title: "",
    colors,
    hideBorder,
    hideTitle: true,
    hideBar,
    borderRadius,
    body,
  });
}

module.exports = { renderPinCard };
