/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import runStyles from "@/modules/bkn-trace/scenes/BknTraceRunsScene.module.css";
import { BknTraceExplorerScene } from "@/modules/bkn-trace/scenes/BknTraceExplorerScene";
import {
  getAccessProfile,
  getBusinessGraph,
  getEvidenceArtifact,
  getEvidenceChain,
  getInteractionSummary,
  getRequestSummaries,
  getRequestSummary,
  getRequestTraces,
  getSnapshotPreview,
  getTraceGraph,
} from "@/modules/bkn-trace/services/trace.service";

const translate = vi.hoisted(() =>
  (key: string, options?: { defaultValue?: string }) =>
    options?.defaultValue ?? key,
);

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return {
    ...original,
    useTranslation: () => ({
      t: translate,
    }),
  };
});

vi.mock("@/modules/bkn-trace/services/trace.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/bkn-trace/services/trace.service")>();
  return {
    ...original,
    getAccessProfile: vi.fn(),
    getBusinessGraph: vi.fn(),
    getEvidenceArtifact: vi.fn(),
    getEvidenceChain: vi.fn(),
    getInteractionSummary: vi.fn(),
    getRequestSummaries: vi.fn(),
    getRequestSummary: vi.fn(),
    getRequestTraces: vi.fn(),
    getSnapshotPreview: vi.fn(),
    getTraceGraph: vi.fn(),
  };
});

const requestSummary = {
  actionSummary: { approved: 0, completed: 0, executed: 0, recommended: 1 },
  agentOrApp: "risk-agent",
  businessDomain: "customer-risk",
  businessRefs: ["bkn://customer/A"],
  completedAt: "2026-07-27T09:00:03Z",
  durationMs: 3000,
  evidenceCompleteness: "complete",
  knowledgeNetworks: ["customer-risk-network"],
  partialReasons: [],
  questionPreview: "客户 A 的风险为什么上升？",
  requestId: "req_business_001",
  resultPreview: "近 7 天投诉增加，风险等级上升。",
  startedAt: "2026-07-27T09:00:00Z",
  status: "completed",
  traceCount: 1,
};

