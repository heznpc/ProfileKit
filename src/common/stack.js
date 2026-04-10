// Composition primitives for /api/stack — combine multiple card SVGs into a
// single outer SVG.
//
// The trick: SVG allows <svg> nesting, where the inner element acts as its
// own viewport at a given x/y. So instead of stripping inner content out of
// each child card, we just position each card's outer <svg> element inside
// the parent. The only adjustment we have to make is namespace each child's
// element IDs so that two cards both defining e.g. `card-clip` don't clobber
// each other's url(#...) references.
//
// CSS classes and @keyframes are intentionally NOT namespaced — for the v1
// scope (one shared theme across stacked cards), card families use distinct
// class prefixes (`.hero-name` vs `.sec-title` vs unprefixed data classes)
// and animation keyframe names. Two cards from the same family share the same
// rules under the same theme, so visual collisions are unlikely. Mixing
// per-card themes inside one stack is left as a known limitation.

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Read width/height attributes from the outer <svg> tag.
function getOuterAttrs(svg) {
  const tag = svg.match(/^\s*<svg([^>]*)>/);
  if (!tag) throw new Error("not a complete SVG");
  const attrs = tag[1];
  const w = attrs.match(/\bwidth="([^"]+)"/);
  const h = attrs.match(/\bheight="([^"]+)"/);
  return {
    width: w ? parseFloat(w[1]) : 0,
    height: h ? parseFloat(h[1]) : 0,
  };
}

// Prefix every `id="X"` declaration in the SVG and rewrite all references
// (`url(#X)`, `href="#X"`, `xlink:href="#X"`) to match. Cards built by this
// project only use ASCII identifiers, so the regex approach is safe.
function namespaceIds(svg, prefix) {
  const ids = new Set();
  const idRe = /\bid="([^"]+)"/g;
  let m;
  while ((m = idRe.exec(svg)) !== null) ids.add(m[1]);

  let result = svg;
  for (const id of ids) {
    const escaped = escapeRegex(id);
    result = result.replace(
      new RegExp(`\\bid="${escaped}"`, "g"),
      `id="${prefix}${id}"`
    );
    result = result.replace(
      new RegExp(`url\\(#${escaped}\\)`, "g"),
      `url(#${prefix}${id})`
    );
    result = result.replace(
      new RegExp(`(\\bxlink:)?href="#${escaped}"`, "g"),
      `$1href="#${prefix}${id}"`
    );
  }
  return result;
}

// Inject `x` and `y` attributes onto the outer <svg> element so it positions
// inside the parent viewport. Strips any pre-existing x/y to keep the result
// idempotent.
function positionSvg(svg, x, y) {
  return svg.replace(/^\s*<svg([^>]*)>/, (_, attrs) => {
    const cleaned = attrs
      .replace(/\s+x="[^"]*"/g, "")
      .replace(/\s+y="[^"]*"/g, "");
    return `<svg x="${x}" y="${y}"${cleaned}>`;
  });
}

// Stack child SVGs vertically, centered horizontally, with `gap` px between
// rows. The returned outer SVG has width = max child width and height = sum
// of child heights + gaps.
function stackVertical(svgs, { gap = 16 } = {}) {
  if (!svgs.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>`;
  }
  const dims = svgs.map(getOuterAttrs);
  const maxWidth = Math.max(...dims.map((d) => d.width));

  let totalHeight = 0;
  const positioned = svgs.map((svg, i) => {
    const { width, height } = dims[i];
    const xOffset = Math.max(0, Math.round((maxWidth - width) / 2));
    const yOffset = totalHeight;
    totalHeight += height + (i < svgs.length - 1 ? gap : 0);
    const namespaced = namespaceIds(svg, `s${i}_`);
    return positionSvg(namespaced, xOffset, yOffset);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxWidth}" height="${totalHeight}" viewBox="0 0 ${maxWidth} ${totalHeight}">
  ${positioned.join("\n  ")}
</svg>`;
}

module.exports = {
  getOuterAttrs,
  namespaceIds,
  positionSvg,
  stackVertical,
};
