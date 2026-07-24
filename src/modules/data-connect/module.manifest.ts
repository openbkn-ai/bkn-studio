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
    "data-connect:create",
    "data-connect:edit",
    "data-connect:delete",
    "data-connect:test",
    "data-connect:toggle",
    "data-connect-discover:create",
    "data-connect-discover:edit",
    "data-connect-discover:delete",
    "data-connect-discover:toggle",
    "data-connect-discover:trigger",
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
