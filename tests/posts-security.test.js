const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateFeedUrl,
  isAllowedFeedHost,
  ALLOWED_FEED_HOSTS,
  fetchCapped,
  FETCH_TIMEOUT_MS,
  MAX_BODY_BYTES,
} = require("../src/fetchers/posts");

// --- isAllowedFeedHost ---

test("isAllowedFeedHost accepts exact allowlist entries", () => {
  assert.equal(isAllowedFeedHost("medium.com"), true);
  assert.equal(isAllowedFeedHost("dev.to"), true);
  assert.equal(isAllowedFeedHost("substack.com"), true);
});

test("isAllowedFeedHost accepts subdomains of allowlist entries", () => {
  assert.equal(isAllowedFeedHost("user.medium.com"), true);
  assert.equal(isAllowedFeedHost("blog.substack.com"), true);
  assert.equal(isAllowedFeedHost("anyone.hashnode.dev"), true);
  assert.equal(isAllowedFeedHost("anyone.github.io"), true);
});

test("isAllowedFeedHost is case-insensitive", () => {
  assert.equal(isAllowedFeedHost("User.MEDIUM.com"), true);
});

test("isAllowedFeedHost rejects look-alike hosts", () => {
  // Suffix match must be anchored on a dot, not a raw substring.
  assert.equal(isAllowedFeedHost("evilmedium.com"), false);
  assert.equal(isAllowedFeedHost("medium.com.evil.tld"), false);
  assert.equal(isAllowedFeedHost("notreallymedium.com"), false);
});

test("isAllowedFeedHost rejects internal / loopback / metadata addresses", () => {
  assert.equal(isAllowedFeedHost("localhost"), false);
  assert.equal(isAllowedFeedHost("127.0.0.1"), false);
  assert.equal(isAllowedFeedHost("10.0.0.1"), false);
  assert.equal(isAllowedFeedHost("169.254.169.254"), false); // AWS / GCP IMDS
  assert.equal(isAllowedFeedHost("metadata.google.internal"), false);
  assert.equal(isAllowedFeedHost("0.0.0.0"), false);
});

test("isAllowedFeedHost rejects empty / null input", () => {
  assert.equal(isAllowedFeedHost(""), false);
  assert.equal(isAllowedFeedHost(null), false);
  assert.equal(isAllowedFeedHost(undefined), false);
});

// --- validateFeedUrl ---

test("validateFeedUrl accepts a canonical medium RSS URL", () => {
  const url = validateFeedUrl("https://medium.com/feed/@user");
  assert.equal(url.hostname, "medium.com");
  assert.equal(url.protocol, "https:");
});

test("validateFeedUrl accepts subdomain feeds", () => {
  const url = validateFeedUrl("https://user.medium.com/feed");
  assert.equal(url.hostname, "user.medium.com");
});

test("validateFeedUrl rejects http://", () => {
  assert.throws(
    () => validateFeedUrl("http://medium.com/feed/@user"),
    /must use https/
  );
});

test("validateFeedUrl rejects unparseable URLs", () => {
  assert.throws(() => validateFeedUrl("not a url"), /Invalid feed URL/);
  assert.throws(() => validateFeedUrl(""), /Invalid feed URL/);
});

test("validateFeedUrl rejects SSRF classics — internal IP and metadata", () => {
  assert.throws(
    () => validateFeedUrl("https://169.254.169.254/latest/meta-data/"),
    /not allowed/
  );
  assert.throws(
    () => validateFeedUrl("https://localhost:8080/"),
    /not allowed/
  );
  assert.throws(
    () => validateFeedUrl("https://127.0.0.1/admin"),
    /not allowed/
  );
  assert.throws(
    () => validateFeedUrl("https://10.0.0.1/"),
    /not allowed/
  );
});

test("validateFeedUrl rejects arbitrary third-party hosts", () => {
  assert.throws(
    () => validateFeedUrl("https://evil.example.com/feed.xml"),
    /not allowed/
  );
});

test("validateFeedUrl rejects hosts that look like suffix bypass attempts", () => {
  // A bare hostname that happens to *contain* "medium.com" must not slip
  // through — suffix matching is anchored on a dot.
  assert.throws(
    () => validateFeedUrl("https://evilmedium.com/feed"),
    /not allowed/
  );
});