describe("BknTraceExplorerScene", { timeout: 30_000 }, () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccessProfile).mockResolvedValue({
      accessScopeFingerprint: "sha256:test",
	  allowedLogCategories: [],
      businessProvenanceManagedNetworks: false,
      businessProvenanceOwn: true,
      globalLogSearch: false,
	  logExport: false,
	  logPolicyRead: false,
	  logSensitiveFields: false,
      managementAudit: false,
      securityAudit: false,
      technicalTrace: true,
    });
    vi.mocked(getRequestSummaries).mockResolvedValue({
      entries: [requestSummary],
      nextCursor: "cursor-2",
      partial: false,
      partialReasons: [],
      total: 1,
      truncated: false,
    });
    vi.mocked(getRequestSummary).mockResolvedValue(requestSummary);
    vi.mocked(getRequestTraces).mockResolvedValue({
      entries: [{
        requestId: requestSummary.requestId,
        rootOperation: "bkn.agent.chat",
        spanCount: 7,
        status: "completed",
        traceId: "trace_001",
      }],
      partial: false,
      partialReasons: [],
      total: 1,
      truncated: false,
    });
    vi.mocked(getEvidenceChain).mockResolvedValue({
      data: {
        artifactLinks: [{
          artifactRef: "artifact:art_question_001",
          artifactType: "question",
          eventId: "evt_started",
          eventType: "agent.interaction.started",
          role: "question_artifact_ref",
        }, {
          artifactRef: "artifact:art_result_001",
          artifactType: "result",
          claimId: "claim_001",
          eventId: "evt_claim",
          eventType: "claim.created",
          role: "result_artifact_ref",
        }],
        businessRefs: [],
        claims: [],
        evidenceRefs: [],
      },
      page: { edgeCount: 0, nodeCount: 2, truncated: false },
      partial: false,
      partialReason: [],
      requestId: requestSummary.requestId,
      traceId: "trace_001",
      visibilitySummary: {
        authorizedRefCount: 2,
        hiddenRefCount: 0,
        omittedRefCount: 0,
        redactedRefCount: 0,
        unauthorizedRefCount: 0,
        unresolvedRefCount: 0,
      },
    });
    vi.mocked(getBusinessGraph).mockResolvedValue({
      data: {
        edges: [],
        nodes: [{
          id: "business:customer-risk",
          label: "客户风险",
          nodeType: "object",
          properties: { ref_id: "bkn://customer/A" },
          stage: "evidence",
          visibility: "visible",
        }],
      },
      page: { edgeCount: 0, nodeCount: 1, truncated: false },
      partial: false,
      partialReason: [],
      requestId: requestSummary.requestId,
      traceId: "trace_001",
      visibilitySummary: {
        authorizedRefCount: 2,
        hiddenRefCount: 0,
        omittedRefCount: 0,
        redactedRefCount: 0,
        unauthorizedRefCount: 0,
        unresolvedRefCount: 0,
      },
    });
    vi.mocked(getSnapshotPreview).mockResolvedValue({
      manifest: {},
      partial: false,
      partialReason: [],
      requestId: requestSummary.requestId,
      snapshotRef: { mode: "preview" },
      traceId: "trace_001",
      visibilitySummary: {
        authorizedRefCount: 2,
        hiddenRefCount: 0,
        omittedRefCount: 0,
        redactedRefCount: 0,
        unauthorizedRefCount: 0,
        unresolvedRefCount: 0,
      },
    });
    vi.mocked(getEvidenceArtifact).mockImplementation((artifactId) => Promise.resolve({
      accountId: "acct-1",
      accountType: "user",
      artifactId,
      artifactType: artifactId.includes("question") ? "question" : "result",
      businessRefs: [],
      content: artifactId.includes("question")
        ? "客户 A 的风险为什么上升？（完整问题）"
        : "近 7 天投诉增加 42%，因此风险等级从中升至高。（完整结论）",
      contentHash: "sha256:test",
      contentType: "application/json",
      observedAt: "2026-07-27T09:00:00Z",
      requestId: requestSummary.requestId,
      schemaVersion: "2.2.0",
      traceId: "trace_001",
    }));
    vi.mocked(getTraceGraph).mockResolvedValue({
      data: {
        edges: [],
        nodes: [{
          durationNano: 1_200_000,
          endNano: 2_200_000,
          kind: "server",
          name: "bkn-agent.chat",
          serviceName: "bkn-agent",
          spanId: "span_agent_001",
          startNano: 1_000_000,
          status: "ok",
        }],
      },
      durationNano: 1_200_000,
      page: { edgeCount: 0, nodeCount: 1, truncated: false },
      partial: false,
      partialReason: [],
      status: "ok",
      traceId: "trace_001",
    });
  });

  it("默认展示可筛选的业务运行列表，而不是要求用户输入内部 ID", async () => {
    render(<BknTraceExplorerScene />);

    await waitFor(() => expect(getRequestSummaries).toHaveBeenCalledWith({ limit: 30 }));
    expect(await screen.findByText("客户 A 的风险为什么上升？")).not.toBeNull();
    expect(await screen.findByText("近 7 天投诉增加，风险等级上升。")).not.toBeNull();
    expect(screen.queryByPlaceholderText("bknTrace.placeholders.traceId")).toBeNull();
  });

  it("普通业务用户不显示全局技术 Trace 高级查询入口", async () => {
    vi.mocked(getAccessProfile).mockResolvedValueOnce({
      accessScopeFingerprint: "sha256:normal-user",
	  allowedLogCategories: [],
      businessProvenanceManagedNetworks: false,
      businessProvenanceOwn: true,
      globalLogSearch: false,
	  logExport: false,
	  logPolicyRead: false,
	  logSensitiveFields: false,
      managementAudit: false,
      securityAudit: false,
      technicalTrace: false,
    });

    render(<BknTraceExplorerScene />);

    await waitFor(() => expect(getAccessProfile).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("bknTrace.tabs.runs")).not.toBeNull();
    expect(screen.queryByText("bknTrace.tabs.advanced")).toBeNull();
  });

  it("将页面标题和筛选区放在独立布局块中，避免正式壳层压缩标题", async () => {
    render(<BknTraceExplorerScene />);

    await waitFor(() => expect(getRequestSummaries).toHaveBeenCalledWith({ limit: 30 }));

    const title = screen.getByRole("heading", { name: "bknTrace.title" });
    const header = title.closest("header");
    const filters = screen.getByRole("search", { name: "bknTrace.title" });

    expect(header).not.toBeNull();
    expect(header?.classList.contains(runStyles.header)).toBe(true);
    expect(title.parentElement?.classList.contains(runStyles.titleBlock)).toBe(true);
    expect(filters.classList.contains(runStyles.filters)).toBe(true);
    expect(header?.contains(filters)).toBe(false);
  });

  it("使用服务端游标继续加载业务运行列表", async () => {
    render(<BknTraceExplorerScene />);

    await waitFor(() => expect(getRequestSummaries).toHaveBeenCalledWith({ limit: 30 }));
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.loadMore" }));

    await waitFor(() =>
      expect(getRequestSummaries).toHaveBeenLastCalledWith({
        cursor: "cursor-2",
        limit: 30,
      }),
    );
  });

  it("从业务运行下钻完整问题、结果、业务语义和关联技术 Trace", async () => {
    render(<BknTraceExplorerScene />);

    await waitFor(() => expect(getRequestSummaries).toHaveBeenCalledWith({ limit: 30 }));
    fireEvent.click(await screen.findByRole("button", { name: /客户 A 的风险为什么上升/ }));

    await waitFor(() => expect(getRequestSummary).toHaveBeenCalledWith("req_business_001"));
    expect(getRequestTraces).toHaveBeenCalledWith("req_business_001", { limit: 100 });
    expect(getEvidenceChain).toHaveBeenCalledWith({ requestId: "req_business_001", limit: 100 });
    expect(getBusinessGraph).toHaveBeenCalledWith({ requestId: "req_business_001", limit: 100 });
    await waitFor(() => expect(getEvidenceArtifact).toHaveBeenCalledTimes(2));

    expect(await screen.findByText("客户 A 的风险为什么上升？（完整问题）")).not.toBeNull();
    expect(screen.getByText("近 7 天投诉增加 42%，因此风险等级从中升至高。（完整结论）")).not.toBeNull();
    expect(screen.getByText("客户风险")).not.toBeNull();

    fireEvent.click(screen.getByText("bknTrace.tabs.diagnostics"));
    fireEvent.click(await screen.findByRole("button", { name: "trace_001" }));

    await waitFor(() => expect(getTraceGraph).toHaveBeenCalledWith("trace_001"));
    expect(await screen.findByText("bkn-agent.chat")).not.toBeNull();
    expect(screen.getByText("bkn-agent")).not.toBeNull();
  }, 30_000);

  it("按 interaction_id 聚合同一轮的多次 OpenBKN 调用", async () => {
    const interactionRequest = {
      ...requestSummary,
      conversationId: "conversation_supply_chain",
      interactionId: "interaction_june_forecast",
    };
    const sqlRequest = {
      ...interactionRequest,
      questionPreview: "查询 6 月需求预测单",
      requestId: "req_sql_002",
      resultPreview: "返回 3 张预测单，共 11594",
    };
    vi.mocked(getRequestSummaries).mockResolvedValue({
      entries: [interactionRequest],
      nextCursor: undefined,
      partial: false,
      partialReasons: [],
      total: 1,
      truncated: false,
    });
    vi.mocked(getRequestSummary).mockResolvedValue(interactionRequest);
    vi.mocked(getInteractionSummary).mockResolvedValue({
      completedAt: "2026-07-27T09:00:03Z",
      conversationId: "conversation_supply_chain",
      durationMs: 3000,
      interactionId: "interaction_june_forecast",
      requests: [interactionRequest, sqlRequest],
      startedAt: "2026-07-27T09:00:00Z",
      status: "completed",
      traces: [{
        interactionId: "interaction_june_forecast",
        requestId: "req_sql_002",
        rootOperation: "context-loader.run_sql",
        spanCount: 4,
        status: "completed",
        traceId: "trace_sql_002",
      }],
    });

    render(<BknTraceExplorerScene />);
    await waitFor(() => expect(getRequestSummaries).toHaveBeenCalledWith({ limit: 30 }));
    fireEvent.click(await screen.findByRole("button", { name: /客户 A 的风险为什么上升/ }));

    await waitFor(() =>
      expect(getInteractionSummary).toHaveBeenCalledWith("interaction_june_forecast"),
    );
    fireEvent.click(screen.getByText("bknTrace.tabs.diagnostics"));

    expect(await screen.findByText("req_sql_002")).not.toBeNull();
    expect(screen.getByText("查询 6 月需求预测单")).not.toBeNull();
    expect(screen.getByText("trace_sql_002")).not.toBeNull();
  }, 30_000);
});
