const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const Model = require("../public/editor-model");
const { SupabaseGalleryStore } = require("../src/gallery/supabase-store");
const { GalleryService } = require("../src/gallery/service");
const { createGalleryHandler } = require("../src/endpoints/gallery");

const execute = promisify(execFile);
const SERVICE_KEY = "sb_secret_test_server_only_123456789";
function draft(title = "Shared design") {
  return { title, author: "Pseudonymous author", description: "Editable design", tags: ["shared"], license: "CC-BY-4.0",
    document: Model.createDocument({ name: title, elements: [Model.createElement("text", { id: "title", text: title })] }) };
}
async function restServer(t, custom) {
  const records = new Map();
  const revisions = new Map();
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;
    const url = new URL(req.url, "http://localhost");
    requests.push({ url, body, headers: req.headers, method: req.method });
    const json = (status, value) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
    if (custom) return custom({ req, res, url, body, json });
    if (url.pathname === "/rest/v1/gallery_entries") {
      const id = url.searchParams.get("id");
      if (id?.startsWith("eq.")) return json(200, records.has(id.slice(3)) ? [{ manifest: records.get(id.slice(3)) }] : []);
      // Deliberately return fewer rows than requested to exercise keyset paging
      // under Supabase's independently configured maximum row count.
      return json(200, [...records.values()].sort((a, b) => a.id.localeCompare(b.id))
        .filter((item) => !id || item.id > id.slice(3)).slice(0, 2).map((manifest) => ({ manifest })));
    }
    if (url.pathname === "/rest/v1/gallery_revisions") {
      const key = `${url.searchParams.get("entry_id").slice(3)}:${url.searchParams.get("version").slice(3)}`;
      return json(200, revisions.has(key) ? [{ revision: revisions.get(key) }] : []);
    }
    if (url.pathname === "/rest/v1/rpc/profilekit_gallery_commit") {
      const current = records.get(body.p_id) || null;
      if (JSON.stringify(current) !== JSON.stringify(body.p_expected)) return json(409, { code: "PT409", message: "Entry changed" });
      records.set(body.p_id, body.p_manifest);
      if (body.p_revision) revisions.set(`${body.p_id}:${body.p_revision.version}`, body.p_revision);
      return json(200, body.p_manifest);
    }
    return json(404, { code: "missing" });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, requests, records, revisions };
}

test("Supabase adapter uses native fetch for durable API shapes, pagination, revisions and withdrawal", async (t) => {
  const remote = await restServer(t);
  const store = new SupabaseGalleryStore(remote.origin, SERVICE_KEY, { allowInsecureLocalhost: true });
  const service = new GalleryService(store);
  const first = await service.publish(draft());
  for (let index = 0; index < 4; index++) await service.publish(draft(`Other ${index}`));
  assert.equal((await service.list()).items.length, 5);
  const freshService = new GalleryService(new SupabaseGalleryStore(remote.origin, SERVICE_KEY, { allowInsecureLocalhost: true }));
  assert.equal((await freshService.get(first.id, 1)).title, "Shared design");
  const revised = await freshService.update(first.id, first.editToken, { ...draft("Revised design"), expectedVersion: 1 });
  assert.equal(revised.version, 2);
  assert.equal((await service.get(first.id, 1)).document.name, "Shared design");
  await assert.rejects(service.update(first.id, first.editToken, { ...draft(), expectedVersion: 1 }), (error) => error.status === 409);
  await service.withdraw(first.id, first.editToken);
  assert.equal((await service.list()).items.length, 4);
  assert.equal((await service.get(first.id, 2)).title, "Revised design");
  assert.equal(remote.requests.every((request) => request.headers.apikey === SERVICE_KEY), true);
  assert.equal(remote.requests.every((request) => request.headers.authorization === undefined), true);
  assert.equal(remote.requests.some((request) => request.url.searchParams.get("id")?.startsWith("gt.")), true);
  const commit = remote.requests.find((request) => request.body?.p_revision?.version === 2);
  assert.equal(commit.body.p_expected.metadata.version, 1);
  assert.equal(JSON.stringify(commit.body).includes(first.editToken), false);
});

test("Supabase CAS preserves the snapshot even if a callback mutates its input", async (t) => {
  const remote = await restServer(t);
  const store = new SupabaseGalleryStore(remote.origin, SERVICE_KEY, { allowInsecureLocalhost: true });
  const first = await new GalleryService(store).publish(draft());
  const original = await store.get(first.id);
  await store.transaction(first.id, async (manifest) => {
    manifest.withdrawnAt = "2026-10-26T00:00:00.000Z";
    return { manifest };
  });
  const last = remote.requests.at(-1);
  assert.deepEqual(last.body.p_expected, original);
  assert.notEqual(last.body.p_manifest.withdrawnAt, original.withdrawnAt);
});

