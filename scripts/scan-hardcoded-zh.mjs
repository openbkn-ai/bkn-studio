/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const rootDir = process.cwd();
const failOnFound = process.argv.includes("--fail-on-found");
const includeAllowed = process.argv.includes("--include-allowed");
const jsonOutput = process.argv.includes("--json");
const summaryOutput = process.argv.includes("--summary");
const chinesePattern = /[\u4e00-\u9fff]/;
const scannedExtensions = new Set([".html", ".ts", ".tsx"]);
const ignoredPathParts = new Set([".git", "dist", "node_modules", "locales"]);
const ignoredFilePatterns = [/\.test\.tsx?$/, /\.spec\.tsx?$/, /mock/i];
const userFacingAttributes = new Set(["alt", "aria-label", "placeholder", "title"]);
const messageMethods = new Set(["error", "info", "success", "warning"]);
const singleWordUiText = new Set([
  "back", "cancel", "close", "copy", "delete", "description", "header", "name",
  "next", "previous", "refresh", "reset", "save", "search", "value",
]);
const stableTechnicalText = new Set([
  "API Key", "Access Token", "Authorization: Bearer", "DB", "ID", "JSON", "MCP",
  "My", "OAuth Token", "PG", "PK", "POST", "REST APIs", "SQL", "TOON",
  "Trace ID", "Request ID", "api", "application/json", "body.json", "fx",
  "inputSchema", "mcp", "outputSchema", "token",
]);

const rawFindings = [];
const findingKeys = new Set();

for (const relativeRoot of ["src", "public"]) {
  const scanRoot = path.join(rootDir, relativeRoot);
  if (fs.existsSync(scanRoot)) walk(scanRoot);
}
const rootHtml = path.join(rootDir, "index.html");
if (fs.existsSync(rootHtml)) scanFile(rootHtml);

const findings = includeAllowed ? rawFindings : rawFindings.filter((finding) => !finding.allowed);
const summary = summarizeFindings(rawFindings, findings);

if (jsonOutput) {
  console.log(JSON.stringify({ summary, findings }, null, 2));
} else {
  if (summaryOutput) printSummary(summary);
  for (const finding of findings) {
    console.log(`${finding.relativePath}:${finding.lineNumber}: [${finding.language}] ${finding.text}`);
  }
  console.log(`hardcoded i18n scan: ${findings.length} potential finding(s)`);
}

if (failOnFound && findings.length > 0) process.exitCode = 1;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredPathParts.has(entry.name)) walk(filePath);
      continue;
    }
    if (scannedExtensions.has(path.extname(entry.name)) && !shouldIgnoreFile(filePath)) {
      scanFile(filePath);
    }
  }
}

function shouldIgnoreFile(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  return ignoredFilePatterns.some((pattern) => pattern.test(normalized));
}

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  scanChineseText(filePath, source);
  if (path.extname(filePath) === ".html") scanHtmlEnglishText(filePath, source);
  else scanTypeScriptEnglishText(filePath, source);
}

function scanChineseText(filePath, source) {
  const sanitized = stripComments(source);
  const sourceLines = source.split(/\r?\n/);
  sanitized.split(/\r?\n/).forEach((line, index) => {
    if (!chinesePattern.test(line)) return;
    const text = sourceLines[index]?.trim() ?? "";
    if (text) addFinding(filePath, index + 1, text, "zh", classifyChineseFinding(filePath, text));
  });
}

function scanTypeScriptEnglishText(filePath, source) {
  const scriptKind = path.extname(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind);
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      addEnglishNodeFinding(filePath, sourceFile, node, node.getText(sourceFile));
    } else if (ts.isJsxAttribute(node) && userFacingAttributes.has(node.name.text)) {
      addEnglishNodeFinding(filePath, sourceFile, node, stringValueOfJsxAttribute(node));
    } else if (isUserMessageCall(node)) {
      addEnglishNodeFinding(filePath, sourceFile, node, stringValueOfExpression(node.arguments[0]));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function scanHtmlEnglishText(filePath, source) {
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, "");
  withoutComments.split(/\r?\n/).forEach((line, index) => {
    for (const match of line.matchAll(/>([^<>]+)</g)) addEnglishTextFinding(filePath, index + 1, match[1]);
    for (const match of line.matchAll(/\b(?:alt|aria-label|placeholder|title)=["']([^"']+)["']/g)) {
      addEnglishTextFinding(filePath, index + 1, match[1]);
    }
  });
}

