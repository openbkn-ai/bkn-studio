import fs from "node:fs";
import path from "node:path";

const moduleDir = path.resolve("src/modules/knowledge-network");
const keys = new Set();

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(filePath);
      continue;
    }
    if (!/\.(tsx?)$/.test(entry.name)) {
      continue;
    }
    const source = fs.readFileSync(filePath, "utf8");
    for (const match of source.matchAll(/knowledgeNetwork\.([A-Za-z0-9]+)/g)) {
      keys.add(match[1]);
    }
  }
}

walk(moduleDir);

const localePath = path.resolve("src/modules/knowledge-network/locales/zh-CN/index.ts");
const localeSource = fs.readFileSync(localePath, "utf8");
const defined = new Set([...localeSource.matchAll(/^\s+(\w+):/gm)].map((match) => match[1]));
const missing = [...keys].filter((key) => !defined.has(key)).sort();

console.log(`used ${keys.size}, defined ${defined.size}, missing ${missing.length}`);
for (const key of missing) {
  console.log(key);
}
