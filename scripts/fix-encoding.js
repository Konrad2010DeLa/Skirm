"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const EXTENSIONS = new Set([".js", ".json", ".toml", ".html", ".md", ".sql"]);

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

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
}

const files = [];
walk(ROOT, files);

let fixed = 0;
for (const filePath of files) {
  const buf = fs.readFileSync(filePath);
  const needsFix =
    (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) || isUtf16Le(buf);
  if (!needsFix) {
    continue;
  }
  const text = readText(filePath);
  fs.writeFileSync(filePath, text, "utf8");
  fixed += 1;
  console.log("fixed encoding:", path.relative(ROOT, filePath));
}

console.log("encoding check complete, fixed " + fixed + " file(s)");
