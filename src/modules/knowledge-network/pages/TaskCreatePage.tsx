import { TaskFormScene } from "@/modules/knowledge-network/scenes/TaskFormScene";
import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";

export function TaskCreatePage() {
  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <TaskFormScene />
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
