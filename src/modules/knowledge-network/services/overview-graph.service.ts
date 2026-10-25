/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type { KnowledgeNetworkOverviewGraph } from "@/modules/knowledge-network/types/knowledge-network";
import { useMock, wait } from "@/modules/knowledge-network/services/shared/runtime";
import {
  mockObjectTypes,
  mockRelationTypes,
} from "@/modules/knowledge-network/services/mock/state";

type BackendOverviewGraph = {
  edges: Array<{
    id: string;
    mapping_mode?: "direct" | "filtered_cross_join" | "indirect";
    name: string;
    source_id: string;
    target_id: string;
  }>;
  next_cursor?: string;
  nodes: Array<{
    color?: string;
    concept_groups?: Array<{ id: string; name: string }>;
    degree?: number;
    icon?: string;
    id: string;
    index_status?: {
      state?: "available" | "unavailable" | "unknown" | "resource_missing" | "not_applicable";
      source_status?: string;
    };
    name: string;
  }>;
  object_type_total: number;
  relation_type_total: number;
  returned_edges: number;
  returned_nodes: number;
  snapshot: string;
  truncated: boolean;
};

export type KnowledgeNetworkOverviewGraphQuery = {
  conceptGroupId?: string;
  cursor?: string;
  edgeLimit?: number;
  expandDepth?: 1 | 2;
  focusObjectTypeId?: string;
  nodeLimit?: number;
};

function mapOverviewGraph(value: BackendOverviewGraph): KnowledgeNetworkOverviewGraph {
  return {
    graph: {
      edges: value.edges.map((edge) => ({
        id: edge.id,
        mappingMode: edge.mapping_mode === "indirect" ? "resource" : "direct",
        name: edge.name,
        sourceId: edge.source_id,
        targetId: edge.target_id,
      })),
      nodes: value.nodes.map((node) => ({
        color: node.color?.trim() || "#1677ff",
        conceptGroups: node.concept_groups,
        icon: node.icon,
        id: node.id,
        indexStatus: node.index_status?.state
          ? { state: node.index_status.state, sourceStatus: node.index_status.source_status }
          : undefined,
        name: node.name,
      })),
    },
    nextCursor: value.next_cursor,
    objectTypeTotal: value.object_type_total,
    relationTypeTotal: value.relation_type_total,
    snapshot: value.snapshot,
    truncated: value.truncated,
  };
}

export async function getKnowledgeNetworkOverviewGraph(
  networkId: string,
  query: KnowledgeNetworkOverviewGraphQuery = {},
): Promise<KnowledgeNetworkOverviewGraph> {
  if (useMock) {
    const nodeLimit = query.nodeLimit ?? 60;
    const edgeLimit = query.edgeLimit ?? 120;
    const scopedObjects = (mockObjectTypes[networkId] ?? []).filter(
      (item) => !query.conceptGroupId || item.conceptGroupIds.includes(query.conceptGroupId),
    );
    const scopedObjectIds = new Set(scopedObjects.map((item) => item.id));
    const scopedRelations = (mockRelationTypes[networkId] ?? []).filter(
      (item) =>
        scopedObjectIds.has(item.sourceObjectTypeId) &&
        scopedObjectIds.has(item.targetObjectTypeId),
    );
    const cursorMatch = /^mock:(\d+):(\d+)$/.exec(query.cursor ?? "");
    const nodeOffset = cursorMatch ? Number(cursorMatch[1]) : 0;
    const edgeOffset = cursorMatch ? Number(cursorMatch[2]) : 0;
    const objects = scopedObjects.slice(nodeOffset, nodeOffset + nodeLimit);
    const pageObjectIds = new Set(objects.map((item) => item.id));
    const relations = query.conceptGroupId
      ? scopedRelations.slice(edgeOffset, edgeOffset + edgeLimit)
      : scopedRelations
          .filter(
            (item) =>
              pageObjectIds.has(item.sourceObjectTypeId) &&
              pageObjectIds.has(item.targetObjectTypeId),
          )
          .slice(0, edgeLimit);
    const nextNodeOffset = nodeOffset + objects.length;
    const nextEdgeOffset = query.conceptGroupId ? edgeOffset + relations.length : 0;
    const hasNext = query.conceptGroupId
      ? nextNodeOffset < scopedObjects.length || nextEdgeOffset < scopedRelations.length
      : nextNodeOffset < scopedObjects.length;
    return wait({
      graph: {
        nodes: objects.map((item) => ({
          color: item.color,
          icon: item.icon,
          id: item.id,
          indexStatus: item.indexStatus,
          name: item.name,
          conceptGroups: item.conceptGroupIds.map((id, index) => ({
            id,
            name: item.conceptGroupNames[index] ?? id,
          })),
        })),
        edges: relations.map((item) => ({
          id: item.id,
          mappingMode: item.mappingMode,
          name: item.name,
          sourceId: item.sourceObjectTypeId,
          targetId: item.targetObjectTypeId,
        })),
      },
      objectTypeTotal: scopedObjects.length,
      relationTypeTotal: scopedRelations.length,
      nextCursor: hasNext ? `mock:${nextNodeOffset}:${nextEdgeOffset}` : undefined,
      snapshot: "mock",
      truncated: hasNext,
    });
  }

  const response = await http.get<BackendOverviewGraph>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/overview-graph`,
    {
      params: {
        concept_group_id: query.conceptGroupId,
        cursor: query.cursor,
        edge_limit: query.edgeLimit ?? 120,
        expand_depth: query.expandDepth,
        focus_object_type_id: query.focusObjectTypeId,
        node_limit: query.nodeLimit ?? 60,
      },
    },
  );
  return mapOverviewGraph(response.data);
}
