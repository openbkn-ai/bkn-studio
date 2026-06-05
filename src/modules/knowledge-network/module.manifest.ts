export const knowledgeNetworkModuleManifest = {
  id: "knowledge-network",
  name: "Knowledge Network",
  permissions: [
    "knowledge-network:create",
    "knowledge-network:edit",
    "knowledge-network:delete",
    "knowledge-network:import",
    "knowledge-network:export",
    "knowledge-network:preview",
    "knowledge-network:concept-group:view",
  ],
  requiresShell: true,
  supportsEmbedded: false,
  supportsReadOnly: false,
  services: [
    "bkn-backend/knowledge-networks",
    "bkn-backend/concept-groups",
    "bkn-backend/object-types",
    "ontology-query/subgraph",
  ],
  scenes: [
    {
      id: "knowledge-network.list",
      exportName: "KnowledgeNetworkListScene",
      description:
        "Manage knowledge networks, search cards, and launch the main workspace.",
      inputs: ["onOpenWorkspace?"],
    },
    {
      id: "knowledge-network.workspace",
      exportName: "KnowledgeNetworkWorkspaceScene",
      description:
        "Render the phase-one workspace shell for overview, preview, and concept groups.",
      inputs: ["networkId?", "section", "onBack?"],
    },
  ],
} as const;
