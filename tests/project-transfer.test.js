const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(require.resolve('../public/project-transfer.js'), 'utf8');
const key = 'profilekit.readme-handoff.test-token';
function setup({ idb = true, abort = false, brokenSession = false } = {}) {
  const records = new Map(), legacy = new Map(), local = new Map();
  let opens = 0, transactions = 0;
  const root = { localStorage: {
    getItem: (key) => local.get(key) ?? null,
    setItem(key, value) { if (brokenSession) throw new Error('Quota exceeded'); local.set(key, value); },
    removeItem: (key) => local.delete(key),
  }, sessionStorage: {
    getItem(key) { return legacy.get(key) ?? null; },
    setItem(key, value) { if (brokenSession) throw new Error('Quota exceeded'); legacy.set(key, value); },
    removeItem(key) { legacy.delete(key); },
  } };
  if (idb) root.indexedDB = { open(name, version) {
    assert.equal(name, 'profilekit-project-transfer'); assert.equal(version, 1); opens++;
    const request = {};
    const db = { objectStoreNames: { contains: () => false }, createObjectStore(name) { assert.equal(name, 'records'); }, close() {}, transaction(name, mode) {
      assert.equal(name, 'records'); transactions++;
      let pending = 0;
      const tx = { objectStore() {
        function action(method, key, value) {
          const req = {}; pending++;
          queueMicrotask(() => {
            if (abort && mode === 'readwrite') { tx.error = new Error('Transaction quota exceeded'); tx.onabort(); return; }
            if (method === 'get') req.result = records.has(key) ? structuredClone(records.get(key)) : undefined;
            if (method === 'put') { records.set(key, structuredClone(value)); req.result = key; }
            if (method === 'delete') records.delete(key);
            req.onsuccess?.();
            if (--pending === 0) tx.oncomplete();
          });
          return req;
        }
        return { get: (key) => action('get', key), put: (value, key) => action('put', key, value), delete: (key) => action('delete', key) };
      } };
      return tx;
    } };
    queueMicrotask(() => { request.result = db; request.onupgradeneeded(); request.onsuccess(); });
    return request;
  } };
  vm.runInNewContext(code, root);
  return { api: root.ProfileKitProjectTransfer, records, legacy, local, counts: () => ({ opens, transactions }) };
}
test('IndexedDB handoffs persist structured large records without sessionStorage quota', async () => {
  const { api, records, legacy, counts } = setup({ brokenSession: true });
  const value = { version: 1, document: { image: 'x'.repeat(6 * 1024 * 1024) } };
  await api.set(key, value);
  value.document.image = 'changed';
  assert.equal((await api.get(key)).document.image.length, 6 * 1024 * 1024);
  assert.equal(legacy.size, 0);
  assert.equal(counts().opens, 1);
  await api.remove(key); assert.equal(records.size, 0); assert.equal(await api.get(key), null);
});
test('missing IndexedDB records can read and clean up in-flight legacy session handoffs', async () => {
  const { api, legacy } = setup();
  legacy.set(key, JSON.stringify({ version: 1, legacy: true }));
  assert.equal((await api.get(key)).legacy, true);
  await api.set(key, { version: 1, legacy: false });
  assert.equal((await api.get(key)).legacy, false);
  await api.remove(key); assert.equal(legacy.size, 0);
});
test('session fallback is used only when IndexedDB is unavailable and exposes quota errors', async () => {
  const { api, legacy } = setup({ idb: false });
  await api.set(key, { version: 1 }); assert.equal(legacy.size, 1);
  assert.equal((await api.get(key)).version, 1);
  await api.remove(key); assert.equal(await api.get(key), null);
  await assert.rejects(setup({ idb: false, brokenSession: true }).api.set(key, {}), /Quota exceeded/);
});
test('aborted IndexedDB writes reject instead of silently falling back to small session storage', async () => {
  const { api, records, legacy } = setup({ abort: true });
  await assert.rejects(api.set(key, { version: 1 }), /Transaction quota exceeded/);
  assert.equal(records.size, 0); assert.equal(legacy.size, 0);
});
test('transport rejects unrelated storage keys and non-object records', async () => {
  const { api } = setup();
  await assert.rejects(api.set('unrelated-key', {}), /Invalid project transfer key/);
  await assert.rejects(api.set(key, 'document'), /must be an object/);
  await api.set('profilekit.readme-studio.v2.test-token', { kind: 'profilekit-card' });
  assert.equal((await api.get('profilekit.readme-studio.v2.test-token')).kind, 'profilekit-card');
});

for (const draftKey of ['profilekit.readme-document.v1', 'profilekit.readme-studio.v2']) {
  test(`${draftKey} migrates local drafts and saves large data with compare-and-set`, async () => {
    const { api, local, records } = setup({ brokenSession: true });
    const original = { source: 'original' };
    local.set(draftKey, JSON.stringify(original));
    assert.deepEqual(JSON.parse(JSON.stringify(await api.get(draftKey))), original);
    assert.ok(records.has(draftKey));
    const large = { source: 'unchanged README', image: 'x'.repeat(6 * 1024 * 1024) };
    assert.equal(await api.compareAndSet(draftKey, original, large), true);
    assert.equal(await api.compareAndSet(draftKey, original, { source: 'stale tab' }), false);
    assert.equal((await api.get(draftKey)).image.length, large.image.length);
    await api.remove(draftKey);
    assert.equal(await api.get(draftKey), null);
  });
}
test('durable drafts use localStorage only when IndexedDB is unavailable', async () => {
  const { api, local, legacy } = setup({ idb: false });
  const key = 'profilekit.readme-document.v1';
  assert.equal(await api.compareAndSet(key, null, { source: 'saved' }), true);
  assert.equal(local.size, 1); assert.equal(legacy.size, 0);
  assert.equal(await api.compareAndSet(key, null, {}), false);
});

test('failed atomic draft saves reject and leave the original durable value intact', async () => {
  const { api, records } = setup({ abort: true });
  const key = 'profilekit.readme-document.v1', original = { source: 'keep this' };
  records.set(key, original);
  await assert.rejects(api.compareAndSet(key, original, { source: 'unsaved' }), /Transaction quota exceeded/);
  assert.deepEqual(records.get(key), original);
});
