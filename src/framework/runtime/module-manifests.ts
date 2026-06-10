import { dataConnectModuleManifest } from "@/modules/data-connect/module.manifest";
import { executionFactoryModuleManifest } from "@/modules/execution-factory/module.manifest";
import { knowledgeNetworkModuleManifest } from "@/modules/knowledge-network/module.manifest";

export const runtimeModuleManifests = [
  knowledgeNetworkModuleManifest,
  dataConnectModuleManifest,
  executionFactoryModuleManifest,
] as const;

export const defaultDevPermissions = runtimeModuleManifests.flatMap(
  (manifest) => manifest.permissions,
);
