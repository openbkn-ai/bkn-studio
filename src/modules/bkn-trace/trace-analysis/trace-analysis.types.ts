/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  OperationCallFact,
  OperationReceipt,
} from "@/modules/bkn-trace/shared/operation-fact.types";

export type TechnicalTraceQuery = {
  cursor?: string;
  errorKeyword?: string;
  from?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
  service?: string;
  status?: string;
  to?: string;
  tool?: string;
  traceId?: string;
};

export type TechnicalTraceSummary = {
  agentName?: string;
  agentOrApp?: string;
  completedAt?: string;
  durationMs?: number;
  errorSummary?: string;
  questionPreview?: string;
  requestId?: string;
  resultPreview?: string;
  rootService?: string;
  rootOperation?: string;
  spanCount: number;
  spanCountStatus?: string;
  startedAt?: string;
  status: string;
  traceId: string;
};

export type TechnicalTracePage = {
  entries: TechnicalTraceSummary[];
  nextCursor?: string;
  page?: number;
  pageSize?: number;
  partial: boolean;
  partialReasons: string[];
  total: number;
  truncated: boolean;
};

export type TechnicalSpanNode = {
  durationNano: number;
  endNano: number;
  errorMessage?: string;
  kind: string;
  name: string;
  parentSpanId?: string;
  serviceName?: string;
  spanId: string;
  startNano: number;
  status: string;
};

export type TechnicalTraceGraph = {
  nodes: TechnicalSpanNode[];
  partial: boolean;
  partialReasons: string[];
};

export type TechnicalTraceOperation = {
  fact: OperationCallFact;
  partialReasons: string[];
  receipt: OperationReceipt;
  state: string;
};

export type SpanDisplayRange = {
  loadedCount: number;
  displayLimit: number;
  rawRecordLimit: number;
  rawRecordCount: number;
  totalCount: number | null;
  totalAccuracy: "estimated" | "unknown";
  sort: "loaded_start_time_asc_span_id_asc";
  truncated: boolean;
  firstStartAt: string | null;
  lastStartAt: string | null;
  browseAllowed: boolean;
  browseReason?: string;
};

export type TechnicalSpanPage = {
  traceId: string;
  entries: TechnicalSpanNode[];
  hasMore: boolean;
  nextCursor?: string;
  sort: "span_id_asc";
  consistency: "live";
};

export type TechnicalTraceDetail = {
  spanDisplay?: SpanDisplayRange;
  graph?: TechnicalTraceGraph;
  operations: TechnicalTraceOperation[];
  partial: boolean;
  partialReasons: string[];
  summary: TechnicalTraceSummary;
};

export type RootServiceOptionsQuery = Pick<
  TechnicalTraceQuery,
  "from" | "to" | "traceId" | "status" | "tool" | "errorKeyword"
> & { q?: string };
export type RootServiceOptions = { entries: string[]; hasMore: boolean };
