const test = require("node:test");
const assert = require("node:assert/strict");
const {
  fetchExternalTheme,
  validateUrl,
  validatePalette,
  clearCache,
  ThemeUrlError,
  ALLOWED_HOSTS,
} = require("../src/common/theme-url");

const { resolveCardOptions } = require("../src/common/options");

const VALID_PALETTE = {
  bg: "#101010",
  title: "#ffffff",
  text: "#dddddd",
  muted: "#888888",
  icon: "#88aaff",
  border: "#222222",
  accentStops: ["#ff0000", "#00ff00", "#0000ff"],
};

const VALID_URL = "https://gist.githubusercontent.com/user/abc/raw/theme.json";

// --- validateUrl ---

test("validateUrl accepts allowlisted gist host over https", () => {
  const url = validateUrl(VALID_URL);
  assert.equal(url.hostname, "gist.githubusercontent.com");
});

test("validateUrl rejects http://", () => {
  assert.throws(
    () => validateUrl("http://gist.githubusercontent.com/user/abc/raw/theme.json"),
    ThemeUrlError
  );
});

test("validateUrl rejects non-allowlisted hosts", () => {
  assert.throws(
    () => validateUrl("https://example.com/theme.json"),
    /not allowed/
  );
});

test("validateUrl rejects malformed URLs", () => {
  assert.throws(() => validateUrl("not a url"), ThemeUrlError);
});

test("validateUrl rejects internal addresses even if dressed as URL", () => {
  // Even if someone passes a localhost URL with the right scheme, the host
  // allowlist should reject it.
  assert.throws(() => validateUrl("https://127.0.0.1/theme.json"), /not allowed/);
  assert.throws(() => validateUrl("https://localhost/theme.json"), /not allowed/);
  assert.throws(() => validateUrl("https://169.254.169.254/theme.json"), /not allowed/);
});

test("ALLOWED_HOSTS contains gist.githubusercontent.com", () => {
  assert.ok(ALLOWED_HOSTS.has("gist.githubusercontent.com"));
});

// --- validatePalette ---

test("validatePalette accepts a complete palette", () => {
  const out = validatePalette(VALID_PALETTE);
  assert.equal(out.bg, "#101010");
  assert.deepEqual(out.accentStops, ["#ff0000", "#00ff00", "#0000ff"]);
});

test("validatePalette rejects null and non-object payloads", () => {
  assert.throws(() => validatePalette(null), ThemeUrlError);
  assert.throws(() => validatePalette("string"), ThemeUrlError);
  assert.throws(() => validatePalette(42), ThemeUrlError);
  assert.throws(() => validatePalette([]), ThemeUrlError);
});

test("validatePalette rejects payloads missing required keys", () => {
  const incomplete = { ...VALID_PALETTE };
  delete incomplete.bg;
  assert.throws(() => validatePalette(incomplete), /missing required key "bg"/);
});

test("validatePalette rejects accentStops that are not arrays", () => {
  assert.throws(
    () => validatePalette({ ...VALID_PALETTE, accentStops: "#ff0000" }),
    /array of at least 2 colors/
  );
});

test("validatePalette rejects accentStops with fewer than 2 entries", () => {
  assert.throws(
    () => validatePalette({ ...VALID_PALETTE, accentStops: ["#ff0000"] }),
    /at least 2 colors/
  );
  assert.throws(
    () => validatePalette({ ...VALID_PALETTE, accentStops: [] }),
    /at least 2 colors/
  );
});

test("validatePalette rejects accentStops with non-hex entries", () => {
  assert.throws(
    () => validatePalette({ ...VALID_PALETTE, accentStops: ["#ff0000", "red"] }),
    /invalid color/
  );
});

test("validatePalette ignores extra keys silently", () => {
  const out = validatePalette({ ...VALID_PALETTE, comment: "my theme", extra: 1 });
  assert.equal(out.comment, undefined);
  assert.equal(out.extra, undefined);
  assert.equal(out.bg, VALID_PALETTE.bg);
});

test("validatePalette rejects non-string color values", () => {
  assert.throws(
    () => validatePalette({ ...VALID_PALETTE, bg: 0x101010 }),
    /must be a string/
  );
});

// --- fetchExternalTheme (with mocked fetch) ---

function mockFetch(response) {
  return async () => ({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    // Use real `Headers` (Node 18+) — case-insensitive lookup like production.
    headers: new Headers(response.headers ?? {}),
    text: async () => response.text ?? JSON.stringify(VALID_PALETTE),
  });
}

// Inline-built mock responses elsewhere in this file omit `headers`; this
// helper wraps a raw mock and fills in an empty Headers so the production
// `res.headers.get('content-length')` call doesn't crash.
function withHeaders(mock) {
  return async (...args) => {
    const r = await mock(...args);
    if (!r.headers) r.headers = new Headers();
    return r;
  };
}

