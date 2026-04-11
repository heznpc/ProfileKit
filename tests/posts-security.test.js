const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateFeedUrl,
  isAllowedFeedHost,
  ALLOWED_FEED_HOSTS,
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
