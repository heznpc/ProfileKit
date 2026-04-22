const ENDPOINT_NAMES = [
  "catalog",
  "constellation",
  "divider",
  "equalizer",
  "glitch",
  "health",
  "heartbeat",
  "hero",
  "languages",
  "leetcode",
  "matrix",
  "neon",
  "now",
  "pin",
  "posts",
  "quote",
  "radar",
  "reviews",
  "section",
  "snake",
  "social",
  "stack",
  "stats",
  "tags",
  "terminal",
  "timeline",
  "toc",
  "typing",
  "wave",
];

const ALLOWED = new Set(ENDPOINT_NAMES);

module.exports = async (req, res) => {
  // The dynamic segment is named [endpoint], not [name], on purpose:
  // some handlers (hero, now, etc.) expect ?name= as a legitimate user
  // parameter, and Vercel merges the captured segment into req.query.
  // Using [endpoint] avoids clobbering ?name= at the URLSearchParams level.
  const endpoint = req.query && req.query.endpoint;
  if (!endpoint || !ALLOWED.has(endpoint)) {
    res.status(404).setHeader("Content-Type", "text/plain");
    return res.send(`Unknown endpoint: ${endpoint ?? "(missing)"}`);
  }

  const handler = require(`../src/endpoints/${endpoint}`);
  return handler(req, res);
};

module.exports.ALLOWED_ENDPOINTS = ENDPOINT_NAMES;
