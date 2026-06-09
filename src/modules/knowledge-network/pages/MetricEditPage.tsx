import { MetricFormScene } from "@/modules/knowledge-network/scenes/MetricFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function MetricEditPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <MetricFormScene mode="edit" />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
