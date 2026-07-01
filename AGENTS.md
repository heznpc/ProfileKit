# ProfileKit

Composable SVG card endpoints for GitHub profiles, READMEs, blogs, and personal
sites. Vanilla Node, no runtime dependencies, Vercel API routes plus Docker
self-hosting.

## Run this repo

```bash
npm run check
npm test
docker build -t profilekit:local .
docker run --rm -p 3000:3000 profilekit:local
```

## Structure

```
api/
  health.js      -> health endpoint
  divider.js     -> SVG divider endpoint
src/
  cards/         -> card renderers
  core/          -> shared SVG/query helpers
server.js        -> local/self-host HTTP adapter
tests/           -> node:test coverage for endpoints and renderers
```

## Invariants

- Keep endpoints deterministic: same query string means same SVG.
- Treat every query parameter as untrusted input. Clamp numbers, whitelist
  enum-like strings, and escape text before embedding in SVG.
- Do not add user ranking, scoring, ratings, or analytics capture.
- Do not introduce a database or server-side persistence for card rendering.
- Docker and Vercel paths must stay behaviorally equivalent.
