import { ActionTypeFormScene } from "@/modules/knowledge-network/scenes/ActionTypeFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function ActionTypeEditPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage immersive>
      <ActionTypeFormScene mode="edit" />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
