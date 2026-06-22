const { CARDS } = require("../src/endpoints/catalog");

const ALLOWED = new Set([...Object.keys(CARDS), "catalog"]);

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

  try {
    const handler = require(`../src/endpoints/${endpoint}`);
    return await handler(req, res);
  } catch (err) {
    res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(`Internal error: ${err.message}`);
  }
};

module.exports.ALLOWED_ENDPOINTS = Array.from(ALLOWED).sort();
