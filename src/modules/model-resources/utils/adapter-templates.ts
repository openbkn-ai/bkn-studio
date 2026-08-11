/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const ADAPTATION_CODE_TEMPLATES: Record<string, string> = {
  embedding: `"""
1. The entry function must be named main.
2. The function accepts exactly one argument with type list[str].
3. The function must be async. Use aiohttp for vector model service calls to avoid blocking.
"""
import time
import aiohttp
import json
import uuid

async def main(texts: list[str]):
    # Call the embedding service.
    url = "http://127.0.0.1:8316/v1/embeddings"
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer **************************"
    }
    payload = {"texts": texts}

    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status != 200:
                raise Exception(f"Embedding API failed with status {resp.status}")
            embeddings = await resp.json()
    # Build a standard OpenAI-style response body.
    response = {
        "object": "list",
        "data": [{
            "object": "embedding",
            "embedding": emb,
            "index": i
        } for i, emb in enumerate(embeddings)],
        "model": "custom",
        "usage": {
            "prompt_tokens": len(texts),
            "total_tokens": len(texts)
        },
        "id": f"infinity-{str(uuid.uuid4())}",
        "created": int(time.time())
    }
    return response`,
  reranker: `"""
1. The entry function must be named main.
2. The function accepts two arguments: query as str and documents as list[str].
3. The function must be async. Use aiohttp for vector model service calls to avoid blocking.
"""
import time
import aiohttp
import json
import uuid


async def main(query: str, documents: list[str]):
    # Call the reranker service.
    url = "http://127.0.0.1:8343/v1/reranker"
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer **************************"
    }
    payload = {
        "query": query,
        "slices": documents
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status != 200:
                raise Exception(f"Reranker API failed with status {resp.status}")
            scores = await resp.json()
    # Build a standard OpenAI-style response body.
    response = {
        "object": "rerank",
        "results": sorted([
            {
                "relevance_score": score,
                "index": idx,
                "document": None
            } for idx, score in enumerate(scores)
        ], key=lambda x: x["relevance_score"], reverse=True),
        "model": "custom",
        "usage": {
            "prompt_tokens": len(query) + sum(len(d) for d in documents),
            "total_tokens": len(query) + sum(len(d) for d in documents)
        },
        "id": f"infinity-{str(uuid.uuid4())}",
        "created": int(time.time())
    }
    return response`,
};

export function getAdaptationCodeTemplate(modelType: string): string {
  return ADAPTATION_CODE_TEMPLATES[modelType] ?? "";
}
