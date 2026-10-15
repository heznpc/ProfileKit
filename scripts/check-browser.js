const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const publicDir = path.join(__dirname, "../public");
const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
for (const file of fs.readdirSync(publicDir).filter((file) => file.endsWith(".js"))) {
  new vm.Script(fs.readFileSync(path.join(publicDir, file), "utf8"), { filename: file });
}
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
  if (match[1].trim()) new vm.Script(match[1], { filename: "index.html inline script" });
}
