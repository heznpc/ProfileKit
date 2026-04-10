const { escapeHtml, makeRng } = require("../common/utils");

function renderRadarCard({
  text,
  color,
  width,
  height,
  blips,
  speed,
  colors,
  borderRadius,
  hideBorder,
  seed,
}) {
  const w = width;
  const h = height;
  const rx = borderRadius != null ? borderRadius : 6;
  const accent = color || "#3fb950";
  const bg = colors.bg;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 20;
  const rotateDur = speed;
  const rng = makeRng(seed);
  const blipCount = blips;

  const rings = [];
  for (let i = 1; i <= 4; i++) {
    rings.push(
      `<circle cx="${cx}" cy="${cy}" r="${(radius * i) / 4}" fill="none" stroke="${accent}" stroke-width="1" opacity="${i === 4 ? 0.6 : 0.25}"/>`
    );
  }
  const cross = `
    <line x1="${cx - radius}" y1="${cy}" x2="${cx + radius}" y2="${cy}" stroke="${accent}" stroke-width="1" opacity="0.25"/>
    <line x1="${cx}" y1="${cy - radius}" x2="${cx}" y2="${cy + radius}" stroke="${accent}" stroke-width="1" opacity="0.25"/>
    <line x1="${cx - radius * 0.707}" y1="${cy - radius * 0.707}" x2="${cx + radius * 0.707}" y2="${cy + radius * 0.707}" stroke="${accent}" stroke-width="1" opacity="0.15"/>
    <line x1="${cx + radius * 0.707}" y1="${cy - radius * 0.707}" x2="${cx - radius * 0.707}" y2="${cy + radius * 0.707}" stroke="${accent}" stroke-width="1" opacity="0.15"/>
  `;

  // 90° wedge from straight up to straight right, rotated for the sweep effect.
  const sweep = `
    <defs>
      <linearGradient id="sweep-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g>
      <path d="M ${cx} ${cy} L ${cx} ${cy - radius} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy} Z" fill="url(#sweep-grad)"/>
      <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - radius}" stroke="${accent}" stroke-width="2"/>
      <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="${rotateDur}s" repeatCount="indefinite"/>
    </g>
  `;

  const blipMarkup = [];
  for (let i = 0; i < blipCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = (0.25 + rng() * 0.7) * radius;
    const bx = (cx + Math.cos(angle) * dist).toFixed(1);
    const by = (cy + Math.sin(angle) * dist).toFixed(1);
    const delay = (rng() * rotateDur).toFixed(2);
    blipMarkup.push(
      `<circle cx="${bx}" cy="${by}" r="3" fill="${accent}">
        <animate attributeName="opacity" values="0;1;0" dur="${rotateDur}s" begin="${delay}s" repeatCount="indefinite"/>
        <animate attributeName="r" values="2;5;2" dur="${rotateDur}s" begin="${delay}s" repeatCount="indefinite"/>
      </circle>`
    );
  }

  const safeText = text ? escapeHtml(text) : "";
  const labelMarkup = safeText
    ? `<text x="${cx}" y="${cy + radius + 18}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="${accent}" letter-spacing="2">${safeText}</text>`
    : "";

  const ariaLabel = safeText ? `Radar: ${safeText}` : "Radar animation";

  return `<svg role="img" aria-label="${ariaLabel}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <title>${ariaLabel}</title>
  <style>@media (prefers-reduced-motion: reduce) { animate, animateTransform { display: none; } }</style>
  <defs>
    <clipPath id="rd-clip">
      <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#rd-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>
    ${rings.join("\n    ")}
    ${cross}
    ${blipMarkup.join("\n    ")}
    ${sweep}
    <circle cx="${cx}" cy="${cy}" r="3" fill="${accent}"/>
    ${labelMarkup}
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"
        fill="none" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
</svg>`;
}

module.exports = { renderRadarCard };
