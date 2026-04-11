const { getRandomQuote, getDailyQuote } = require("../src/data/quotes");
const { renderQuoteCard } = require("../src/cards/quote");
const { parseSearchParams, resolveCardOptions } = require("../src/common/options");
const { parseBoolean, parseIntSafe, cacheHeaders } = require("../src/common/utils");

module.exports = async (req, res) => {
  const params = parseSearchParams(req);
  const { opts, themeError } = await resolveCardOptions(params);

  const daily = parseBoolean(params.get("daily"));
  // card_width is the canonical name; width is kept as a documented alias.
  const width = opts.cardWidth || parseIntSafe(params.get("width"), 495);

  const quote = daily ? getDailyQuote() : getRandomQuote();
  const svg = renderQuoteCard(quote, { ...opts, width });

  res.setHeader("Content-Type", "image/svg+xml");
  if (themeError) res.setHeader("X-Theme-Error", themeError);
  res.setHeader(
    "Cache-Control",
    daily
      ? "public, max-age=43200, s-maxage=43200"
      : cacheHeaders()
  );
  return res.send(svg);
};
