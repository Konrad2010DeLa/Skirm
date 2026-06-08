"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "netlify", "functions-dist");

function isUtf16Le(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return true;
  }
  if (buf.length < 4 || buf.length % 2 !== 0) {
    return false;
  }
  let pairs = 0;
  const sample = Math.min(buf.length, 80);
  for (let i = 0; i < sample; i += 2) {
    if (buf[i + 1] === 0 && buf[i] >= 0x09 && buf[i] <= 0x7e) {
      pairs += 1;
    }
  }
  return pairs >= 4;
}

function readText(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString("utf16le").replace(/^\uFEFF/, "");
  }
  if (isUtf16Le(buf)) {
    return buf.toString("utf16le").replace(/^\uFEFF/, "");
  }
  return buf.toString("utf8").replace(/^\uFEFF/, "");
}

function writeOut(name, content) {
  fs.writeFileSync(path.join(OUT, name), content, "utf8");
}

function remapRequires(source) {
  return source
    .replace(/\.\.\/\.\.\/lib\/snapshot-core/g, "./snapshot-core")
    .replace(/\.\.\/\.\.\/lib\/db/g, "./db")
    .replace(/\.\.\/\.\.\/lib\/ids/g, "./ids");
}

if (!fs.existsSync(OUT)) {
  fs.mkdirSync(OUT, { recursive: true });
}

writeOut("snapshot-core.js", readText(path.join(ROOT, "lib", "snapshot-core.js")));
writeOut("db.js", readText(path.join(ROOT, "lib", "db.js")));
writeOut("ids.js", readText(path.join(ROOT, "lib", "ids.js")));
writeOut(
  "upload-snapshot.js",
  remapRequires(readText(path.join(ROOT, "netlify", "functions", "upload-snapshot.js")))
);
writeOut(
  "view-snapshot.js",
  remapRequires(readText(path.join(ROOT, "netlify", "functions", "view-snapshot.js")))
);
writeOut(
  "get-snapshot.js",
  remapRequires(readText(path.join(ROOT, "netlify", "functions", "get-snapshot.js")))
);

console.log("bundled netlify functions to netlify/functions-dist/");
