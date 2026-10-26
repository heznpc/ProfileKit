const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomBytes } = require("node:crypto");
const { GalleryError } = require("./errors");

const ID = /^[a-f0-9]{32}$/;
const REF = /^[a-f0-9]{32}\.json$/;
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function validId(id) {
  if (typeof id !== "string" || !ID.test(id)) throw new GalleryError(400, "invalid_id", "Gallery ID is invalid");
  return id;
}

async function readJSON(filename) {
  try { return JSON.parse(await fs.readFile(filename, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function syncDirectory(directory) {
  const handle = await fs.open(directory, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

// The adapter contract is list(), get(id), readRevision(id, version), and
// transaction(id, async current => ({ manifest, revision? })). A transaction
// serializes all writers for its ID and atomically publishes the manifest and
// optional immutable revision. An object-store adapter must use conditional
// writes/CAS to provide that same guarantee across processes and hosts.
class FileGalleryStore {
  constructor(directory, { lockTimeoutMs = 5000 } = {}) {
    if (typeof directory !== "string" || !directory.trim() || !path.isAbsolute(directory)) {
      throw new GalleryError(503, "gallery_configuration", "Set PROFILEKIT_GALLERY_DIR to an absolute path on a durable shared volume");
    }
    this.directory = path.resolve(directory);
    this.lockTimeoutMs = lockTimeoutMs;
  }

  entryPath(id) { return path.join(this.directory, validId(id)); }

  async get(id) { return readJSON(path.join(this.entryPath(id), "manifest.json")); }

  async list() {
    let entries;
    try { entries = await fs.readdir(this.directory, { withFileTypes: true }); }
    catch (error) { if (error.code === "ENOENT") return []; throw error; }
    const result = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !ID.test(entry.name)) continue;
      const manifest = await this.get(entry.name);
      if (manifest) result.push(manifest);
    }
    return result;
  }

  async readRevision(id, version) {
    const manifest = await this.get(id);
    const reference = manifest?.revisionRefs?.[String(version)];
    if (!reference || !REF.test(reference)) return null;
    return readJSON(path.join(this.entryPath(id), "revisions", reference));
  }

  async acquireLock(directory) {
    const filename = path.join(directory, ".write-lock");
    const identity = { token: randomBytes(16).toString("hex"), pid: process.pid, host: os.hostname() };
    const deadline = Date.now() + this.lockTimeoutMs;
    for (;;) {
      let handle;
      try {
        handle = await fs.open(filename, "wx", 0o600);
        await handle.writeFile(JSON.stringify(identity));
        await handle.sync();
        await handle.close();
        return async () => {
          // A writer never removes another writer's lock. We deliberately do
          // not expire locks by age: a slow live publisher still owns its lock.
          const current = await readJSON(filename);
          if (current?.token === identity.token) await fs.unlink(filename);
        };
      } catch (error) {
        if (handle) await handle.close().catch(() => {});
        if (error.code !== "EEXIST") throw error;
      }
      let owner;
      try { owner = await readJSON(filename); } catch { /* A new lock may still be receiving its identity. */ }
      if (owner?.host === os.hostname() && Number.isSafeInteger(owner.pid) && owner.pid > 0) {
        try { process.kill(owner.pid, 0); }
        catch (error) {
          if (error.code === "ESRCH") {
            // Automatic unlink of a stale lock has an unavoidable ABA race
            // without OS advisory locks. Preserve it for safe operator recovery.
            throw new GalleryError(503, "gallery_stale_lock", "A stopped gallery writer left a lock. Stop gallery publishers, remove the affected entry's .write-lock, then restart");
          }
        }
      }
      if (Date.now() >= deadline) throw new GalleryError(503, "gallery_busy", "Gallery entry is busy; retry shortly. If a writer crashed, stop publishers before removing its .write-lock");
      await pause(20 + Math.floor(Math.random() * 30));
    }
  }

  async transaction(id, operation) {
    const directory = this.entryPath(id);
    await fs.mkdir(path.join(directory, "revisions"), { recursive: true, mode: 0o700 });
    await syncDirectory(this.directory);
    const release = await this.acquireLock(directory);
    let temporary;
    try {
      const current = await this.get(id);
      const result = await operation(current);
      if (!result?.manifest) throw new Error("Gallery transaction must return a manifest");
      const manifest = { ...result.manifest, revisionRefs: { ...(current?.revisionRefs || {}) } };
      if (result.revision) {
        const version = result.revision.version;
        if (!Number.isSafeInteger(version) || version < 1 || manifest.revisionRefs[version]) throw new Error("Gallery revisions are immutable");
        // Random storage references avoid collisions after a crash between the
        // revision write and manifest commit. Uncommitted revisions stay private.
        const reference = `${randomBytes(16).toString("hex")}.json`;
        const handle = await fs.open(path.join(directory, "revisions", reference), "wx", 0o600);
        try { await handle.writeFile(JSON.stringify(result.revision)); await handle.sync(); }
        finally { await handle.close(); }
        await syncDirectory(path.join(directory, "revisions"));
        manifest.revisionRefs[version] = reference;
      }
      temporary = path.join(directory, `.manifest-${randomBytes(16).toString("hex")}.tmp`);
      const handle = await fs.open(temporary, "wx", 0o600);
      try { await handle.writeFile(JSON.stringify(manifest)); await handle.sync(); }
      finally { await handle.close(); }
      await fs.rename(temporary, path.join(directory, "manifest.json"));
      temporary = null;
      await syncDirectory(directory);
      return manifest;
    } finally {
      if (temporary) await fs.unlink(temporary).catch(() => {});
      await release();
    }
  }
}

module.exports = { FileGalleryStore, validId };
