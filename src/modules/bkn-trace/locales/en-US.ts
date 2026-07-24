/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const bknTraceEnUS = {
  bknTrace: {
    actions: {
      query: "Query",
    },
    description:
      "Inspect runtime traces, evidence chains, business semantic graphs, and snapshot previews by trace id or request id.",
    empty: "Enter a trace id or request id to query.",
    errors: {
      missingScope: "Enter a trace id or request id.",
      queryFailed: "Query failed.",
    },
    metrics: {
      businessEdges: "Business edges",
      businessNodes: "Business nodes",
      businessRefs: "Business refs",
      claims: "Claims",
      evidenceRefs: "Evidence refs",
      spans: "Spans",
    },
    partial: "The current result is partial",
    placeholders: {
      requestId: "request id",
      traceId: "trace id",
    },
    scope: {
      request: "Request",
      trace: "Trace",
    },
    sections: {
      businessGraph: "Business Semantic Graph",
      evidenceChain: "Evidence Chain",
      snapshot: "Snapshot Preview",
      traceGraph: "Trace Graph",
      visibility: "Visibility",
    },
    title: "BKN Trace",
    traceGraphRequestOnly: "Trace Graph is only available for trace-id queries.",
  },
} as const;
