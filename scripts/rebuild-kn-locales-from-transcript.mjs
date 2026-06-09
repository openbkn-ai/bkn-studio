import fs from "node:fs";
import path from "node:path";

const transcriptPath = path.resolve(
  "C:/Users/mengfanjie/.cursor/projects/d-openbkn-bkn-studio/agent-transcripts/df31c58b-9db8-42dd-83de-17b3f53f1210/df31c58b-9db8-42dd-83de-17b3f53f1210.jsonl",
);

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/").toLowerCase();
}

function extractEntries(text) {
  const entries = new Map();
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const match = lines[i].match(/^(\s+)(\w+):\s*(.*)$/);
    if (!match || match[2] === "knowledgeNetwork") {
      i += 1;
      continue;
    }
    const key = match[2];
    let block = lines[i];
    const rest = match[3];
    const completeOnLine =
      rest.length > 0 &&
      !/:\s*$/.test(lines[i]) &&
      lines[i].trimEnd().endsWith(",");
    if (!completeOnLine) {
      i += 1;
      while (i < lines.length) {
        block += `\n${lines[i]}`;
        if (lines[i].trimEnd().endsWith(",")) {
          break;
        }
        i += 1;
      }
    }
    entries.set(key, block);
    i += 1;
  }
  return entries;
}

function collectEntries(fileName) {
  const entries = new Map();
  const lines = fs.readFileSync(transcriptPath, "utf8").split(/\r?\n/);
  const target = `locales/${fileName}`.toLowerCase();

  for (const line of lines) {
    if (!line.includes(fileName)) {
      continue;
    }
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    for (const item of event?.message?.content ?? []) {
      if (!["StrReplace", "Write"].includes(item?.name)) {
        continue;
      }
      const input = item.input;
      if (!input?.path || !normalizePath(input.path).endsWith(target)) {
        continue;
      }
      const chunks = [];
      if (typeof input.new_string === "string") {
        chunks.push(input.new_string);
      }
      if (typeof input.contents === "string") {
        chunks.push(input.contents);
      }
      for (const chunk of chunks) {
        for (const [key, block] of extractEntries(chunk)) {
          entries.set(key, block);
        }
      }
    }
  }
  return entries;
}

function renderLocale(exportName, entries) {
  const body = [...entries.values()].join("\n");
  return `export const ${exportName} = {\n  knowledgeNetwork: {\n${body}\n  },\n} as const;\n`;
}

const localeDir = path.resolve("src/modules/knowledge-network/locales");
const zhEntries = collectEntries("zh-CN.ts");
const enEntries = collectEntries("en-US.ts");

const zhBase = extractEntries(fs.readFileSync(path.join(localeDir, "zh-CN.ts"), "utf8"));
const enBase = extractEntries(fs.readFileSync(path.join(localeDir, "en-US.ts"), "utf8"));

for (const [key, block] of zhBase) {
  if (!zhEntries.has(key)) {
    zhEntries.set(key, block);
  }
}
for (const [key, block] of enBase) {
  if (!enEntries.has(key)) {
    enEntries.set(key, block);
  }
}

const zhOrdered = [...zhEntries.entries()].sort(([a], [b]) => a.localeCompare(b));
const enOrdered = [...enEntries.entries()].sort(([a], [b]) => a.localeCompare(b));

fs.writeFileSync(
  path.join(localeDir, "zh-CN.ts"),
  renderLocale(
    "knowledgeNetworkZhCN",
    new Map(zhOrdered.map(([key, block]) => [key, block])),
  ),
);
fs.writeFileSync(
  path.join(localeDir, "en-US.ts"),
  renderLocale(
    "knowledgeNetworkEnUS",
    new Map(enOrdered.map(([key, block]) => [key, block])),
  ),
);

console.log("zh keys:", zhEntries.size);
console.log("en keys:", enEntries.size);
