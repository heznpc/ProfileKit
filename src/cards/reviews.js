const { renderCard } = require("../common/card");
const { icons } = require("../common/icons");
const { formatNumber } = require("../common/utils");

const reviewItems = [
  { key: "totalReviews", label: "Total Reviews", icon: icons.reviews, color: "#a371f7" },
  { key: "approved", label: "Approved", icon: icons.approved, color: "#3fb950" },
  { key: "changesRequested", label: "Changes Requested", icon: icons.changesRequested, color: "#d29922" },
  { key: "reposReviewed", label: "Repos Reviewed", icon: icons.repos, color: "#56d4dd" },
];

function renderReviewsCard(stats, { colors, hideBorder, hideTitle, hideBar, borderRadius, title, cardWidth }) {
  // renderCard escapes the title; pre-escaping here would double up to "&amp;amp;"
  const cardTitle = title || `${stats.name}'s Code Reviews`;
  const width = cardWidth || 495;
  const startY = hideTitle ? 25 : 55;

  // Approval rate ring
  const circleR = 38;
  const circleX = 70;
  const circleY = startY + 50;
  const circumference = 2 * Math.PI * circleR;
  const ratePct = stats.approvalRate / 100;
  const dashOffset = circumference * (1 - ratePct);
  const rateColor = stats.totalReviews === 0 ? colors.muted
    : stats.approvalRate >= 80 ? "#3fb950"
    : stats.approvalRate >= 50 ? "#d29922"
    : "#f85149";

  const ringMarkup = `
    <circle cx="${circleX}" cy="${circleY}" r="${circleR}" fill="none" stroke="${colors.border}" stroke-width="5"/>
    <circle cx="${circleX}" cy="${circleY}" r="${circleR}" fill="none" stroke="${rateColor}" stroke-width="5"
      stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
      stroke-linecap="round" transform="rotate(-90 ${circleX} ${circleY})"${stats.totalReviews === 0 ? ' opacity="0"' : ""}/>
    <text x="${circleX}" y="${circleY - 6}" text-anchor="middle" class="stat-value" font-size="18" fill="${rateColor}">${stats.totalReviews === 0 ? "\u2014" : `${stats.approvalRate}%`}</text>
    <text x="${circleX}" y="${circleY + 10}" text-anchor="middle" class="lang-pct" font-size="10">approval</text>
  `;

  const detailX = 160;
  const valueX = width - detailX - 25;
  const detailsMarkup = reviewItems
    .map((item, i) => {
      const y = startY + 15 + i * 28;
      const value = formatNumber(stats[item.key]);
      const c = colors.accent || item.color;
      return `<g transform="translate(${detailX}, ${y})" class="stagger" style="animation-delay: ${(i + 1) * 150}ms">
      <circle cx="10" cy="8" r="12" fill="${c}" opacity="0.1"/>
      <svg x="2" y="0" viewBox="0 0 16 16" width="16" height="16" fill="${c}">
        ${item.icon}
      </svg>
      <text x="30" y="12" class="stat-label">${item.label}</text>
      <text x="${valueX}" y="12" class="stat-value" text-anchor="end" fill="${c}">${value}</text>
    </g>`;
    })
    .join("\n    ");

  const height = startY + 135;
  const body = `${ringMarkup}\n    ${detailsMarkup}`;

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

module.exports = { renderReviewsCard };
