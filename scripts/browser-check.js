// Run npm ci and npm run browser:install before npm run test:browser.
// The locked Playwright version and its bundled Chromium are the default.
// PROFILEKIT_PLAYWRIGHT_PATH and PROFILEKIT_BROWSER_CHANNEL are optional overrides.
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");

async function main() {
  require.resolve(process.env.PROFILEKIT_PLAYWRIGHT_PATH || "playwright");
  const output = await mkdtemp(path.join(os.tmpdir(), "profilekit-browser-"));
  const gallery = await mkdtemp(path.join(os.tmpdir(), "profilekit-gallery-test-"));
  // Browser checks must never publish into a configured production gallery.
  process.env.PROFILEKIT_GALLERY_DIR = gallery;
  process.env.PROFILEKIT_GALLERY_SUPABASE_URL = "";
  process.env.PROFILEKIT_GALLERY_SUPABASE_SERVICE_KEY = "";
  process.env.PROFILEKIT_GALLERY_PUBLISH_KEY = "";
  process.env.PROFILEKIT_PUBLIC_ORIGIN = "";
  const { server } = require("../server");
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  console.log(`Browser artifacts: ${output}`);
  try {
    for (const name of ["roundtrip", "large-assets-reload", "export-race", "mobile-editor", "community-ai"]) {
      const child = spawn(process.execPath, [path.join(__dirname, "browser", `${name}.js`)], {
        env: { ...process.env, PROFILEKIT_TEST_ORIGIN: origin, PROFILEKIT_TEST_OUTPUT: output },
        stdio: "inherit",
        timeout: 180000,
      });
      const [code, signal] = await once(child, "exit");
      if (code !== 0) throw new Error(`${name} failed (${signal || code})`);
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(gallery, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
