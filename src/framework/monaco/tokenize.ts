/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import * as monaco from "monaco-editor";

import { ensureMonacoSetup } from "@/framework/monaco/ensure";

export type MonacoToken = { text: string; type: string };

/**
 * Splits code into Monaco's Monarch tokens, line by line, without mounting an editor. Load this
 * module lazily: it pulls in Monaco itself.
 */
export async function tokenizeCode(code: string, language: string): Promise<MonacoToken[][]> {
  await ensureMonacoSetup();
  // Languages load lazily; colorize waits for this one's tokenizer, tokenize does not.
  await monaco.editor.colorize("", language, {});
  const lines = code.split("\n");
  const tokens = monaco.editor.tokenize(code, language);
  return lines.map((line, index) => {
    const lineTokens = tokens[index] ?? [];
    if (lineTokens.length === 0) return [{ text: line, type: "" }];
    return lineTokens.map((token, position) => ({
      text: line.slice(token.offset, lineTokens[position + 1]?.offset ?? line.length),
      type: token.type,
    }));
  });
}
