/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "src");
const failOnFound = process.argv.includes("--fail-on-found");
const findings = [];

if (fs.existsSync(sourceDir)) walk(sourceDir);

for (const finding of findings) {
  console.log(`${finding.file}:${finding.line}: ${finding.value}`);
}
console.log(`semantic text-color check: ${findings.length} violation(s)`);

if (failOnFound && findings.length > 0) process.exitCode = 1;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(filePath);
    } else if (entry.name.endsWith(".css")) {
      scanCss(filePath, fs.readFileSync(filePath, "utf8"));
    } else if (entry.name.endsWith(".tsx")) {
      scanTsx(filePath, fs.readFileSync(filePath, "utf8"));
    }
  }
}

function scanCss(filePath, source) {
  const sanitized = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const pattern = /(^|[;\s])color\s*:\s*([^;}\s]+)/g;
  for (const match of sanitized.matchAll(pattern)) {
    const value = match[2];
    if (!isSemanticColor(value)) addFinding(filePath, source, match.index ?? 0, value);
  }
}

function scanTsx(filePath, source) {
  const stylePattern = /style=\{\{([\s\S]*?)\}\}/g;
  for (const styleMatch of source.matchAll(stylePattern)) {
    const style = styleMatch[1];
    const colorPattern = /(?:^|[,\s])color\s*:\s*(["'])(.*?)\1/g;
    for (const colorMatch of style.matchAll(colorPattern)) {
      const value = colorMatch[2];
      if (!isSemanticColor(value)) {
        addFinding(filePath, source, (styleMatch.index ?? 0) + (colorMatch.index ?? 0), value);
      }
    }
  }
}

function isSemanticColor(value) {
  return value.startsWith("var(")
    || value.startsWith("color-mix(")
    || ["currentColor", "inherit", "initial", "unset", "transparent"].includes(value);
}

function addFinding(filePath, source, index, value) {
  findings.push({
    file: path.relative(rootDir, filePath),
    line: source.slice(0, index).split(/\r?\n/).length,
    value,
  });
}
