/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useMemo, useState } from "react";

import { useAppServices } from "@/framework/context/use-app-services";
import type { CypherCompletionSchema } from "@/modules/knowledge-network/cypher/cypher-completion";
import { getObjectTypeProperties } from "@/modules/knowledge-network/cypher/cypher-query.service";
import type { AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import {
  fetchKnDetailRest,
  type ContextLoaderEnv,
} from "@/modules/knowledge-network/services/context-loader.service";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/network.service";
import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/network";

const EMPTY_SCHEMA: CypherCompletionSchema = { objectTypes: [], relationTypes: [], properties: {} };
const PROPERTY_BATCH = 20;

/**
 * The network a Cypher function queries, with what its editor completes and its trial run
 * needs: the record (the stored kn_id is the network's id), the Context Loader environment
 * (which names the network by its identifier) and the network's labels, relationship types
 * and properties.
 */
export function useCypherNetwork(knId: string | undefined) {
  const { runtimeConfig } = useAppServices();
  const [base] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const tokenProvider = useMemo<AgentTokenProvider>(
    () => ({
      getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
      refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
    }),
    [runtimeConfig],
  );
  const [network, setNetwork] = useState<KnowledgeNetworkRecord | null>(null);
  const [schema, setSchema] = useState<CypherCompletionSchema>(EMPTY_SCHEMA);

  useEffect(() => {
    let cancelled = false;
    if (!knId) {
      setNetwork(null);
      return;
    }
    if (network?.id === knId) return;
    void getKnowledgeNetwork(knId, { skipErrorToast: true })
      .then((record) => {
        if (!cancelled) setNetwork(record);
      })
      .catch(() => {
        if (!cancelled) setNetwork(null);
      });
    return () => {
      cancelled = true;
    };
  }, [knId, network?.id]);

  const env = useMemo<ContextLoaderEnv | null>(
    () =>
      network
        ? { base, token: tokenProvider.getToken(), knId: network.identifier || network.id }
        : null,
    [base, network, tokenProvider],
  );

  useEffect(() => {
    setSchema(EMPTY_SCHEMA);
    if (!env) return;
    const controller = new AbortController();
    // Completion helps but is not needed: a network whose schema cannot be read still edits.
    void fetchKnDetailRest(env, tokenProvider, controller.signal)
      .then(async (detail) => {
        if (controller.signal.aborted) return;
        setSchema({
          objectTypes: detail.object_types.map((item) => ({
            id: item.id,
            name: item.name?.trim() || item.id,
          })),
          relationTypes: detail.relation_types.map((item) => ({
            id: item.id,
            name: item.name?.trim() || item.id,
            sourceId: item.sourceId,
            targetId: item.targetId,
          })),
          properties: {},
        });
        const ids = detail.object_types.map((item) => item.id);
        for (let start = 0; start < ids.length; start += PROPERTY_BATCH) {
          const part = await getObjectTypeProperties({
            env,
            auth: tokenProvider,
            objectTypeIds: ids.slice(start, start + PROPERTY_BATCH),
            signal: controller.signal,
          }).catch(() => ({}));
          if (controller.signal.aborted) return;
          setSchema((current) => ({
            ...current,
            properties: { ...current.properties, ...part },
          }));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [env, tokenProvider]);

  return { base, network, setNetwork, env, tokenProvider, schema };
}
