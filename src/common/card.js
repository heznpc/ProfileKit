const { escapeHtml } = require("./utils");

function renderCard({ width, height, title, colors, hideBorder, hideTitle, hideBar, borderRadius, body }) {
  const rx = borderRadius != null ? borderRadius : 6;

  const titleMarkup = hideTitle
    ? ""
    : `<text x="25" y="35" class="header">${escapeHtml(title)}</text>`;

  const accentStops = colors.accent
    ? `<stop offset="0%" stop-color="${colors.accent}"/>
      <stop offset="100%" stop-color="${colors.accent}" stop-opacity="0.6"/>`
    : `<stop offset="0%" stop-color="#3fb950"/>
      <stop offset="40%" stop-color="#a371f7"/>
      <stop offset="100%" stop-color="#f778ba"/>`;

  const barMarkup = hideBar
    ? ""
    : `<rect x="0.5" y="0.5" width="${width - 1}" height="3" fill="url(#accent-grad)" clip-path="url(#card-clip)"/>`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="accent-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      ${accentStops}
    </linearGradient>
    <clipPath id="card-clip">
      <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${rx}"/>
    </clipPath>
  </defs>
  <style>
    .header { font: 600 18px 'Segoe UI', Ubuntu, sans-serif; fill: ${colors.title}; }
    .stat-label { font: 400 14px 'Segoe UI', Ubuntu, sans-serif; fill: ${colors.text}; }
    .stat-value { font: 700 14px 'Segoe UI', Ubuntu, sans-serif; fill: ${colors.title}; }
    .lang-name { font: 400 13px 'Segoe UI', Ubuntu, sans-serif; fill: ${colors.text}; }
    .lang-pct { font: 400 12px 'Segoe UI', Ubuntu, sans-serif; fill: ${colors.muted}; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .stagger { opacity: 0; animation: fadeIn 0.3s ease-in-out forwards; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${rx}"
        fill="${colors.bg}" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
  ${barMarkup}
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
