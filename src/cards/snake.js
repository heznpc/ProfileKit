const { makeRng } = require("../common/utils");

function renderSnakeCard({
  color,
  emptyColor,
  width,
  height,
  cols,
  rows,
  cellSize,
  cellGap,
  duration,
  colors,
  borderRadius,
  hideBorder,
  seed,
}) {
  const nCols = cols;
  const nRows = rows;
  const cs = cellSize;
  const gap = cellGap;
  const padding = 18;
  const w = width || nCols * (cs + gap) + padding * 2;
  const h = height || nRows * (cs + gap) + padding * 2;
  const rx = borderRadius != null ? borderRadius : 6;
  const bg = colors.bg;
  const accent = color || "#39d353";
  const dim = emptyColor || colors.border;
  const totalCells = nCols * nRows;
  const totalDur = duration;
  const rng = makeRng(seed);

  const levels = new Array(totalCells);
  for (let i = 0; i < totalCells; i++) {
    const r = rng();
    levels[i] = r < 0.45 ? 0 : r < 0.7 ? 1 : r < 0.87 ? 2 : r < 0.96 ? 3 : 4;
  }

  // Serpentine: column-major, with odd columns walking row N-1 → 0.
  // orderOf(c, r) maps a cell to its index in the snake's path.
  const orderOf = (c, r) =>
    c * nRows + (c % 2 === 0 ? r : nRows - 1 - r);

  // Pre-compute pixel positions in snake-walk order — both the cell loop and
  // the snake body trail need them, and tail segments are just shifted prefixes
  // of the same sequence so we only walk the order once.
  const headXs = new Array(totalCells);
  const headYs = new Array(totalCells);
  for (let idx = 0; idx < totalCells; idx++) {
    const col = Math.floor(idx / nRows);
    const step = idx % nRows;
    const row = col % 2 === 0 ? step : nRows - 1 - step;
    headXs[idx] = padding + col * (cs + gap);
    headYs[idx] = padding + row * (cs + gap);
  }

  const dimCells = [];
  const litCells = [];
  for (let i = 0; i < totalCells; i++) {
    const c = i % nCols;
    const r = Math.floor(i / nCols);
    const x = padding + c * (cs + gap);
    const y = padding + r * (cs + gap);
    const lv = levels[i];

    if (lv === 0) {
      dimCells.push(
        `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" rx="2"/>`
      );
      continue;
    }

    const eatFrac = orderOf(c, r) / totalCells;
    const k = eatFrac.toFixed(4);
    const op = (0.32 + lv * 0.17).toFixed(2);
    litCells.push(
      `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" rx="2" opacity="${op}">
        <animate attributeName="opacity" values="${op};0.12;${op}" keyTimes="0;${k};0.9995" dur="${totalDur}s" repeatCount="indefinite"/>
      </rect>`
    );
  }

  const snakeLen = 5;
  const snakeNodes = [];
  for (let s = 0; s < snakeLen; s++) {
    const xs = new Array(s).fill(-100);
    const ys = new Array(s).fill(-100);
    for (let i = 0; i < totalCells - s; i++) {
      xs.push(headXs[i]);
      ys.push(headYs[i]);
    }
    xs.push(-100);
    ys.push(-100);
    const opacity = (1 - s * 0.13).toFixed(2);
    snakeNodes.push(
      `<rect x="-100" y="-100" width="${cs}" height="${cs}" rx="2" opacity="${opacity}">
        <animate attributeName="x" values="${xs.join(";")}" dur="${totalDur}s" repeatCount="indefinite" calcMode="discrete"/>
        <animate attributeName="y" values="${ys.join(";")}" dur="${totalDur}s" repeatCount="indefinite" calcMode="discrete"/>
      </rect>`
    );
  }

  return `<svg role="img" aria-label="Contribution snake animation" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <title>Contribution snake animation</title>
  <defs>
    <clipPath id="snake-clip">
      <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"/>
    </clipPath>
  </defs>
  <style>
    @media (prefers-reduced-motion: reduce) {
      animate, animateTransform { display: none; }
    }
  </style>
  <g clip-path="url(#snake-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>
    <g fill="${dim}">
      ${dimCells.join("\n      ")}
    </g>
    <g fill="${accent}">
      ${litCells.join("\n      ")}
      ${snakeNodes.join("\n      ")}
    </g>
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}"
        fill="none" stroke="${colors.border}" stroke-opacity="${hideBorder ? 0 : 1}"/>
</svg>`;
}

module.exports = { renderSnakeCard };
