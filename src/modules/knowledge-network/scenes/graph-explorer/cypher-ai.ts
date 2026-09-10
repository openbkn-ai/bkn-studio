/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { generateText } from "ai";

import { createChatModel, type AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import type { ContextLoaderEnv, KnDetail } from "@/modules/knowledge-network/services/context-loader.service";

/**
 * Prompt for turning a natural-language question into the MATCH / WHERE fragment the
 * explorer accepts. The schema goes in as ids with display names so the model can use
 * either; the output contract mirrors parseCypherPattern's expectations.
 */
export function buildCypherPrompt(detail: Pick<KnDetail, "object_types" | "relation_types">, question: string): { system: string; user: string } {
  const objectLines = detail.object_types.map((item) => {
    const props = (item.data_properties ?? [])
      .slice(0, 12)
      .map((property) => `${property.name}${property.type ? `:${property.type}` : ""}`)
      .join(", ");
    return `- ${item.id}（${item.name?.trim() || item.id}）${item.comment ? ` — ${item.comment.slice(0, 80)}` : ""}${props ? `\n  属性: ${props}` : ""}`;
  });
  const relationLines = detail.relation_types.map(
    (item) => `- ${item.id}（${item.name?.trim() || item.id}）: (${item.sourceId})-[:${item.id}]->(${item.targetId})`,
  );
  const system = [
    "你是知识网络图查询助手。把用户的自然语言问题改写成一段 openCypher 的 MATCH 模式，只输出模式本身。",
    "",
    "硬性规则：",
    "1. 只写 MATCH … 与可选的 WHERE …；绝对不要写 RETURN、ORDER BY、SKIP、LIMIT，也不要解释。",
    "2. 每个节点必须带变量和标签：(k:knowledge)。标签只能用下面列出的对象类 id。",
    "3. 关系必须带方向且只写一个关系类 id：-[:rel_id]-> 或 <-[:rel_id]-。方向以关系类定义的 source -> target 为准。",
    "4. 不支持变长关系（*1..3）、可选匹配、聚合、函数。WHERE 只能是 变量.属性 与字面量的 = <> < > <= >= 比较，用 AND 连接。",
    "5. 属性名只能用下面列出的属性名。",
    "6. 只用一行或几行纯文本输出，不要 Markdown 代码块。",
    "",
    "对象类：",
    ...objectLines,
    "",
    "关系类（方向为 source -> target）：",
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
  return body.replace(/;+\s*$/, "").trim();
}

export async function generateCypherFragment(
  env: ContextLoaderEnv,
  tokenProvider: AgentTokenProvider,
  modelName: string,
  detail: Pick<KnDetail, "object_types" | "relation_types">,
  question: string,
  signal?: AbortSignal,
): Promise<string> {
  const prompt = buildCypherPrompt(detail, question);
  const result = await generateText({
    model: createChatModel(env, modelName, tokenProvider),
    system: prompt.system,
    prompt: prompt.user,
    temperature: 0,
    abortSignal: signal,
  });
  return extractCypherFragment(result.text);
}
