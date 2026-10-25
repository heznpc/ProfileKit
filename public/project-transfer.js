/* Browser-local project handoffs. No network or server storage. */
(function (root) {
  'use strict';
  const DATABASE = 'profilekit-project-transfer', STORE = 'records';
  let opening;
  function keyName(key) {
    if (typeof key !== 'string' || !/^profilekit\.readme-(?:handoff\.|studio\.v2\.)[a-z0-9-]{1,80}$/i.test(key)) throw new Error('Invalid project transfer key');
    return key;
  }
  function failure(error) {
    return new Error('Browser project storage failed. Save a project file and check browser storage permissions or free space. ' + (error?.message || ''));
  }
  function database() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = root.indexedDB.open(DATABASE, 1);
      let blocked = false;
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { blocked = true; reject(new Error('Close other ProfileKit tabs to update project storage.')); };
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) { db.close(); return; }
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
    }).catch((error) => { opening = null; throw error; });
    return opening;
  }
  async function operation(key, mode, action) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE), key);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error || request.error || new Error('Project transaction aborted'));
      transaction.onerror = () => reject(transaction.error || request.error);
    });
  }
  root.ProfileKitProjectTransfer = Object.freeze({
    async get(key) {
      try {
        keyName(key);
        if (root.indexedDB) {
          const value = await operation(key, 'readonly', (store) => store.get(key));
          if (value !== undefined) return value;
        }
        const legacy = root.sessionStorage.getItem(key);
        return legacy === null ? null : JSON.parse(legacy);
      } catch (error) { throw failure(error); }
    },
    async set(key, value) {
      try {
        keyName(key);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Project transfer value must be an object');
        if (root.indexedDB) await operation(key, 'readwrite', (store) => store.put(value, key));
        else root.sessionStorage.setItem(key, JSON.stringify(value));
      } catch (error) { throw failure(error); }
    },
    async remove(key) {
      try {
        keyName(key);
        if (root.indexedDB) await operation(key, 'readwrite', (store) => store.delete(key));
        root.sessionStorage.removeItem(key);
      } catch (error) { throw failure(error); }
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
