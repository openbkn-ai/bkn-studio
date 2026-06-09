import { MetricDataQueryScene } from "@/modules/knowledge-network/scenes/MetricDataQueryScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function MetricDataQueryPage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <MetricDataQueryScene />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
