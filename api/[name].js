const ENDPOINT_NAMES = [
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
  const name = req.query && req.query.name;
  if (!name || !ALLOWED.has(name)) {
    res.status(404).setHeader("Content-Type", "text/plain");
    return res.send(`Unknown endpoint: ${name ?? "(missing)"}`);
  }

  const handler = require(`../src/endpoints/${name}`);
  return handler(req, res);
};

module.exports.ALLOWED_ENDPOINTS = ENDPOINT_NAMES;