test("validateFeedUrl rejects file:/// and javascript: schemes", () => {
  assert.throws(
    () => validateFeedUrl("file:///etc/passwd"),
    /must use https/
  );
  assert.throws(
    () => validateFeedUrl("javascript:alert(1)"),
    /must use https/
  );
});

test("ALLOWED_FEED_HOSTS includes the baseline blog platforms", () => {
  for (const host of ["medium.com", "dev.to", "hashnode.dev", "substack.com"]) {
    assert.ok(
      ALLOWED_FEED_HOSTS.includes(host),
      `expected ${host} in allowlist`
    );
  }
});

// --- fetchCapped wire-level guards (mocked fetch) ---
//
// SECURITY.md promises four properties of the user-controlled fetch path:
//   1. redirect: "error" — no following 302 to internal IPs
//   2. 5s AbortController timeout — slow remote can't hold the function open
//   3. content-length cap (2 MB) — declared-length large responses are rejected
//   4. body-length cap (2 MB) — bodies that exceed cap *after* reading are rejected
//
// These tests verify each property by spying on the init args passed to fetch
// and by returning crafted responses. Without them, a refactor that drops any
// one guard would not fail a single existing test.

test("fetchCapped passes redirect:'error' to the underlying fetch", async () => {
  let capturedInit;
  await fetchCapped(
    "https://medium.com/feed/@user",
    {},
    {
      fetchImpl: async (_url, init) => {
        capturedInit = init;
        return { ok: true, headers: new Map(), text: async () => "" };
      },
    }
  );
  assert.equal(
    capturedInit.redirect,
    "error",
    "redirect:error must be set so an allowlisted host's 302 to IMDS can't bypass SSRF guards"
  );
});

test("fetchCapped's redirect:'error' is non-overridable by caller init", async () => {
  // Defense in depth: even if a caller mistakenly passes `{ redirect: "follow" }`,
  // the wrapper must still enforce redirect:error. Caller init is spread BEFORE
  // the security defaults in the implementation, so the guard always wins.
  let capturedInit;
  await fetchCapped(
    "https://medium.com/feed/@user",
    { redirect: "follow" },
    {
      fetchImpl: async (_url, init) => {
        capturedInit = init;
        return { ok: true, headers: new Map(), text: async () => "" };
      },
    }
  );
  assert.equal(
    capturedInit.redirect,
    "error",
    "redirect must remain 'error' even when caller asks for 'follow'"
  );
});

test("fetchCapped rejects responses whose declared content-length exceeds the cap", async () => {
  await assert.rejects(
    fetchCapped(
      "https://medium.com/feed/@user",
      {},
      {
        fetchImpl: async () => ({
          ok: true,
          headers: new Map([["content-length", String(MAX_BODY_BYTES + 1)]]),
          text: async () => "should not be read",
        }),
      }
    ),
    /Response too large/
  );
});

test("fetchCapped rejects responses whose body exceeds the cap after reading", async () => {
  // Content-length absent / lying: the post-read length check is the last
  // line of defense against a streamed-chunked oversize body.
  const oversize = "x".repeat(MAX_BODY_BYTES + 10);
  await assert.rejects(
    fetchCapped(
      "https://medium.com/feed/@user",
      {},
      {
        fetchImpl: async () => ({
          ok: true,
          headers: new Map(),
          text: async () => oversize,
        }),
      }
    ),
    /Response too large/
  );
});

test("fetchCapped translates AbortError into a clean timeout message", async () => {
  await assert.rejects(
    fetchCapped(
      "https://medium.com/feed/@user",
      {},
      {
        fetchImpl: async () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          throw err;
        },
      }
    ),
    new RegExp(`timed out after ${FETCH_TIMEOUT_MS}ms`)
  );
});

test("fetchCapped throws on non-ok response with the status surfaced", async () => {
  await assert.rejects(
    fetchCapped(
      "https://medium.com/feed/@user",
      {},
      {
        fetchImpl: async () => ({
          ok: false,
          status: 503,
          headers: new Map(),
          text: async () => "",
        }),
      }
    ),
    /HTTP 503/
  );
});
