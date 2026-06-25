import { knowledgeNetworkLabPermissionList } from "./permissions";

export const knowledgeNetworkLabModuleManifest = {
  id: "knowledge-network-lab",
  name: "Knowledge Network Lab",
  permissions: knowledgeNetworkLabPermissionList,
  requiresShell: true,
  supportsEmbedded: false,
  supportsReadOnly: false,
  services: [
    "bkn-backend/knowledge-networks",
    "bkn-backend/object-types",
    "bkn-backend/relation-types",
    "ontology-query/metrics-data",
  ],
  scenes: [
    {
      id: "knowledge-network-lab.list",
      exportName: "DomainNetworkLabListScene",
      description: "Experimental domain knowledge network browser (ontology cards).",
      inputs: [],
    },
    {
      id: "knowledge-network-lab.detail",
      exportName: "DomainNetworkLabDetailScene",
      description: "Ontology graph, entity/relation classes, and data binding for a domain network.",
      inputs: [],
    },
    {
      id: "knowledge-network-lab.debug",
      exportName: "DomainNetworkLabDebugScene",
      description: "Retrieval sandbox / API debugger for a domain knowledge network.",
      inputs: [],
    },
  ],
} as const;
