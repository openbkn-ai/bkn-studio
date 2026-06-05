import { dataConnectModuleManifest } from "@/modules/data-connect/module.manifest";
import { executionFactoryModuleManifest } from "@/modules/execution-factory/module.manifest";
import { starterModuleManifest } from "@/modules/starter/module.manifest";

export const runtimeModuleManifests = [
  starterModuleManifest,
  dataConnectModuleManifest,
  executionFactoryModuleManifest,
] as const;

export const defaultDevPermissions = runtimeModuleManifests.flatMap(
  (manifest) => manifest.permissions,
);
