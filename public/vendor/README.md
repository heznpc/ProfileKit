# Browser-only README preview dependencies

These upstream browser builds are vendored so README previews need no CDN or
Node runtime dependency. Load Marked, DOMPurify, then `readme-preview.js`.
Do not edit the bundled library files. Upgrade the pinned builds together with
their licenses and verify the README preview's sanitization/browser checks.

| File | Version | Upstream source | SHA-256 |
| --- | --- | --- | --- |
| `marked.umd.js` | 18.1.1 | `package/lib/marked.umd.js` in https://registry.npmjs.org/marked/-/marked-18.1.1.tgz | `fb82b9334406d8bdd16b6236c08de1cb65b2a859873ca9503d9cc0b292ca3c12a` |
| `purify.min.js` | 3.4.17 | https://raw.githubusercontent.com/cure53/DOMPurify/3.4.17/dist/purify.min.js | `cd37898f9782adf54820c413191b5691803f0f137c799d6edcfd38523b4c2c31` |

Marked is MIT-licensed; `marked.LICENSE` is the unmodified license from the same
npm distribution. DOMPurify is dual-licensed under Apache-2.0 or MPL-2.0; this
distribution uses Apache-2.0 and includes the upstream `LICENSE` as
`DOMPurify.LICENSE`. Copyright notices remain in both browser builds.

Upstream projects: https://github.com/markedjs/marked and
https://github.com/cure53/DOMPurify. Retrieved 2026-10-23.