test("Supabase transport rejects redirects and hides upstream errors and service credentials", async (t) => {
  for (const result of [
    { status: 409, payload: { code: "PT409", message: SERVICE_KEY }, code: "version_conflict" },
    { status: 401, payload: { message: SERVICE_KEY }, code: "gallery_storage_auth" },
    { status: 500, payload: { message: SERVICE_KEY }, code: "gallery_storage_error" },
  ]) {
    const remote = await restServer(t, ({ json }) => json(result.status, result.payload));
    const store = new SupabaseGalleryStore(remote.origin, SERVICE_KEY, { allowInsecureLocalhost: true });
    await assert.rejects(store.get("a".repeat(32)), (error) => error.code === result.code && !error.message.includes(SERVICE_KEY));
  }
  const redirected = await restServer(t, ({ res }) => { res.writeHead(302, { Location: "http://127.0.0.1:1/private" }); res.end(); });
  await assert.rejects(new SupabaseGalleryStore(redirected.origin, SERVICE_KEY, { allowInsecureLocalhost: true }).get("a".repeat(32)), (error) => error.code === "gallery_storage_unavailable");
  assert.equal(redirected.requests.length, 1);
  const legacy = await restServer(t);
  await new SupabaseGalleryStore(legacy.origin, "legacy-server-service-role-key", { allowInsecureLocalhost: true }).get("a".repeat(32));
  assert.equal(legacy.requests[0].headers.authorization, "Bearer legacy-server-service-role-key");
});

test("Supabase configuration stays server-only and does not silently fall back to a filesystem", async () => {
  for (const url of ["http://example.com", "https://example.com/path", "https://key:secret@example.com", "https://example.com?key=secret"]) {
    assert.throws(() => new SupabaseGalleryStore(url, SERVICE_KEY), /HTTPS origin/);
  }
  assert.throws(() => new SupabaseGalleryStore("http://127.0.0.1:3000", SERVICE_KEY), /HTTPS origin/);
  assert.throws(() => new SupabaseGalleryStore("https://example.supabase.co", "sb_publishable_examplekey"), /server secret/);
  async function config(options) {
    const response = { statusCode: 200, setHeader() {}, send(body) { this.body = JSON.parse(body); } };
    await createGalleryHandler({ ...options, publicOrigin: "", publishKey: "" })({ url: "/api/gallery?config=1", method: "GET", headers: {} }, response);
    return response;
  }
  const enabled = await config({ supabaseUrl: "https://example.supabase.co", supabaseServiceKey: SERVICE_KEY, directory: "/unused-volume" });
  assert.equal(enabled.body.enabled, true);
  assert.equal(JSON.stringify(enabled.body).includes(SERVICE_KEY), false);
  const missing = await config({ supabaseUrl: "https://example.supabase.co", supabaseServiceKey: "", directory: "/unused-volume" });
  assert.equal(missing.statusCode, 503);
  assert.equal(missing.body.error.code, "gallery_configuration");
});

