/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src/modules/knowledge-network/locales");

function classifyKey(key) {
  const rootKey = key.split(".")[0];
  if (/^conceptGroup/i.test(rootKey) || rootKey === "conceptGroups") {
    return "concept-group";
  }
  if (
    /^objectType/i.test(rootKey) ||
    /^dataAttribute/i.test(rootKey) ||
    /^logicAttribute/i.test(rootKey) ||
    rootKey.startsWith("step") ||
    rootKey.startsWith("pickAttribute") ||
    rootKey.startsWith("syncField") ||
    rootKey.startsWith("smartMatch") ||
    rootKey.startsWith("primaryKey") ||
    rootKey.startsWith("displayKey") ||
    rootKey.startsWith("incrementalKey")
  ) {
    return "object-type";
  }
  if (/^relationType/i.test(rootKey) || /^relationMapping/i.test(rootKey)) {
    return "relation-type";
  }
  if (/^actionType/i.test(rootKey) || /^execution/i.test(rootKey) || rootKey === "actionTypes") {
    return "action-type";
  }
  if (/^metric/i.test(rootKey) || rootKey === "metricsTitle" || rootKey === "emptyMetrics") {
    return "metric";
  }
  if (/^task/i.test(rootKey) || rootKey === "tasksDescription") {
    return "task";
  }
  return "network";
}

function extractEntries(source) {
  const lines = source.split(/\r?\n/);
  const entries = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i].match(/^(\s+)([\w.]+|"[\w.]+"):\s*(.*)$/);
    if (!match) {
      i += 1;
      continue;
    }

    const rawKey = match[2].replace(/^"|"$/g, "");
    if (rawKey === "knowledgeNetwork") {
      i += 1;
      continue;
    }

    let block = lines[i];
    const rest = match[3];
    const completeOnLine =
      rest.length > 0 && !/:\s*$/.test(lines[i]) && lines[i].trimEnd().endsWith(",");

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

    entries.push({ key: rawKey, block, bucket: classifyKey(rawKey) });
    i += 1;
  }

  return entries;
}

function splitLocale(fileName, exportName) {
  const sourcePath = path.join(root, fileName);
  const source = fs.readFileSync(sourcePath, "utf8");
  const entries = extractEntries(source);
  const buckets = {
    network: [],
    "concept-group": [],
    "object-type": [],
    "relation-type": [],
    "action-type": [],
    metric: [],
    task: [],
  };

  for (const entry of entries) {
    buckets[entry.bucket].push(entry.block);
  }

  const localeDir = path.join(root, fileName.replace(".ts", ""));
  fs.mkdirSync(localeDir, { recursive: true });

  const partFiles = Object.entries(buckets).map(([name, bucketLines]) => {
    const partExport = `${name.replace(/-/g, "")}Part`;
    const filePath = path.join(localeDir, `${name}.ts`);
    const body = bucketLines.join("\n");
    fs.writeFileSync(filePath, `export const ${partExport} = {\n${body}\n};\n`);
    return { partExport, importPath: `./${name}` };
  });

  const imports = partFiles
    .map(({ partExport, importPath }) => `import { ${partExport} } from "${importPath}";`)
    .join("\n");
  const spreads = partFiles.map(({ partExport }) => `    ...${partExport},`).join("\n");

  fs.writeFileSync(
    path.join(localeDir, "index.ts"),
    `${imports}

export const ${exportName} = {
  knowledgeNetwork: {
${spreads}
  },
} as const;
`,
  );

  fs.writeFileSync(
    sourcePath,
    `export { ${exportName} } from "./${fileName.replace(".ts", "")}/index";\n`,
  );
}

splitLocale("zh-CN.ts", "knowledgeNetworkZhCN");
splitLocale("en-US.ts", "knowledgeNetworkEnUS");
console.log("Locale split complete.");
