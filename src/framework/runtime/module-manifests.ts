import { dataConnectModuleManifest } from "@/modules/data-connect/module.manifest";
import { knowledgeNetworkModuleManifest } from "@/modules/knowledge-network/module.manifest";

export const runtimeModuleManifests = [
  dataConnectModuleManifest,
  knowledgeNetworkModuleManifest,
] as const;

export const defaultDevPermissions = runtimeModuleManifests.flatMap(
  (manifest) => manifest.permissions,
);
