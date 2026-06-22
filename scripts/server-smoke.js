const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOpenPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitForHealth(baseUrl, child, stderr) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`server exited before health check passed. stderr: ${stderr()}`);
    }

    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return res;
    } catch {
      // The process may still be binding the port.
    }
    await delay(100);
  }
  throw new Error(`timed out waiting for /api/health. stderr: ${stderr()}`);
}

async function main() {
  const port = await getOpenPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let stderr = "";

  const child = spawn(process.execPath, ["server.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      INSTANCE_ID: "server-smoke",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  try {
    const health = await waitForHealth(baseUrl, child, () => stderr);
    assert.equal(health.headers.get("x-profilekit-instance"), "server-smoke");
    const healthBody = await health.json();
    assert.equal(healthBody.ok, true);
    assert.equal(healthBody.service, "profilekit");

    const svg = await fetch(`${baseUrl}/api/divider?style=line&width=400`);
    assert.equal(svg.status, 200);
    assert.equal(svg.headers.get("content-type"), "image/svg+xml");
    assert.match(await svg.text(), /^<svg/);
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        delay(2000).then(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        }),
      ]);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
