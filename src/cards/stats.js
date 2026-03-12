const { renderCard } = require("../common/card");
const { icons } = require("../common/icons");
const { formatNumber, escapeHtml } = require("../common/utils");

const statItems = [
  { key: "commits", label: "Total Commits", icon: icons.commits, field: "totalCommits" },
  { key: "prs", label: "Total PRs", icon: icons.prs, field: "totalPRs" },
  { key: "issues", label: "Total Issues", icon: icons.issues, field: "totalIssues" },
  { key: "stars", label: "Total Stars", icon: icons.stars, field: "totalStars" },
  { key: "repos", label: "Total Repos", icon: icons.repos, field: "totalRepos" },
  { key: "contributed", label: "Contributed To", icon: icons.contributed, field: "contributedTo" },
];

function renderStatsCard(stats, { colors, hide = [], hideBorder, hideTitle, title }) {
  const visible = statItems.filter((s) => !hide.includes(s.key));
  const cardTitle = title || `${escapeHtml(stats.name)}'s GitHub Stats`;
  const rowHeight = 28;
  const startY = hideTitle ? 25 : 55;
  const height = startY + visible.length * rowHeight + 20;

  const rows = visible
    .map((item, i) => {
      const y = startY + i * rowHeight;
      const value = formatNumber(stats[item.field]);
      const delay = i * 150;
      return `<g transform="translate(25, ${y})" class="stagger" style="animation-delay: ${delay}ms">
      <svg viewBox="0 0 16 16" width="16" height="16" fill="${colors.icon}">
        ${item.icon}
      </svg>
      <text x="25" y="12.5" class="stat-label">${item.label}</text>
      <text x="450" y="12.5" class="stat-value" text-anchor="end">${value}</text>
    </g>`;
    })
    .join("\n  ");

  return renderCard({
    width: 495,
    height,
    title: cardTitle,
    colors,
    hideBorder,
    hideTitle,
    body: rows,
  });
}

module.exports = { renderStatsCard };
