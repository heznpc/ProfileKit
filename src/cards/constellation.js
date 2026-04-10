const { escapeHtml, makeRng } = require("../common/utils");

function renderConstellationCard({
  text,
  color,
  width,
  height,
  density,
  colors,
  borderRadius,
  hideBorder,
  seed,
}) {
  const w = width;
  const h = height;
  const rx = borderRadius != null ? borderRadius : 6;
  const accent = color || "#a371f7";
  const bg = colors.bg;
  const rng = makeRng(seed);
  // density is user-supplied so we hard cap both stars and links to keep the
  // worst-case SVG bounded — otherwise density=10 on a hero-sized canvas
  // produces ~3k links and a multi-hundred-KB output.
  const MAX_STARS = 120;
  const MAX_LINKS = 1200;
  const rawCount = Math.floor((density * w * h) / 1500);
  const starCount = Math.max(0, Math.min(rawCount, MAX_STARS));
  const linkDist = 75;

  const stars = [];
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.round(rng() * w),
      y: Math.round(rng() * h),
      r: 0.8 + rng() * 1.8,
      twinkleDur: (2 + rng() * 3).toFixed(2),
      twinkleDelay: (-rng() * 4).toFixed(2),
    });
  }

  const links = [];
  outer: for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const dx = stars[i].x - stars[j].x;
      const dy = stars[i].y - stars[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < linkDist) {
        links.push({ a: i, b: j, opacity: ((1 - d / linkDist) * 0.45).toFixed(2) });
        if (links.length >= MAX_LINKS) break outer;
      }
    }
  }

  const lineMarkup = links
    .map(
      (l) =>
        `<line x1="${stars[l.a].x}" y1="${stars[l.a].y}" x2="${stars[l.b].x}" y2="${stars[l.b].y}" stroke="${accent}" stroke-width="0.8" opacity="${l.opacity}"/>`
    )
    .join("\n    ");

  const starMarkup = stars
    .map(
      (s) =>
        `<circle cx="${s.x}" cy="${s.y}" r="${s.r.toFixed(1)}" fill="${accent}">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="${s.twinkleDur}s" begin="${s.twinkleDelay}s" repeatCount="indefinite"/>
        </circle>`
    )
    .join("\n    ");

  const safeText = text ? escapeHtml(text) : "";
  const overlay = safeText
    ? `<text x="${w / 2}" y="${h / 2 + 10}" text-anchor="middle"
        font-family="'Segoe UI', sans-serif" font-size="32" font-weight="700"
        fill="${colors.title}" letter-spacing="3">${safeText}
        <animate attributeName="opacity" from="0" to="1" dur="1s" fill="freeze"/>
      </text>`
    : "";

  const ariaLabel = safeText || "Constellation animation";

  return `<svg role="img" aria-label="${ariaLabel}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <title>${ariaLabel}</title>
  <style>@media (prefers-reduced-motion: reduce) { animate, animateTransform { display: none; } }</style>
  <defs>
    <clipPath id="con-clip">
      <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"/>
    </clipPath>
    <radialGradient id="con-bg" cx="50%" cy="50%" r="80%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g clip-path="url(#con-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#con-bg)"/>
    ${lineMarkup}
    ${starMarkup}
    ${overlay}
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"
        fill="none" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
</svg>`;
}

module.exports = { renderConstellationCard };
