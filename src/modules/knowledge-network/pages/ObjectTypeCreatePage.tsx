import { ObjectTypeFormScene } from "@/modules/knowledge-network/scenes/ObjectTypeFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function ObjectTypeCreatePage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage immersive>
      <ObjectTypeFormScene mode="create" />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
