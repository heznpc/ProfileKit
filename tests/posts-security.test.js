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
//   2. AbortController timeout — slow remote can't hold the function open
//   3. content-length cap — declared-length large responses are rejected
//   4. body-byte cap — bodies that exceed cap during streaming are aborted
//
// These tests verify each property by spying on the init args passed to fetch
// and by returning crafted responses. Without them, a refactor that drops any
// one guard would not fail a single existing test.
//
// Header fidelity: use real `Headers` (Node 18+) rather than a `Map`, so a
// future refactor to `get('Content-Length')` (capital) still matches against
// the same case-insensitive `Headers.get` production uses.

function makeResponse({ ok = true, status = 200, headers = {}, body = "" } = {}) {
  return {
    ok,
    status,
    headers: new Headers(headers),
    text: async () => body,
    // No `body` stream — exercises fetchCapped's res.text() fallback path,
    // which is what production also hits when Undici delivers a small or
    // non-streamable response.
  };
}

test("fetchCapped passes redirect:'error' to the underlying fetch", async () => {
  let capturedInit;
  await fetchCapped(
    "https://medium.com/feed/@user",
    {},
    {
      fetchImpl: async (_url, init) => {
        capturedInit = init;
        return makeResponse();
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
        return makeResponse();
      },
    }
  );
  assert.equal(
    capturedInit.redirect,
    "error",
    "redirect must remain 'error' even when caller asks for 'follow'"
  );
});

test("fetchCapped's signal is non-overridable by caller init", async () => {
  // Same defense-in-depth as redirect, but for the signal property. A caller
  // passing their own signal would (without this guard) replace the internal
  // timer-controller, silently defeating the hard-timeout contract.
  let capturedInit;
  const callerSignal = new AbortController().signal;
  await fetchCapped(
    "https://medium.com/feed/@user",
    { signal: callerSignal },
    {
      fetchImpl: async (_url, init) => {
        capturedInit = init;
        return makeResponse();
      },
    }
  );
  assert.notEqual(
    capturedInit.signal,
    callerSignal,
    "signal must remain the internal timer controller's signal, never the caller's"
  );
});

test("fetchCapped rejects when declared content-length exceeds the cap, and does NOT read the body", async () => {
  // The whole point of the pre-read cap is to avoid materializing a giant
  // body. A test that only checks the rejection message can't distinguish
  // pre-read rejection from post-read rejection. Spy text() to lock that in.
  let textCalled = false;
  await assert.rejects(
    fetchCapped(
      "https://medium.com/feed/@user",
      {},
      {
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": String(MAX_BODY_BYTES + 1) }),
          text: async () => {
            textCalled = true;
            return "should not be read";
          },
        }),
      }
    ),
    /Response too large/
  );
  assert.equal(textCalled, false, "pre-read cap must throw before text() is invoked");
});

test("fetchCapped accepts a sane content-length", async () => {
  // Mirror of the cap test: a legitimate declared length should NOT trip the
  // pre-read check. Catches a refactor that flips the > to >=.
  const out = await fetchCapped(
    "https://medium.com/feed/@user",
    {},
    {
      fetchImpl: async () =>
        makeResponse({ headers: { "content-length": String(MAX_BODY_BYTES) }, body: "ok" }),
    }
  );
  assert.equal(out, "ok");
});

test("fetchCapped ignores negative or non-integer content-length", async () => {
  // A buggy/hostile upstream sending `Content-Length: -1` must not bypass
  // the cap by exploiting Number('-1') === -1 (finite, not greater than cap).
  // The post-read fallback should still reject if the actual body is over.
  const oversize = "x".repeat(MAX_BODY_BYTES + 10);
  await assert.rejects(
    fetchCapped(
      "https://medium.com/feed/@user",
      {},
      {
        fetchImpl: async () =>
          makeResponse({
            headers: { "content-length": "-1" },
            body: oversize,
          }),
      }
    ),
    /Response too large/
  );
});

test("fetchCapped rejects body that exceeds the cap (counted in bytes, not chars)", async () => {
  // The cap is named MAX_BODY_BYTES; enforce it in bytes. Multibyte UTF-8
  // text whose char count fits the cap but whose byte count doesn't must
  // still be rejected. 800K emoji = ~3.2 MB UTF-8 (4 bytes each).
  const multibyte = "🔥".repeat(800_000);
  await assert.rejects(
    fetchCapped(
      "https://medium.com/feed/@user",
      {},
      {
        fetchImpl: async () => makeResponse({ body: multibyte }),
      }
    ),
    /Response too large/
  );
});

test("fetchCapped translates timer-induced AbortError into a clean timeout message", async () => {
  // Use a 10ms override timeout so we don't wait the real 5s budget. The
  // fetchImpl hangs on the signal so the abort-via-timer is the only way to
  // resolve it — that's the exact production path being asserted.
  await assert.rejects(
    fetchCapped(
      "https://medium.com/feed/@user",
      {},
      {
        timeoutMs: 10,
        fetchImpl: (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => {
              const err = new Error("aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      }
    ),
    /timed out after 10ms/
  );
});

test("fetchCapped does NOT mislabel non-timer AbortError as a timeout", async () => {
  // Undici can surface AbortError for non-timeout reasons (server-side
  // reset mid-stream). The catch path checks controller.signal.aborted
  // before translating, so this synthetic non-timer abort must propagate
  // with its own message — not be re-labeled "timed out".
  await assert.rejects(
    fetchCapped(
      "https://medium.com/feed/@user",
      {},
      {
        fetchImpl: async () => {
          const err = new Error("upstream connection reset");
          err.name = "AbortError";
          throw err;
        },
      }
    ),
    /upstream connection reset/
  );
});

test("fetchCapped throws on non-ok response with the status surfaced", async () => {
  await assert.rejects(
    fetchCapped(
      "https://medium.com/feed/@user",
      {},
      {
        fetchImpl: async () => makeResponse({ ok: false, status: 503 }),
      }
    ),
    /HTTP 503/
  );
});

test("fetchCapped tolerates null options arg (treats as defaults)", async () => {
  // `null` is a common 'no options' sentinel. The wrapper must not crash
  // destructuring it; should fall back to globalThis.fetch via the internal
  // `opts || {}` guard.
  let called = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return makeResponse({ body: "global-ok" });
  };
  try {
    const out = await fetchCapped("https://medium.com/feed/@user", {}, null);
    assert.equal(out, "global-ok");
    assert.equal(called, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("fetchCapped tolerates { fetchImpl: null } (falls back to global)", async () => {
  let called = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return makeResponse({ body: "global-ok" });
  };
  try {
    const out = await fetchCapped(
      "https://medium.com/feed/@user",
      {},
      { fetchImpl: null }
    );
    assert.equal(out, "global-ok");
    assert.equal(called, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// --- fetchHashnodeRetired (source=hashnode is intentionally dead) ---

test("fetchPosts with source=hashnode throws a 'retired' error", async () => {
  const { fetchPosts } = require("../src/fetchers/posts");
  await assert.rejects(
    fetchPosts({ source: "hashnode", username: "anyone", count: 5 }),
    /retired/
  );
});
