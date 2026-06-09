export type KnowledgeNetworkListSceneProps = {
  onOpenWorkspace?: (networkId: string) => void;
};

export type KnowledgeNetworkWorkspaceSection =
  | "overview"
  | "preview"
  | "concept-groups"
  | "object-types"
  | "relation-types"
  | "action-types"
  | "metrics"
  | "tasks";

export type KnowledgeNetworkWorkspaceSceneProps = {
  networkId?: string;
  onBack?: () => void;
  section: KnowledgeNetworkWorkspaceSection;
};
