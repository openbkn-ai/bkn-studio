/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

/** `text` is shown as is, without coloring, for things like a directory tree. */
export type CodeLanguage = "shell" | "python" | "typescript" | "json" | "text";

export type TokenKind = "comment" | "key" | "string" | "number" | "keyword" | "variable" | "type";

export type CodeToken = { text: string; kind: TokenKind | null };

/** Monaco's Monarch token types, folded into the few colors a code sample needs. */
function kindOf(type: string): TokenKind | null {
  if (type.startsWith("comment")) return "comment";
  if (type.startsWith("string.key") || type.startsWith("attribute.name")) return "key";
  if (type.startsWith("string")) return "string";
  if (type.startsWith("number")) return "number";
  if (type.startsWith("keyword")) return "keyword";
  if (type.startsWith("variable")) return "variable";
  if (type.startsWith("type")) return "type";
  return null;
}

/**
 * Colored tokens from Monaco's tokenizer. Rendering them as React text keeps every value an
 * escaped string; no markup is built from them.
 */
async function tokenize(code: string, language: CodeLanguage): Promise<CodeToken[][]> {
  const { tokenizeCode } = await import("@/framework/monaco/tokenize");
  const lines = await tokenizeCode(code, language);
  return lines.map((tokens) =>
    tokens.map((token) => ({ text: token.text, kind: kindOf(token.type) })),
  );
}

/** Tokens for the code once Monaco has them; null until then, or if it cannot load. */
export function useHighlightedCode(code: string, language: CodeLanguage) {
  const [state, setState] = useState<{ key: string; lines: CodeToken[][] } | null>(null);
  const key = `${language}\n${code}`;

  useEffect(() => {
    if (language === "text") return;
    let cancelled = false;
    tokenize(code, language)
      .then((lines) => {
        if (!cancelled) setState({ key, lines });
      })
      .catch(() => {
        // Plain text is a fine fallback for a sample; nothing to report.
      });
    return () => {
      cancelled = true;
    };
  }, [code, key, language]);

  return state?.key === key ? state.lines : null;
}
