const { escapeHtml } = require("../common/utils");
const { resolveFont, DEFAULT_MONO_FAMILY } = require("../common/card");

function renderTerminalCard({
  commands,
  prompt,
  windowTitle,
  color,
  width,
  speed,
  pause,
  font,
  fontSize,
  colors,
  borderRadius,
  hideBorder,
}) {
  const w = width;
  const lineH = 22;
  const headerH = 34;
  const padding = 18;
  const h = headerH + commands.length * lineH + padding * 2;
  const rx = borderRadius != null ? borderRadius : 8;
  const accent = color || "#3fb950";
  const bg = colors.bg;
  const headerBg = "#161b22";
  const textColor = colors.text;
  // Terminal defaults to system monospace; ?font=jetbrains-mono picks the
  // bundled VF instead. Other (sans) keys also work but look out of place.
  const { embedCss, family: fontFamily } = resolveFont(font, DEFAULT_MONO_FAMILY);
  const fSize = fontSize;
  const charW = fSize * 0.62;
  const bodyY = headerH + padding + 8;
  const promptW = (prompt.length + 1) * charW;
  const cmdStartX = padding + promptW;

  let cumulative = 0;
  const lines = commands.map((cmd, i) => {
    const typeMs = Math.max(150, cmd.length * speed);
    const begin = cumulative;
    cumulative += typeMs + pause;
    return { cmd, typeMs, begin, index: i, lineY: bodyY + i * lineH };
  });

  const clipDefs = lines
    .map((line) => {
      const textW = Math.max(8, line.cmd.length * charW + 10);
      return `<clipPath id="term-clip-${line.index}">
      <rect x="${cmdStartX.toFixed(1)}" y="${(line.lineY - fSize).toFixed(1)}" width="0" height="${(fSize + 6).toFixed(1)}">
        <animate attributeName="width" from="0" to="${textW.toFixed(1)}" begin="${(line.begin / 1000).toFixed(2)}s" dur="${(line.typeMs / 1000).toFixed(2)}s" fill="freeze"/>
      </rect>
    </clipPath>`;
    })
    .join("\n    ");

  const lineMarkup = lines
    .map((line) => {
      const promptOpacityBegin = (line.begin / 1000).toFixed(2);
      return `<text x="${padding}" y="${line.lineY}" font-family="${fontFamily}" font-size="${fSize}" font-weight="700" fill="${accent}" opacity="0">
      ${escapeHtml(prompt)}
      <animate attributeName="opacity" from="0" to="1" begin="${promptOpacityBegin}s" dur="0.05s" fill="freeze"/>
    </text>
    <text x="${cmdStartX.toFixed(1)}" y="${line.lineY}" font-family="${fontFamily}" font-size="${fSize}" fill="${textColor}" clip-path="url(#term-clip-${line.index})">${escapeHtml(line.cmd)}</text>`;
    })
    .join("\n    ");

  const lastLine = lines[lines.length - 1];
  const lastEndX = padding + promptW + lastLine.cmd.length * charW + 4;
  const cursorAppearAt = (cumulative / 1000).toFixed(2);
  const cursorMarkup = `<rect x="${lastEndX.toFixed(1)}" y="${(lastLine.lineY - fSize + 3).toFixed(1)}" width="8" height="${fSize}" fill="${textColor}" opacity="0">
      <animate attributeName="opacity" values="1;0" keyTimes="0;1" begin="${cursorAppearAt}s" dur="0.6s" repeatCount="indefinite"/>
    </rect>`;

  const titleText = escapeHtml(windowTitle);

  const ariaLabel = `Terminal: ${commands.join("; ")}`;

  return `<svg role="img" aria-label="${escapeHtml(ariaLabel)}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <title>${escapeHtml(ariaLabel)}</title>
  <style>${embedCss}@media (prefers-reduced-motion: reduce) { animate, animateTransform { display: none; } }</style>
  <defs>
    <clipPath id="term-frame">
      <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"/>
    </clipPath>
    ${clipDefs}
  </defs>
  <g clip-path="url(#term-frame)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>
    <rect x="0" y="0" width="${w}" height="${headerH}" fill="${headerBg}"/>
    <line x1="0" y1="${headerH}" x2="${w}" y2="${headerH}" stroke="#30363d" stroke-width="1"/>
    <circle cx="18" cy="${headerH / 2}" r="6" fill="#ff5f56"/>
    <circle cx="38" cy="${headerH / 2}" r="6" fill="#ffbd2e"/>
    <circle cx="58" cy="${headerH / 2}" r="6" fill="#27c93f"/>
    <text x="${w / 2}" y="${headerH / 2 + 4}" text-anchor="middle"
          font-family="${fontFamily}" font-size="12" fill="#8b949e">${titleText}</text>
    ${lineMarkup}
    ${cursorMarkup}
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"
        fill="none" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
</svg>`;
}

module.exports = { renderTerminalCard };
