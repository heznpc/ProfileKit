// server.js — standalone HTTP server for ProfileKit self-hosting.
//
// ProfileKit's primary deployment target is Vercel (api/[endpoint].js).
// That file relies on Vercel's platform glue to (a) route /api/<name> to
// the dynamic handler and (b) provide Express-style req.query +
// res.status()/res.send().
//
// To run ProfileKit as a plain container (or behind any reverse proxy / LB
// you control), this file reproduces that glue with Node 22's built-in
// http module — no npm dependencies, matching the zero-dep posture the
// rest of the project commits to. Vercel deploys are unaffected: they
// keep importing api/[endpoint].js. This file is purely additive.
//
// Security posture: the same ALLOWED set (CARDS keys + catalog + health)
// gates the dynamic `require` so a request like /api/../../etc/passwd
// cannot escape the endpoints directory.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const { CARDS } = require("./src/endpoints/catalog");

const ALLOWED = new Set([...Object.keys(CARDS), "catalog", "health"]);

const PORT = Number(process.env.PORT || 3000);
// INSTANCE_ID lets a load balancer demo / multi-replica deploy reveal
// which replica answered (X-ProfileKit-Instance header). Defaults to the
// container hostname when present (Docker / Kubernetes).
const INSTANCE_ID = process.env.INSTANCE_ID || process.env.HOSTNAME || "local";

const PUBLIC_DIR = path.join(__dirname, "public");
const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

// Adapt Node's ServerResponse to the Express-ish shape the endpoint
// handlers expect (they were written against Vercel's helper layer).
function adaptResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.send = (body) => {
    res.end(body);
    return res;
  };
  return res;
}

function serveStatic(req, res) {
  let rel = req.url.split("?")[0];
  if (rel === "/") rel = "/index.html";
  // Path traversal guard: resolve the full target then assert containment
  // inside PUBLIC_DIR. Rejects `/../../etc/passwd`, `/%2e%2e/foo`, etc.
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.end("Not found");
    }
    res.setHeader(
      "Content-Type",
      STATIC_TYPES[path.extname(filePath)] || "application/octet-stream"
    );
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  adaptResponse(res);

  // Stamp every response with the serving instance so curl against a load
  // balancer visibly rotates across replicas (round-robin proof).
  res.setHeader("X-ProfileKit-Instance", INSTANCE_ID);

  // Parse against a fixed origin — req.headers.host is untrusted in
  // serverless / reverse-proxy environments and the endpoint handlers
  // already build their own URL via parseSearchParams.
  const url = new URL(req.url, "http://profilekit.local");
  const segments = url.pathname.split("/").filter(Boolean);

  // /api/<endpoint> — reproduce Vercel's [endpoint] dynamic segment.
  if (segments[0] === "api" && segments[1]) {
    const endpoint = segments[1];
    if (!ALLOWED.has(endpoint)) {
      res
        .status(404)
        .setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(`Unknown endpoint: ${endpoint}`);
    }
    // Handlers consume params via parseSearchParams(req) which reads req.url
    // directly, so url stays as-is. req.query mirrors what Vercel provides
    // for handlers that prefer the parsed form (api/[endpoint].js uses it).
    req.query = Object.fromEntries(url.searchParams);
    req.query.endpoint = endpoint;
    try {
      const handler = require(`./src/endpoints/${endpoint}`);
      return await handler(req, res);
    } catch (err) {
      res
        .status(500)
        .setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(`Internal error: ${err.message}`);
    }
  }

  // Everything else → static playground assets (public/).
  return serveStatic(req, res);
});

// Only auto-listen when run directly. When required from tests, the test
// drives `.listen(0)` itself on an ephemeral port.
if (require.main === module) {
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`ProfileKit listening on :${PORT} (instance=${INSTANCE_ID})`);
  });

  // Graceful shutdown so the orchestrator can drain connections on
  // scale-down without dropping in-flight requests.
  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, () => {
      // eslint-disable-next-line no-console
      console.log(`${sig} received — draining`);
      server.close(() => process.exit(0));
    });
  }
}

module.exports = { server, ALLOWED, PUBLIC_DIR };
