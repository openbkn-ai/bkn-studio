/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { generateText } from "ai";

import { createChatModel, type AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import type { ContextLoaderEnv, KnDetail } from "@/modules/knowledge-network/services/context-loader.service";

/** Localised wording of the generation prompt; the structure is fixed, the text comes from the locale files. */
export type CypherPromptTexts = {
  intro: string;
  rulesHeader: string;
  rules: string[];
  propertiesLabel: string;
  objectTypesHeader: string;
  relationTypesHeader: string;
};

/**
 * Prompt for turning a natural-language question into the MATCH / WHERE fragment the
 * explorer accepts. The schema goes in as ids with display names so the model can use
 * either; the output contract mirrors parseCypherPattern's expectations.
 */
export function buildCypherPrompt(
  detail: Pick<KnDetail, "object_types" | "relation_types">,
  question: string,
  texts: CypherPromptTexts,
): { system: string; user: string } {
  const objectLines = detail.object_types.map((item) => {
    const props = (item.data_properties ?? [])
      .slice(0, 12)
      .map((property) => `${property.name}${property.type ? `:${property.type}` : ""}`)
      .join(", ");
    const comment = item.comment ? ` - ${item.comment.slice(0, 80)}` : "";
    return `- ${item.id} (${item.name?.trim() || item.id})${comment}${props ? `\n  ${texts.propertiesLabel}: ${props}` : ""}`;
  });
  const relationLines = detail.relation_types.map(
    (item) => `- ${item.id} (${item.name?.trim() || item.id}): (${item.sourceId})-[:${item.id}]->(${item.targetId})`,
  );
  const system = [
    texts.intro,
    "",
    texts.rulesHeader,
    ...texts.rules.map((rule, index) => `${index + 1}. ${rule}`),
    "",
    texts.objectTypesHeader,
    ...objectLines,
    "",
    texts.relationTypesHeader,
    ...relationLines,
  ].join("\n");
  return { system, user: question.trim() };
}

/** Pulls the MATCH fragment out of a model reply: fences, prose and a stray RETURN tail are removed. */
export function extractCypherFragment(text: string): string {
  let body = text.trim();
  const fence = /```(?:cypher|sql)?\s*([\s\S]*?)```/i.exec(body);
  if (fence) body = fence[1].trim();
  const start = body.search(/\bMATCH\b/i);
  if (start > 0) body = body.slice(start);
  body = body.replace(/\b(RETURN|ORDER\s+BY|SKIP|LIMIT)\b[\s\S]*$/i, "").trim();
  return inlineMapsToWhere(body.replace(/;+\s*$/, "").trim());
}

/**
 * Rewrites `(v:Label {a: 'x', b: 2})` into `(v:Label)` plus `v.a = 'x' AND v.b = 2` in the WHERE
 * clause. Models reach for the inline form even when told not to, and the backend subset only
 * accepts WHERE comparisons.
 */
export function inlineMapsToWhere(fragment: string): string {
  const conditions: string[] = [];
  const stripped = fragment.replace(/\(\s*([A-Za-z_]\w*)\s*:\s*([^\s{)]+)\s*\{([^}]*)\}\s*\)/g, (_match, variable: string, label: string, body: string) => {
    for (const pair of splitTopLevel(body)) {
      const colon = pair.indexOf(":");
      if (colon < 0) continue;
      const key = pair.slice(0, colon).trim().replace(/^[`'"]|[`'"]$/g, "");
      const value = pair.slice(colon + 1).trim();
      if (key && value) conditions.push(`${variable}.${key} = ${value}`);
    }
    return `(${variable}:${label})`;
  });
  if (conditions.length === 0) return stripped;
  const where = /\bWHERE\b/i.exec(stripped);
  if (where) {
    const head = stripped.slice(0, where.index + where[0].length);
    const tail = stripped.slice(where.index + where[0].length).trim();
    return `${head} ${conditions.join(" AND ")}${tail ? ` AND ${tail}` : ""}`;
  }
  return `${stripped}\nWHERE ${conditions.join(" AND ")}`;
}

/** Splits `a: 'x, y', b: 2` on commas that are outside quotes. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const char of text) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export async function generateCypherFragment(
  env: ContextLoaderEnv,
  tokenProvider: AgentTokenProvider,
  modelName: string,
  detail: Pick<KnDetail, "object_types" | "relation_types">,
  question: string,
  texts: CypherPromptTexts,
  signal?: AbortSignal,
): Promise<string> {
  const prompt = buildCypherPrompt(detail, question, texts);
  const result = await generateText({
    model: createChatModel(env, modelName, tokenProvider),
    system: prompt.system,
    prompt: prompt.user,
    temperature: 0,
    abortSignal: signal,
  });
  return extractCypherFragment(result.text);
}
