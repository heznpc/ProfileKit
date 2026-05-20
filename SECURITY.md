# Security Policy

## Reporting a vulnerability

ProfileKit is a serverless SVG endpoint service that fetches data from
external URLs on behalf of users. The two user-controlled URL surfaces are:

- `?theme_url=` on `/api/stats` and `/api/stack` — see [`src/common/theme-url.js`](src/common/theme-url.js)
- `?source=rss|medium&url=` on `/api/posts` — see [`src/fetchers/posts.js`](src/fetchers/posts.js)

Both apply a host allowlist, https-only, `redirect: "error"`, a hard timeout,
and a response-body size cap. If you find a bypass — or any other issue
(prompt injection through user-controlled text, XSS in rendered SVG,
auth/scope issue with GitHub API token pool, theme schema escape) — please
report it privately.

**How to report:**

- Use GitHub's [Private vulnerability reporting](https://github.com/newtria/ProfileKit/security/advisories/new)
  (preferred — keeps disclosure timeline tracked).
- Or email the maintainer via the address listed on the GitHub profile.

Please do **not** open a public issue for security reports.

## Response timeline

| Stage | Target |
|---|---|
| Acknowledgement | within 7 days |
| Coordinated disclosure | up to 90 days from report |

Single-maintainer project — only the two endpoints above are committed.
If a fix lands earlier, disclosure happens at fix time. If a fix needs
more than 90 days (e.g., upstream dependency), we coordinate a longer
window with the reporter.

## Supported versions

The deployed instance at <https://profilekit.vercel.app> always runs the
current `main` branch. There are no maintained release branches — fixes
land on `main` and ship within minutes via Vercel.

Self-hosters: re-deploy from `main` after any security advisory.

## Out of scope

- Denial of service via expensive `?source=rss` feeds — the per-request
  body cap (2 MB) and timeout (5s) bound the surface; Vercel function
  duration (10s, see `vercel.json`) is the upper bound.
- Rate-limit consumption of the deployer's GitHub API token pool — public
  data only, mitigated via the token pool design (`src/common/github-token.js`).
- Issues in third-party platforms (GitHub Camo proxy, Notion image proxy,
  etc.) that affect how cards render — report to those platforms directly.
