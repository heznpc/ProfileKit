const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const publicDir = path.join(__dirname, "../public");
for (const file of fs.readdirSync(publicDir).filter((file) => file.endsWith(".js"))) {
  new vm.Script(fs.readFileSync(path.join(publicDir, file), "utf8"), { filename: file });
}
for (const file of fs.readdirSync(publicDir).filter((file) => file.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(publicDir, file), "utf8");
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    if (match[1].trim()) new vm.Script(match[1], { filename: `${file} inline script` });
  }
}
