const { renderCard } = require("../common/card");
const { escapeHtml } = require("../common/utils");

const socialIcons = {
  github:
    '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>',
  linkedin:
    '<path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>',
  x:
    '<path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633z"/>',
  email:
    '<path d="M1.75 2A1.75 1.75 0 000 3.75v.736a.75.75 0 00.334.625L8 8.972l7.666-3.86A.75.75 0 0016 4.487V3.75A1.75 1.75 0 0014.25 2H1.75zM16 6.53l-7.55 3.8a.75.75 0 01-.9 0L0 6.53v5.72A1.75 1.75 0 001.75 14h12.5A1.75 1.75 0 0016 12.25V6.53z"/>',
  website:
    '<path fill-rule="evenodd" d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z"/>',
  youtube:
    '<path d="M15.32 4.06c-.17-.67-.67-1.19-1.32-1.37C12.8 2.4 8 2.4 8 2.4s-4.8 0-5.99.29c-.65.18-1.15.7-1.32 1.37C.4 5.28.4 8 .4 8s0 2.72.29 3.94c.17.67.67 1.19 1.32 1.37C3.2 13.6 8 13.6 8 13.6s4.8 0 5.99-.29c.65-.18 1.15-.7 1.32-1.37.29-1.22.29-3.94.29-3.94s0-2.72-.29-3.94zM6.4 10.4V5.6L10.56 8 6.4 10.4z"/>',
};

function renderSocialCard(links, { colors, hideBorder, hideBar, borderRadius, title, layout }) {
  const cardTitle = title || "";
  const ariaLabel =
    cardTitle ||
    `Social links: ${links.map((l) => l.type).join(", ")}`;
  const isCompact = layout === "compact";
  const iconSize = 20;
  const gap = isCompact ? 36 : 45;
  const startX = 25;
  const startY = cardTitle && !isCompact ? 50 : 25;
  const iconColor = colors.accent || colors.icon;

  if (isCompact) {
    const width = startX * 2 + links.length * gap + 10;
    const height = 65;

    const iconsMarkup = links
      .map((link, i) => {
        const x = startX + i * gap;
        const icon = socialIcons[link.type] || socialIcons.website;
        return `<a href="${escapeHtml(link.url)}" target="_blank">
        <g transform="translate(${x}, ${startY})">
          <circle cx="10" cy="10" r="14" fill="${iconColor}" opacity="0.1"/>
          <svg x="2" y="2" viewBox="0 0 16 16" width="${iconSize}" height="${iconSize}" fill="${iconColor}">
            ${icon}
          </svg>
        </g>
      </a>`;
      })
      .join("\n    ");

    return renderCard({
      width,
      height,
      title: cardTitle,
      ariaLabel,
      colors,
      hideBorder,
      hideTitle: !cardTitle,
      hideBar,
      borderRadius,
      body: iconsMarkup,
    });
  }

  const rowHeight = 32;
  const height = startY + links.length * rowHeight + 15;

  const rows = links
    .map((link, i) => {
      const y = startY + i * rowHeight;
      const icon = socialIcons[link.type] || socialIcons.website;
      const label = escapeHtml(link.label || link.url);
      const delay = i * 100;
      return `<a href="${escapeHtml(link.url)}" target="_blank">
      <g transform="translate(${startX}, ${y})" class="stagger" style="animation-delay: ${delay}ms">
        <circle cx="10" cy="10" r="14" fill="${iconColor}" opacity="0.1"/>
        <svg x="2" y="2" viewBox="0 0 16 16" width="${iconSize}" height="${iconSize}" fill="${iconColor}">
          ${icon}
        </svg>
        <text x="32" y="15" class="stat-label">${label}</text>
      </g>
    </a>`;
    })
    .join("\n    ");

  return renderCard({
    width: 350,
    height,
    title: cardTitle,
    ariaLabel,
    colors,
    hideBorder,
    hideTitle: !cardTitle,
    hideBar,
    borderRadius,
    body: rows,
  });
}

module.exports = { renderSocialCard };
