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
const includeAllowed = process.argv.includes("--include-allowed");
const jsonOutput = process.argv.includes("--json");
const summaryOutput = process.argv.includes("--summary");
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

const rawFindings = [];

walk(path.join(rootDir, "src"));

const findings = includeAllowed ? rawFindings : rawFindings.filter((finding) => !finding.allowed);
const summary = summarizeFindings(rawFindings, findings);

if (jsonOutput) {
  console.log(JSON.stringify({ summary, findings }, null, 2));
} else {
  if (summaryOutput) {
    printSummary(summary);
  }
  for (const finding of findings) {
    console.log(`${finding.relativePath}:${finding.lineNumber}: ${finding.text}`);
  }
  console.log(`hardcoded Chinese scan: ${findings.length} potential finding(s)`);
}

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
    const finding = {
      lineNumber: index + 1,
      relativePath: path.relative(rootDir, filePath),
      text: originalLine,
    };
    rawFindings.push({
      ...finding,
      ...classifyFinding(finding),
    });
  });
}

function classifyFinding(finding) {
  const normalizedPath = finding.relativePath.split(path.sep).join("/");
  const text = finding.text;

  if (isChineseValidationPattern(text)) {
    return {
      allowed: true,
      category: "allowed-pattern",
      reason: "Chinese character validation pattern",
    };
  }

  if (normalizedPath.endsWith(".tsx")) {
    return {
      allowed: false,
      category: "ui",
    };
  }

  if (looksLikePrompt(normalizedPath, text)) {
    return {
      allowed: false,
      category: "prompt",
    };
  }

  if (normalizedPath.includes("/services/")) {
    return {
      allowed: false,
      category: "service",
    };
  }

  return {
    allowed: false,
    category: "utility",
  };
}

function isChineseValidationPattern(text) {
  return /\\u4e00|\\u9fff|一-龥|\[\\p\{Script=Han\}/u.test(text) && /pattern|regex|regexp|RegExp|\/.*\//i.test(text);
}

function looksLikePrompt(relativePath, text) {
  return (
    /prompt|agent|llm|model|chat/i.test(relativePath) ||
    /prompt|systemPrompt|instruction|模型|提示词|生成|输出|回答|提问/.test(text)
  );
}

function summarizeFindings(allFindings, activeFindings) {
  const byCategory = {};
  const activeByCategory = {};

  for (const finding of allFindings) {
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
  }

  for (const finding of activeFindings) {
    activeByCategory[finding.category] = (activeByCategory[finding.category] ?? 0) + 1;
  }

  return {
    active: activeFindings.length,
    total: allFindings.length,
    allowed: allFindings.length - activeFindings.length,
    byCategory,
    activeByCategory,
  };
}

function printSummary(summary) {
  console.log("hardcoded Chinese scan summary:");
  console.log(`active: ${summary.active}`);
  console.log(`allowed: ${summary.allowed}`);
  for (const [category, count] of Object.entries(summary.activeByCategory).sort()) {
    console.log(`${category}: ${count}`);
  }
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
