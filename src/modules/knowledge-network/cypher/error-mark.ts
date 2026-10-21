/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Where the backend says a query went wrong, as an editor position (1-based). */
export type CypherErrorMark = { line: number; column: number; message: string };

/**
 * Reads the position out of a backend message such as "line 1, column 32: …" or
 * "line 2:0: …". The parser counts columns from 0 in both forms.
 */
export function errorMarkFrom(message: string, query: string): CypherErrorMark | null {
  const match = /line (\d+)(?:, column |:)(\d+)/i.exec(message);
  if (!match) return null;
  const lineCount = query.split("\n").length;
  const line = Math.min(Math.max(1, Number(match[1])), lineCount);
  return { line, column: Number(match[2]) + 1, message };
}
