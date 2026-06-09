import { ConceptGroupFormScene } from "@/modules/knowledge-network/scenes/ConceptGroupFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function ConceptGroupCreatePage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <ConceptGroupFormScene mode="create" />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
