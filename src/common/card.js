const { escapeHtml } = require("./utils");

function renderCard({ width, height, title, colors, hideBorder, hideTitle, body }) {
  const titleMarkup = hideTitle
    ? ""
    : `<text x="25" y="35" class="header">${escapeHtml(title)}</text>`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .header { font: 600 18px 'Segoe UI', Ubuntu, sans-serif; fill: ${colors.title}; }
    .stat-label { font: 400 14px 'Segoe UI', Ubuntu, sans-serif; fill: ${colors.text}; }
    .stat-value { font: 600 14px 'Segoe UI', Ubuntu, sans-serif; fill: ${colors.text}; }
    .lang-name { font: 400 12px 'Segoe UI', Ubuntu, sans-serif; fill: ${colors.text}; }
    .lang-pct { font: 400 12px 'Segoe UI', Ubuntu, sans-serif; fill: ${colors.muted}; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .stagger { opacity: 0; animation: fadeIn 0.3s ease-in-out forwards; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="4.5"
        fill="${colors.bg}" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
  ${titleMarkup}
  ${body}
</svg>`;
}

function renderError(message, colors) {
  const body = `<text x="25" y="40" class="stat-label" fill="#f85149">${escapeHtml(message)}</text>`;
  return renderCard({
    width: 495,
    height: 70,
    title: "",
    colors,
    hideBorder: false,
    hideTitle: true,
    body,
  });
}

module.exports = { renderCard, renderError };
