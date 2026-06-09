import { ConceptGroupFormScene } from "@/modules/knowledge-network/scenes/ConceptGroupFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function ConceptGroupEditPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <ConceptGroupFormScene mode="edit" />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
