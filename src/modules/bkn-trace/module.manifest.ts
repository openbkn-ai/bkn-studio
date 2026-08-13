/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const bknTraceModuleManifest = {
  id: "bkn-trace",
  name: "BKN Trace",
  permissions: [],
  requiresShell: true,
  services: ["agent-observability/v1"],
  supportsEmbedded: false,
  supportsReadOnly: true,
  scenes: [
    {
      id: "bkn-trace.analysis",
      exportName: "TraceAnalysisScene",
      description: "Inspect one technical Trace with its spans and raw Operation call facts.",
      inputs: [
        { name: "traceId", required: false, type: "string" },
      ],
    },
  ],
} as const;
