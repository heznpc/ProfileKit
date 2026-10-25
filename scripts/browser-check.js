// Optional browser checks: install Playwright locally or set
// PROFILEKIT_PLAYWRIGHT_PATH to an existing Playwright module directory.
// Chrome is used by default; PROFILEKIT_BROWSER_CHANNEL overrides it.
const { spawn } = require("node:child_process");
const { mkdtemp } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { server } = require("../server");

async function main() {
  require.resolve(process.env.PROFILEKIT_PLAYWRIGHT_PATH || "playwright");
  const output = await mkdtemp(path.join(os.tmpdir(), "profilekit-browser-"));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  console.log(`Browser artifacts: ${output}`);
  try {
    for (const name of ["roundtrip", "large-assets-reload", "export-race", "mobile-editor"]) {
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
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
