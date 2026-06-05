import { dataConnectModuleManifest } from "@/modules/data-connect/module.manifest";
import { starterModuleManifest } from "@/modules/starter/module.manifest";

export const runtimeModuleManifests = [
  starterModuleManifest,
  dataConnectModuleManifest,
] as const;

export const defaultDevPermissions = runtimeModuleManifests.flatMap(
  (manifest) => manifest.permissions,
);
