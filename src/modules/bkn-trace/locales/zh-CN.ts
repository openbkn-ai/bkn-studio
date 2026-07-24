/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const bknTraceZhCN = {
  bknTrace: {
    actions: {
      query: "查询",
    },
    description: "按 trace id 或 request id 查看运行链路、证据链、业务语义链和快照预览。",
    empty: "输入 trace id 或 request id 后查询",
    errors: {
      missingScope: "请输入 trace id 或 request id。",
      queryFailed: "查询失败。",
    },
    metrics: {
      businessEdges: "业务边",
      businessNodes: "业务节点",
      businessRefs: "业务引用",
      claims: "结论",
      evidenceRefs: "证据引用",
      spans: "Span",
    },
    partial: "当前结果不完整",
    placeholders: {
      requestId: "request id",
      traceId: "trace id",
    },
    scope: {
      request: "Request",
      trace: "Trace",
    },
    sections: {
      businessGraph: "业务语义链",
      evidenceChain: "证据链",
      snapshot: "快照预览",
      traceGraph: "调用链",
      visibility: "可见性",
    },
    title: "BKN Trace",
    traceGraphRequestOnly: "request id 查询不返回调用链",
  },
} as const;
