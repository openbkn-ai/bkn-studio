/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * How much raw text the page shows at once. Tens of thousands of lines in one
 * block can freeze the tab while the browser lays them out for screen readers,
 * so longer text is cut here and offered whole through copy and download.
 */
export const RAW_PREVIEW_MAX_LINES = 2000;
export const RAW_PREVIEW_MAX_CHARS = 200_000;

export type RawPreview = {
  text: string;
  shownLines: number;
  totalLines: number;
  truncated: boolean;
};

function countLines(text: string): number {
  if (!text) return 0;
  let lines = 1;
  for (let at = text.indexOf("\n"); at !== -1; at = text.indexOf("\n", at + 1)) lines += 1;
  return lines;
}

/** The start of `text` that fits both budgets, and how much of it that is. */
export function previewRawText(
  text: string,
  maxLines = RAW_PREVIEW_MAX_LINES,
  maxChars = RAW_PREVIEW_MAX_CHARS,
): RawPreview {
  const totalLines = countLines(text);
  let end = Math.min(text.length, maxChars);
  let lines = 0;
  for (let at = text.indexOf("\n"); at !== -1 && at < end; at = text.indexOf("\n", at + 1)) {
    lines += 1;
    if (lines === maxLines) {
      end = at;
      break;
    }
  }
  if (end >= text.length) {
    return { text, shownLines: totalLines, totalLines, truncated: false };
  }
  const shown = text.slice(0, end);
  return { text: shown, shownLines: countLines(shown), totalLines, truncated: true };
}
