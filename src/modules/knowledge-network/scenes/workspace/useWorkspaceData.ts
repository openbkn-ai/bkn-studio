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
  listKnowledgeNetworkTasks,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  integrateWorkspaceMetrics,
  integrateWorkspaceTasks,
  logServiceFallback,
} from "@/modules/knowledge-network/services/shared/runtime";
import type {
  ConceptGroupRecord,
  KnowledgeNetworkActionTypeRecord,
  KnowledgeNetworkMetricRecord,
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRecord,
  KnowledgeNetworkRecentObject,
  KnowledgeNetworkRelationTypeRecord,
  KnowledgeNetworkTaskRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

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
  const [metricApiUnavailable, setMetricApiUnavailable] = useState(false);
  const [tasks, setTasks] = useState<KnowledgeNetworkTaskRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const loadedSectionsRef = useRef<Set<string>>(new Set());
  const recentLoadedRef = useRef(false);

  const clearSectionCache = useCallback(() => {
    loadedSectionsRef.current.clear();
    recentLoadedRef.current = false;
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
      setDetail(await getKnowledgeNetwork(networkId));
    } catch (error) {
      setDetail(null);
      setDetailError(extractRequestErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  }, [networkId]);

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
          case "preview": {
            const [objectTypeResult, relationTypeResult] = await Promise.all([
              listKnowledgeNetworkObjectTypes(networkId),
              listKnowledgeNetworkRelationTypes(networkId),
            ]);
            setObjectTypes(objectTypeResult);
            setRelationTypes(relationTypeResult);
            break;
          }
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
          case "metrics":
            if (integrateWorkspaceMetrics) {
              const metricResult = await listKnowledgeNetworkMetrics(networkId);
              setMetrics(metricResult.entries);
              setMetricApiUnavailable(getMetricApiAvailability() === "unsupported");
            }
            break;
          case "tasks":
            if (integrateWorkspaceTasks) {
              setTasks(await listKnowledgeNetworkTasks(networkId));
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
    [networkId],
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

    ["object-types", "preview", "relation-types", "action-types"].forEach((item) => {
      loadedSectionsRef.current.delete(sectionCacheKey(networkId, item as KnowledgeNetworkWorkspaceSection));
    });
    setObjectTypes(await listKnowledgeNetworkObjectTypes(networkId));
    loadedSectionsRef.current.add(sectionCacheKey(networkId, "object-types"));
  }, [networkId]);

  const reloadRelationTypes = useCallback(async () => {
    if (!networkId) {
      return;
    }

    ["relation-types", "preview"].forEach((item) => {
      loadedSectionsRef.current.delete(sectionCacheKey(networkId, item as KnowledgeNetworkWorkspaceSection));
    });
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

  const reloadMetrics = useCallback(async () => {
    if (!networkId || !integrateWorkspaceMetrics) {
      return;
    }

    loadedSectionsRef.current.delete(sectionCacheKey(networkId, "metrics"));
    const metricResult = await listKnowledgeNetworkMetrics(networkId);
    setMetrics(metricResult.entries);
    setMetricApiUnavailable(getMetricApiAvailability() === "unsupported");
    loadedSectionsRef.current.add(sectionCacheKey(networkId, "metrics"));
  }, [networkId]);

  const reloadTasks = useCallback(async () => {
    if (!networkId || !integrateWorkspaceTasks) {
      return;
    }

    loadedSectionsRef.current.delete(sectionCacheKey(networkId, "tasks"));
    setTasks(await listKnowledgeNetworkTasks(networkId));
    loadedSectionsRef.current.add(sectionCacheKey(networkId, "tasks"));
  }, [networkId]);

  return {
    actionTypes,
    conceptGroups,
    detail,
    detailError,
    detailLoading,
    integrateMetrics: integrateWorkspaceMetrics,
    integrateTasks: integrateWorkspaceTasks,
    loadError: detailError,
    loading: sectionLoading,
    loadWorkspaceData,
    loadRecentObjects,
    metricApiUnavailable,
    metrics,
    objectTypes,
    recentObjects,
    recentLoading,
    relationTypes,
    reloadActionTypes,
    reloadConceptGroups,
    reloadMetrics,
    reloadObjectTypes,
    reloadRelationTypes,
    reloadTasks,
    sectionError,
    sectionLoading,
    tasks,
  };
}