test("gallery SQL enforces privileges, atomic commits, immutable revisions and concurrent CAS in isolated PostgreSQL", async (t) => {
  const binaryDirectory = process.env.PROFILEKIT_TEST_POSTGRES_BIN || "/opt/homebrew/bin";
  for (const binary of ["initdb", "pg_ctl", "psql"]) {
    try { await fs.access(path.join(binaryDirectory, binary)); }
    catch { t.skip("Local PostgreSQL binaries unavailable; set PROFILEKIT_TEST_POSTGRES_BIN to enable SQL integration"); return; }
  }
  if (typeof process.getuid === "function" && process.getuid() === 0) { t.skip("initdb requires an unprivileged test user"); return; }
  const directory = await fs.mkdtemp("/tmp/pk-gallery-pg-");
  const data = path.join(directory, "data");
  let started = false;
  t.after(async () => {
    if (started) await execute(path.join(binaryDirectory, "pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"]);
    await fs.rm(directory, { recursive: true, force: true });
  });
  await execute(path.join(binaryDirectory, "initdb"), ["-D", data, "--no-locale", "--encoding=UTF8", "--auth=trust", "--username=profilekit_gallery_test"]);
  // A private Unix socket directory and no TCP listener leave existing local
  // clusters and ports untouched. This cluster is removed by the test cleanup.
  await execute(path.join(binaryDirectory, "pg_ctl"), ["-D", data, "-l", path.join(directory, "postgres.log"), "-o", `-F -h '' -k ${directory}`, "-w", "start"]);
  started = true;
  const args = ["-X", "-v", "ON_ERROR_STOP=1", "-tA", "-h", directory, "-U", "profilekit_gallery_test", "-d", "postgres"];
  const sql = async (statement) => (await execute(path.join(binaryDirectory, "psql"), [...args, "-c", statement])).stdout.trim();
  const quote = (value) => value === null ? "null" : `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  const commit = (id, expected, manifest, revision) => `select public.profilekit_gallery_commit('${id}', ${quote(expected)}, ${quote(manifest)}, ${quote(revision)});`;
  await sql("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  await execute(path.join(binaryDirectory, "psql"), [...args, "-f", path.join(__dirname, "../examples/self-host/gallery.sql")]);
  // Reapplying the migration must not remove existing tables or loosen grants.
  await execute(path.join(binaryDirectory, "psql"), [...args, "-f", path.join(__dirname, "../examples/self-host/gallery.sql")]);

  const id = "a".repeat(32);
  const metadata = { id, version: 1, title: "Initial", author: "Author", description: "", tags: [], license: "CC-BY-4.0",
    createdAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T00:00:00.000Z", source: null, attributions: [] };
  const manifest = { id, ownerHash: "b".repeat(64), metadata, withdrawnAt: null };
  const revision = { version: 1, metadata, document: draft().document };
  await sql(`set role service_role; ${commit(id, null, manifest, revision)}`);
  assert.equal(await sql("select count(*) from public.gallery_entries; select count(*) from public.gallery_revisions;"), "1\n1");
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(sql(`set role ${role}; select manifest from public.gallery_entries;`), /permission denied/);
    await assert.rejects(sql(`set role ${role}; ${commit(id, null, manifest, revision)}`), /permission denied/);
  }
  // Even an accidental SELECT grant does not expose rows to browser roles.
  await sql("grant select on public.gallery_entries, public.gallery_revisions to anon, authenticated;");
  for (const role of ["anon", "authenticated"]) {
    assert.equal(await sql(`set role ${role}; select count(*) from public.gallery_entries; select count(*) from public.gallery_revisions;`), "SET\n0\n0");
  }
  await sql("revoke select on public.gallery_entries, public.gallery_revisions from anon, authenticated;");
  await assert.rejects(sql("set role service_role; delete from public.gallery_revisions;"), /permission denied/);
  await assert.rejects(sql("update public.gallery_revisions set revision = revision;"), /immutable/);
  await assert.rejects(sql("delete from public.gallery_revisions;"), /immutable/);
  assert.equal(await sql("select relrowsecurity from pg_class where oid in ('public.gallery_entries'::regclass, 'public.gallery_revisions'::regclass) order by relname;"), "t\nt");
  assert.equal(await sql("select proconfig::text from pg_proc where oid = 'public.profilekit_gallery_commit(text,jsonb,jsonb,jsonb)'::regprocedure;"), '{"search_path=\\"\\""}');

  const changed = (title) => ({ ...manifest, metadata: { ...metadata, version: 2, title } });
  const changeRevision = (next) => ({ ...revision, version: 2, metadata: next.metadata });
  const first = changed("Writer one");
  const second = changed("Writer two");
  const forgedOwner = { ...first, ownerHash: "f".repeat(64) };
  await assert.rejects(sql(commit(id, manifest, forgedOwner, changeRevision(forgedOwner))), /Ownership and provenance are immutable/);
  const forgedSource = { ...first, metadata: { ...first.metadata, source: { id: "c".repeat(32), version: 1 } } };
  await assert.rejects(sql(commit(id, manifest, forgedSource, changeRevision(forgedSource))), /Ownership and provenance are immutable/);
  const outcomes = await Promise.allSettled([
    sql(`begin; set local role service_role; ${commit(id, manifest, first, changeRevision(first))} select pg_sleep(0.15); commit;`),
    sql(`set role service_role; ${commit(id, manifest, second, changeRevision(second))}`),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === "rejected" && /Gallery entry changed/.test(outcome.reason.message)).length, 1);
  assert.equal(await sql("select version from public.gallery_revisions order by version;"), "1\n2");
  const current = JSON.parse(await sql(`select manifest from public.gallery_entries where id='${id}';`));
  const withdrawn = { ...current, withdrawnAt: "2026-10-26T01:00:00.000Z" };
  await sql(`set role service_role; ${commit(id, current, withdrawn, null)}`);
  await assert.rejects(sql(`set role service_role; ${commit(id, current, changed("Late writer"), changeRevision(changed("Late writer")))}`), /Gallery entry changed/);
  const resurrected = { ...current, metadata: { ...current.metadata, version: 3 } };
  await assert.rejects(sql(commit(id, withdrawn, resurrected, { ...revision, version: 3, metadata: resurrected.metadata })), /stale or withdrawn/);
  assert.equal(await sql(`select revision #>> '{metadata,title}' from public.gallery_revisions where entry_id='${id}' and version=1;`), "Initial");
  // An invalid revision rolls the newly inserted manifest back in the same RPC.
  const badId = "c".repeat(32);
  const badManifest = { ...manifest, id: badId, metadata: { ...metadata, id: badId } };
  await assert.rejects(sql(commit(badId, null, badManifest, { version: 1, metadata: badManifest.metadata })), /gallery_revision_shape/);
  assert.equal(await sql(`select count(*) from public.gallery_entries where id='${badId}';`), "0");
});
