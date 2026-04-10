function renderDividerCard({ style, color, width, height, colors }) {
  const w = width;
  const h = height;
  const c = color || colors.muted;
  const cy = h / 2;

  let content = "";

  if (style === "wave") {
    const points = [];
    const amp = h / 4;
    const freq = 0.04;
    for (let x = 0; x <= w + 40; x += 5) {
      const y = cy + amp * Math.sin(x * freq);
      points.push(`${x === 0 ? "M" : "L"} ${x} ${y.toFixed(1)}`);
    }
    content = `<g>
      <path d="${points.join(" ")}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.7">
        <animateTransform attributeName="transform" type="translate" values="0,0; -40,0; 0,0" dur="4s" repeatCount="indefinite"/>
      </path>
    </g>`;
  } else if (style === "dots") {
    const dotCount = 30;
    const dotSpacing = w / (dotCount + 1);
    const dots = [];
    for (let i = 0; i < dotCount; i++) {
      const cx = dotSpacing * (i + 1);
      const begin = (i * 0.05).toFixed(2);
      dots.push(
        `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="2" fill="${c}" opacity="0.6">
          <animate attributeName="opacity" values="0.2;0.9;0.2" dur="2s" begin="${begin}s" repeatCount="indefinite"/>
        </circle>`
      );
    }
    content = dots.join("");
  } else if (style === "dashed") {
    content = `<line x1="20" y1="${cy}" x2="${w - 20}" y2="${cy}" stroke="${c}" stroke-width="2" stroke-dasharray="6,8" opacity="0.6"/>`;
  } else if (style === "gradient") {
    content = `
      <defs>
        <linearGradient id="div-grad" x1="0%" x2="100%">
          <stop offset="0%" stop-color="${c}" stop-opacity="0"/>
          <stop offset="50%" stop-color="${c}" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${cy - 1}" width="${w}" height="2" fill="url(#div-grad)"/>`;
  } else if (style === "double") {
    content = `
      <line x1="20" y1="${cy - 3}" x2="${w - 20}" y2="${cy - 3}" stroke="${c}" stroke-width="1" opacity="0.5"/>
      <line x1="20" y1="${cy + 3}" x2="${w - 20}" y2="${cy + 3}" stroke="${c}" stroke-width="1" opacity="0.5"/>`;
  } else {
    // line (default)
    content = `<line x1="20" y1="${cy}" x2="${w - 20}" y2="${cy}" stroke="${c}" stroke-width="1" opacity="0.5"/>`;
  }

  return `<svg role="presentation" aria-hidden="true" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <style>@media (prefers-reduced-motion: reduce) { animate, animateTransform { display: none; } }</style>
  ${content}
</svg>`;
}

module.exports = { renderDividerCard };