test("fetchExternalTheme returns parsed palette on success", async () => {
  clearCache();
  const palette = await fetchExternalTheme(VALID_URL, {
    fetchImpl: mockFetch({ text: JSON.stringify(VALID_PALETTE) }),
  });
  assert.equal(palette.bg, "#101010");
});

test("fetchExternalTheme caches results within TTL", async () => {
  clearCache();
  let callCount = 0;
  const fetchImpl = async () => {
    callCount++;
    return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(VALID_PALETTE) };
  };
  await fetchExternalTheme(VALID_URL, { fetchImpl });
  await fetchExternalTheme(VALID_URL, { fetchImpl });
  await fetchExternalTheme(VALID_URL, { fetchImpl });
  assert.equal(callCount, 1, "second & third call should hit cache");
});

test("fetchExternalTheme refetches after TTL expires", async () => {
  clearCache();
  let callCount = 0;
  const fetchImpl = async () => {
    callCount++;
    return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(VALID_PALETTE) };
  };
  let fakeNow = 1_000_000;
  const now = () => fakeNow;
  await fetchExternalTheme(VALID_URL, { fetchImpl, now });
  fakeNow += 31 * 60 * 1000; // 31 minutes later
  await fetchExternalTheme(VALID_URL, { fetchImpl, now });
  assert.equal(callCount, 2);
});

test("fetchExternalTheme throws on HTTP error", async () => {
  clearCache();
  await assert.rejects(
    fetchExternalTheme(VALID_URL, {
      fetchImpl: async () => ({ ok: false, status: 404, headers: new Headers(), text: async () => "" }),
    }),
    /HTTP 404/
  );
});

test("fetchExternalTheme throws on invalid JSON", async () => {
  clearCache();
  await assert.rejects(
    fetchExternalTheme(VALID_URL, {
      fetchImpl: async () => ({ ok: true, status: 200, headers: new Headers(), text: async () => "not json{" }),
    }),
    /not valid JSON/
  );
});

test("fetchExternalTheme throws on schema-invalid payload", async () => {
  clearCache();
  await assert.rejects(
    fetchExternalTheme(VALID_URL, {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ bg: "#000" }),
      }),
    }),
    /missing required key/
  );
});

test("fetchExternalTheme rejects disallowed hosts before any request", async () => {
  clearCache();
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: true, text: async () => "{}" };
  };
  await assert.rejects(
    fetchExternalTheme("https://evil.example.com/theme.json", { fetchImpl }),
    /not allowed/
  );
  assert.equal(called, false, "fetch should not have been invoked");
});

test("fetchExternalTheme surfaces a timer-induced AbortError as a clean timeout message", async () => {
  // Use a short timeoutMs override so the abort fires via the actual timer
  // path (not synchronous throw) — that's what production hits and what the
  // new controller.signal.aborted guard distinguishes from upstream-surfaced
  // AbortErrors.
  clearCache();
  await assert.rejects(
    fetchExternalTheme(VALID_URL, {
      timeoutMs: 10,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    }),
    /timed out/
  );
});

test("fetchExternalTheme does NOT mislabel non-timer AbortError as a timeout", async () => {
  // Non-timer AbortError (e.g., upstream connection reset in some Undici
  // versions) must propagate with its own message, not be re-labeled
  // 'timed out'. controller.signal.aborted is false in this path.
  clearCache();
  await assert.rejects(
    fetchExternalTheme(VALID_URL, {
      fetchImpl: async () => {
        const err = new Error("upstream connection reset");
        err.name = "AbortError";
        throw err;
      },
    }),
    /upstream connection reset/
  );
});

test("fetchExternalTheme rejects responses whose declared content-length exceeds the cap", async () => {
  const { MAX_BODY_BYTES } = require("../src/common/theme-url");
  clearCache();
  let textCalled = false;
  await assert.rejects(
    fetchExternalTheme(VALID_URL, {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": String(MAX_BODY_BYTES + 1) }),
        text: async () => {
          textCalled = true;
          return "should not be read";
        },
      }),
    }),
    /too large/
  );
  assert.equal(textCalled, false, "pre-read cap must reject before text() runs");
});

test("fetchExternalTheme rejects bodies whose actual size exceeds the cap (bytes, not chars)", async () => {
  const { MAX_BODY_BYTES } = require("../src/common/theme-url");
  clearCache();
  // 4 bytes per emoji in UTF-8; (cap/4 + 100) emoji exceeds the cap in bytes
  // even though text.length is much smaller.
  const oversize = "🔥".repeat(Math.ceil(MAX_BODY_BYTES / 4) + 100);
  await assert.rejects(
    fetchExternalTheme(VALID_URL, {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => oversize,
      }),
    }),
    /too large/
  );
});

