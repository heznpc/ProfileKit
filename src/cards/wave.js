const { escapeHtml } = require("../common/utils");
const { resolveFont } = require("../common/card");

function renderWaveCard({
  text,
  color,
  width,
  height,
  waves,
  colors,
  borderRadius,
  hideBorder,
  font,
}) {
  const { embedCss, family } = resolveFont(font);
  const w = width;
  const h = height;
  const c = color || colors.accent || "#58a6ff";
  const rx = borderRadius != null ? borderRadius : 6;
  const layerCount = Math.max(1, Math.min(waves, 5));

  const layers = [];
  for (let i = 0; i < layerCount; i++) {
    const points = [];
    const amp = 14 + i * 5;
    const freq = 0.014 + i * 0.005;
    const offsetY = h * 0.55 + i * 14;
    const phase = i * 1.3;
    points.push(`M -50 ${offsetY}`);
    for (let x = -50; x <= w + 100; x += 10) {
      const y = offsetY + amp * Math.sin(x * freq + phase);
      points.push(`L ${x} ${y.toFixed(1)}`);
    }
    points.push(`L ${w + 100} ${h}`);
    points.push(`L -50 ${h}`);
    points.push("Z");
    const opacity = (0.22 - i * 0.05).toFixed(2);
    const dur = 5 + i * 1.5;
    const dist = 40 + i * 15;
    layers.push(
      `<path d="${points.join(" ")}" fill="${c}" opacity="${opacity}">
        <animateTransform attributeName="transform" type="translate" values="0,0; -${dist},0; 0,0" dur="${dur}s" repeatCount="indefinite"/>
      </path>`
    );
  }

  const safeText = text ? escapeHtml(text) : "";
  const textMarkup = safeText
    ? `<text x="${w / 2}" y="${h / 2 + 8}" text-anchor="middle"
        font-family="${family}" font-size="32" font-weight="700" fill="${colors.title}">
        ${safeText}
        <animate attributeName="opacity" from="0" to="1" dur="0.8s" fill="freeze"/>
      </text>`
    : "";

  const ariaLabel = safeText || "Wave";

  return `<svg role="img" aria-label="${ariaLabel}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <title>${ariaLabel}</title>
  <style>${embedCss}@media (prefers-reduced-motion: reduce) { animate, animateTransform { display: none; } }</style>
  <defs>
    <clipPath id="wave-clip">
      <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#wave-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${colors.bg}"/>
    ${layers.join("\n    ")}
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"
        fill="none" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
  ${textMarkup}
</svg>`;
}

module.exports = { renderWaveCard };
