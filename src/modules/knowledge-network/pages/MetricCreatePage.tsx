import { MetricFormScene } from "@/modules/knowledge-network/scenes/MetricFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function MetricCreatePage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <MetricFormScene mode="create" />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
