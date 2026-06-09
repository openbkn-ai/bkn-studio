import { useCallback, useEffect, useState } from "react";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  getKnowledgeNetwork,
  getKnowledgeNetworkPreviewGraph,
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
} from "@/modules/knowledge-network/services/shared/runtime";
import type {
  ConceptGroupRecord,
  KnowledgeNetworkActionTypeRecord,
  KnowledgeNetworkMetricRecord,
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkPreviewGraph,
  KnowledgeNetworkRecord,
  KnowledgeNetworkRecentObject,
  KnowledgeNetworkRelationTypeRecord,
  KnowledgeNetworkTaskRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

export function useWorkspaceData(networkId: string) {
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
  const [previewGraph, setPreviewGraph] = useState<KnowledgeNetworkPreviewGraph>({
    edges: [],
    nodes: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadWorkspaceData = useCallback(async () => {
    if (!networkId) {
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [
        detailResult,
        objectResult,
        groupResult,
        previewResult,
        objectTypeResult,
        relationTypeResult,
        actionTypeResult,
        metricResult,
        taskResult,
      ] = await Promise.all([
        getKnowledgeNetwork(networkId),
        listKnowledgeNetworkRecentObjects(networkId),
        listKnowledgeNetworkConceptGroups(networkId),
        getKnowledgeNetworkPreviewGraph(networkId),
        listKnowledgeNetworkObjectTypes(networkId),
        listKnowledgeNetworkRelationTypes(networkId),
        listKnowledgeNetworkActionTypes(networkId),
        integrateWorkspaceMetrics
          ? listKnowledgeNetworkMetrics(networkId)
          : Promise.resolve([]),
        integrateWorkspaceTasks
          ? listKnowledgeNetworkTasks(networkId)
          : Promise.resolve([]),
      ]);

      setDetail(detailResult);
      setRecentObjects(objectResult);
      setConceptGroups(groupResult);
      setPreviewGraph(previewResult);
      setObjectTypes(objectTypeResult);
      setRelationTypes(relationTypeResult);
      setActionTypes(actionTypeResult);
      setMetrics(metricResult);
      setMetricApiUnavailable(getMetricApiAvailability() === "unsupported");
      setTasks(taskResult);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  const reloadConceptGroups = useCallback(async () => {
    if (!networkId) {
      return;
    }

    setConceptGroups(await listKnowledgeNetworkConceptGroups(networkId));
  }, [networkId]);

  const reloadObjectTypes = useCallback(async () => {
    if (!networkId) {
      return;
    }

    setObjectTypes(await listKnowledgeNetworkObjectTypes(networkId));
  }, [networkId]);

  const reloadRelationTypes = useCallback(async () => {
    if (!networkId) {
      return;
    }

    setRelationTypes(await listKnowledgeNetworkRelationTypes(networkId));
  }, [networkId]);

  const reloadActionTypes = useCallback(async () => {
    if (!networkId) {
      return;
    }

    setActionTypes(await listKnowledgeNetworkActionTypes(networkId));
  }, [networkId]);

  const reloadMetrics = useCallback(async () => {
    if (!networkId || !integrateWorkspaceMetrics) {
      return;
    }

    setMetrics(await listKnowledgeNetworkMetrics(networkId));
    setMetricApiUnavailable(getMetricApiAvailability() === "unsupported");
  }, [networkId]);

  const reloadTasks = useCallback(async () => {
    if (!networkId || !integrateWorkspaceTasks) {
      return;
    }

    setTasks(await listKnowledgeNetworkTasks(networkId));
  }, [networkId]);

  return {
    actionTypes,
    conceptGroups,
    detail,
    integrateMetrics: integrateWorkspaceMetrics,
    integrateTasks: integrateWorkspaceTasks,
    loadError,
    loading,
    loadWorkspaceData,
    metricApiUnavailable,
    metrics,
    objectTypes,
    previewGraph,
    recentObjects,
    relationTypes,
    reloadActionTypes,
    reloadConceptGroups,
    reloadMetrics,
    reloadObjectTypes,
    reloadRelationTypes,
    reloadTasks,
    tasks,
  };
}
