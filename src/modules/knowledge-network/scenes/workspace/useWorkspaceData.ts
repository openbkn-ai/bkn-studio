/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { useCapability } from "@/framework/entitlement/use-entitlement";
import type { KnowledgeNetworkWorkspaceSection } from "@/modules/knowledge-network/contracts/scenes";
import {
  getKnowledgeNetwork,
  getKnowledgeNetworkStatistics,
  listKnowledgeNetworkRecentObjects,
  listObjectMetricsV1,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import { listKnowledgeNetworkCapabilities } from "@/modules/knowledge-network/services/capability-binding.service";
import { logServiceFallback } from "@/modules/knowledge-network/services/shared/runtime";
import type {
  CapabilityBindingListResult,
  CapabilityType,
  KnowledgeNetworkRecord,
  KnowledgeNetworkRecentObject,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

import {
  clearMetricsTotalPending,
  commitMetricsTotalUpdate,
  createMetricsTotalPending,
  mergePendingMetricsTotalIntoDetail,
} from "./workspaceMetricsTotal";

/** Read every mounted row before splitting toolbox tools into Function and API sections. */
const CAPABILITY_SECTION_LIMIT = 1000;

/** Dynamic Model lists stored mounts; action executors stay in Action Type configuration. */
async function listAllCapabilities(
  networkId: string,
  type: CapabilityType,
): Promise<CapabilityBindingListResult> {
  const first = await listKnowledgeNetworkCapabilities(networkId, {
    limit: CAPABILITY_SECTION_LIMIT,
    mountedOnly: true,
    type,
    withDetail: true,
  });
  const entries = [...first.entries];
  const boxes = [...first.boxes];

  const pages = Math.ceil(first.totalCount / CAPABILITY_SECTION_LIMIT);
  for (let page = 1; page < pages; page += 1) {
    const next = await listKnowledgeNetworkCapabilities(networkId, {
      limit: CAPABILITY_SECTION_LIMIT,
      mountedOnly: true,
      offset: page * CAPABILITY_SECTION_LIMIT,
      type,
      withDetail: true,
    });
    entries.push(...next.entries);
    next.boxes.forEach((box) => {
      if (!boxes.some((known) => known.boxId === box.boxId)) {
        boxes.push(box);
      }
    });
  }

  // Older backends ignore mounted_only. Keep the view correct while the two services roll out.
  const mounted = entries.filter((entry) => entry.id !== "");
  const mountedBoxIds = new Set(mounted.map((entry) => entry.boxId));
  return {
    ...first,
    boxes: boxes.filter((box) => mountedBoxIds.has(box.boxId)),
    entries: mounted,
    totalCount: mounted.length,
  };
}

/**
 * Tool bindings come back as one list whatever the tool is; the backend tags each row with the kind
 * of toolset it belongs to, the same line the workspace draws between its two lists. A row without
 * the tag lands under functions, which is how functions_total counts it.
 */
function splitToolBindings(
  result: CapabilityBindingListResult,
): Record<"api" | "function", CapabilityBindingListResult> {
  const entriesByKind: Record<"api" | "function", CapabilityBindingListResult["entries"]> = {
    api: [],
    function: [],
  };
  result.entries.forEach((entry) => {
    entriesByKind[entry.metadataType === "openapi" ? "api" : "function"].push(entry);
  });

  const byKind = {} as Record<"api" | "function", CapabilityBindingListResult>;
  (["api", "function"] as const).forEach((kind) => {
    const entries = entriesByKind[kind];
    const boxIds = new Set(entries.map((entry) => entry.boxId));
    byKind[kind] = {
      boxes: result.boxes.filter((box) => boxIds.has(box.boxId)),
      entries,
      metadataAvailable: result.metadataAvailable,
      totalCount: entries.length,
    };
  });

  return byKind;
}

const EMPTY_CAPABILITY_RESULT: CapabilityBindingListResult = {
  boxes: [],
  entries: [],
  metadataAvailable: true,
  totalCount: 0,
};

type WorkspaceDataSection = KnowledgeNetworkWorkspaceSection | "extension";

function sectionCacheKey(networkId: string, section: WorkspaceDataSection) {
  return `${networkId}:${section}`;
}

/**
 * `reloadKey` changes when what the workspace reads changes under it, such as the version of a
 * versioned network on screen; everything is loaded again then.
 */
export function useWorkspaceData(networkId: string, section: WorkspaceDataSection, reloadKey = "") {
  const objectMetricsAvailable = useCapability(CAPABILITIES.OBJECT_METRICS) === "available";
  const [detail, setDetail] = useState<KnowledgeNetworkRecord | null>(null);
  const [recentObjects, setRecentObjects] = useState<KnowledgeNetworkRecentObject[]>([]);
  const [metrics, setMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [functions, setFunctions] = useState<CapabilityBindingListResult>(EMPTY_CAPABILITY_RESULT);
  const [apis, setApis] = useState<CapabilityBindingListResult>(EMPTY_CAPABILITY_RESULT);
  const [mcpTools, setMcpTools] = useState<CapabilityBindingListResult>(EMPTY_CAPABILITY_RESULT);
  const [skills, setSkills] = useState<CapabilityBindingListResult>(EMPTY_CAPABILITY_RESULT);
  const [detailLoading, setDetailLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const loadedSectionsRef = useRef<Set<string>>(new Set());
  const recentLoadedRef = useRef(false);
  const pendingMetricsTotalRef = useRef(createMetricsTotalPending());
  const detailRequestRef = useRef(0);
  const detailRef = useRef<KnowledgeNetworkRecord | null>(null);
  detailRef.current = detail;

  const clearSectionCache = useCallback(() => {
    loadedSectionsRef.current.clear();
    recentLoadedRef.current = false;
    clearMetricsTotalPending(pendingMetricsTotalRef.current);
  }, []);

  const applyMetricsTotalToDetail = useCallback((metricsTotal: number) => {
    const nextDetail = commitMetricsTotalUpdate(
      detailRef.current,
      metricsTotal,
      pendingMetricsTotalRef.current,
    );
    if (!nextDetail) {
      return;
    }

    detailRef.current = nextDetail;
    setDetail(nextDetail);
  }, []);

  const loadRecentObjects = useCallback(
    async (options?: { force?: boolean }) => {
      if (!networkId) {
        return;
      }

      if (!options?.force && recentLoadedRef.current) {
        return;
      }

      setRecentLoading(true);
      setSectionError(null);

      try {
        setRecentObjects(await listKnowledgeNetworkRecentObjects(networkId));
        recentLoadedRef.current = true;
      } catch (error) {
        logServiceFallback("useWorkspaceData.overview.recentObjects", error);
        setRecentObjects([]);
        setSectionError(extractRequestErrorMessage(error));
      } finally {
        setRecentLoading(false);
      }
    },
    [networkId],
  );

  const loadDetail = useCallback(async () => {
    if (!networkId) {
      return;
    }

    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setDetailLoading(true);
    setDetailError(null);

    try {
      const fetched = await getKnowledgeNetwork(networkId, { skipErrorToast: true });
      if (detailRequestRef.current !== requestId) {
        return;
      }
      const merged = fetched
        ? mergePendingMetricsTotalIntoDetail(fetched, pendingMetricsTotalRef.current)
        : null;
      detailRef.current = merged;
      setDetail(merged);

      void getKnowledgeNetworkStatistics(networkId)
        .then((statistics) => {
          if (!statistics || detailRequestRef.current !== requestId) {
            return;
          }
          const current = detailRef.current;
          if (!current || current.id !== networkId) {
            return;
          }
          const resolvedStatistics = loadedSectionsRef.current.has(
            sectionCacheKey(networkId, "metrics"),
          )
            ? { ...statistics, metricsTotal: current.statistics.metricsTotal }
            : statistics;
          const withStatistics = mergePendingMetricsTotalIntoDetail(
            { ...current, statistics: resolvedStatistics },
            pendingMetricsTotalRef.current,
          );
          detailRef.current = withStatistics;
          setDetail(withStatistics);
        })
        .catch((error) => {
          logServiceFallback("useWorkspaceData.statistics", error);
        });
    } catch (error) {
      if (detailRequestRef.current !== requestId) {
        return;
      }
      detailRef.current = null;
      setDetail(null);
      setDetailError(extractRequestErrorMessage(error));
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  }, [networkId]);

  const loadToolBindings = useCallback(async (targetNetworkId: string) => {
    const split = splitToolBindings(await listAllCapabilities(targetNetworkId, "function"));
    setFunctions(split.function);
    setApis(split.api);
  }, []);

  const loadSectionData = useCallback(
    async (targetSection: WorkspaceDataSection, options?: { force?: boolean }) => {
      if (!networkId) {
        return;
      }

      const cacheKey = sectionCacheKey(networkId, targetSection);
      if (!options?.force && loadedSectionsRef.current.has(cacheKey)) {
        return;
      }

      setSectionLoading(true);
      setSectionError(null);

      try {
        switch (targetSection) {
          case "overview":
            break;
          case "experience-agent":
          case "experience-mcp":
            break;
          case "concept-groups":
            break;
          case "object-types":
            break;
          case "relation-types": {
            break;
          }
          case "action-types": {
            break;
          }
          case "functions":
          case "apis":
            await loadToolBindings(networkId);
            break;
          case "mcp":
            setMcpTools(await listAllCapabilities(networkId, "mcp_tool"));
            break;
          case "skills":
            setSkills(await listAllCapabilities(networkId, "skill"));
            break;
          case "metrics":
            if (objectMetricsAvailable) {
              const metricResult = await listObjectMetricsV1(networkId, { limit: 500 });
              setMetrics(metricResult.entries);
              applyMetricsTotalToDetail(metricResult.total_count);
            }
            break;
          default:
            break;
        }

        loadedSectionsRef.current.add(cacheKey);
      } catch (error) {
        setSectionError(extractRequestErrorMessage(error));
      } finally {
        setSectionLoading(false);
      }
    },
    [networkId, applyMetricsTotalToDetail, loadToolBindings, objectMetricsAvailable],
  );

  useEffect(() => {
    clearSectionCache();
    setRecentObjects([]);
    void loadDetail();
  }, [clearSectionCache, loadDetail, networkId, reloadKey]);

  useEffect(() => {
    void loadSectionData(section);
  }, [loadSectionData, reloadKey, section]);

  const loadWorkspaceData = useCallback(async () => {
    clearSectionCache();
    await loadDetail();
    await loadSectionData(section, { force: true });
  }, [clearSectionCache, loadDetail, loadSectionData, section]);

  const reloadCapabilities = useCallback(
    async (capabilityType: CapabilityType) => {
      if (!networkId) {
        return;
      }

      const sections: KnowledgeNetworkWorkspaceSection[] =
        capabilityType === "function"
          ? ["functions", "apis"]
          : capabilityType === "mcp_tool"
            ? ["mcp"]
            : ["skills"];
      sections.forEach((section) => {
        loadedSectionsRef.current.delete(sectionCacheKey(networkId, section));
      });

      if (capabilityType === "function") {
        await loadToolBindings(networkId);
      } else if (capabilityType === "mcp_tool") {
        setMcpTools(await listAllCapabilities(networkId, "mcp_tool"));
      } else {
        setSkills(await listAllCapabilities(networkId, "skill"));
      }

      sections.forEach((section) => {
        loadedSectionsRef.current.add(sectionCacheKey(networkId, section));
      });
      // The nav count comes from the detail statistics, so a mount has to refresh it too.
      await loadDetail();
    },
    [loadDetail, loadToolBindings, networkId],
  );

  const reloadMetrics = useCallback(async () => {
    if (!networkId || !objectMetricsAvailable) {
      return;
    }

    loadedSectionsRef.current.delete(sectionCacheKey(networkId, "metrics"));
    const metricResult = await listObjectMetricsV1(networkId, { limit: 500 });
    setMetrics(metricResult.entries);
    applyMetricsTotalToDetail(metricResult.total_count);
    loadedSectionsRef.current.add(sectionCacheKey(networkId, "metrics"));
  }, [networkId, applyMetricsTotalToDetail, objectMetricsAvailable]);

  return {
    detail,
    detailError,
    detailLoading,
    loadError: detailError,
    loading: sectionLoading,
    loadWorkspaceData,
    loadRecentObjects,
    apis,
    functions,
    mcpTools,
    metrics,
    recentObjects,
    recentLoading,
    reloadCapabilities,
    reloadMetrics,
    sectionError,
    sectionLoading,
    skills,
  };
}