function stringValueOfJsxAttribute(attribute) {
  const initializer = attribute.initializer;
  if (!initializer) return "";
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (ts.isJsxExpression(initializer) && initializer.expression) {
    return stringValueOfExpression(initializer.expression);
  }
  return "";
}

function stringValueOfExpression(expression) {
  if (!expression) return "";
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  return "";
}

function isUserMessageCall(node) {
  if (!ts.isCallExpression(node) || node.arguments.length === 0) return false;
  const expression = node.expression;
  return ts.isPropertyAccessExpression(expression)
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === "message"
    && messageMethods.has(expression.name.text);
}

function addEnglishNodeFinding(filePath, sourceFile, node, value) {
  if (!value) return;
  const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  addEnglishTextFinding(filePath, lineNumber, value);
}

function addEnglishTextFinding(filePath, lineNumber, value) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!looksLikeNaturalEnglish(text)) return;
  addFinding(filePath, lineNumber, text, "en", { allowed: false, category: "ui" });
}

function looksLikeNaturalEnglish(text) {
  if (!text || stableTechnicalText.has(text) || looksLikeTechnicalValue(text)) return false;
  const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
  return words.length >= 2 || (words.length === 1 && singleWordUiText.has(words[0].toLowerCase()));
}

function looksLikeTechnicalValue(text) {
  return /^(?:https?:\/\/|\/|~\/|\.\/|\.\.\/)/.test(text)
    || /^\.[\w-]+(?:\.[\w-]+)+$/.test(text)
    || /^\.[\w-]+\/[\w./-]+$/.test(text)
    || /^(?:GET|POST|PUT|PATCH|DELETE)\s+\/[\w./{}:-]*/.test(text)
    || /^(?:curl|pip|npm|pnpm|yarn|npx)\s+\S+/i.test(text)
    || looksLikeJson(text)
    || looksLikeSqlSnippet(text)
    || /^<[^>]+>$/.test(text)
    || /^[A-Z][A-Z0-9_-]+$/.test(text)
    || /^[a-zA-Z_$][\w$]*(?:[./:_-][\w$-]+)+$/.test(text)
    || /^\{\{[^}]+\}\}$/.test(text);
}

function looksLikeJson(text) {
  if (!/^[{[]/.test(text)) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function looksLikeSqlSnippet(text) {
  return /\b(?:bigint|boolean|datetime|decimal|integer|jsonb?|numeric|smallint|text|timestamp|varchar)\b/i.test(text)
    && /\b[a-z_][\w$]*\s+(?:bigint|boolean|datetime|decimal|integer|jsonb?|numeric|smallint|text|timestamp|varchar)\b/i.test(text);
}

function addFinding(filePath, lineNumber, text, language, classification) {
  const relativePath = path.relative(rootDir, filePath).split(path.sep).join("/");
  const key = `${relativePath}:${lineNumber}:${language}:${text}`;
  if (findingKeys.has(key)) return;
  findingKeys.add(key);
  rawFindings.push({ lineNumber, relativePath, text, language, ...classification });
}

function classifyChineseFinding(filePath, text) {
  if (isChineseValidationPattern(text)) {
    return { allowed: true, category: "allowed-pattern", reason: "Chinese character validation pattern" };
  }
  return { allowed: false, category: path.extname(filePath) === ".html" ? "html" : "ui" };
}

function isChineseValidationPattern(text) {
  return /\\u4e00|\\u9fff|一-龥|\[\\p\{Script=Han\}/u.test(text)
    && /pattern|regex|regexp|RegExp|\/.*\//i.test(text);
}

function summarizeFindings(allFindings, activeFindings) {
  const byCategory = {};
  const activeByCategory = {};
  const activeByLanguage = {};
  for (const finding of allFindings) byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
  for (const finding of activeFindings) {
    activeByCategory[finding.category] = (activeByCategory[finding.category] ?? 0) + 1;
    activeByLanguage[finding.language] = (activeByLanguage[finding.language] ?? 0) + 1;
  }
  return {
    active: activeFindings.length,
    total: allFindings.length,
    allowed: allFindings.length - activeFindings.length,
    byCategory,
    activeByCategory,
    activeByLanguage,
  };
}

function printSummary(summary) {
  console.log("hardcoded i18n scan summary:");
  console.log(`active: ${summary.active}`);
  console.log(`allowed: ${summary.allowed}`);
  for (const [language, count] of Object.entries(summary.activeByLanguage).sort()) console.log(`${language}: ${count}`);
  for (const [category, count] of Object.entries(summary.activeByCategory).sort()) console.log(`${category}: ${count}`);
}

function stripComments(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/\/\/.*$/gm, "");
}
