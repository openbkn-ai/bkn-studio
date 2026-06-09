import { RelationTypeFormScene } from "@/modules/knowledge-network/scenes/RelationTypeFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function RelationTypeEditPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage immersive>
      <RelationTypeFormScene mode="edit" />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
