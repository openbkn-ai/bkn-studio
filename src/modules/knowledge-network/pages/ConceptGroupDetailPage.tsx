import { ConceptGroupDetailScene } from "@/modules/knowledge-network/scenes/ConceptGroupDetailScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function ConceptGroupDetailPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <ConceptGroupDetailScene />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
