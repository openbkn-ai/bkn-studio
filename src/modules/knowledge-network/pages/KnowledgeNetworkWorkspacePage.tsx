import type { KnowledgeNetworkWorkspaceSection } from "@/modules/knowledge-network/contracts/scenes";
import { KnowledgeNetworkWorkspaceScene } from "@/modules/knowledge-network/scenes/KnowledgeNetworkWorkspaceScene";

type KnowledgeNetworkWorkspacePageProps = {
  section: KnowledgeNetworkWorkspaceSection;
};

export function KnowledgeNetworkWorkspacePage({
  section,
}: KnowledgeNetworkWorkspacePageProps) {
  return <KnowledgeNetworkWorkspaceScene section={section} />;
}
