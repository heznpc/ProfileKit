const { renderCard } = require("../common/card");
const { escapeHtml } = require("../common/utils");

const difficultyColors = {
  easy: "#3fb950",
  medium: "#d29922",
  hard: "#f85149",
};

function renderLeetcodeCard(stats, { colors, hideBorder, hideTitle, hideBar, borderRadius, title }) {
  const cardTitle = title || `${escapeHtml(stats.username)}'s LeetCode`;
  const width = 495;
  const startY = hideTitle ? 20 : 50;

  const circleR = 42;
  const circleX = 75;
  const circleY = startY + 55;
  const circumference = 2 * Math.PI * circleR;
  const solvedPct = stats.totalQuestions > 0 ? stats.totalSolved / stats.totalQuestions : 0;
  const dashOffset = circumference * (1 - solvedPct);
  const ringColor = colors.accent || "#a371f7";

  const circleMarkup = `
    <circle cx="${circleX}" cy="${circleY}" r="${circleR}" fill="none" stroke="${colors.border}" stroke-width="6"/>
    <circle cx="${circleX}" cy="${circleY}" r="${circleR}" fill="none" stroke="${ringColor}" stroke-width="6"
      stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
      stroke-linecap="round" transform="rotate(-90 ${circleX} ${circleY})"/>
    <text x="${circleX}" y="${circleY - 8}" text-anchor="middle" class="stat-value" font-size="20">${stats.totalSolved}</text>
    <text x="${circleX}" y="${circleY + 12}" text-anchor="middle" class="lang-pct" font-size="11">/ ${stats.totalQuestions}</text>
  `;

  const barStartX = 170;
  const barWidth = 280;
  const difficulties = [
    { key: "easy", label: "Easy", data: stats.easy },
    { key: "medium", label: "Medium", data: stats.medium },
    { key: "hard", label: "Hard", data: stats.hard },
  ];

  const barsMarkup = difficulties
    .map((diff, i) => {
      const y = startY + 25 + i * 32;
      const pct = diff.data.total > 0 ? diff.data.solved / diff.data.total : 0;
      const fillWidth = Math.max(barWidth * pct, 2);
      const color = difficultyColors[diff.key];

      return `<g transform="translate(${barStartX}, ${y})">
      <text x="0" y="10" class="lang-name" fill="${color}" font-weight="600">${diff.label}</text>
      <text x="${barWidth}" y="10" text-anchor="end" class="stat-value" font-size="12" fill="${color}">${diff.data.solved}<tspan class="lang-pct"> / ${diff.data.total}</tspan></text>
      <rect x="0" y="16" width="${barWidth}" height="7" rx="3.5" fill="${colors.border}" opacity="0.4"/>
      <rect x="0" y="16" width="${fillWidth}" height="7" rx="3.5" fill="${color}"/>
    </g>`;
    })
    .join("\n    ");

  const height = startY + 130;
  const body = `${circleMarkup}\n    ${barsMarkup}`;

  return renderCard({
    width,
    height,
    title: cardTitle,
    colors,
    hideBorder,
    hideTitle,
    hideBar,
    borderRadius,
    body,
  });
}

module.exports = { renderLeetcodeCard };
