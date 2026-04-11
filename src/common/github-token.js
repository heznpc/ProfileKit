// Token rotation for GitHub fetchers.
//
// A single GITHUB_TOKEN bottlenecks at 5000 GraphQL points per hour, which
// translates to ~1000 fetchStats calls per hour for the worst case (one
// query + four pagination pages = 5 calls). Heavy README embeds blow through
// this in minutes.
//
// This module reads tokens from any of the following env shapes and exposes
// a `nextToken()` round-robin plus an `invalidate(token)` hook so callers
// can mark a token as exhausted (HTTP 401/403/429) and skip it for the
// remainder of the warm process.
//
//   GITHUB_TOKEN                       (single)
//   GITHUB_TOKENS                      (comma-separated list)
//   GITHUB_TOKEN_1, GITHUB_TOKEN_2, …  (numbered)
//
// All shapes can be combined; duplicates are removed.

const COOLDOWN_MS = 60 * 60 * 1000; // mirror GitHub's reset window

let pool = null;

function loadTokens() {
  const seen = new Set();
  const tokens = [];

  const add = (raw) => {
    if (!raw) return;
    const t = raw.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    tokens.push({ token: t, cooldownUntil: 0 });
  };

  add(process.env.GITHUB_TOKEN);

  if (process.env.GITHUB_TOKENS) {
    for (const t of process.env.GITHUB_TOKENS.split(",")) add(t);
  }

  for (let i = 1; i < 32; i++) {
    add(process.env[`GITHUB_TOKEN_${i}`]);
  }

  return tokens;
}

function ensurePool() {
  if (pool) return pool;
  pool = { tokens: loadTokens(), cursor: 0 };
  return pool;
}

/**
 * Returns the next usable token, or null if every token in the pool is
 * currently in cooldown. Round-robins across calls.
 */
function nextToken() {
  const p = ensurePool();
  if (p.tokens.length === 0) return null;

  const now = Date.now();
  const start = p.cursor;
  for (let i = 0; i < p.tokens.length; i++) {
    const idx = (start + i) % p.tokens.length;
    const entry = p.tokens[idx];
    if (entry.cooldownUntil <= now) {
      p.cursor = (idx + 1) % p.tokens.length;
      return entry.token;
    }
  }
  return null;
}

/**
 * Mark a token as cooled-down for `ms` milliseconds (default 1h). Used by
 * fetchers when a request fails with 401/403/429 — the same call sequence
 * will pick a different token on its next attempt.
 */
function invalidate(token, ms = COOLDOWN_MS) {
  const p = ensurePool();
  for (const entry of p.tokens) {
    if (entry.token === token) {
      entry.cooldownUntil = Date.now() + ms;
      return;
    }
  }
}

/**
 * Convenience wrapper: try `fn(token)` against each available token in turn,
 * invalidating tokens that come back with rotation-eligible status codes,
 * and rethrowing on the final failure (or any non-rotation error).
 */
async function withRotation(fn) {
  const p = ensurePool();
  if (p.tokens.length === 0) {
    throw new Error("GITHUB_TOKEN not configured");
  }

  let lastError;
  for (let attempt = 0; attempt < p.tokens.length; attempt++) {
    const token = nextToken();
    if (!token) break;
    try {
      return await fn(token);
    } catch (err) {
      lastError = err;
      const status = err && err.status;
      if (status === 401 || status === 403 || status === 429) {
        invalidate(token);
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error("All GitHub tokens are in cooldown");
}

// Test-only escape hatch — lets unit tests reset the pool between cases.
function _resetForTests() {
  pool = null;
}

module.exports = { nextToken, invalidate, withRotation, _resetForTests };
