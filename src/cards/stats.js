const { renderCard } = require("../common/card");
const { bodyStartY } = require("../common/tokens");
const { icons } = require("../common/icons");
const { formatNumber } = require("../common/utils");

const statItems = [
  { key: "commits", label: "Total Commits", shortLabel: "Commits", icon: icons.commits, field: "totalCommits", color: "#3fb950" },
  { key: "prs", label: "Total PRs", shortLabel: "PRs", icon: icons.prs, field: "totalPRs", color: "#a371f7" },
  { key: "issues", label: "Total Issues", shortLabel: "Issues", icon: icons.issues, field: "totalIssues", color: "#f0883e" },
  { key: "stars", label: "Total Stars", shortLabel: "Stars", icon: icons.stars, field: "totalStars", color: "#e3b341" },
  { key: "repos", label: "Total Repos", shortLabel: "Repos", icon: icons.repos, field: "totalRepos", color: "#56d4dd" },
  { key: "contributed", label: "Contributed To", shortLabel: "Contrib", icon: icons.contributed, field: "contributedTo", color: "#f778ba" },
];

function renderStatsCard(stats, { colors, hide = [], hideBorder, hideTitle, hideBar, borderRadius, title, layout, cardWidth, font }) {
  const visible = statItems.filter((s) => !hide.includes(s.key));
  // renderCard escapes the title; pre-escaping here would double up to "&amp;amp;"
  const cardTitle = title || `${stats.name}'s GitHub Stats`;

  if (layout === "compact") {
    return renderCompact(stats, visible, { colors, hideBorder, hideTitle, hideBar, borderRadius, cardTitle, cardWidth, font });
  }
  return renderDefault(stats, visible, { colors, hideBorder, hideTitle, hideBar, borderRadius, cardTitle, cardWidth, font });
}

function renderDefault(stats, visible, { colors, hideBorder, hideTitle, hideBar, borderRadius, cardTitle, cardWidth, font }) {
  const width = cardWidth || 495;
  const rowHeight = 30;
  const startY = bodyStartY(hideTitle);
  const height = startY + visible.length * rowHeight + 20;
  const valueX = width - 45;

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
      <text x="${valueX}" y="12.5" class="stat-value" text-anchor="end" fill="${c}">${value}</text>
    </g>`;
    })
    .join("\n  ");

  return renderCard({ width, height, title: cardTitle, colors, hideBorder, hideTitle, hideBar, borderRadius, body: rows, font, titleTarget: "username" });
}

function renderCompact(stats, visible, { colors, hideBorder, hideTitle, hideBar, borderRadius, cardTitle, cardWidth, font }) {
  const cols = 2;
  const colWidth = 210;
  const width = cardWidth || (colWidth * cols + 75);
  const rowHeight = 38;
  const startY = bodyStartY(hideTitle);
  const rowCount = Math.ceil(visible.length / cols);
  const height = startY + rowCount * rowHeight + 15;

  const cells = visible
    .map((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 25 + col * colWidth;
      const y = startY + row * rowHeight;
      const value = formatNumber(stats[item.field]);
      const delay = i * 100;
      const c = colors.accent || item.color;
      return `<g transform="translate(${x}, ${y})" class="stagger" style="animation-delay: ${delay}ms">
      <circle cx="10" cy="10" r="12" fill="${c}" opacity="0.1"/>
      <svg x="2" y="2" viewBox="0 0 16 16" width="16" height="16" fill="${c}">
        ${item.icon}
      </svg>
      <text x="30" y="14" class="stat-value" fill="${c}" font-size="16">${value}</text>
      <text x="30" y="29" class="lang-pct">${item.shortLabel}</text>
    </g>`;
    })
    .join("\n  ");

  return renderCard({ width, height, title: cardTitle, colors, hideBorder, hideTitle, hideBar, borderRadius, body: cells, font, titleTarget: "username" });
}

module.exports = { renderStatsCard };
