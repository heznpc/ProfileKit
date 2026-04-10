const { escapeHtml, makeRng } = require("../common/utils");
const { resolveFont } = require("../common/card");

function renderEqualizerCard({
  bars,
  color,
  label,
  width,
  height,
  colors,
  borderRadius,
  hideBorder,
  seed,
  font,
}) {
  const w = width;
  const h = height;
  const rx = borderRadius != null ? borderRadius : 6;
  const accent = color || colors.accent || "#3fb950";
  const bg = colors.bg;
  const { embedCss, family } = resolveFont(font);
  const barCount = Math.max(4, Math.min(bars, 60));
  const padding = 24;
  const labelH = label ? 24 : 0;
  const eqAreaTop = padding + labelH;
  const eqAreaH = h - eqAreaTop - padding;
  const totalBarSpace = w - padding * 2;
  const barWidth = Math.max(2, Math.floor((totalBarSpace / barCount) * 0.6));
  const barGap = (totalBarSpace - barCount * barWidth) / (barCount - 1);
  const baseY = eqAreaTop + eqAreaH;
  const minH = 6;
  const maxH = eqAreaH;
  const rng = makeRng(seed);

  const barElements = [];
  for (let i = 0; i < barCount; i++) {
    const x = padding + i * (barWidth + barGap);
    const heights = [];
    const steps = 6;
    for (let k = 0; k < steps; k++) {
      heights.push(Math.round(minH + rng() * (maxH - minH)));
    }
    heights.push(heights[0]);
    const ys = heights.map((hh) => baseY - hh);
    const dur = (1 + rng() * 0.8).toFixed(2);
    const delay = (-rng() * 1.5).toFixed(2);

    barElements.push(
      `<rect x="${x}" y="${baseY - minH}" width="${barWidth}" height="${minH}" rx="1.5" fill="${accent}">
        <animate attributeName="height" values="${heights.join(";")}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
        <animate attributeName="y" values="${ys.join(";")}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
      </rect>`
    );
  }

  const labelMarkup = label
    ? `<text x="${padding}" y="${padding + 6}" font-family="${family}" font-size="13" font-weight="600" fill="${colors.title}">${escapeHtml(label)}</text>
       <circle cx="${w - padding - 4}" cy="${padding}" r="4" fill="#f85149">
         <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
       </circle>
       <text x="${w - padding - 14}" y="${padding + 5}" text-anchor="end" font-family="${family}" font-size="11" fill="${colors.muted}">LIVE</text>`
    : "";

  const ariaLabel = label ? `${escapeHtml(label)} equalizer` : "Audio equalizer animation";

  return `<svg role="img" aria-label="${ariaLabel}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <title>${ariaLabel}</title>
  <style>${embedCss}@media (prefers-reduced-motion: reduce) { animate, animateTransform { display: none; } }</style>
  <defs>
    <clipPath id="eq-clip">
      <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#eq-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>
    ${labelMarkup}
    ${barElements.join("\n    ")}
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"
        fill="none" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
</svg>`;
}

module.exports = { renderEqualizerCard };
