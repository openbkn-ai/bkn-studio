import { dataConnectModuleManifest } from "@/modules/data-connect/module.manifest";
import { executionFactoryModuleManifest } from "@/modules/execution-factory/module.manifest";
import { knowledgeNetworkModuleManifest } from "@/modules/knowledge-network/module.manifest";
import { modelResourcesModuleManifest } from "@/modules/model-resources/module.manifest";

export const runtimeModuleManifests = [
  knowledgeNetworkModuleManifest,
  dataConnectModuleManifest,
  executionFactoryModuleManifest,
  modelResourcesModuleManifest,
] as const;

export const defaultDevPermissions = runtimeModuleManifests.flatMap(
  (manifest) => manifest.permissions,
);
