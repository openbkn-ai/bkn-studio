import { RelationTypeFormScene } from "@/modules/knowledge-network/scenes/RelationTypeFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function RelationTypeCreatePage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage immersive>
      <RelationTypeFormScene mode="create" />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
