const { escapeHtml, makeRng } = require("../common/utils");
const { resolveFont } = require("../common/card");

function renderHeroCard({
  name,
  subtitle,
  bg,
  color,
  width,
  height,
  align,
  colors,
  borderRadius,
  hideBorder,
  font,
}) {
  const { embedCss, family } = resolveFont(font);
  const w = width;
  const h = height;
  const c = color || colors.accent || "#58a6ff";
  const rx = borderRadius != null ? borderRadius : 8;

  let bgContent = "";

  if (bg === "grid") {
    bgContent = `
    <defs>
      <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <circle cx="20" cy="20" r="1.2" fill="${c}" opacity="0.35">
          <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" repeatCount="indefinite"/>
        </circle>
      </pattern>
      <radialGradient id="hero-fade" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stop-color="${colors.bg}" stop-opacity="0"/>
        <stop offset="100%" stop-color="${colors.bg}" stop-opacity="0.85"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#hero-grid)"/>
    <rect width="${w}" height="${h}" fill="url(#hero-fade)"/>`;
  } else if (bg === "wave") {
    const waves = [];
    for (let i = 0; i < 3; i++) {
      const points = [];
      const amp = 18 + i * 6;
      const freq = 0.012 + i * 0.004;
      const offsetY = h * 0.62 + i * 18;
      const phase = i * 1.4;
      points.push(`M -50 ${offsetY}`);
      for (let x = -50; x <= w + 100; x += 10) {
        const y = offsetY + amp * Math.sin(x * freq + phase);
        points.push(`L ${x} ${y.toFixed(1)}`);
      }
      points.push(`L ${w + 100} ${h}`);
      points.push(`L -50 ${h}`);
      points.push("Z");
      const opacity = (0.18 - i * 0.05).toFixed(2);
      const dur = 5 + i * 1.5;
      const dist = 40 + i * 15;
      waves.push(
        `<path d="${points.join(" ")}" fill="${c}" opacity="${opacity}">
          <animateTransform attributeName="transform" type="translate" values="0,0; -${dist},0; 0,0" dur="${dur}s" repeatCount="indefinite"/>
        </path>`
      );
    }
    bgContent = waves.join("\n    ");
  } else if (bg === "particles") {
    const particles = [];
    const rand = makeRng(1);
    for (let i = 0; i < 36; i++) {
      const cx = Math.floor(rand() * w);
      const cy = Math.floor(rand() * h);
      const r = (1 + rand() * 2.5).toFixed(1);
      const dur = (3 + rand() * 4).toFixed(1);
      const drift = (15 + rand() * 25).toFixed(0);
      particles.push(
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity="0.45">
          <animate attributeName="cy" values="${cy};${cy - drift};${cy}" dur="${dur}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.15;0.7;0.15" dur="${dur}s" repeatCount="indefinite"/>
        </circle>`
      );
    }
    bgContent = particles.join("\n    ");
  } else {
    // gradient (default)
    bgContent = `
    <defs>
      <linearGradient id="hero-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c}" stop-opacity="0.22">
          <animate attributeName="stop-opacity" values="0.12;0.28;0.12" dur="5s" repeatCount="indefinite"/>
        </stop>
        <stop offset="100%" stop-color="${c}" stop-opacity="0">
          <animate attributeName="stop-opacity" values="0;0.15;0" dur="5s" repeatCount="indefinite"/>
        </stop>
      </linearGradient>
      <radialGradient id="hero-glow" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="${c}" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#hero-grad)"/>
    <rect width="${w}" height="${h}" fill="url(#hero-glow)"/>`;
  }

  const safeName = escapeHtml(name || "");
  const safeSub = subtitle ? escapeHtml(subtitle) : "";
  const anchor = align === "left" ? "start" : "middle";
  const tx = align === "left" ? 60 : w / 2;
  // With subtitle: name above center, bar between, subtitle below — 8-10px
  // breathing room on each side of the bar.
  // Without subtitle: name at geometric center (baseline = center + 0.35*size)
  // and no accent bar — a lone bar under a centered name looks orphaned.
  const nameY = safeSub ? h / 2 - 8 : h / 2 + 19;
  const subY = h / 2 + 38;

  const accentBarY = nameY + 16;
  const accentBarW = 60;
  const accentBarX = align === "left" ? 60 : w / 2 - accentBarW / 2;

  const ariaLabel = safeSub ? `${safeName} — ${safeSub}` : safeName;

  return `<svg role="img" aria-label="${ariaLabel}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <title>${ariaLabel}</title>
  <defs>
    <clipPath id="hero-clip">
      <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"/>
    </clipPath>
  </defs>
  <style>${embedCss}
    .hero-name { font: 800 56px ${family}; fill: ${colors.title}; }
    .hero-sub { font: 400 20px ${family}; fill: ${colors.text}; }
    @keyframes heroIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes barIn { from { width: 0; opacity: 0; } to { width: ${accentBarW}px; opacity: 1; } }
    .hero-name { animation: heroIn 0.8s ease-out both; }
    .hero-sub { animation: heroIn 0.8s ease-out 0.25s both; }
    .hero-bar { animation: barIn 0.8s ease-out 0.5s both; }
    @media (prefers-reduced-motion: reduce) {
      .hero-name, .hero-sub { animation: none; opacity: 1; }
      .hero-bar { animation: none; }
      animate, animateTransform { display: none; }
    }
  </style>
  <g clip-path="url(#hero-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${colors.bg}"/>
    ${bgContent}
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"
        fill="none" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
  <text x="${tx}" y="${nameY}" text-anchor="${anchor}" class="hero-name">${safeName}</text>
  ${safeSub ? `<rect class="hero-bar" x="${accentBarX}" y="${accentBarY}" width="${accentBarW}" height="3" rx="1.5" fill="${c}"/>` : ""}
  ${safeSub ? `<text x="${tx}" y="${subY}" text-anchor="${anchor}" class="hero-sub">${safeSub}</text>` : ""}
</svg>`;
}

module.exports = { renderHeroCard };
