export type KnowledgeNetworkListSceneProps = {
  onOpenWorkspace?: (networkId: string) => void;
};

export type KnowledgeNetworkWorkspaceSection =
  | "overview"
  | "preview"
  | "concept-groups"
  | "object-types"
  | "relation-types"
  | "action-types";

export type KnowledgeNetworkWorkspaceSceneProps = {
  networkId?: string;
  onBack?: () => void;
  section: KnowledgeNetworkWorkspaceSection;
};
