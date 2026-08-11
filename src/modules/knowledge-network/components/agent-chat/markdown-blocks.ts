/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Streaming Markdown block splitting and tail completion.
 *
 * react-markdown reparses the full body on every render. During streaming that
 * becomes O(n^2) as every token reparses all prior text. Splitting stable blocks
 * from the active tail lets memoized blocks avoid re-rendering, bringing the
 * common path back to O(n).
 */

/** Fence line: ``` or ~~~, allowing up to three leading spaces. */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
/** List item line: - * + or 1. / 1). */
const LIST_RE = /^ {0,3}(?:[-*+]|\d{1,9}[.)])\s/;
/** Continuation line for a list item. */
const LIST_CONT_RE = /^(?: {2,}|\t)\S/;

function isListish(line: string): boolean {
  return LIST_RE.test(line) || LIST_CONT_RE.test(line);
}

/** Finds the nearest non-blank line before or at from. */
function lastNonBlank(lines: readonly string[], from: number): string | undefined {
  for (let i = from; i >= 0; i--) {
    if (lines[i].trim() !== "") return lines[i];
  }
  return undefined;
}

/** Finds the nearest non-blank line after or at from. */
function firstNonBlank(lines: readonly string[], from: number): string | undefined {
  for (let i = from; i < lines.length; i++) {
    if (lines[i].trim() !== "") return lines[i];
  }
  return undefined;
}

/**
 * Splits Markdown text by block boundaries, usually blank lines. Two cases stay intact:
 * - blank lines inside fenced code blocks;
 * - blank lines between loose-list items, which would otherwise become separate lists.
 *
 * A long loose list remains one active tail block because splitting it would
 * break ordered-list numbering. That case still reparses more than ideal, but
 * it preserves Markdown semantics.
 */
export function splitMarkdownBlocks(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let cur: string[] = [];
  let fence: string | null = null;

  const flush = () => {
    if (cur.length > 0) {
      blocks.push(cur.join("\n"));
      cur = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (fence !== null) {
      cur.push(line);
      const closing = FENCE_RE.exec(line);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) fence = null;
      continue;
    }

    const opening = FENCE_RE.exec(line);
    if (opening) {
      fence = opening[1];
      cur.push(line);
      continue;
    }

    if (line.trim() === "") {
      // Blank lines are block boundaries unless they sit between loose-list items.
      // Scan nearest non-blank lines without slicing; this runs on the streaming hot path.
      const prev = lastNonBlank(cur, cur.length - 1);
      const next = firstNonBlank(lines, i + 1);
      if (prev && next && isListish(prev) && isListish(next)) {
        cur.push(line);
        continue;
      }
      flush();
      continue;
    }

    cur.push(line);
  }

  flush();
  return blocks;
}

/** Returns the closing marker when the text still has an open fence. */
function openFenceMarker(text: string): string | null {
  let fence: string | null = null;
  for (const line of text.split("\n")) {
    const m = FENCE_RE.exec(line);
    if (!m) continue;
    if (fence === null) fence = m[1];
    else if (m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
  }
  return fence;
}

function countOccurrences(line: string, token: string): number {
  let n = 0;
  let at = line.indexOf(token);
  while (at !== -1) {
    n += 1;
    at = line.indexOf(token, at + token.length);
  }
  return n;
}

/**
 * Completes the active streaming tail when it stops in the middle of Markdown
 * syntax. Completion is render-only; the next real token replaces it.
 */
export function closeOpenMarkdown(block: string): string {
  const fence = openFenceMarker(block);
  if (fence !== null) return `${block}${block.endsWith("\n") ? "" : "\n"}${fence}`;

  const lines = block.split("\n");
  // Match inline syntax within the currently written paragraph, not just the
  // last line, because bold and inline code can span lines.
  let start = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === "") {
      start = i + 1;
      break;
    }
  }
  const para = lines.slice(start);
  if (para.length === 0 || para.join("").trim() === "") return block;
  // Do not pair inline markers inside a paragraph that contains a fence line;
  // fence backticks would skew the count.
  if (para.some((l) => FENCE_RE.test(l))) return block;

  const text = para.join("\n");
  let tail = "";
  // Complete bold before inline code so **`x closes in the reverse order: `**.
  if (countOccurrences(text, "**") % 2 === 1) tail = `**${tail}`;
  const backticks = countOccurrences(text, "`") - countOccurrences(text, "``") * 2;
  if (backticks % 2 === 1) tail = `\`${tail}`;
  return tail ? block + tail : block;
}
