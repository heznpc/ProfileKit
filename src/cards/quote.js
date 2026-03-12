const { renderCard } = require("../common/card");
const { escapeHtml } = require("../common/utils");

function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function renderQuoteCard(quote, { colors, hideBorder, hideBar, borderRadius, width }) {
  const cardWidth = width || 495;
  const maxChars = Math.floor(cardWidth / 8.5);
  const lines = wrapText(quote.text, maxChars);
  const lineHeight = 22;
  const startY = 50;
  const textHeight = lines.length * lineHeight;
  const height = startY + textHeight + 45;

  const decorQuote = `<text x="20" y="55" font-family="Georgia, serif" font-size="60" fill="${colors.muted}" opacity="0.25">\u201C</text>`;

  const quoteMarkup = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      let display = escapeHtml(line);
      if (i === 0) display = `\u201C${display}`;
      if (i === lines.length - 1) display = `${display}\u201D`;
      return `<text x="40" y="${y}" class="stat-label" font-style="italic">${display}</text>`;
    })
    .join("\n    ");

  const authorY = startY + textHeight + 20;
  const authorMarkup = `<text x="${cardWidth - 25}" y="${authorY}" text-anchor="end" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="13" font-weight="600" fill="${colors.title}">\u2014 ${escapeHtml(quote.author)}</text>`;

  const body = `${decorQuote}\n    ${quoteMarkup}\n    ${authorMarkup}`;

  return renderCard({
    width: cardWidth,
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

module.exports = { renderQuoteCard };
