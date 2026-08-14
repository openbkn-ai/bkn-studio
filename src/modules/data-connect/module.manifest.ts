/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const dataConnectModuleManifest = {
  id: "data-connect",
  name: "Data Connect",
  permissions: [
    "catalog:view_detail",
    "catalog:create",
    "catalog:modify",
    "catalog:delete",
    "catalog:task_manage",
  ],
  requiresShell: true,
  supportsEmbedded: false,
  supportsReadOnly: false,
  services: ["vega-backend/catalogs", "vega-backend/connector-types", "vega-backend/discover-schedules", "vega-backend/discover-tasks"],
  scenes: [
    {
      id: "data-connect.list",
      exportName: "DataConnectListScene",
      description: "Manage data connection records, search, filter, inspect and operate entries.",
      inputs: ["defaultKeyword?", "defaultConnectorType?", "onCreate?", "onEdit?", "onOpenDetail?", "onOpenDiscovers?"],
    },
    {
      id: "data-connect.form",
      exportName: "DataConnectFormScene",
      description: "Create or edit a data connection using connector-type driven configuration.",
      inputs: ["mode", "recordId?", "onBack?", "onSubmitSuccess?"],
    },
    {
      id: "data-connect.discover",
      exportName: "DataConnectDiscoverScene",
      description: "Manage discover schedules and discover tasks for data connection catalogs.",
      inputs: ["catalogId?", "onBackToConnections?", "onCatalogIdChange?"],
    },
  ],
} as const;
