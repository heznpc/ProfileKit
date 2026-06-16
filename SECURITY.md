# Security Policy

## Reporting a vulnerability

ProfileKit is a serverless SVG endpoint service that fetches data from
external URLs on behalf of users. The user-controlled URL surfaces are:

- `?theme_url=` on **every card endpoint** — parsed by the shared option
  resolver in [`src/common/options.js`](src/common/options.js); the
  underlying fetch lives in [`src/common/theme-url.js`](src/common/theme-url.js)
  with a single-host allowlist (`gist.githubusercontent.com`), a 5-second
  timeout that covers the body read, a 256 KB streaming byte cap, and
  `redirect: "error"`.
- `?source=rss|medium&url=` on `/api/posts` — see
  [`src/fetchers/posts.js`](src/fetchers/posts.js). 13-host allowlist plus
  https-only, `redirect: "error"`, 5-second timeout across the body read,
  and a 2 MB streaming byte cap (the cap aborts the underlying controller
  mid-stream if exceeded, so chunked / no-content-length responses cannot
  OOM the function).

Both fetch paths spread caller `init` BEFORE forcing `redirect: "error"`
and `signal: controller.signal`, so a future caller cannot weaken either
guard through their own `init`.

If you find a bypass — or any other issue (prompt injection through
user-controlled text, XSS in rendered SVG, auth/scope issue with GitHub
API token pool, theme schema escape) — please report it privately.

**How to report:**

- Use GitHub's [Private vulnerability reporting](https://github.com/starter-series/ProfileKit/security/advisories/new)
  (preferred — keeps disclosure timeline tracked).
- Or email the maintainer via the address listed on the GitHub profile.

Please do **not** open a public issue for security reports.

## Response timeline

| Stage | Target |
|---|---|
| Acknowledgement | within 7 days |
| Coordinated disclosure | up to 90 days from report |

Single-maintainer project — only the surfaces above are committed.
If a fix lands earlier, disclosure happens at fix time. If a fix needs
more than 90 days (e.g., upstream dependency), we coordinate a longer
window with the reporter.

## Supported versions

The deployed instance at <https://profilekit.vercel.app> always runs the
current `main` branch. There are no maintained release branches — fixes
land on `main` and ship within minutes via Vercel.

Self-hosters: re-deploy from `main` after any security advisory.

## Out of scope

- Denial of service via expensive `?source=rss` feeds — the streaming
  body cap (2 MB) and timeout (5s) bound the surface; Vercel function
  duration (10s, see `vercel.json`) is the upper bound.
- Rate-limit consumption of the deployer's GitHub API token pool — public
  data only, mitigated via the token pool design (`src/common/github-token.js`).
- Issues in third-party platforms (GitHub Camo proxy, Notion image proxy,
  etc.) that affect how cards render — report to those platforms directly.
- `source=hashnode` on `/api/posts` — Hashnode retired the free public
  GraphQL API in 2026-05; the source is now disabled at the entry point
  and returns a clean "use source=rss instead" error. No SSRF surface.
