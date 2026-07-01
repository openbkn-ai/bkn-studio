/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { SmallModelType } from "@/modules/model-resources/types/small-model";

export const MODEL_API_KEY_PLACEHOLDER = "$api_key";

export function getModelApiHost(host = window.location.host) {
  return host;
}

export function getModelApiBaseUrl(host = window.location.host) {
  return `https://${host}/api/mf-model-api/v1/`;
}

export function resolveModelApiName(modelName: string, apiModel?: string) {
  return apiModel?.trim() || modelName;
}

export function buildLlmCurlExample(params: {
  apiKey?: string;
  host?: string;
  modelName: string;
}) {
  const host = params.host ?? getModelApiHost();
  const apiKey = params.apiKey ?? MODEL_API_KEY_PLACEHOLDER;

  return `curl https://${host}/api/mf-model-api/v1/chat/completions \\
-H "Content-Type: application/json" \\
-H "Authorization: Bearer ${apiKey}" \\
-d '{
\t"model": "${params.modelName}",
\t"messages": [{"role": "user", "content": "Hi, who are you?"}],
\t"temperature": 0.3
}' -k`;
}

export function buildLlmSdkExample(params: {
  apiKey?: string;
  host?: string;
  modelName: string;
}) {
  const host = params.host ?? getModelApiHost();
  const apiKey = params.apiKey ?? MODEL_API_KEY_PLACEHOLDER;

  return `import openai
from openai import OpenAI
API_BASE = "https://${host}/api/mf-model-api/v1/"
API_KEY = "${apiKey}"
client = OpenAI(
    api_key=API_KEY,
    base_url=API_BASE
)
completion = client.chat.completions.create(
    model="${params.modelName}",
    messages=[{"role": "user", "content": "Hi, who are you?"}]
)
print(completion)`;
}

export function buildSmallModelCurlExample(params: {
  apiKey?: string;
  host?: string;
  modelName: string;
  modelType: SmallModelType;
}) {
  const host = params.host ?? getModelApiHost();
  const apiKey = params.apiKey ?? MODEL_API_KEY_PLACEHOLDER;

  if (params.modelType === "reranker") {
    return `curl 'https://${host}/api/mf-model-api/v1/small-model/reranker' \\
-H 'Content-Type: application/json' \\
-H 'Authorization: Bearer ${apiKey}' \\
-d '{
  "model": "${params.modelName}",
  "query": "who are",
  "documents": [
    "Hi, who are you?",
    "hello word",
    "come on"
  ]
}' -k`;
  }

  return `curl 'https://${host}/api/mf-model-api/v1/small-model/embeddings' \\
-H 'Content-Type: application/json' \\
-H 'Authorization: Bearer ${apiKey}' \\
-d '{
\t"model":"${params.modelName}",
\t"input":["Hi, who are you?"]
}' -k`;
}
