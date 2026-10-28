/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { mockKnowledgeBases } from "@/modules/knowledge-network/services/mock/state";
import { useMock, wait } from "@/modules/knowledge-network/services/shared/runtime";

/** The operation a knowledge network needs on a knowledge base to read it through its proxy. */
export const KNOWLEDGE_BASE_QUERY_OPERATION = "query_data";

/** A knowledge base the caller may mount: one they can query. */
export type QueryableKnowledgeBase = {
  description: string;
  documentCount: number;
  id: string;
  name: string;
};

/** One entry of kb-api's dataset list, with what the caller may do on it. */
export type BackendKnowledgeBase = {
  description?: string | null;
  document_count?: number;
  id: number | string;
  name: string;
  operations?: string[];
};

/** kb-api (professional edition) wraps its body as `{ code, msg, data }`; code 0 is success. */
type KnowledgeBaseEnvelope<T> = { code?: number; data?: T; msg?: string };

export function mapQueryableKnowledgeBases(
  items: BackendKnowledgeBase[],
): QueryableKnowledgeBase[] {
  return items
    .filter((item) => item.operations?.includes(KNOWLEDGE_BASE_QUERY_OPERATION))
    .map((item) => ({
      description: item.description ?? "",
      documentCount: item.document_count ?? 0,
      id: String(item.id),
      name: item.name,
    }));
}

/**
 * Knowledge bases the caller can query, by name. kb-api lists only what the caller can see, with
 * the operations they hold; one they can see but not query is left out, since mounting it would be
 * refused.
 */
export async function listQueryableKnowledgeBases(name = ""): Promise<QueryableKnowledgeBase[]> {
  const keyword = name.trim();
  if (useMock) {
    return wait(
      mapQueryableKnowledgeBases(
        mockKnowledgeBases.filter((item) => !keyword || item.name.includes(keyword)),
      ),
    );
  }
  const response = await http.get<KnowledgeBaseEnvelope<BackendKnowledgeBase[]>>(
    "/kb/v1/knowledge_base/datasets",
    { params: { name: keyword || undefined }, skipErrorToast: true },
  );
  const envelope = response.data;
  if (envelope?.code !== 0) {
    throw new Error(envelope?.msg || "knowledge base list failed");
  }
  return mapQueryableKnowledgeBases(envelope.data ?? []);
}
