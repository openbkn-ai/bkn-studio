import { RelationTypeMappingScene } from "@/modules/knowledge-network/scenes/RelationTypeMappingScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function RelationTypeMappingPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <RelationTypeMappingScene />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
