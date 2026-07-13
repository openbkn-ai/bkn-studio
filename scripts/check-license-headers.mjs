/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import fs from "node:fs";
import path from "node:path";

const requiredMarkers = [
  "Copyright (c) 2026 OpenBKN",
  "SPDX-License-Identifier: LicenseRef-OpenBKN",
  "Licensed under the OpenBKN License",
];

const blockHeader = `/**\n * Copyright (c) 2026 OpenBKN\n * SPDX-License-Identifier: LicenseRef-OpenBKN\n * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional\n * Conditions. See LICENSE for the full text.\n */\n\n`;

const hashHeader = `# Copyright (c) 2026 OpenBKN\n# SPDX-License-Identifier: LicenseRef-OpenBKN\n# Licensed under the OpenBKN License, a modified Apache 2.0 with Additional\n# Conditions. See LICENSE for the full text.\n\n`;

const htmlHeader = `<!--\n  Copyright (c) 2026 OpenBKN\n  SPDX-License-Identifier: LicenseRef-OpenBKN\n  Licensed under the OpenBKN License, a modified Apache 2.0 with Additional\n  Conditions. See LICENSE for the full text.\n-->\n`;

const roots = [
  ".github",
  "deploy",
  "public",
  "scripts",
  "src",
  "tests/e2e",
];

const rootFiles = [
  "Dockerfile",
  "eslint.base.mjs",
  "eslint.config.js",
  "eslint.config.typechecked.js",
  "index.html",
  "vite.config.ts",
];

const excludedDirs = new Set([".git", "dist", "node_modules"]);
const excludedFiles = new Set([
  "deploy/charts/bkn-studio/templates/configmap.yaml",
  "deploy/charts/bkn-studio/templates/deployment.yaml",
  "deploy/charts/bkn-studio/templates/ingress.yaml",
  "deploy/charts/bkn-studio/templates/service.yaml",
]);

const commentableExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ps1",
  ".sh",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const fix = process.argv.includes("--fix");
const projectRoot = process.cwd();

function normalize(filePath) {
  return filePath.split(path.sep).join("/");
}

function shouldCheck(filePath) {
  const relativePath = normalize(path.relative(projectRoot, filePath));

  if (excludedFiles.has(relativePath)) {
    return false;
  }

  if (path.basename(filePath) === "Dockerfile") {
    return true;
  }

  return commentableExtensions.has(path.extname(filePath));
}

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) {
    return files;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excludedDirs.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(entryPath, files);
      continue;
    }

    if (shouldCheck(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

function hasLicenseHeader(content) {
  return requiredMarkers.every((marker) => content.includes(marker));
}

function insertAfterFirstLine(content, header) {
  const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const firstLine = lines.shift() ?? "";
  return `${firstLine}${lineEnding}${header}${lines.join(lineEnding)}`;
}

function addHeader(filePath, content) {
  const basename = path.basename(filePath);
  const extension = path.extname(filePath);

  if (basename === "Dockerfile") {
    if (content.startsWith("# syntax=")) {
      return insertAfterFirstLine(content, hashHeader);
    }

    return `${hashHeader}${content}`;
  }

  if (extension === ".html") {
    if (/^<!doctype html>/i.test(content)) {
      return insertAfterFirstLine(content, htmlHeader);
    }

    return `${htmlHeader}${content}`;
  }

  if (extension === ".sh" || extension === ".ps1" || extension === ".yaml" || extension === ".yml") {
    if (content.startsWith("#!")) {
      return insertAfterFirstLine(content, hashHeader);
    }

    return `${hashHeader}${content}`;
  }

  return `${blockHeader}${content}`;
}

const candidates = [
  ...rootFiles.map((file) => path.join(projectRoot, file)).filter(fs.existsSync),
  ...roots.flatMap((root) => walk(path.join(projectRoot, root))),
];

const uniqueCandidates = [...new Set(candidates.map((file) => path.resolve(file)))].sort();
const missing = [];

for (const filePath of uniqueCandidates) {
  const content = fs.readFileSync(filePath, "utf8");

  if (hasLicenseHeader(content)) {
    continue;
  }

  missing.push(filePath);

  if (fix) {
    fs.writeFileSync(filePath, addHeader(filePath, content), "utf8");
  }
}

if (missing.length > 0) {
  const action = fix ? "Added missing license headers to" : "Missing license headers in";
  console.error(`${action} ${missing.length} file(s):`);
  for (const filePath of missing) {
    console.error(`- ${normalize(path.relative(projectRoot, filePath))}`);
  }

  if (!fix) {
    console.error("\nRun `node scripts/check-license-headers.mjs --fix` to add headers automatically.");
    process.exit(1);
  }
}
