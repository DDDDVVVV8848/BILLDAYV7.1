const fs = require("fs");
const path = require("path");

const root = __dirname;
const out = path.join(root, "public");
const files = [
  "index.html",
  "app.js",
  "sw.js",
  "manifest.webmanifest",
  "src/styles.css",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

fs.rmSync(out, { recursive: true, force: true });

for (const file of files) {
  const source = path.join(root, file);
  const target = path.join(out, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

console.log(`Static site written to ${out}`);
