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
    text: async () => response.text ?? JSON.stringify(VALID_PALETTE),
  });
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
    return { ok: true, status: 200, text: async () => JSON.stringify(VALID_PALETTE) };
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
    return { ok: true, status: 200, text: async () => JSON.stringify(VALID_PALETTE) };
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
      fetchImpl: async () => ({ ok: false, status: 404, text: async () => "" }),
    }),
    /HTTP 404/
  );
});

test("fetchExternalTheme throws on invalid JSON", async () => {
  clearCache();
  await assert.rejects(
    fetchExternalTheme(VALID_URL, {
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => "not json{" }),
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

test("fetchExternalTheme surfaces an AbortError as a clean timeout message", async () => {
  clearCache();
  const fetchImpl = async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  };
  await assert.rejects(
    fetchExternalTheme(VALID_URL, { fetchImpl }),
    /timed out/
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
