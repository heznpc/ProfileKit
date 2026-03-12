const { renderCard } = require("../common/card");
const { icons } = require("../common/icons");
const { formatNumber, escapeHtml } = require("../common/utils");

const statItems = [
  { key: "commits", label: "Total Commits", icon: icons.commits, field: "totalCommits", color: "#3fb950" },
  { key: "prs", label: "Total PRs", icon: icons.prs, field: "totalPRs", color: "#a371f7" },
  { key: "issues", label: "Total Issues", icon: icons.issues, field: "totalIssues", color: "#f0883e" },
  { key: "stars", label: "Total Stars", icon: icons.stars, field: "totalStars", color: "#e3b341" },
  { key: "repos", label: "Total Repos", icon: icons.repos, field: "totalRepos", color: "#56d4dd" },
  { key: "contributed", label: "Contributed To", icon: icons.contributed, field: "contributedTo", color: "#f778ba" },
];

function renderStatsCard(stats, { colors, hide = [], hideBorder, hideTitle, hideBar, borderRadius, title }) {
  const visible = statItems.filter((s) => !hide.includes(s.key));
  const cardTitle = title || `${escapeHtml(stats.name)}'s GitHub Stats`;
  const rowHeight = 30;
  const startY = hideTitle ? 25 : 55;
  const height = startY + visible.length * rowHeight + 20;

  const rows = visible
    .map((item, i) => {
      const y = startY + i * rowHeight;
      const value = formatNumber(stats[item.field]);
      const delay = i * 150;
      const c = colors.accent || item.color;
      return `<g transform="translate(25, ${y})" class="stagger" style="animation-delay: ${delay}ms">
      <circle cx="10" cy="8" r="12" fill="${c}" opacity="0.1"/>
      <svg x="2" y="0" viewBox="0 0 16 16" width="16" height="16" fill="${c}">
        ${item.icon}
      </svg>
      <text x="32" y="12.5" class="stat-label">${item.label}</text>
      <text x="450" y="12.5" class="stat-value" text-anchor="end" fill="${c}">${value}</text>
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
    hideBar,
    borderRadius,
    body: rows,
  });
}

module.exports = { renderStatsCard };
