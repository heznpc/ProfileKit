const { renderCard } = require("../common/card");
const { icons } = require("../common/icons");
const { formatNumber, escapeHtml, truncate } = require("../common/utils");

const LANG_LEAD = 18;   // circle + gap before language text
const BLOCK_TRAIL = 20; // gap between footer blocks

function wrapText(text, maxChars, maxLines) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxChars && current) {
      lines.push(current);
      if (lines.length >= maxLines) {
        current = "";
        break;
      }
      current = word;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  // Append an ellipsis to the last line if any text was dropped.
  const consumed = lines.join(" ").length;
  if (consumed < text.length && lines.length > 0) {
    let last = lines[lines.length - 1];
    const maxLast = Math.max(1, maxChars - 1);
    if (last.length > maxLast) last = last.slice(0, maxLast).trimEnd();
    lines[lines.length - 1] = last + "…";
  }
  return lines;
}

function renderPinCard(repo, { colors, hideBorder, hideBar, borderRadius, cardWidth, description, font, maxDescLines }) {
  const width = cardWidth || 400;
  const maxChars = Math.floor((width - 50) / 7);
  const desc = description || repo.description;
  // maxDescLines is the layout reserve — the card always allocates this many
  // lines of vertical space, regardless of how much actual text fits. Lets
  // caller pin three side-by-side pins to identical heights even when one has
  // a long description and another has none.
  const maxLines = Math.max(1, Math.min(maxDescLines || 3, 6));
  const descLines = wrapText(desc, maxChars, maxLines);

  const nameY = 35;
  const descStartY = 58;
  const descLineHeight = 18;
  const footerY = descStartY + maxLines * descLineHeight + 15;
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

  // Layout the footer left-to-right but reserve space for stars/forks first so
  // a long language name gets truncated rather than pushing them off-card.
  const footerParts = [];
  const footerEnd = width - 25;
  // Always show stars/forks — even zero. Consistency of footer layout across
  // cards beats saving a few pixels when a repo is new. People come to a
  // profile to gauge social proof; hiding a "0" implies we're hiding
  // something rather than admitting the repo is young.
  const starsStr = formatNumber(repo.stars || 0);
  const forksStr = formatNumber(repo.forks || 0);
  const starsW = starsStr ? 20 + starsStr.length * 7 + 20 : 0;
  const forksW = forksStr ? 20 + forksStr.length * 7 + 20 : 0;
  let fx = 25;

  if (repo.language) {
    const langColor = repo.languageColor || colors.muted;
    const available = footerEnd - fx - LANG_LEAD - BLOCK_TRAIL - starsW - forksW;
    const maxLangChars = Math.max(3, Math.floor(available / 7.5));
    const langText = truncate(repo.language, maxLangChars);
    footerParts.push(
      `<circle cx="${fx + 6}" cy="${footerY}" r="6" fill="${langColor}"/>`,
      `<text x="${fx + LANG_LEAD}" y="${footerY + 4}" class="lang-name">${escapeHtml(langText)}</text>`
    );
    fx += LANG_LEAD + langText.length * 7.5 + BLOCK_TRAIL;
  }

  if (starsStr) {
    footerParts.push(
      `<svg x="${fx}" y="${footerY - 8}" viewBox="0 0 16 16" width="16" height="16" fill="${colors.muted}">${icons.stars}</svg>`,
      `<text x="${fx + 20}" y="${footerY + 4}" class="lang-pct">${starsStr}</text>`
    );
    fx += 20 + starsStr.length * 7 + 20;
  }

  if (forksStr) {
    footerParts.push(
      `<svg x="${fx}" y="${footerY - 8}" viewBox="0 0 16 16" width="16" height="16" fill="${colors.muted}">${icons.forks}</svg>`,
      `<text x="${fx + 20}" y="${footerY + 4}" class="lang-pct">${forksStr}</text>`
    );
  }

  const body = `
    ${nameMarkup}
    ${descMarkup}
    ${footerParts.join("\n    ")}
  `;

  const ariaLabel = desc
    ? `${repo.name}: ${desc}`
    : `${repo.name} repository`;

  return renderCard({
    width,
    height,
    title: "",
    ariaLabel,
    colors,
    hideBorder,
    hideTitle: true,
    hideBar,
    borderRadius,
    body,
    font,
  });
}

module.exports = { renderPinCard };
