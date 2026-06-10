import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkPreviewGraph,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

export function buildModelingPreviewGraph(
  objectTypes: KnowledgeNetworkObjectTypeRecord[],
  relationTypes: KnowledgeNetworkRelationTypeRecord[],
): KnowledgeNetworkPreviewGraph {
  const nodeIdSet = new Set(objectTypes.map((item) => item.id));

  return {
    nodes: objectTypes.map((item) => ({
      color: item.color || "#1677ff",
      icon: item.icon,
      id: item.id,
      name: item.name,
    })),
    edges: relationTypes
      .filter(
        (item) =>
          nodeIdSet.has(item.sourceObjectTypeId) && nodeIdSet.has(item.targetObjectTypeId),
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        sourceId: item.sourceObjectTypeId,
        targetId: item.targetObjectTypeId,
      })),
  };
}
