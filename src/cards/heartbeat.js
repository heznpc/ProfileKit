const { escapeHtml } = require("../common/utils");
const { resolveFont, DEFAULT_MONO_FAMILY } = require("../common/card");

function renderHeartbeatCard({
  text,
  color,
  bpm,
  width,
  height,
  colors,
  borderRadius,
  hideBorder,
  font,
}) {
  const w = width;
  const h = height;
  const rx = borderRadius != null ? borderRadius : 6;
  const accent = color || "#f85149";
  const bg = colors.bg;
  const padding = 20;
  // If the user picks a font, use it for both states (text + bare BPM). If
  // not, the bare BPM falls back to mono and the text-with-label uses sans.
  const safeText = text ? escapeHtml(text) : "";
  const { embedCss, family: textFamily } = resolveFont(font);
  const monoFamily = font ? textFamily : DEFAULT_MONO_FAMILY;

  // PQRST waveform: flat → P bump → QRS spike → T bump → flat. Drawn across
  // multiple cycle widths so the looped translate doesn't reveal a seam.
  const cycleW = 240;
  const cy = h / 2 + 8;
  const cycles = Math.ceil((w + cycleW * 2) / cycleW) + 1;

  const segments = [`M ${-cycleW} ${cy}`];
  for (let i = 0; i < cycles; i++) {
    const ox = i * cycleW - cycleW;
    segments.push(
      `L ${ox + 30} ${cy}`,
      `Q ${ox + 40} ${cy - 6} ${ox + 50} ${cy}`,
      `L ${ox + 65} ${cy}`,
      `L ${ox + 72} ${cy + 8}`,
      `L ${ox + 80} ${cy - 38}`,
      `L ${ox + 88} ${cy + 14}`,
      `L ${ox + 100} ${cy}`,
      `L ${ox + 130} ${cy}`,
      `Q ${ox + 150} ${cy - 12} ${ox + 170} ${cy}`,
      `L ${ox + cycleW} ${cy}`
    );
  }
  const path = segments.join(" ");

  const cycleDur = 60 / bpm;
  const ariaLabel = safeText ? `${safeText} (${bpm} BPM)` : `Heartbeat ${bpm} BPM`;

  return `<svg role="img" aria-label="${ariaLabel}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <title>${ariaLabel}</title>
  <style>${embedCss}@media (prefers-reduced-motion: reduce) { animate, animateTransform { display: none; } }</style>
  <defs>
    <clipPath id="hb-clip">
      <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"/>
    </clipPath>
    <linearGradient id="hb-fade" x1="0%" x2="100%">
      <stop offset="0%" stop-color="${bg}" stop-opacity="1"/>
      <stop offset="8%" stop-color="${bg}" stop-opacity="0"/>
      <stop offset="92%" stop-color="${bg}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="1"/>
    </linearGradient>
    <filter id="hb-glow">
      <feGaussianBlur stdDeviation="1.5"/>
    </filter>
    <path id="hb-path" d="${path}" fill="none" stroke="${accent}" stroke-linecap="round" stroke-linejoin="round"/>
  </defs>
  <g clip-path="url(#hb-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>
    <g>
      <use href="#hb-path" stroke-width="2.5" filter="url(#hb-glow)" opacity="0.5"/>
      <use href="#hb-path" stroke-width="2"/>
      <animateTransform attributeName="transform" type="translate" from="0 0" to="${-cycleW} 0" dur="${cycleDur.toFixed(2)}s" repeatCount="indefinite"/>
    </g>
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#hb-fade)"/>
    ${
      safeText
        ? `<text x="${padding}" y="${padding + 10}" font-family="${textFamily}" font-size="14" font-weight="600" fill="${colors.title}">${safeText}</text>
           <text x="${padding}" y="${padding + 28}" font-family="${textFamily}" font-size="11" fill="${colors.muted}">${bpm} BPM</text>`
        : `<text x="${padding}" y="${padding + 10}" font-family="${monoFamily}" font-size="13" font-weight="700" fill="${accent}">${bpm} BPM</text>`
    }
    <circle cx="${w - padding - 4}" cy="${padding + 4}" r="4" fill="${accent}">
      <animate attributeName="opacity" values="1;0.3;1" dur="${cycleDur.toFixed(2)}s" repeatCount="indefinite"/>
      <animate attributeName="r" values="4;5.5;4" dur="${cycleDur.toFixed(2)}s" repeatCount="indefinite"/>
    </circle>
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"
        fill="none" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
</svg>`;
}

module.exports = { renderHeartbeatCard };
