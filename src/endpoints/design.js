// Stateless live compositions. Documents contain endpoint names and parameters,
// never URLs to fetch or SVG to trust. Every card runs through an existing handler.
const Model = require("../../public/editor-model");
const Design = require("../../public/card-design");
const { CARDS } = require("../../public/card-schema");
const { scopeParams } = require("./stack");
const { getOuterAttrs, positionSvg } = require("../common/stack");
const { parseSearchParams, parseCardOptions } = require("../common/options");
const { cacheHeaders, errorCacheHeaders, classifyError, parseIntSafe } = require("../common/utils");
const { renderError } = require("../common/card");

const handlers = new Map(Object.keys(CARDS).map((name) => [name, require(`./${name}`)]));

function aggregateCache(values) {
  if (!values.length) return cacheHeaders();
  if (values.some((value) => !value || /\b(?:no-store|private)\b/i.test(value))) return "no-store, max-age=0";
  if (values.some((value) => /\bno-cache\b/i.test(value))) return "no-cache, max-age=0";
  const directives = ["max-age", "s-maxage", "stale-while-revalidate"];
  return "public, " + directives.map((directive) => {
    const seconds = values.map((value) => {
      const match = value.match(new RegExp(`(?:^|[,\\s])${directive}=(\\d+)`, "i"));
      return match ? Number(match[1]) : 0;
    });
    return `${directive}=${Math.min(...seconds)}`;
  }).join(", ");
}

function errorSVG(error, params = new URLSearchParams()) {
  return renderError(String(error.message || error), parseCardOptions(params));
}

async function invokeCard(card) {
  // normalizeCard is defense in depth if this helper is used beyond buildDesign.
  const normalized = Model.normalizeCard(card);
  if (normalized.endpoint === "stack") return invokeStack(normalized);
  const handler = handlers.get(normalized.endpoint);
  if (!handler) throw new Error("Unsupported card endpoint");
  const headers = Object.create(null);
  let svg;
  const response = {
    statusCode: 200,
    setHeader(name, value) { headers[name.toLowerCase()] = String(value); return this; },
    status(code) { this.statusCode = code; return this; },
    send(value) { svg = String(value); return this; },
  };
  try {
    await handler({ url: Model.cardPath(normalized), method: "GET", headers: {} }, response);
    if (typeof svg !== "string" || !/^\s*<svg\b/.test(svg)) throw new Error("Card renderer did not return an SVG");
  } catch (error) {
    svg = errorSVG(error, new URLSearchParams(normalized.params));
    headers["cache-control"] = errorCacheHeaders(classifyError(error));
  }
  return { svg, headers };
}

async function invokeStack(card) {
  const params = new URLSearchParams(card.params);
  const children = card.params.cards.split(",").map((name) => name.trim()).filter(Boolean);
  const gap = parseIntSafe(params.get("gap"), 16, 0, 200);
  const results = [];
  // Sequential children also reuse successful external-theme cache entries.
  // Each child keeps its own error policy instead of being hidden by stack's TTL.
  for (const endpoint of children) results.push(await invokeCard({ endpoint, params: Object.fromEntries(scopeParams(params, endpoint)) }));
  const dimensions = results.map(({ svg }) => getOuterAttrs(svg));
  const width = Math.max(...dimensions.map((size) => size.width));
  let height = 0;
  const content = results.map(({ svg }, index) => {
    const size = dimensions[index];
    const x = Math.max(0, Math.round((width - size.width) / 2));
    const y = height;
    height += size.height + (index < results.length - 1 ? gap : 0);
    return positionSvg(Model.isolateSVG(svg, `stack-${index}-`), x, y);
  }).join("\n");
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`,
    headers: {
      "cache-control": aggregateCache(results.map((result) => result.headers["cache-control"])),
      "x-theme-error": results.map((result, index) => result.headers["x-theme-error"] ? `${children[index]}: ${result.headers["x-theme-error"]}` : "").filter(Boolean).join("; "),
    },
  };
}

async function buildDesign(document) {
  const doc = Model.normalizeDocument(document);
  const cards = doc.elements.filter((element) => element.type === "card");
  const results = await Promise.all(cards.map(invokeCard));
  const cardMarkup = Object.fromEntries(cards.map((card, index) => [card.id, results[index].svg]));
  const themeErrors = results.map((result, index) => result.headers["x-theme-error"] ? `${cards[index].id}: ${result.headers["x-theme-error"]}` : "").filter(Boolean);
  return {
    svg: Model.renderSVG(doc, { cardMarkup }),
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": aggregateCache(results.map((result) => result.headers["cache-control"])),
      // Node disallows control/non-Latin characters in HTTP header values.
      ...(themeErrors.length ? { "X-Theme-Error": themeErrors.join("; ").replace(/[^\x20-\x7e]/g, " ").slice(0, 4096) } : {}),
    },
  };
}

module.exports = async (req, res) => {
  let doc;
  try {
    if (typeof req.url !== "string" || req.url.length > Design.MAX_DESIGN_URL_LENGTH) throw new Error("Design URL is too large (maximum 14,000 characters)");
    const params = parseSearchParams(req);
    if (params.getAll("d").length !== 1 || Array.from(params.keys()).some((key) => key !== "d")) throw new Error("Provide one ?d= encoded design document");
    doc = Design.decodeDocument(params.get("d"));
  } catch (error) {
    if (typeof res.status === "function") res.status(400);
    else res.statusCode = 400;
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", errorCacheHeaders("bad_input"));
    return res.send(errorSVG(error));
  }
  const result = await buildDesign(doc);
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  return res.send(result.svg);
};

module.exports.buildDesign = buildDesign;
module.exports.aggregateCache = aggregateCache;
