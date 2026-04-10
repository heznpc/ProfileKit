const { escapeHtml } = require("./utils");
const FONTS = require("../data/fonts.json");

const DEFAULT_FAMILY = "'Segoe UI', Ubuntu, sans-serif";
const DEFAULT_MONO_FAMILY = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

// Resolve a font key to its embed CSS + computed font-family stack. Cards
// that pass an unknown key fall back silently to whatever fallback they
// specified (typically the system sans for data cards, or monospace for
// terminal/matrix).
function resolveFont(key, fallback = DEFAULT_FAMILY) {
  const f = key && FONTS[key];
  if (!f) return { embedCss: "", family: fallback };
  return {
    embedCss: f.css,
    family: `'${f.family}', ${fallback}`,
  };
}

function renderCard({ width, height, title, ariaLabel, colors, hideBorder, hideTitle, hideBar, borderRadius, body, font }) {
  const rx = borderRadius != null ? borderRadius : 6;
  const { embedCss, family } = resolveFont(font);

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

  const a11y = ariaLabel || title;
  // Only emit role/aria-label/<title> when a label exists. role="img" with an
  // empty aria-label is a WAI-ARIA spec violation; treat unlabelled cards as
  // decorative instead.
  const a11ySafe = a11y ? escapeHtml(a11y) : "";
  const svgA11yAttrs = a11y ? `role="img" aria-label="${a11ySafe}"` : "";
  const titleEl = a11y ? `<title>${a11ySafe}</title>` : "";

  return `<svg ${svgA11yAttrs} width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${titleEl}
  <defs>
    <linearGradient id="accent-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      ${accentStops}
    </linearGradient>
    <clipPath id="card-clip">
      <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${rx}"/>
    </clipPath>
  </defs>
  <style>${embedCss}
    .header { font: 700 18px ${family}; fill: ${colors.title}; }
    .stat-label { font: 400 14px ${family}; fill: ${colors.text}; }
    .stat-value { font: 700 14px ${family}; fill: ${colors.title}; }
    .lang-name { font: 400 13px ${family}; fill: ${colors.text}; }
    .lang-pct { font: 400 12px ${family}; fill: ${colors.muted}; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .stagger { animation: fadeIn 0.3s ease-in-out both; }
    @media (prefers-reduced-motion: reduce) {
      .stagger { animation: none; opacity: 1; }
    }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${rx}"
        fill="${colors.bg}" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
  ${barMarkup}
  ${titleMarkup}
  ${body}
</svg>`;
}

function renderError(message, { colors, width, font } = {}) {
  const w = width || 495;
  const body = `<text x="25" y="40" class="stat-label" fill="#f85149">${escapeHtml(message)}</text>`;
  return renderCard({
    width: w,
    height: 70,
    title: "",
    ariaLabel: `Error: ${message}`,
    colors,
    hideBorder: false,
    hideTitle: true,
    body,
    font,
  });
}

module.exports = { renderCard, renderError, resolveFont, DEFAULT_FAMILY, DEFAULT_MONO_FAMILY };
