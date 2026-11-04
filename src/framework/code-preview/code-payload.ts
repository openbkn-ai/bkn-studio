/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type CodePayload = { code: string; language: string };

const languageAliases: Record<string, string> = {
  py: "python",
  python3: "python",
  js: "javascript",
  ts: "typescript",
  sh: "shell",
  bash: "shell",
  text: "plaintext",
  txt: "plaintext",
};

// 只解析参数容器；代码字段本身从不反转义、格式化或补换行。
export function getCodePayload(value: unknown, defaultLanguage = "plaintext"): CodePayload | null {
  let payload: unknown = value;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload) as unknown;
    } catch {
      return null;
    }
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
  const fields = payload as Record<string, unknown>;
  if (typeof fields.code !== "string") return null;
  const language =
    typeof fields.language === "string" && fields.language.trim()
      ? fields.language.trim().toLowerCase()
      : defaultLanguage;
  return {
    code: fields.code,
    language: Object.hasOwn(languageAliases, language) ? languageAliases[language] : language,
  };
}

export function countSourceLines(code: string): number {
  return code === "" ? 0 : code.split(/\r\n|\r|\n/).length;
}
