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
    // 后端两个动词都认（老动词在前、短路），所以这里两边都要声明:自定义角色
    // 手上还是 resource:*，只问 catalog:* 会让它们按钮全消失而接口其实可用。
    "resource:create",
    "resource:task_manage",
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
