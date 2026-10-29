/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { appEnUS } from "@/app/locales/resources/app/en-US";
import { authEnUS } from "@/app/locales/resources/auth/en-US";
import { commonEnUS } from "@/app/locales/resources/common/en-US";
import { shellEnUS } from "@/app/locales/resources/shell/en-US";
import { bknProjectEnUS } from "@/modules/bkn-project/locales/en-US";
import { homeEnUS } from "@/modules/home/locales/en-US";
import { knowledgeNetworkEnUS } from "@/modules/knowledge-network/locales/en-US";

// English UI labels use sentence case: only the first word (and proper nouns) is capitalized.
// Modules are added here as their copy is migrated.
const CHECKED_RESOURCES = {
  appEnUS,
  authEnUS,
  commonEnUS,
  shellEnUS,
  bknProjectEnUS,
  homeEnUS,
  knowledgeNetworkEnUS,
};

// Product and top-level module names keep their capitalization.
const PROPER_PHRASES = [
  "Data Resource Knowledge Network",
  "Global Business Knowledge Network",
  "Domain Knowledge Network",
  "Execution Factory",
  "BKN Project",
  "BKN Trace",
  "Context Loader",
  "Studio Console",
  "Account Center",
  "Claude Code",
  "SQL Server",
  "Hong Kong",
  "(Lab)",
];

const PROPER_WORDS = new Set([
  "English",
  "Chinese",
  "Vega",
  "Workshop",
  "Cypher",
  "Studio",
  "Python",
  "Markdown",
  "Bearer",
  "Cursor",
  "Enter",
  "Esc",
  "Ctrl",
  "Shift",
  "Tab",
  "Cmd",
  "Alt",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

const SEGMENT_SEPARATOR = / \/ | · | - | — | – |: /;
const CAPITALIZED_WORD = /^["'(“<]?([A-Z][a-z]+(?:['’][a-z]+)?(?:-[A-Za-z]+)*)[,;:)”>…]*$/;

/** Returns the words that break sentence case in a short label, or [] when the label is fine. */
function titleCaseWords(value: string): string[] {
  if (/[.?!。]$/.test(value.trim()) || value.split(/\s+/).length > 10) return [];
  let text = value;
  // A proper phrase still counts as a word, so the word after it is not treated as first.
  for (const phrase of PROPER_PHRASES) text = text.split(phrase).join("x");
  const offenders: string[] = [];
  for (const segment of text.split(SEGMENT_SEPARATOR)) {
    let first = true;
    for (const word of segment.split(" ")) {
      if (!/[A-Za-z]/.test(word.replace(/\{\{[^}]*\}\}/g, ""))) {
        if (/^\d+\.$/.test(word)) first = true;
        continue;
      }
      if (!first) {
        const match = CAPITALIZED_WORD.exec(word);
        const base = match?.[1].split("-")[0];
        if (base && !PROPER_WORDS.has(base)) offenders.push(word);
      }
      first = /[.?!:]$/.test(word);
    }
  }
  return offenders;
}

function collectViolations(node: unknown, path: string, out: string[]) {
  if (typeof node === "string") {
    const words = titleCaseWords(node);
    if (words.length > 0) out.push(`${path}: "${node}" (${words.join(", ")})`);
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, child] of Object.entries(node)) {
      collectViolations(child, path ? `${path}.${key}` : key, out);
    }
  }
}

describe("English UI copy casing", () => {
  it("flags title case words after the first word", () => {
    expect(titleCaseWords("Basic Information")).toEqual(["Information"]);
    expect(titleCaseWords("Basic information")).toEqual([]);
    expect(titleCaseWords("Open Execution Factory")).toEqual([]);
    expect(titleCaseWords("Hong Kong Dollar · HKD")).toEqual(["Dollar"]);
    expect(titleCaseWords("Hong Kong dollar · HKD")).toEqual([]);
    expect(titleCaseWords("Issue API key")).toEqual([]);
    expect(titleCaseWords("{{name}} / Column masking rule")).toEqual([]);
    expect(titleCaseWords("Collapsed. Expand to edit")).toEqual([]);
  });

  it("uses sentence case for labels in migrated modules", () => {
    const violations: string[] = [];
    collectViolations(CHECKED_RESOURCES, "", violations);
    expect(violations).toEqual([]);
  });
});
