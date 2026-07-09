const { execFileSync } = require("node:child_process");
const pkg = require("../package.json");

const ALLOWED = [
  /^package\.json$/,
  /^README\.md$/,
  /^LICENSE$/,
  /^server\.js$/,
  /^vercel\.json$/,
  /^Dockerfile$/,
  /^\.dockerignore$/,
  /^api\//,
  /^src\//,
  /^public\//,
  /^examples\/self-host\//,
];

if (pkg.private !== true) {
  console.error("package.json must keep private=true unless the package surface is re-audited.");
  process.exit(1);
}

const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
const [pack] = JSON.parse(output);
const forbidden = pack.files
  .map((file) => file.path)
  .filter((file) => !ALLOWED.some((pattern) => pattern.test(file)));

if (forbidden.length) {
  console.error("Unexpected files in npm pack output:");
  for (const file of forbidden) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log(`pack:check ok (${pack.files.length} files, ${pack.unpackedSize} bytes)`);
