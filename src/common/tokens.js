// Design tokens — currently only the radius scale is wired into a query
// param (`?border_radius=lg`); the spacing and type scales are reserved for
// future card-level adoption (see README "Design Tokens" section). Tokens
// match Tailwind / shadcn naming so designers transfer existing intuition.

const RADIUS = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 6,
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  full: 9999,
};

// Layout constants — every renderCard-based card pulls its body offset from
// here so vertical rhythm stays aligned when several cards are stacked.
const LAYOUT = {
  BODY_TOP_WITH_TITLE: 55,
  BODY_TOP_NO_TITLE: 25,
};

function parseToken(scale, value, defaultValue) {
  if (value == null || value === "") return defaultValue;
  if (Object.prototype.hasOwnProperty.call(scale, value)) return scale[value];
  const n = parseFloat(value);
  return Number.isNaN(n) ? defaultValue : n;
}

function parseRadius(value, defaultValue) {
  return parseToken(RADIUS, value, defaultValue);
}

function bodyStartY(hideTitle) {
  return hideTitle ? LAYOUT.BODY_TOP_NO_TITLE : LAYOUT.BODY_TOP_WITH_TITLE;
}

module.exports = {
  RADIUS,
  LAYOUT,
  parseToken,
  parseRadius,
  bodyStartY,
};
