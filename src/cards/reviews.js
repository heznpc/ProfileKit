const { renderCard } = require("../common/card");
const { icons } = require("../common/icons");
const { formatNumber, escapeHtml } = require("../common/utils");

function renderReviewsCard(stats, { colors, hideBorder, hideTitle, title }) {
  const cardTitle = title || `${escapeHtml(stats.name)}'s Code Reviews`;
  const width = 495;
  const startY = hideTitle ? 25 : 55;

  // Approval rate ring
  const circleR = 38;
  const circleX = 70;
  const circleY = startY + 50;
  const circumference = 2 * Math.PI * circleR;
  const ratePct = stats.approvalRate / 100;
  const dashOffset = circumference * (1 - ratePct);
  const rateColor = stats.approvalRate >= 80 ? "#3fb950" : stats.approvalRate >= 50 ? "#d29922" : "#f85149";

  const ringMarkup = `
    <circle cx="${circleX}" cy="${circleY}" r="${circleR}" fill="none" stroke="${colors.border}" stroke-width="5" opacity="0.5"/>
    <circle cx="${circleX}" cy="${circleY}" r="${circleR}" fill="none" stroke="${rateColor}" stroke-width="5"
      stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
      stroke-linecap="round" transform="rotate(-90 ${circleX} ${circleY})"/>
    <text x="${circleX}" y="${circleY - 6}" text-anchor="middle" class="stat-value" font-size="18" fill="${rateColor}">${stats.approvalRate}%</text>
    <text x="${circleX}" y="${circleY + 10}" text-anchor="middle" class="lang-pct" font-size="10">approval</text>
  `;

  // Stats items
  const items = [
    { label: "Total Reviews", value: formatNumber(stats.totalReviews), icon: icons.reviews },
    { label: "Approved", value: formatNumber(stats.approved), icon: icons.approved, color: "#3fb950" },
    { label: "Changes Requested", value: formatNumber(stats.changesRequested), icon: icons.changesRequested, color: "#d29922" },
    { label: "Repos Reviewed", value: formatNumber(stats.reposReviewed), icon: icons.repos },
  ];

  const detailX = 160;
  const detailsMarkup = items
    .map((item, i) => {
      const y = startY + 15 + i * 28;
      const iconColor = item.color || colors.icon;
      return `<g transform="translate(${detailX}, ${y})" class="stagger" style="animation-delay: ${(i + 1) * 150}ms">
      <circle cx="10" cy="8" r="12" fill="${iconColor}" opacity="0.1"/>
      <svg x="2" y="0" viewBox="0 0 16 16" width="16" height="16" fill="${iconColor}">
        ${item.icon}
      </svg>
      <text x="30" y="12" class="stat-label">${item.label}</text>
      <text x="310" y="12" class="stat-value" text-anchor="end">${item.value}</text>
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
    body,
  });
}

module.exports = { renderReviewsCard };
