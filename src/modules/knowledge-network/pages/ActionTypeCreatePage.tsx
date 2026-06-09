import { ActionTypeFormScene } from "@/modules/knowledge-network/scenes/ActionTypeFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function ActionTypeCreatePage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage immersive>
      <ActionTypeFormScene mode="create" />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
