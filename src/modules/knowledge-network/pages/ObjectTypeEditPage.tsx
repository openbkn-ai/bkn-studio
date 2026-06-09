import { ObjectTypeFormScene } from "@/modules/knowledge-network/scenes/ObjectTypeFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function ObjectTypeEditPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage immersive>
      <ObjectTypeFormScene mode="edit" />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
