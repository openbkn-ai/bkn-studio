/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const dataCatalogModuleManifest = {
  id: "data-catalog",
  name: "Data Catalog",
  // Permission points align with the bkn-safe authorization catalog (resource_type:operation).
  permissions: [
    "catalog:view_detail",
    "catalog:create",
    "catalog:modify",
    "catalog:delete",
    "catalog:task_manage",
    "catalog:resource_manage",
    "resource:view_detail",
    // 改表/删表/任务这几个动词后端仍是「先问这张表、拒了再问目录」，所以两边都要
    // 声明。建表不在其列：它只判目标目录，因为通配对象答不了「建在哪个目录」。
    "resource:task_manage",
    "resource:query_data",
    "catalog:query_data",
  ],
  requiresShell: true,
  supportsEmbedded: false,
  supportsReadOnly: false,
  services: [
    "vega-backend/catalogs",
    "vega-backend/connector-types",
    "vega-backend/resources",
    "vega-backend/index-capabilities",
    "vega-backend/build-tasks",
    "vega-backend/discover-tasks",
    "vega-backend/semantic-understanding-tasks",
  ],
  scenes: [
    {
      id: "data-catalog.explorer",
      exportName: "DataCatalogScene",
      description:
        "Tree-based catalog explorer: catalogs and resources on the left, detail panel on the right.",
      inputs: ["selection?"],
    },
    {
      id: "data-catalog.index-builds",
      exportName: "TaskManagementScene",
      description: "Task management with index build, discover, and semantic-understanding task lists.",
      inputs: [],
    },
    {
      id: "data-catalog.resource-workspace",
      exportName: "ResourceWorkspaceScene",
      description:
        "Resource detail workspace with detail, data preview, and data-index tabs (configure index / task management).",
      inputs: ["resourceId", "tab?", "view?"],
    },
  ],
} as const;
