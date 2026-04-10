const { escapeHtml } = require("../common/utils");
const { resolveFont } = require("../common/card");

// Approximate width of one char at 26px in a typical variable-width sans
// (Inter / Segoe UI / Manrope). SVG can't measure text without a layout
// engine, so this is a deliberate over-estimate that keeps the underline +
// icon offsets visually aligned for Latin titles regardless of bundled font.
const TITLE_CHAR_W = 14;
const ICON_GAP = 10;
const ICON_W = 30;

function renderSectionCard({
  title,
  subtitle,
  align,
  color,
  width,
  height,
  icon,
  colors,
  font,
}) {
  const { embedCss, family } = resolveFont(font);
  const w = width;
  const h = height || (subtitle ? 90 : 70);
  const c = color || colors.title;
  const accentColor = colors.accent || color || "#58a6ff";

  const safeTitle = escapeHtml(title || "");
  const safeSub = subtitle ? escapeHtml(subtitle) : "";
  const safeIcon = icon ? escapeHtml(icon) : "";

  const titleY = subtitle ? 38 : h / 2 + 8;
  const subY = titleY + 22;
  const underlineY = titleY + 10;
  const underlineWidth = Math.max(40, Math.min(safeTitle.length * 8, 120));

  const titleEstW = safeTitle.length * TITLE_CHAR_W;
  const groupW = (safeIcon ? ICON_W + ICON_GAP : 0) + titleEstW;
  const groupX = align === "center" ? Math.max(25, (w - groupW) / 2) : 25;
  const iconX = groupX;
  const titleX = groupX + (safeIcon ? ICON_W + ICON_GAP : 0);
  const underlineX = titleX + (titleEstW - underlineWidth) / 2;

  const iconMarkup = safeIcon
    ? `<text x="${iconX}" y="${titleY}" font-size="26" fill="${accentColor}">${safeIcon}</text>`
    : "";

  const ariaLabel = safeSub ? `${safeTitle}, ${safeSub}` : safeTitle;

  return `<svg role="img" aria-label="${ariaLabel}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <title>${ariaLabel}</title>
  <style>${embedCss}
    .sec-title { font: 700 26px ${family}; fill: ${c}; }
    .sec-sub { font: 400 14px ${family}; fill: ${colors.muted}; }
    @keyframes drawIn { from { width: 0; } to { width: ${underlineWidth}px; } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .sec-title, .sec-sub { animation: fadeUp 0.5s ease-out both; }
    .sec-sub { animation-delay: 0.15s; }
    .sec-underline { animation: drawIn 0.6s ease-out 0.2s both; }
    @media (prefers-reduced-motion: reduce) {
      .sec-title, .sec-sub { animation: none; opacity: 1; }
      .sec-underline { animation: none; }
    }
  </style>
  ${iconMarkup}
  <text x="${titleX}" y="${titleY}" class="sec-title">${safeTitle}</text>
  ${safeTitle ? `<rect class="sec-underline" x="${underlineX}" y="${underlineY}" width="${underlineWidth}" height="3" rx="1.5" fill="${accentColor}"/>` : ""}
  ${safeSub ? `<text x="${titleX}" y="${subY}" class="sec-sub">${safeSub}</text>` : ""}
</svg>`;
}

module.exports = { renderSectionCard };
