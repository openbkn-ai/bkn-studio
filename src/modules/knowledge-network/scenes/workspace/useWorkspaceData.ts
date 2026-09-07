/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import type { KnowledgeNetworkWorkspaceSection } from "@/modules/knowledge-network/contracts/scenes";
import {
  getKnowledgeNetwork,
  listKnowledgeNetworkActionTypes,
  getMetricApiAvailability,
  listKnowledgeNetworkConceptGroups,
  listKnowledgeNetworkMetrics,
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRecentObjects,
  listKnowledgeNetworkRelationTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import { listKnowledgeNetworkCapabilities } from "@/modules/knowledge-network/services/capability-binding.service";
import {
  integrateWorkspaceMetrics,
  logServiceFallback,
} from "@/modules/knowledge-network/services/shared/runtime";
import type {
  CapabilityBindingListResult,
  CapabilityType,
  ConceptGroupRecord,
  KnowledgeNetworkActionTypeRecord,
  KnowledgeNetworkMetricRecord,
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRecord,
  KnowledgeNetworkRecentObject,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import {
  clearMetricsTotalPending,
  commitMetricsTotalUpdate,
  createMetricsTotalPending,
  mergePendingMetricsTotalIntoDetail,
} from "./workspaceMetricsTotal";

/**
 * The backend appends model-referenced capabilities only to a page that reaches the end of the
 * stored rows, so a short page would drop them. Ask for the largest page it accepts, which covers
 * any real network in one read; the loop below stays for the pathological case.
 */
const CAPABILITY_SECTION_LIMIT = 1000;

/** Enough pages for any real network; a truncated read would understate the nav counts. */
const CAPABILITY_MAX_PAGES = 10;

/**
 * Tool bindings drive both list pages and both nav counts, and the split between API and function
 * can only be made on entries this client holds. Reading one page would silently undercount a
 * network with more bindings than the page size, so walk the pages until the reported total is in.
 */
async function listAllCapabilities(
  networkId: string,
  type: CapabilityType,
): Promise<CapabilityBindingListResult> {
  const first = await listKnowledgeNetworkCapabilities(networkId, {
    limit: CAPABILITY_SECTION_LIMIT,
    type,
    withDetail: true,
  });
  const entries = [...first.entries];
  const boxes = [...first.boxes];

  const pages = Math.min(
    Math.ceil(first.totalCount / CAPABILITY_SECTION_LIMIT),
    CAPABILITY_MAX_PAGES,
  );
  for (let page = 1; page < pages; page += 1) {
    const next = await listKnowledgeNetworkCapabilities(networkId, {
      limit: CAPABILITY_SECTION_LIMIT,
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

  return { ...first, boxes, entries };
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

function sectionCacheKey(networkId: string, section: KnowledgeNetworkWorkspaceSection) {
  return `${networkId}:${section}`;
}

export function useWorkspaceData(
  networkId: string,
  section: KnowledgeNetworkWorkspaceSection,
) {
  const [detail, setDetail] = useState<KnowledgeNetworkRecord | null>(null);
  const [recentObjects, setRecentObjects] = useState<KnowledgeNetworkRecentObject[]>([]);
  const [conceptGroups, setConceptGroups] = useState<ConceptGroupRecord[]>([]);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [relationTypes, setRelationTypes] = useState<KnowledgeNetworkRelationTypeRecord[]>(
    [],
  );
  const [actionTypes, setActionTypes] = useState<KnowledgeNetworkActionTypeRecord[]>([]);
  const [metrics, setMetrics] = useState<KnowledgeNetworkMetricRecord[]>([]);
  const [functions, setFunctions] = useState<CapabilityBindingListResult>(
    EMPTY_CAPABILITY_RESULT,
  );
  const [apis, setApis] = useState<CapabilityBindingListResult>(EMPTY_CAPABILITY_RESULT);
  const [mcpTools, setMcpTools] = useState<CapabilityBindingListResult>(
    EMPTY_CAPABILITY_RESULT,
  );
  const [skills, setSkills] = useState<CapabilityBindingListResult>(EMPTY_CAPABILITY_RESULT);
  const [metricApiUnavailable, setMetricApiUnavailable] = useState(false);
  const [detailLoading, setDetailLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const loadedSectionsRef = useRef<Set<string>>(new Set());
  const recentLoadedRef = useRef(false);
  const pendingMetricsTotalRef = useRef(createMetricsTotalPending());
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

    setDetailLoading(true);
    setDetailError(null);

    try {
      const fetched = await getKnowledgeNetwork(networkId);
      const merged = fetched
        ? mergePendingMetricsTotalIntoDetail(fetched, pendingMetricsTotalRef.current)
        : null;
      detailRef.current = merged;
      setDetail(merged);
    } catch (error) {
      detailRef.current = null;
      setDetail(null);
      setDetailError(extractRequestErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  }, [networkId]);

  const loadToolBindings = useCallback(async (targetNetworkId: string) => {
    const split = splitToolBindings(await listAllCapabilities(targetNetworkId, "function"));
    setFunctions(split.function);
    setApis(split.api);
  }, []);

  const loadSectionData = useCallback(
    async (targetSection: KnowledgeNetworkWorkspaceSection, options?: { force?: boolean }) => {
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
            setConceptGroups(await listKnowledgeNetworkConceptGroups(networkId));
            break;
          case "object-types":
            setObjectTypes(await listKnowledgeNetworkObjectTypes(networkId));
            break;
          case "relation-types": {
            const [objectTypeResult, relationTypeResult] = await Promise.all([
              listKnowledgeNetworkObjectTypes(networkId),
              listKnowledgeNetworkRelationTypes(networkId),
            ]);
            setObjectTypes(objectTypeResult);
            setRelationTypes(relationTypeResult);
            break;
          }
          case "action-types": {
            const [objectTypeResult, actionTypeResult] = await Promise.all([
              listKnowledgeNetworkObjectTypes(networkId),
              listKnowledgeNetworkActionTypes(networkId),
            ]);
            setObjectTypes(objectTypeResult);
            setActionTypes(actionTypeResult);
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
            if (integrateWorkspaceMetrics) {
              const metricResult = await listKnowledgeNetworkMetrics(networkId);
              setMetrics(metricResult.entries);
              applyMetricsTotalToDetail(metricResult.totalCount);
              setMetricApiUnavailable(getMetricApiAvailability() === "unsupported");
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
    [networkId, applyMetricsTotalToDetail, loadToolBindings],
  );

  useEffect(() => {
    clearSectionCache();
    setRecentObjects([]);
    void loadDetail();
  }, [clearSectionCache, loadDetail, networkId]);

  useEffect(() => {
    void loadSectionData(section);
  }, [loadSectionData, section]);

  const loadWorkspaceData = useCallback(async () => {
    clearSectionCache();
    await loadDetail();
    await loadSectionData(section, { force: true });
  }, [clearSectionCache, loadDetail, loadSectionData, section]);

  const reloadConceptGroups = useCallback(async () => {
    if (!networkId) {
      return;
    }

    loadedSectionsRef.current.delete(sectionCacheKey(networkId, "concept-groups"));
    setConceptGroups(await listKnowledgeNetworkConceptGroups(networkId));
    loadedSectionsRef.current.add(sectionCacheKey(networkId, "concept-groups"));
  }, [networkId]);

  const reloadObjectTypes = useCallback(async () => {
    if (!networkId) {
      return;
    }

    ["object-types", "relation-types", "action-types"].forEach((item) => {
      loadedSectionsRef.current.delete(
        sectionCacheKey(networkId, item as KnowledgeNetworkWorkspaceSection),
      );
    });
    setObjectTypes(await listKnowledgeNetworkObjectTypes(networkId));
    loadedSectionsRef.current.add(sectionCacheKey(networkId, "object-types"));
  }, [networkId]);

  const reloadRelationTypes = useCallback(async () => {
    if (!networkId) {
      return;
    }

    loadedSectionsRef.current.delete(sectionCacheKey(networkId, "relation-types"));
    setRelationTypes(await listKnowledgeNetworkRelationTypes(networkId));
    loadedSectionsRef.current.add(sectionCacheKey(networkId, "relation-types"));
  }, [networkId]);

  const reloadActionTypes = useCallback(async () => {
    if (!networkId) {
      return;
    }

    loadedSectionsRef.current.delete(sectionCacheKey(networkId, "action-types"));
    setActionTypes(await listKnowledgeNetworkActionTypes(networkId));
    loadedSectionsRef.current.add(sectionCacheKey(networkId, "action-types"));
  }, [networkId]);

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
    if (!networkId || !integrateWorkspaceMetrics) {
      return;
    }

    loadedSectionsRef.current.delete(sectionCacheKey(networkId, "metrics"));
    const metricResult = await listKnowledgeNetworkMetrics(networkId);
    setMetrics(metricResult.entries);
    applyMetricsTotalToDetail(metricResult.totalCount);
    setMetricApiUnavailable(getMetricApiAvailability() === "unsupported");
    loadedSectionsRef.current.add(sectionCacheKey(networkId, "metrics"));
  }, [networkId, applyMetricsTotalToDetail]);

  return {
    actionTypes,
    conceptGroups,
    detail,
    detailError,
    detailLoading,
    integrateMetrics: integrateWorkspaceMetrics,
    loadError: detailError,
    loading: sectionLoading,
    loadWorkspaceData,
    loadRecentObjects,
    apis,
    functions,
    mcpTools,
    metricApiUnavailable,
    metrics,
    objectTypes,
    recentObjects,
    recentLoading,
    relationTypes,
    reloadActionTypes,
    reloadCapabilities,
    reloadConceptGroups,
    reloadMetrics,
    reloadObjectTypes,
    reloadRelationTypes,
    sectionError,
    sectionLoading,
    skills,
  };
}
