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
const findings = [];

walk(sourceDir);

const blockerFiles = findings.filter((finding) => finding.severity === "blocker");
const reviewFiles = findings.filter((finding) => finding.severity === "review");

printSection("BLOCKER", blockerFiles);
printSection("REVIEW", reviewFiles);
console.log(
  `theme surface scan: ${blockerFiles.length} blocker file(s), ${reviewFiles.length} review file(s)`,
);

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(filePath);
    } else if (entry.name.endsWith(".css")) {
      scanCss(filePath, fs.readFileSync(filePath, "utf8"));
    } else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
      scanTsx(filePath, fs.readFileSync(filePath, "utf8"));
    }
  }
}

function scanCss(filePath, source) {
  // Preserve line offsets while ignoring comments so a finding always points to the rendered rule,
  // not to a later line after a long Chinese or English comment block.
  const sanitized = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const surfaces = [...sanitized.matchAll(/\b(?:background|background-color)\s*:\s*([^;}\n]+)/gi)]
    .filter((match) => isLightSurface(match[1]));
  if (surfaces.length === 0) return;

  const themeAware = /data-theme\s*=\s*["']dark["']/.test(sanitized)
    || /color\s*:\s*var\(--(?:color|admin-color|business-color)-(?:text|heading|secondary|muted|tertiary)/.test(sanitized);
  addFinding(filePath, source, surfaces, themeAware ? "blocker" : "review");
}

function scanTsx(filePath, source) {
  const surfaces = [...source.matchAll(/style=\{\{[^}]*\b(?:background|backgroundColor)\s*:\s*["']?(#[fF][0-9a-fA-F]{2,5}|rgb\(255|rgba\(255)/g)];
  if (surfaces.length > 0) addFinding(filePath, source, surfaces, "review");
}

function isLightSurface(value) {
  const hexValues = value.match(/#[0-9a-f]{3,6}\b/gi) ?? [];
  return hexValues.some(isLightHex) || /rgba?\(\s*255\b/i.test(value);
}

function isLightHex(value) {
  const compact = value.slice(1);
  const hex = compact.length === 3
    ? compact.split("").map((channel) => channel + channel).join("")
    : compact;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  return luminance >= 205;
}

function addFinding(filePath, source, matches, severity) {
  const lines = matches.slice(0, 4).map((match) => source.slice(0, match.index ?? 0).split(/\r?\n/).length);
  findings.push({
    file: path.relative(rootDir, filePath),
    lines,
    severity,
  });
}

function printSection(label, entries) {
  console.log(`\n${label}`);
  for (const entry of entries) {
    console.log(`${entry.file}:${entry.lines.join(",")}`);
  }
}
