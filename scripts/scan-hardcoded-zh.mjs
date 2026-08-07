/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const failOnFound = process.argv.includes("--fail-on-found");
const chinesePattern = /[\u4e00-\u9fff]/;
const scannedExtensions = new Set([".ts", ".tsx"]);
const ignoredPathParts = new Set([
  ".git",
  "dist",
  "node_modules",
  "locales",
]);
const ignoredFilePatterns = [
  /\.test\.tsx?$/,
  /\.spec\.tsx?$/,
  /mock/i,
];

const findings = [];

walk(path.join(rootDir, "src"));

for (const finding of findings) {
  console.log(`${finding.relativePath}:${finding.lineNumber}: ${finding.text}`);
}

console.log(`hardcoded Chinese scan: ${findings.length} potential finding(s)`);

if (failOnFound && findings.length > 0) {
  process.exitCode = 1;
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredPathParts.has(entry.name)) {
        walk(filePath);
      }
      continue;
    }

    if (!scannedExtensions.has(path.extname(entry.name)) || shouldIgnoreFile(filePath)) {
      continue;
    }

    scanFile(filePath);
  }
}

function shouldIgnoreFile(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  return ignoredFilePatterns.some((pattern) => pattern.test(normalized));
}

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const sanitized = stripComments(source);
  const sourceLines = source.split(/\r?\n/);
  const sanitizedLines = sanitized.split(/\r?\n/);

  sanitizedLines.forEach((line, index) => {
    if (!chinesePattern.test(line)) {
      return;
    }
    const originalLine = sourceLines[index]?.trim() ?? "";
    if (!originalLine) {
      return;
    }
    findings.push({
      lineNumber: index + 1,
      relativePath: path.relative(rootDir, filePath),
      text: originalLine,
    });
  });
}

function stripComments(source) {
  let output = "";
  let index = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;

  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];
    const previous = source[index - 1];

    if (inLineComment) {
      if (current === "\n") {
        inLineComment = false;
        output += current;
      } else {
        output += " ";
      }
      index += 1;
      continue;
    }

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        output += "  ";
        index += 2;
        continue;
      }
      output += current === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inTemplate && current === "/" && next === "/") {
      inLineComment = true;
      output += "  ";
      index += 2;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inTemplate && current === "/" && next === "*") {
      inBlockComment = true;
      output += "  ";
      index += 2;
      continue;
    }

    if (!inDoubleQuote && !inTemplate && current === "'" && previous !== "\\") {
      inSingleQuote = !inSingleQuote;
    } else if (!inSingleQuote && !inTemplate && current === "\"" && previous !== "\\") {
      inDoubleQuote = !inDoubleQuote;
    } else if (!inSingleQuote && !inDoubleQuote && current === "`" && previous !== "\\") {
      inTemplate = !inTemplate;
    }

    output += current;
    index += 1;
  }

  return output;
}
