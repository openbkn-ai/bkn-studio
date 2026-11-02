/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useMemo, useState } from "react";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { useCapability } from "@/framework/entitlement/use-entitlement";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import {
  actionCall,
  cypherCall,
  functionCall,
  metricCall,
  queryObjectsCall,
  searchCall,
  type SampleRow,
  type ToolCall,
} from "@/modules/knowledge-network/services/app-development-examples";
import {
  fetchFirstMountedFunction,
  fetchOAuthEndpoints,
  fetchPlatformVersion,
} from "@/modules/knowledge-network/services/app-development.service";
import type { OsdkRelation } from "@/modules/knowledge-network/services/app-development-osdk";
import type { OAuthEndpoints } from "@/modules/knowledge-network/services/app-development-render";
import {
  getKnowledgeNetworkActionTypeDetail,
  listKnowledgeNetworkActionTypes,
} from "@/modules/knowledge-network/services/action-type.service";
import {
  fetchKnDetailRest,
  fetchObjectInstances,
  fetchObjectTypes,
  listMcpTools,
  type ContextLoaderEnv,
  type KnDetail,
  type McpAuth,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";
import { listKnowledgeNetworkObjectTypes } from "@/modules/knowledge-network/services/object-type.service";

export type AppDevelopmentData = {
  platformVersion: string | null;
  /** null when the platform's tool definitions could not be read. */
  tools: McpToolDef[] | null;
  queryObjects: {
    call: ToolCall;
    objectTypeId: string;
    name: string;
    filtered: boolean;
    /** The sample instance, for the typed-package and agent examples too. */
    row: SampleRow | null;
    /** Property ids from the network's schema. */
    properties: string[];
    /** A relation that starts here and reaches data, for following it from the typed package. */
    relation?: OsdkRelation;
  } | null;
  /** Object types with data behind them, in the network's order, for the sample app's side list. */
  objectTypes: Array<{ id: string; name: string }>;
  cypher: { call: ToolCall; name: string; anchored: boolean } | null;
  search: { call: ToolCall; name: string } | null;
  /** undefined when the edition has no object metrics: the section is not shown at all. */
  metric?: { call: ToolCall; metricId: string; name: string; version: number } | null;
  action: { call: ToolCall; actionTypeId: string; name: string; createsObjects: boolean } | null;
  fn: { call: ToolCall; name: string } | null;
  /** null when the platform's OAuth metadata could not be read. */
  oauth: OAuthEndpoints | null;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AppDevelopmentData };

/** At most this many object types are read for metrics; the page needs only the first one. */
const METRIC_SCAN_LIMIT = 50;

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

async function loadAppDevelopmentData(
  env: ContextLoaderEnv,
  auth: McpAuth,
  networkId: string,
  metricsAvailable: boolean,
  signal: AbortSignal,
): Promise<AppDevelopmentData> {
  const [detailResult, indexResult, actionsResult, fnResult, versionResult, toolsResult, oauth] =
    await Promise.allSettled([
      fetchKnDetailRest(env, auth, signal),
      listKnowledgeNetworkObjectTypes(networkId, { skipErrorToast: true }),
      listKnowledgeNetworkActionTypes(networkId),
      fetchFirstMountedFunction(env, auth, signal),
      fetchPlatformVersion(),
      listMcpTools(env, auth, signal),
      fetchOAuthEndpoints(signal),
    ]);
  if (detailResult.status === "rejected") throw detailResult.reason;
  const detail: KnDetail = detailResult.value;
  const knId = env.knId;

  const samples = new Map<string, Promise<SampleRow | null>>();
  const sample = (objectTypeId: string) => {
    let row = samples.get(objectTypeId);
    if (!row) {
      row = fetchObjectInstances(env, objectTypeId, 1, auth, signal)
        .then((rows) => rows[0] ?? null)
        .catch(() => null);
      samples.set(objectTypeId, row);
    }
    return row;
  };

  const queryable = detail.object_types.filter((objectType) => objectType.data_source?.id);
  const queryableIds = new Set(queryable.map((objectType) => objectType.id));
  const objectTypeOf = (objectTypeId: string) =>
    detail.object_types.find((objectType) => objectType.id === objectTypeId);
  const nameOf = (objectTypeId: string) => objectTypeOf(objectTypeId)?.name ?? objectTypeId;
  const propertiesOf = (objectTypeId: string) =>
    (objectTypeOf(objectTypeId)?.data_properties ?? []).map((property) => property.name);
  /** A relation from here whose far end has data, so following it returns rows. */
  const relationFrom = (objectTypeId: string, except?: string) =>
    detail.relation_types.find(
      (item) =>
        item.sourceId === objectTypeId && item.id !== except && queryableIds.has(item.targetId),
    );

  const osdkRelation = (objectTypeId: string): OsdkRelation | undefined => {
    const first = relationFrom(objectTypeId);
    if (!first) return undefined;
    const next = relationFrom(first.targetId, first.id);
    return {
      id: first.id,
      name: first.name ?? first.id,
      targetId: first.targetId,
      targetName: nameOf(first.targetId),
      targetProperties: propertiesOf(first.targetId),
      next: next
        ? { id: next.id, name: next.name ?? next.id, targetName: nameOf(next.targetId) }
        : undefined,
    };
  };

  const queryObjects = async () => {
    const objectType = queryable.at(0);
    if (!objectType) return null;
    const row = await sample(objectType.id);
    const { call, filtered } = queryObjectsCall(knId, objectType.id, row);
    return {
      call,
      objectTypeId: objectType.id,
      name: objectType.name ?? objectType.id,
      filtered,
      row,
      properties: propertiesOf(objectType.id),
      relation: osdkRelation(objectType.id),
    };
  };

  const cypher = async () => {
    const relation = detail.relation_types.find(
      (item) => queryableIds.has(item.sourceId) && queryableIds.has(item.targetId),
    );
    if (!relation) return null;
    const [sourceRow, targetRow] = await Promise.all([
      sample(relation.sourceId),
      sample(relation.targetId),
    ]);
    const { call, anchored } = cypherCall(knId, relation, sourceRow, targetRow);
    return { call, name: relation.name ?? relation.id, anchored };
  };

  const indexState = new Map(
    (settled(indexResult) ?? []).map((record) => [record.id, record.indexStatus?.state]),
  );
  const searchable = detail.object_types.find(
    (objectType) => indexState.get(objectType.id) === "available",
  );
  const search = searchable
    ? {
        call: searchCall(knId, searchable.name ?? searchable.id),
        name: searchable.name ?? searchable.id,
      }
    : null;

  const metric = async () => {
    if (!metricsAvailable) return undefined;
    const ids = queryable.slice(0, METRIC_SCAN_LIMIT).map((objectType) => objectType.id);
    if (ids.length === 0) return null;
    const objectTypes = await fetchObjectTypes(env, ids, auth, signal).catch(() => []);
    for (const objectType of objectTypes) {
      for (const item of objectType.related_metrics ?? []) {
        if (item.id && typeof item.version === "number") {
          return {
            call: metricCall(knId, item.id, item.version),
            metricId: item.id,
            name: item.name ?? item.id,
            version: item.version,
          };
        }
      }
    }
    return null;
  };

  const action = async () => {
    const first = settled(actionsResult)?.at(0);
    if (!first) return null;
    const actionDetail = await getKnowledgeNetworkActionTypeDetail(networkId, first.id).catch(
      () => null,
    );
    const inputs = (actionDetail?.executionConfig.parameters ?? [])
      .filter((parameter) => parameter.valueFrom === "input")
      .map((parameter) => ({ name: parameter.name, type: parameter.type }));
    const createsObjects = first.actionKind === "create";
    const targetRow =
      !createsObjects && queryableIds.has(first.objectTypeId)
        ? await sample(first.objectTypeId)
        : null;
    return {
      call: actionCall(knId, first.id, inputs, targetRow, { createsObjects }),
      actionTypeId: first.id,
      name: first.name || first.id,
      createsObjects,
    };
  };

  const mounted = settled(fnResult);
  const fn = mounted
    ? {
        call: functionCall(knId, mounted.toolboxId, mounted.toolId, mounted.inputSchema),
        name: mounted.name,
      }
    : null;

  const [queryObjectsData, cypherData, metricData, actionData] = await Promise.all([
    queryObjects(),
    cypher(),
    metric(),
    action(),
  ]);

  return {
    platformVersion: settled(versionResult),
    tools: settled(toolsResult),
    queryObjects: queryObjectsData,
    objectTypes: queryable.map((objectType) => ({
      id: objectType.id,
      name: objectType.name ?? objectType.id,
    })),
    cypher: cypherData,
    search,
    metric: metricData,
    action: actionData,
    fn,
    oauth: settled(oauth),
  };
}

/** Everything the page renders, read once per network; nothing here writes. */
export function useAppDevelopmentData(networkId: string, knId: string) {
  const runtimeConfig = useRuntimeConfig();
  const metricsAvailable = useCapability(CAPABILITIES.OBJECT_METRICS) === "available";
  const [state, setState] = useState<State>({ status: "loading" });

  const auth = useMemo<McpAuth>(
    () => ({
      getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
      refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
    }),
    [runtimeConfig],
  );
  const env = useMemo<ContextLoaderEnv>(
    () => ({ base: window.location.origin, token: auth.getToken?.() ?? "", knId }),
    [auth, knId],
  );

  useEffect(() => {
    if (!networkId || !knId) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    loadAppDevelopmentData(env, auth, networkId, metricsAvailable, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });
    return () => controller.abort();
  }, [auth, env, knId, metricsAvailable, networkId]);

  return { state, env, auth };
}
