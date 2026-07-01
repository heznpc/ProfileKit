# Security guidance

This file is read by Anthropic's Claude Code Security Guidance Plugin as an
in-session guard while Claude writes code. It complements the
`claude-code-security-review` GitHub Action and the repo-level
`audit_security` check.

## Universal rules

- Never log secrets, tokens, cookies, or raw request headers.
- Never use `eval`, `Function()`, or shell execution for request data.
- Validate and clamp all query parameters before rendering SVG.
- Escape user-visible text before embedding it in SVG or HTML.
- Keep `.env*` files out of git. Use examples with placeholder values only.
- Use OIDC trusted publishing where publishing is added; do not add long-lived
  registry tokens to workflows.

## ProfileKit rules

- SVG endpoints must be deterministic and side-effect free.
- Do not add persistence, analytics capture, tracking pixels, or ranking data
  to card rendering.
- Maintain parity between Vercel API routes and the Docker/self-host server.
- Cap width, height, text length, color strings, and list sizes so malformed
  query strings cannot produce excessive SVG output.
