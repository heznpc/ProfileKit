const { escapeHtml } = require("../common/utils");

// Perceived brightness via the standard luma weights. Used to pick clone
// colors that contrast against the actual background instead of hard-coding
// neon RGB that disappears on light themes.
function isLightHex(hex) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 128;
}

function renderGlitchCard({
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
  const baseColor = color || colors.title;
  const bg = colors.bg;
  const fSize = size;
  const fontFamily = font || "'Segoe UI', sans-serif";
  const safeText = escapeHtml(text);
  const cx = w / 2;
  const cy = h / 2 + fSize * 0.35;
  const lightBg = isLightHex(bg);
  const cloneR = lightBg ? "#c70039" : "#ff003c";
  const cloneC = lightBg ? "#1a8fb3" : "#00ffff";

  return `<svg role="img" aria-label="${safeText}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <title>${safeText}</title>
  <defs>
    <clipPath id="glitch-clip">
      <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"/>
    </clipPath>
  </defs>
  <style>
    @keyframes glitch-r {
      0%, 100% { transform: translate(0, 0); }
      20% { transform: translate(-3px, 1px); }
      40% { transform: translate(2px, -1px); }
      60% { transform: translate(-2px, 0); }
      80% { transform: translate(3px, -1px); }
    }
    @keyframes glitch-c {
      0%, 100% { transform: translate(0, 0); }
      20% { transform: translate(3px, -1px); }
      40% { transform: translate(-2px, 1px); }
      60% { transform: translate(2px, 1px); }
      80% { transform: translate(-3px, 0); }
    }
    @keyframes glitch-clip-1 {
      0%, 90%, 100% { clip-path: inset(0 0 100% 0); }
      30% { clip-path: inset(20% 0 60% 0); }
      40% { clip-path: inset(50% 0 30% 0); }
      55% { clip-path: inset(70% 0 10% 0); }
    }
    @keyframes glitch-clip-2 {
      0%, 85%, 100% { clip-path: inset(0 0 100% 0); }
      35% { clip-path: inset(40% 0 40% 0); }
      45% { clip-path: inset(10% 0 70% 0); }
      65% { clip-path: inset(60% 0 25% 0); }
    }
    .g-r { animation: glitch-r 2.2s infinite steps(1); }
    .g-c { animation: glitch-c 2.2s infinite steps(1); }
    .g-slice-1 { animation: glitch-clip-1 2.8s infinite linear; }
    .g-slice-2 { animation: glitch-clip-2 3.4s infinite linear; }
    .glitch-text {
      font: 800 ${fSize}px ${fontFamily};
      text-anchor: middle;
    }
    @media (prefers-reduced-motion: reduce) {
      .g-r, .g-c, .g-slice-1, .g-slice-2 { animation: none; }
      .g-slice-1, .g-slice-2 { display: none; }
    }
  </style>
  <g clip-path="url(#glitch-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>
    <text class="glitch-text g-r" x="${cx}" y="${cy}" fill="${cloneR}" opacity="0.85">${safeText}</text>
    <text class="glitch-text g-c" x="${cx}" y="${cy}" fill="${cloneC}" opacity="0.85">${safeText}</text>
    <text class="glitch-text" x="${cx}" y="${cy}" fill="${baseColor}">${safeText}</text>
    <text class="glitch-text g-slice-1" x="${cx}" y="${cy}" fill="${baseColor}" transform="translate(-2,0)">${safeText}</text>
    <text class="glitch-text g-slice-2" x="${cx}" y="${cy}" fill="${baseColor}" transform="translate(2,0)">${safeText}</text>
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"
        fill="none" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
</svg>`;
}

module.exports = { renderGlitchCard };
