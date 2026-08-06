/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import runStyles from "@/modules/bkn-trace/scenes/BknTraceRunsScene.module.css";
import { BknTraceAdvancedExplorerScene, BknTraceExplorerScene } from "@/modules/bkn-trace/scenes/BknTraceExplorerScene";
import { BknTraceRunsScene } from "@/modules/bkn-trace/scenes/BknTraceRunsScene";
import {
  getAccessProfile,
  getBusinessGraph,
  getConversationSummaries,
  getEvidenceArtifact,
  getEvidenceChain,
  getInteractionSummary,
  getInteractionSummaries,
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
    getConversationSummaries: vi.fn(),
    getEvidenceArtifact: vi.fn(),
    getEvidenceChain: vi.fn(),
    getInteractionSummary: vi.fn(),
    getInteractionSummaries: vi.fn(),
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
    window.history.replaceState({}, "", "/");
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
    vi.mocked(getConversationSummaries).mockResolvedValue({
	  entries: [{
		agentOrApp: "risk-agent",
		businessDomain: "customer-risk",
		conversationId: "conversation_customer_risk",
		durationMs: 3000,
		evidenceCompleteness: "complete",
		interactionCount: 1,
		knowledgeNetworks: ["customer-risk-network"],
		partialReasons: [],
		questionPreview: "客户 A 的风险为什么上升？",
		requestCount: 1,
		resultPreview: "近 7 天投诉增加，风险等级上升。",
		startedAt: "2026-07-27T09:00:00Z",
		status: "completed",
		traceCount: 1,
	  }],
	  nextCursor: "cursor-2",
	  partial: false,
	  partialReasons: [],
	  total: 1,
	  truncated: false,
	});
    vi.mocked(getInteractionSummaries).mockResolvedValue({
	  entries: [{
		conversationId: "conversation_customer_risk",
		evidenceCompleteness: "complete",
		interactionId: "interaction_customer_risk",
		knowledgeNetworks: ["customer-risk-network"],
		partialReasons: [],
		questionPreview: "客户 A 的风险为什么上升？",
		requestCount: 1,
		resultPreview: "近 7 天投诉增加，风险等级上升。",
		startedAt: "2026-07-27T09:00:00Z",
		status: "completed",
		traceCount: 1,
	  }],
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
        spanCountStatus: "available",
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
	  conclusionScope: "trace",
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
	  conclusionScope: "trace",
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

  it("Trace 分析从 URL 恢复 trace_id 深链", () => {
    window.history.replaceState({}, "", "/observability/traces?trace_id=trace_001");
    render(<BknTraceAdvancedExplorerScene />);

    const traceInput = screen.getByPlaceholderText("bknTrace.placeholders.traceId");
    expect(traceInput instanceof HTMLInputElement && traceInput.value).toBe("trace_001");
  });

	it("单次 OpenBKN 调用把最终结论中性归属到所属交互轮次", async () => {
		const chain = await vi.mocked(getEvidenceChain)({ traceId: "trace_001" });
		const graph = await vi.mocked(getBusinessGraph)({ traceId: "trace_001" });
		vi.mocked(getEvidenceChain).mockResolvedValue({ ...chain, conclusionScope: "interaction" });
		vi.mocked(getBusinessGraph).mockResolvedValue({ ...graph, conclusionScope: "interaction" });
		window.history.replaceState({}, "", "/observability/traces?trace_id=trace_001");

		render(<BknTraceAdvancedExplorerScene />);
		fireEvent.click(screen.getByRole("button", { name: /bknTrace\.actions\.query/ }));

		expect(await screen.findByText("bknTrace.conclusionAtInteraction")).not.toBeNull();
		expect(screen.queryByText("bknTrace.incompleteBusiness")).toBeNull();
	});

  it("业务制品按 Trace 不可用时仍展示技术调用链", async () => {
    window.history.replaceState({}, "", "/observability/traces?trace_id=trace_001");
    vi.mocked(getEvidenceChain).mockRejectedValueOnce(new Error("evidence chain not found"));
    vi.mocked(getBusinessGraph).mockRejectedValueOnce(new Error("business graph not found"));
    vi.mocked(getSnapshotPreview).mockRejectedValueOnce(new Error("snapshot preview not found"));

    render(<BknTraceAdvancedExplorerScene />);
    fireEvent.click(screen.getByRole("button", { name: /bknTrace\.actions\.query/ }));

    expect(await screen.findByText("trace_001")).not.toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "bknTrace.tabs.diagnostics" }));
    expect(await screen.findByText("bkn-agent.chat")).not.toBeNull();
    expect(screen.queryByText("evidence chain not found")).toBeNull();
    expect(screen.getByText("bknTrace.partial")).not.toBeNull();
  });

  it("默认展示可筛选的会话列表，而不是要求用户输入内部 ID", async () => {
    render(<BknTraceExplorerScene />);

    await waitFor(() => expect(getConversationSummaries).toHaveBeenCalledWith({ page: 1, pageSize: 20 }));
    expect(await screen.findByText("客户 A 的风险为什么上升？")).not.toBeNull();
    expect(await screen.findByText("近 7 天投诉增加，风险等级上升。")).not.toBeNull();
    expect(screen.queryByPlaceholderText("bknTrace.placeholders.traceId")).toBeNull();
  });

  it("消费日志传入的 request_id 深链并打开对应 OpenBKN 调用", async () => {
    window.history.replaceState({}, "", "/observability/business-provenance?view=requests&request_id=req_business_001");

    render(<BknTraceRunsScene />);

    await waitFor(() => expect(getRequestSummary).toHaveBeenCalledWith("req_business_001"));
    expect(await screen.findByText("bknTrace.sections.requestDetail")).not.toBeNull();
    expect(window.location.search).toContain("request_id=req_business_001");

    fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.back" }));

    expect(window.location.search).not.toContain("request_id=");
  });

  it("深链详情关闭后重新查询不会再次打开", async () => {
    window.history.replaceState({}, "", "/observability/business-provenance?view=requests&request_id=req_business_001");

    render(<BknTraceRunsScene />);
    await waitFor(() => expect(getRequestSummary).toHaveBeenCalledWith("req_business_001"));
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.back" }));
    fireEvent.click(screen.getByRole("button", { name: /bknTrace\.actions\.query$/ }));

    await waitFor(() => expect(getRequestSummaries).toHaveBeenCalledTimes(2));

    expect(screen.queryByText("bknTrace.sections.requestDetail")).toBeNull();
    expect(getRequestSummary).toHaveBeenCalledTimes(1);
  });

  it("重新查询会放弃进行中的详情并清除 request_id 深链", async () => {
    window.history.replaceState({}, "", "/observability/business-provenance?view=requests&request_id=req_business_001");
    let resolveRequestSummary: ((value: Awaited<ReturnType<typeof getRequestSummary>>) => void) | undefined;
    vi.mocked(getRequestSummary).mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequestSummary = resolve;
    }));

    render(<BknTraceRunsScene />);

    await waitFor(() => expect(getRequestSummary).toHaveBeenCalledWith("req_business_001"));
    fireEvent.click(screen.getByRole("button", { name: /bknTrace\.actions\.query$/ }));

    expect(window.location.search).not.toContain("request_id=");
    resolveRequestSummary?.(requestSummary);
  });

	it("默认显示 Agent 声明名称并隐藏可信技术主键", async () => {
		vi.mocked(getConversationSummaries).mockResolvedValue({
			entries: [{
				agentName: "供应链分析助手",
				applicationPrincipalId: "266c6a42-6131-4d62-8f39-853e7093701c",
				conversationId: "conversation_identity",
				effectiveSubjectId: "user-001",
				evidenceCompleteness: "complete",
				interactionCount: 3,
				knowledgeNetworks: [],
				partialReasons: [],
				questionPreview: "查询供应链库存",
				requestCount: 9,
				resultPreview: "库存查询完成",
				status: "active",
				traceCount: 9,
			}],
			partial: false,
			partialReasons: [],
			total: 1,
			truncated: false,
		});

		render(<BknTraceRunsScene />);

		expect(await screen.findByText("供应链分析助手")).not.toBeNull();
		expect(screen.queryByText("266c6a42-6131-4d62-8f39-853e7093701c")).toBeNull();
	});

  it("按会话、交互轮次、请求的真实层级下钻并同步 URL", async () => {
	render(<BknTraceExplorerScene />);

	await waitFor(() => expect(getConversationSummaries).toHaveBeenCalledWith({ page: 1, pageSize: 20 }));
	fireEvent.click(await screen.findByRole("button", { name: /客户 A 的风险为什么上升/ }));
	await waitFor(() => expect(getInteractionSummaries).toHaveBeenCalledWith({
	  conversationId: "conversation_customer_risk",
	  page: 1, pageSize: 20,
	}));
	expect(window.location.search).toContain("view=interactions");
	expect(window.location.search).toContain("conversation_id=conversation_customer_risk");

	fireEvent.click(await screen.findByRole("button", { name: /客户 A 的风险为什么上升/ }));
	await waitFor(() => expect(getRequestSummaries).toHaveBeenCalledWith({
	  conversationId: "conversation_customer_risk",
	  interactionId: "interaction_customer_risk",
	  page: 1, pageSize: 20,
	}));
	expect(window.location.search).toContain("view=requests");
	expect(window.location.search).toContain("interaction_id=interaction_customer_risk");
  });

  it("进入交互轮次后按权限读取完整问题和完整结果", async () => {
    vi.mocked(getInteractionSummary).mockResolvedValue({
      conversationId: "conversation_customer_risk",
      evidenceCompleteness: "complete",
      interactionId: "interaction_customer_risk",
      partialReasons: [],
      questionArtifactRef: "artifact:art_question_001",
      questionPreview: "客户 A 的风险为什么上升？",
      requests: [requestSummary],
      resultArtifactRef: "artifact:art_result_001",
      resultPreview: "近 7 天投诉增加，风险等级上升。",
      status: "completed",
      traces: [],
    });
    window.history.replaceState(
      {},
      "",
      "/observability/business-provenance?view=interactions&conversation_id=conversation_customer_risk",
    );

    render(<BknTraceRunsScene />);
    fireEvent.click(await screen.findByRole("button", { name: /客户 A 的风险为什么上升/ }));

    await waitFor(() => expect(getInteractionSummary).toHaveBeenCalledWith("interaction_customer_risk"));
    expect(await screen.findByText("客户 A 的风险为什么上升？（完整问题）")).not.toBeNull();
    expect(screen.getByText("近 7 天投诉增加 42%，因此风险等级从中升至高。（完整结论）")).not.toBeNull();
  });

  it("丢弃晚到的旧层级响应，避免覆盖当前业务溯源视图", async () => {
    let resolveConversations!: (value: Awaited<ReturnType<typeof getConversationSummaries>>) => void;
    vi.mocked(getConversationSummaries).mockImplementationOnce(() => new Promise((resolve) => {
      resolveConversations = resolve;
    }));
    vi.mocked(getInteractionSummaries).mockResolvedValueOnce({
      entries: [{
        conversationId: "conversation-latest",
        evidenceCompleteness: "complete",
        interactionId: "interaction-latest",
        knowledgeNetworks: [],
        partialReasons: [],
        questionPreview: "当前交互结果",
        requestCount: 1,
        resultPreview: "当前结果",
        startedAt: "2026-08-01T10:00:00Z",
        status: "completed",
        traceCount: 1,
      }],
      partial: false,
      partialReasons: [],
      total: 1,
      truncated: false,
    });

    render(<BknTraceExplorerScene />);
    await waitFor(() => expect(getConversationSummaries).toHaveBeenCalled());
    fireEvent.click(screen.getByText("bknTrace.views.interactions"));
    expect(await screen.findByText("当前交互结果")).not.toBeNull();

    resolveConversations({
      entries: [{
        agentOrApp: "stale-agent",
        businessDomain: "stale-domain",
        conversationId: "conversation-stale",
        durationMs: 1,
        evidenceCompleteness: "complete",
        interactionCount: 1,
        knowledgeNetworks: [],
        partialReasons: [],
        questionPreview: "过期会话结果",
        requestCount: 1,
        resultPreview: "不应显示",
        startedAt: "2026-08-01T09:00:00Z",
        status: "completed",
        traceCount: 1,
      }],
      partial: false,
      partialReasons: [],
      total: 1,
      truncated: false,
    });
    await waitFor(() => expect(screen.queryByText("过期会话结果")).toBeNull());
    expect(screen.getByText("当前交互结果")).not.toBeNull();
  });

  it("从 URL 恢复业务溯源层级和筛选上下文", async () => {
	window.history.replaceState(
	  {},
	  "",
	  "/observability/business-provenance?view=interactions&conversation_id=conversation_customer_risk&keyword=%E9%A3%8E%E9%99%A9&status=completed",
	);
	render(<BknTraceExplorerScene />);

	await waitFor(() => expect(getInteractionSummaries).toHaveBeenCalledWith({
	  conversationId: "conversation_customer_risk",
	  keyword: "风险",
	  page: 1, pageSize: 20,
	  status: "completed",
	}));
	const keywordInput = screen.getByPlaceholderText("bknTrace.placeholders.keyword");
	expect(keywordInput instanceof HTMLInputElement && keywordInput.value).toBe("风险");
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

    await waitFor(() => expect(getConversationSummaries).toHaveBeenCalledWith({ page: 1, pageSize: 20 }));

    const title = screen.getByRole("heading", { name: "bknTrace.title" });
    const header = title.closest("header");
    const filters = screen.getByRole("search", { name: "bknTrace.title" });

    expect(header).not.toBeNull();
    expect(header?.classList.contains(runStyles.header)).toBe(true);
    expect(title.parentElement?.classList.contains(runStyles.titleBlock)).toBe(true);
    expect(filters.classList.contains(runStyles.filters)).toBe(true);
    expect(header?.contains(filters)).toBe(false);
  });

  it("OpenBKN 调用详情不复制整轮问题和最终答案，并保留关联技术 Trace", async () => {
    window.history.replaceState({}, "", "/observability/business-provenance?view=requests");
    render(<BknTraceExplorerScene />);

    await waitFor(() => expect(getRequestSummaries).toHaveBeenCalledWith({ page: 1, pageSize: 20 }));
    fireEvent.click(await screen.findByRole("button", { name: /客户 A 的风险为什么上升/ }));

    await waitFor(() => expect(getRequestSummary).toHaveBeenCalledWith("req_business_001"));
    expect(getRequestTraces).toHaveBeenCalledWith("req_business_001", { limit: 100 });
    expect(getEvidenceChain).toHaveBeenCalledWith({ requestId: "req_business_001", limit: 100 });
    expect(getBusinessGraph).toHaveBeenCalledWith({ requestId: "req_business_001", limit: 100 });
    await waitFor(() => expect(getEvidenceArtifact).toHaveBeenCalledTimes(2));

    expect(screen.queryByText("客户 A 的风险为什么上升？（完整问题）")).toBeNull();
    expect(screen.queryByText("近 7 天投诉增加 42%，因此风险等级从中升至高。（完整结论）")).toBeNull();
    expect(screen.getAllByText("客户风险")).toHaveLength(2);

    fireEvent.click(screen.getByText("bknTrace.tabs.diagnostics"));
    fireEvent.click(await screen.findByRole("button", { name: "trace_001" }));

    await waitFor(() => expect(getTraceGraph).toHaveBeenCalledWith("trace_001"));
    expect(await screen.findByText("bkn-agent.chat")).not.toBeNull();
    expect(screen.getByText("bkn-agent")).not.toBeNull();
  }, 30_000);

  it("把已解析业务节点展示为数据、逻辑与行动依据", async () => {
    vi.mocked(getBusinessGraph).mockResolvedValueOnce({
      data: {
        edges: [],
        nodes: [{
          display: { name: "产品BOM" },
          id: "business:object:supplychain_hd0202:bom",
          nodeType: "business_ref",
          properties: {
            ref_id: "object:supplychain_hd0202:supplychain_hd0202_bom",
            ref_type: "object_type",
          },
          stage: "evidence",
          visibility: "visible",
        }],
      },
      page: { edgeCount: 0, nodeCount: 1, truncated: false },
      conclusionScope: "trace",
      partial: false,
      partialReason: [],
      requestId: requestSummary.requestId,
      traceId: "trace_001",
      visibilitySummary: {
        authorizedRefCount: 1,
        hiddenRefCount: 0,
        omittedRefCount: 0,
        redactedRefCount: 0,
        unauthorizedRefCount: 0,
        unresolvedRefCount: 0,
      },
    });
    window.history.replaceState({}, "", "/observability/business-provenance?view=requests");

    render(<BknTraceRunsScene />);
    fireEvent.click(await screen.findByRole("button", { name: /客户 A 的风险为什么上升/ }));

    expect(await screen.findByText("bknTrace.evidenceBasis.data")).not.toBeNull();
    expect(screen.getAllByText("产品BOM")).toHaveLength(2);
    expect(screen.getByText("bknTrace.evidenceBasis.noLogicAtCall")).not.toBeNull();
    expect(screen.getByText("bknTrace.evidenceBasis.noActionAtCall")).not.toBeNull();
  });

  it("保留未分类制品，而不是将其隐藏为无依据", async () => {
    vi.mocked(getEvidenceChain).mockResolvedValueOnce({
      data: {
        artifactLinks: [{
          artifactRef: "artifact:art_model_note_001",
          artifactType: "model_note",
          eventId: "evt_note",
          eventType: "agent.note.observed",
          role: "note_artifact_ref",
        }],
        businessRefs: [],
        claims: [],
        evidenceRefs: [],
      },
      page: { edgeCount: 0, nodeCount: 1, truncated: false },
      conclusionScope: "trace",
      partial: false,
      partialReason: [],
      requestId: requestSummary.requestId,
      traceId: "trace_001",
      visibilitySummary: {
        authorizedRefCount: 1,
        hiddenRefCount: 0,
        omittedRefCount: 0,
        redactedRefCount: 0,
        unauthorizedRefCount: 0,
        unresolvedRefCount: 0,
      },
    });
    vi.mocked(getEvidenceArtifact).mockResolvedValueOnce({
      accountId: "acct-1",
      accountType: "user",
      artifactId: "art_model_note_001",
      artifactType: "model_note",
      businessRefs: [],
      content: "模型补充说明",
      contentHash: "sha256:test",
      contentType: "application/json",
      observedAt: "2026-07-27T09:00:00Z",
      requestId: requestSummary.requestId,
      schemaVersion: "2.2.0",
      traceId: "trace_001",
    });
    window.history.replaceState({}, "", "/observability/business-provenance?view=requests");

    render(<BknTraceRunsScene />);
    fireEvent.click(await screen.findByRole("button", { name: /客户 A 的风险为什么上升/ }));

    expect(await screen.findByText("bknTrace.evidenceBasis.other")).not.toBeNull();
    expect(screen.getByText("模型补充说明")).not.toBeNull();
  });

  it("OpenBKN 调用以业务操作区分，而不是重复本轮问题和答案", async () => {
	vi.mocked(getRequestSummaries).mockResolvedValue({
	  entries: [{
		...requestSummary,
		operationId: "op_schema",
		operationKey: "supply-chain-schema",
		toolName: "search_schema",
	  }, {
		...requestSummary,
		businessRefs: ["resource:forecast"],
		controlledSummary: "需求预测数据",
		operationId: "op_sql",
		operationKey: "supply-chain-data",
		requestId: "req_sql",
		resultCount: 40,
		toolName: "run_sql",
	  }],
	  partial: false,
	  partialReasons: [],
	  total: 2,
	  truncated: false,
	});

	window.history.replaceState({}, "", "/observability/business-provenance?view=requests");
	render(<BknTraceExplorerScene />);

	await waitFor(() => expect(getRequestSummaries).toHaveBeenCalledWith({ page: 1, pageSize: 20 }));
	expect(await screen.findByRole("button", { name: "bknTrace.operations.searchSchema" }, { timeout: 5_000 })).not.toBeNull();
	expect(screen.getByRole("button", { name: "bknTrace.operations.runSql · 需求预测数据" })).not.toBeNull();
	expect(screen.getByText("bknTrace.operationResults.dataCount")).not.toBeNull();
    expect(screen.getAllByText("bknTrace.fields.operationResult")).not.toHaveLength(0);
  });

  it("未返回结果数的终态调用复用完整状态文案", async () => {
    vi.mocked(getRequestSummaries).mockResolvedValue({
      entries: [{ ...requestSummary, requestId: "req_failed", status: "failed" }],
      partial: false,
      partialReasons: [],
      total: 1,
      truncated: false,
    });
    window.history.replaceState({}, "", "/observability/business-provenance?view=requests");

    render(<BknTraceRunsScene />);

    expect((await screen.findAllByText("bknTrace.status.failed")).length).toBeGreaterThan(1);
    expect(screen.queryByText("bknTrace.operationResults.failed")).toBeNull();
  });

  it("可选证据视图缺失时仍展示 OpenBKN 调用基础详情", async () => {
	vi.mocked(getRequestTraces).mockRejectedValue(new Error("trace graph not found"));
	vi.mocked(getEvidenceChain).mockRejectedValue(new Error("evidence chain not found"));
	vi.mocked(getBusinessGraph).mockRejectedValue(new Error("business graph not found"));
	vi.mocked(getSnapshotPreview).mockRejectedValue(new Error("snapshot preview not found"));

	window.history.replaceState({}, "", "/observability/business-provenance?view=requests");
	render(<BknTraceExplorerScene />);
	await waitFor(() => expect(getRequestSummaries).toHaveBeenCalledWith({ page: 1, pageSize: 20 }));
	fireEvent.click(await screen.findByRole("button", { name: /客户 A 的风险为什么上升/ }, { timeout: 5_000 }));

	expect(await screen.findByText("bknTrace.sections.requestDetail")).not.toBeNull();
	expect(screen.getAllByText("客户 A 的风险为什么上升？").length).toBeGreaterThan(0);
	expect(screen.queryByText("trace graph not found")).toBeNull();
  });

  it("按 interaction_id 聚合同一轮的多次 OpenBKN 调用", async () => {
    const interactionRequest = {
      ...requestSummary,
      conversationId: "conversation_supply_chain",
	  controlledSummary: "HD供应链业务知识网络_v3",
      interactionId: "interaction_june_forecast",
	  toolName: "search_schema",
    };
    const sqlRequest = {
      ...interactionRequest,
	  controlledSummary: "需求预测数据",
      requestId: "req_sql_002",
	  resultCount: 3,
	  toolName: "run_sql",
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
	  evidenceCompleteness: "complete",
      interactionId: "interaction_june_forecast",
	  partialReasons: [],
      requests: [interactionRequest, sqlRequest],
      startedAt: "2026-07-27T09:00:00Z",
      status: "completed",
      traces: [{
        interactionId: "interaction_june_forecast",
        requestId: "req_sql_002",
        rootOperation: "context-loader.run_sql",
        spanCount: 4,
        spanCountStatus: "available",
        status: "completed",
        traceId: "trace_sql_002",
      }],
    });

    window.history.replaceState({}, "", "/observability/business-provenance?view=requests");
    render(<BknTraceExplorerScene />);
    await waitFor(() => expect(getRequestSummaries).toHaveBeenCalledWith({ page: 1, pageSize: 20 }));
    fireEvent.click(await screen.findByRole("button", {
      name: "bknTrace.operations.searchSchema · HD供应链业务知识网络_v3",
    }));

    await waitFor(() =>
      expect(getInteractionSummary).toHaveBeenCalledWith("interaction_june_forecast"),
    );
    fireEvent.click(screen.getByText("bknTrace.tabs.diagnostics"));

    expect((await screen.findAllByText(
      "bknTrace.operations.searchSchema · HD供应链业务知识网络_v3",
    )).length).toBeGreaterThan(0);
    expect(screen.getByText("bknTrace.operations.runSql · 需求预测数据")).not.toBeNull();
    expect(screen.queryByText("req_sql_002")).toBeNull();
    expect(screen.getByText("trace_sql_002")).not.toBeNull();
  }, 30_000);
});
