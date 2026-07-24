/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { dataCatalogModuleManifest } from "@/modules/data-catalog/module.manifest";
import { bknTraceModuleManifest } from "@/modules/bkn-trace/module.manifest";
import { dataConnectModuleManifest } from "@/modules/data-connect/module.manifest";
import { executionFactoryLabModuleManifest } from "@/modules/execution-factory-lab/module.manifest";
import { executionFactoryModuleManifest } from "@/modules/execution-factory/module.manifest";
import { knowledgeNetworkModuleManifest } from "@/modules/knowledge-network/module.manifest";
import { modelResourcesModuleManifest } from "@/modules/model-resources/module.manifest";
import { systemAdminModuleManifest } from "@/modules/system-admin/module.manifest";

export const runtimeModuleManifests = [
  knowledgeNetworkModuleManifest,
  dataCatalogModuleManifest,
  dataConnectModuleManifest,
  executionFactoryModuleManifest,
  modelResourcesModuleManifest,
  executionFactoryLabModuleManifest,
  bknTraceModuleManifest,
  systemAdminModuleManifest,
] as const;

export const defaultDevPermissions = runtimeModuleManifests.flatMap(
  (manifest) => manifest.permissions,
);
