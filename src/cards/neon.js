const { escapeHtml } = require("../common/utils");

function renderNeonCard({
  text,
  color,
  font,
  size,
  width,
  height,
  colors,
  borderRadius,
  hideBorder,
}) {
  const w = width;
  const h = height;
  const rx = borderRadius != null ? borderRadius : 6;
  const c = color || "#ff2bd1";
  const bg = colors.bg;
  const fSize = size;
  const fontFamily = font || "'Segoe UI', sans-serif";
  const safeText = escapeHtml(text);

  return `<svg role="img" aria-label="${safeText}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <title>${safeText}</title>
  <defs>
    <clipPath id="neon-clip">
      <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"/>
    </clipPath>
    <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.5" result="blur1"/>
      <feGaussianBlur stdDeviation="6" result="blur2"/>
      <feGaussianBlur stdDeviation="14" result="blur3"/>
      <feMerge>
        <feMergeNode in="blur3"/>
        <feMergeNode in="blur2"/>
        <feMergeNode in="blur1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <radialGradient id="neon-bg" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <style>
    @keyframes flicker {
      0%, 18%, 22%, 25%, 53%, 57%, 100% {
        opacity: 1;
      }
      20%, 24%, 55% {
        opacity: 0.4;
      }
    }
    .neon-text { animation: flicker 4s infinite; }
    @media (prefers-reduced-motion: reduce) {
      .neon-text { animation: none; }
    }
  </style>
  <g clip-path="url(#neon-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#neon-bg)"/>
    <text class="neon-text" x="${w / 2}" y="${h / 2 + fSize * 0.35}" text-anchor="middle"
          font-family="${fontFamily}" font-size="${fSize}" font-weight="700"
          fill="${c}" stroke="#ffffff" stroke-width="0.5"
          filter="url(#neon-glow)">${safeText}</text>
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"
        fill="none" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
</svg>`;
}

module.exports = { renderNeonCard };
