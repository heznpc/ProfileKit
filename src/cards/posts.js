const { renderCard } = require("../common/card");
const { escapeHtml, truncate } = require("../common/utils");

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderPostsCard(posts, opts) {
  const { colors, hideBorder, hideTitle, hideBar, borderRadius, title, cardWidth } = opts;
  const width = cardWidth || 495;
  const startY = hideTitle ? 30 : 55;
  const rowHeight = 52;
  const height = startY + Math.max(posts.length, 1) * rowHeight + 10;
  const accent = colors.accent || "#58a6ff";
  const maxTitleChars = Math.floor((width - 75) / 7.2);

  const rows = posts.length
    ? posts
        .map((post, i) => {
          const y = startY + i * rowHeight;
          const delay = i * 120;
          const date = formatDate(post.published);
          const meta = [];
          if (date) meta.push(date);
          if (post.readingTime) meta.push(`${post.readingTime} min read`);
          if (typeof post.reactions === "number" && post.reactions > 0)
            meta.push(`\u2665 ${post.reactions}`);
          const metaText = meta.join("  \u00b7  ");
          return `<g transform="translate(25, ${y})" class="stagger" style="animation-delay: ${delay}ms">
      <rect x="0" y="-2" width="3" height="38" rx="1.5" fill="${accent}"/>
      <text x="14" y="10" class="stat-value">${escapeHtml(truncate(post.title || "(untitled)", maxTitleChars))}</text>
      <text x="14" y="28" class="lang-pct">${escapeHtml(metaText)}</text>
    </g>`;
        })
        .join("\n  ")
    : `<text x="25" y="${startY}" class="stat-label" fill="${colors.muted}">No posts</text>`;

  return renderCard({
    width,
    height,
    title: title || "Latest Posts",
    colors,
    hideBorder,
    hideTitle,
    hideBar,
    borderRadius,
    body: rows,
  });
}

module.exports = { renderPostsCard };
