/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const dataCatalogModuleManifest = {
  id: "data-catalog",
  name: "Data Catalog",
  // 权限点对齐 bkn-safe authz 目录(resource_type:operation)
  permissions: [
    "catalog:view_detail",
    "catalog:create",
    "catalog:modify",
    "catalog:delete",
    "catalog:task_manage",
    "resource:view_detail",
    "resource:create",
    "resource:modify",
    "resource:delete",
    "resource:task_manage",
  ],
  requiresShell: true,
  supportsEmbedded: false,
  supportsReadOnly: false,
  services: [
    "vega-backend/catalogs",
    "vega-backend/connector-types",
    "vega-backend/resources",
    "vega-backend/build-tasks",
    "vega-backend/discover-tasks",
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
      exportName: "IndexBuildListScene",
      description: "Cross-resource index build task list with progress polling.",
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
