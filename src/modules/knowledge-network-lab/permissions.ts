export const knowledgeNetworkLabPermissions = {
  view: "knowledge-network-lab:view",
  create: "knowledge-network-lab:create",
  editOntology: "knowledge-network-lab:ontology:edit",
  bind: "knowledge-network-lab:bind",
  debug: "knowledge-network-lab:debug",
  query: "knowledge-network-lab:query",
} as const;

export const knowledgeNetworkLabPermissionList = Object.values(knowledgeNetworkLabPermissions);
