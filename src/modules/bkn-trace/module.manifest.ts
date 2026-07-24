/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const bknTraceModuleManifest = {
  id: "bkn-trace",
  name: "BKN Trace",
  permissions: ["bkn-trace:view"],
  requiresShell: true,
  services: ["agent-observability/v1"],
  supportsEmbedded: false,
  supportsReadOnly: true,
  scenes: [
    {
      id: "bkn-trace.explorer",
      exportName: "BknTraceExplorerScene",
      description: "Inspect Trace Graph, Evidence Chain, Business Graph, and Snapshot Preview.",
      inputs: [
        { name: "traceId", required: false, type: "string" },
        { name: "requestId", required: false, type: "string" },
      ],
    },
  ],
} as const;