test("fetchExternalTheme rejects http:// before any request", async () => {
  clearCache();
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: true, text: async () => "{}" };
  };
  await assert.rejects(
    fetchExternalTheme("http://gist.githubusercontent.com/x/y/raw/t.json", { fetchImpl }),
    /must use https/
  );
  assert.equal(called, false);
});

// --- resolveCardOptions integration ---

test("resolveCardOptions returns dark fallback + themeError when fetch fails", async () => {
  clearCache();
  // Force a host-allowlist failure to exercise the fallback path.
  const params = new URLSearchParams("theme_url=https://evil.example.com/t.json");
  const { opts, themeError } = await resolveCardOptions(params);
  assert.ok(themeError);
  assert.match(themeError, /not allowed/);
  // Falls back to dark theme.
  assert.equal(opts.colors.bg, "#0d1117");
});

test("resolveCardOptions returns null themeError when no theme_url passed", async () => {
  const params = new URLSearchParams("theme=light");
  const { opts, themeError } = await resolveCardOptions(params);
  assert.equal(themeError, null);
  assert.equal(opts.colors.bg, "#ffffff");
});

test("resolveCardOptions per-param color overrides win over external palette", async () => {
  clearCache();
  // Bypass network by stubbing the cache directly.
  const { fetchExternalTheme } = require("../src/common/theme-url");
  // Pre-populate the cache with a known palette so resolveCardOptions
  // doesn't actually hit the network during this test.
  const url = VALID_URL;
  // Trigger fetch with a stub fetchImpl, then verify per-param overrides.
  await fetchExternalTheme(url, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify(VALID_PALETTE),
    }),
  });
  const params = new URLSearchParams(
    `theme_url=${encodeURIComponent(url)}&bg_color=ff0000`
  );
  const { opts, themeError } = await resolveCardOptions(params);
  assert.equal(themeError, null);
  assert.equal(opts.colors.bg, "#ff0000"); // per-param wins
  assert.equal(opts.colors.title, "#ffffff"); // from external palette
});

// --- prefetched palette reuse (stack N+1 dedup) ---

test("resolveCardOptions reuses a prefetched palette without a network call", async () => {
  // /api/stack passes a prefetched { url, palette } to every child slot so
  // the gist URL is fetched once, not 1+N times. Pin that contract here.
  const { resolveCardOptions } = require("../src/common/options");
  clearCache();
  const url = VALID_URL;
  const prefetched = { url, palette: VALID_PALETTE };
  const params = new URLSearchParams(`theme_url=${encodeURIComponent(url)}`);
  // No fetchImpl available — if resolveCardOptions tried to call fetch, it
  // would hit the real network or crash. The prefetched path must short-circuit.
  const { opts, themeError } = await resolveCardOptions(params, prefetched);
  assert.equal(themeError, null);
  assert.equal(opts.colors.bg, VALID_PALETTE.bg);
});

test("resolveCardOptions surfaces a prefetched error without retry", async () => {
  // If the top-level fetch failed, child slots inherit the same error rather
  // than each retrying — preserves the single-fetch contract on failure too.
  const { resolveCardOptions } = require("../src/common/options");
  clearCache();
  const url = VALID_URL;
  const prefetched = { url, error: "theme_url payload too large: 999999 bytes" };
  const params = new URLSearchParams(`theme_url=${encodeURIComponent(url)}`);
  const { themeError } = await resolveCardOptions(params, prefetched);
  assert.match(themeError, /too large/);
});

test("resolveCardOptions falls through when a child overrides with a different theme_url", async () => {
  // <card>.theme_url=<different> in /api/stack must NOT reuse the prefetched
  // palette — it's a different URL. Falls back to fetchExternalTheme via the
  // standard cache, which we pre-populate to avoid hitting the network.
  const { resolveCardOptions } = require("../src/common/options");
  const { fetchExternalTheme } = require("../src/common/theme-url");
  clearCache();
  const otherUrl = "https://gist.githubusercontent.com/u/zzz/raw/other.json";
  const otherPalette = { ...VALID_PALETTE, bg: "#abcdef" };
  await fetchExternalTheme(otherUrl, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify(otherPalette),
    }),
  });
  const prefetched = { url: VALID_URL, palette: VALID_PALETTE };
  const params = new URLSearchParams(`theme_url=${encodeURIComponent(otherUrl)}`);
  const { opts } = await resolveCardOptions(params, prefetched);
  assert.equal(opts.colors.bg, "#abcdef");
});
