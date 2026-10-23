const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveURL, sanitizeSrcset, themeMedia } = require('../public/readme-preview');

test('README preview URLs allow only supported protocols without credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'file:///etc/passwd', 'blob:https://example.com/id', 'https://user:secret@example.com/x', 'java\nscript:alert(1)', '\\example.com/x', '#image']) {
    assert.equal(resolveURL(url, 'image'), null, url);
  }
  assert.equal(resolveURL('https://images.example.com/a.svg?text=a,b&width=900', 'image'), 'https://images.example.com/a.svg?text=a,b&width=900');
  assert.equal(resolveURL('//images.example.com/x.png', 'image'), 'https://images.example.com/x.png');
  assert.equal(resolveURL('mailto:hello@example.com', 'link'), 'mailto:hello@example.com');
  assert.equal(resolveURL('mailto:hello@example.com', 'image'), null);
  assert.equal(resolveURL('#about-me', 'link'), '#about-me');
});

test('relative README URLs need a repository and stay inside its root', () => {
  assert.equal(resolveURL('./assets/banner.svg', 'image'), null);
  assert.equal(resolveURL('/api/hero?name=Ren', 'image'), null);
  const options = { repository: 'hello-world/hello-world' };
  assert.equal(resolveURL('./assets/banner.svg', 'image', options), 'https://raw.githubusercontent.com/hello-world/hello-world/HEAD/assets/banner.svg');
  assert.equal(resolveURL('/docs/about.md#intro', 'link', { ...options, branch: 'main' }), 'https://github.com/hello-world/hello-world/blob/main/docs/about.md#intro');
  assert.equal(resolveURL('assets/../my%20image.png', 'image', options), 'https://raw.githubusercontent.com/hello-world/hello-world/HEAD/my%20image.png');
  for (const url of ['../outside.png', '%2e%2e/outside.png', 'assets/%2foutside.png']) assert.equal(resolveURL(url, 'image', options), null);
  assert.equal(resolveURL('./image.png', 'image', { repository: 'owner/..' }), null);
  assert.equal(resolveURL('./image.png', 'image', { repository: 'owner/repo', branch: '../elsewhere' }), null);
});

test('only explicit ProfileKit API images use the supplied deployment origin', () => {
  const options = { origin: 'http://localhost:3000/some/path' };
  assert.equal(resolveURL('/api/hero?name=Ren', 'image', options), 'http://localhost:3000/api/hero?name=Ren');
  assert.equal(resolveURL('./assets/banner.svg', 'image', options), null);
  assert.equal(resolveURL('/private.json', 'image', options), null);
  assert.equal(resolveURL('/api/hero?name=Ren', 'link', options), null);
  assert.equal(resolveURL('/api/hero', 'image', { origin: 'javascript:alert(1)' }), null);
});

test('srcset preserves commas inside card queries and rejects unsafe candidates', () => {
  assert.equal(sanitizeSrcset('https://example.com/api/tags?tags=A,B,C 1x, https://example.com/large.png 2x', {}), 'https://example.com/api/tags?tags=A,B,C 1x, https://example.com/large.png 2x');
  assert.equal(sanitizeSrcset('javascript:alert(1) 1x, https://example.com/safe.png 2x', {}), 'https://example.com/safe.png 2x');
  assert.equal(sanitizeSrcset('./a.png 1x, ./b.png 2x', {}), '');
});

test('picture theme conditions depend on the selected preview theme', () => {
  assert.equal(themeMedia('(prefers-color-scheme: dark)', 'dark'), '(width >= 0px)');
  assert.equal(themeMedia('(prefers-color-scheme: dark)', 'light'), '(width < 0px)');
  assert.equal(themeMedia('(min-width: 500px) and (prefers-color-scheme: light)', 'light'), '(min-width: 500px) and (width >= 0px)');
});
