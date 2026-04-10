const { escapeHtml, makeRng } = require("../common/utils");

const CHARS =
  "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+=";

// Pre-escape the alphabet (only `&` needs escaping) so the render hot path
// doesn't run escapeHtml on every character.
const CHARS_ESCAPED = Array.from(CHARS, (c) => (c === "&" ? "&amp;" : c));

function renderMatrixCard({
  text,
  color,
  width,
  height,
  density,
  speed,
  colors,
  borderRadius,
  hideBorder,
  seed,
}) {
  const w = width;
  const h = height;
  const rx = borderRadius != null ? borderRadius : 6;
  const c = color || "#3fb950";
  const bg = colors.bg;
  const rng = makeRng(seed);

  const colSpacing = 18;
  const cols = Math.max(8, Math.floor(w / colSpacing));
  const colCount = Math.min(cols, Math.floor(density * cols));
  const charsPerCol = 12;
  const fontSize = 14;
  const lineH = 16;
  const colHeight = charsPerCol * lineH;

  const columns = [];
  for (let i = 0; i < colCount; i++) {
    const x = (i + 0.5) * (w / colCount);
    const dur = (4 + rng() * 4) / speed;
    const delay = -rng() * dur;

    const charElements = [];
    for (let j = 0; j < charsPerCol; j++) {
      const ch = CHARS_ESCAPED[Math.floor(rng() * CHARS_ESCAPED.length)];
      const y = j * lineH;
      const opacity = j === charsPerCol - 1 ? 1 : (0.15 + (j / charsPerCol) * 0.55).toFixed(2);
      const fill = j === charsPerCol - 1 ? "#ffffff" : c;
      // font-family/size/text-anchor are inherited from the wrapping <g>; only
      // the per-glyph attributes are emitted here.
      charElements.push(
        `<text y="${y}" fill="${fill}" opacity="${opacity}">${ch}</text>`
      );
    }

    columns.push(
      `<g transform="translate(${x.toFixed(1)}, 0)">
        <g>
          ${charElements.join("\n          ")}
          <animateTransform attributeName="transform" type="translate" values="0,${-colHeight}; 0,${h + 20}" dur="${dur.toFixed(2)}s" begin="${delay.toFixed(2)}s" repeatCount="indefinite"/>
        </g>
      </g>`
    );
  }

  const safeText = text ? escapeHtml(text) : "";
  const overlay = safeText
    ? `<rect x="0" y="${h / 2 - 32}" width="${w}" height="64" fill="${bg}" opacity="0.55"/>
       <text x="${w / 2}" y="${h / 2 + 10}" text-anchor="middle"
        font-family="'Segoe UI', sans-serif" font-size="32" font-weight="700"
        fill="${c}" letter-spacing="2">${safeText}</text>`
    : "";

  const ariaLabel = safeText || "Matrix rain animation";

  return `<svg role="img" aria-label="${ariaLabel}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <title>${ariaLabel}</title>
  <style>@media (prefers-reduced-motion: reduce) { animate, animateTransform { display: none; } }</style>
  <defs>
    <clipPath id="mtx-clip">
      <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#mtx-clip)" font-family="ui-monospace, monospace" font-size="${fontSize}" text-anchor="middle">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>
    ${columns.join("\n    ")}
    ${overlay}
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"
        fill="none" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
</svg>`;
}

module.exports = { renderMatrixCard };
