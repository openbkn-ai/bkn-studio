/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import dayjs from "dayjs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ObservabilityLogsScene } from "@/modules/bkn-trace/scenes/ObservabilityLogsScene";
import { ObservabilitySettingsScene } from "@/modules/bkn-trace/scenes/ObservabilitySettingsScene";
import { createArchive, getArchiveOverview, getLogDetail, listArchiveJobs, listLogPolicies, listLogs, listLogSources } from "@/modules/bkn-trace/services/observability.service";
import { getAccessProfile } from "@/modules/bkn-trace/services/trace.service";
import { AuditLogPage } from "@/modules/system-admin/pages/AuditLogPage";

const translate = (key: string, options?: Record<string, unknown>) => {
  const value = ({
  "bknTrace.logs.authenticatedUser": "已认证用户",
  "bknTrace.logs.authMethods.api_key": "通过 API Key",
  "bknTrace.logs.businessConversationSuffix": " 的业务会话",
  "bknTrace.logs.conversationId": "Conversation ID",
  "bknTrace.logs.unnamedAgent": "未命名 Agent",
  "bknTrace.logs.modules.openbkn": "技术运行日志（非操作日志）",
  "bknTrace.logs.domainAction": "{{action}}{{target}}",
  "bknTrace.logs.domainAuditActions.create": "创建",
  "bknTrace.logs.targetTypes.object_type": "对象类",
  "bknTrace.settings.status.healthy": "已接入",
  "bknTrace.settings.sourceState.partial_management_audit_coverage": "已接入部分管理操作；其余操作尚未纳入审计。",
  }[key] ?? key);
  return value.replace(/{{(\w+)}}/g, (_match, name: string) => typeof options?.[name] === "string" ? options[name] : "");
};

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return { ...original, useTranslation: () => ({ t: translate }) };
});

vi.mock("@/modules/bkn-trace/services/trace.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/bkn-trace/services/trace.service")>();
  return { ...original, getAccessProfile: vi.fn() };
});

vi.mock("@/modules/bkn-trace/services/observability.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/bkn-trace/services/observability.service")>();
  return { ...original, createArchive: vi.fn(), getArchiveOverview: vi.fn(), getLogDetail: vi.fn(), listArchiveJobs: vi.fn(), listLogPolicies: vi.fn(), listLogs: vi.fn(), listLogSources: vi.fn() };
});

vi.mock("@/modules/execution-factory/utils/use-audit-user-directory", () => ({
  useAuditUserDirectory: () => new Map([
    ["266c6a42-6131-4d62-8f39-853e7093701c", "Administrator"],
  ]),
}));

const profile = {
  accessScopeFingerprint: "sha256:test",
  allowedLogCategories: ["runtime.system" as const, "runtime.business" as const],
  businessProvenanceManagedNetworks: false,
  businessProvenanceOwn: true,
  globalLogSearch: true,
  logExport: false,
  logPolicyRead: true,
  logSensitiveFields: false,
  managementAudit: false,
  securityAudit: false,
  technicalTrace: true,
  observabilityArchiveManage: true,
};

describe("observability workspace scenes", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(), addListener: vi.fn(), dispatchEvent: vi.fn(), matches: false,
      media: query, onchange: null, removeEventListener: vi.fn(), removeListener: vi.fn(),
    }));
  });

  beforeEach(() => {
    vi.clearAllMocks();
		vi.mocked(createArchive).mockReset();
		vi.mocked(getArchiveOverview).mockReset();
		vi.mocked(listArchiveJobs).mockReset();
		vi.mocked(getArchiveOverview).mockImplementation((kind) => Promise.resolve({ candidateCount: 0, cutoffAt: "2026-08-07T00:00:00Z", kind, retentionDays: kind === "log" ? 30 : 7, storageStatus: "unavailable" }));
		vi.mocked(listArchiveJobs).mockResolvedValue([]);
		window.history.replaceState({}, "", "/observability/logs");
    vi.mocked(getAccessProfile).mockResolvedValue(profile);
    vi.mocked(listLogs).mockResolvedValue({
      count: { accuracy: "partial", value: 1 },
      data: [{
        action: "create", actor: { id: "user-a", name: "供应链管理员", type: "user" }, authMethod: "api_key",
        facts: { action: "create", targetId: "conv-a", targetNameSnapshot: "供应链分析助手", targetType: "conversation" },
        conversationId: "conv-a", eventId: "audit-a", eventName: "conversation.created", eventTime: "2026-08-01T10:00:00Z",
        logCategory: "runtime.business", attributes: { agent_name: "供应链分析助手", external_conversation_key: "cursor-thread-a" },
        businessModule: "domain_knowledge_network", outcome: "success", recordedAt: "2026-08-01T10:00:01Z",
        requestId: "req-a", sourceChannel: "api", sourceId: "bkn-trace-core",
        target: { id: "conv-a", name: "供应链分析助手", type: "conversation" },
        traceId: "4b3d59daeff5bfbb23d46c47a5051ec9",
      }],
      partial: true,
      sourceStatus: [{ coveredModules: ["openbkn"], reason: "source_query_failed", reliability: "best_effort", sourceId: "safe-audit", status: "unavailable" }],
    });
    vi.mocked(listLogSources).mockResolvedValue([{ coveredModules: ["openbkn"], collectionMethod: "direct_otlp", reliability: "best_effort", sourceId: "otel-ss4o", status: "healthy" }]);
    vi.mocked(listLogPolicies).mockResolvedValue([{ category: "runtime.system", legalHold: false, policyKind: "runtime", policyRevision: "r6.2-default", readOnly: true, retentionDays: 7, scope: { tenant_id: "tenant-a" } }]);
		vi.mocked(getLogDetail).mockResolvedValue({
			data: {
				action: "create", actor: { id: "user-a", name: "供应链管理员", type: "user" }, authMethod: "api_key",
				facts: { action: "create", operationType: "conversation.create", operationStatus: "completed", businessContext: "managed", targetId: "conv-a", targetNameSnapshot: "供应链分析助手", targetType: "conversation" },
				conversationId: "conv-a", eventId: "audit-a", eventName: "conversation.created", eventTime: "2026-08-01T10:00:00Z",
				logCategory: "runtime.business", attributes: { agent_name: "供应链分析助手", external_conversation_key: "cursor-thread-a" },
				businessModule: "domain_knowledge_network", outcome: "success", recordedAt: "2026-08-01T10:00:01Z",
				requestId: "req-a", sourceChannel: "api", sourceId: "bkn-trace-core",
				target: { id: "conv-a", name: "供应链分析助手", type: "conversation" },
				traceId: "4b3d59daeff5bfbb23d46c47a5051ec9",
			},
			policyRevision: "r6.2-default", redactedFields: [], relatedTraceIds: ["trace-a"],
		});
  });

  afterEach(() => cleanup());

  it("日志检索展示操作审计七列、局部结果和来源状态", async () => {
    render(<ObservabilityLogsScene />);
    await waitFor(() => expect(listLogs).toHaveBeenCalled());
    const [query] = vi.mocked(listLogs).mock.calls[0] ?? [];
    expect(query).toMatchObject({ page: 1, pageSize: 20 });
    expect(query?.timeFrom).toEqual(expect.any(String));
    expect(query?.timeTo).toEqual(expect.any(String));
    expect(dayjs(query?.timeTo).diff(dayjs(query?.timeFrom), "day")).toBe(7);
    expect(await screen.findByText("bknTrace.logs.auditActions.startAgentConversation")).not.toBeNull();
    expect(screen.getByText("供应链分析助手 的业务会话")).not.toBeNull();
    expect(screen.getByText("供应链管理员")).not.toBeNull();
    expect(screen.getByText("通过 API Key")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.partialWarning")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.modules.domain_knowledge_network")).not.toBeNull();
    for (const column of ["time", "module", "action", "target", "actor", "outcome", "source"]) {
      expect(screen.getByText(`bknTrace.logs.columns.${column}`)).not.toBeNull();
    }
  });

  it("以业务语言展示领域知识网络管理事实", async () => {
    vi.mocked(listLogs).mockResolvedValueOnce({
      count: { accuracy: "exact", value: 1 },
      data: [{
        action: "create", actor: { id: "user-a", name: "供应链管理员", type: "user" }, authMethod: "api_key",
        facts: { action: "create", targetId: "material", targetNameSnapshot: "物料", targetType: "object_type" },
        eventId: "evt-a", eventName: "resource_config.changed", eventTime: "2026-08-13T08:00:00Z",
        logCategory: "audit.admin", attributes: { method: "POST" }, businessModule: "domain_knowledge_network",
        outcome: "success", recordedAt: "2026-08-13T08:00:01Z", requestId: "req-a", sourceChannel: "api", sourceId: "bkn-backend",
        target: { id: "material", name: "物料", type: "object_type" },
      }],
      partial: false,
      sourceStatus: [{ coveredModules: ["domain_knowledge_network"], reliability: "best_effort", sourceId: "bkn-backend", status: "healthy" }],
    });

    render(<ObservabilityLogsScene />);

    expect(await screen.findByText("创建对象类")).not.toBeNull();
    expect(screen.getByText("物料")).not.toBeNull();
    expect(screen.getByText("供应链管理员")).not.toBeNull();
  });

  it("从链接恢复日志时间范围", async () => {
    window.history.replaceState({}, "", "/observability/logs?time_from=2026-08-01T00%3A00%3A00.000Z&time_to=2026-08-03T00%3A00%3A00.000Z");

    render(<ObservabilityLogsScene />);

    await waitFor(() => expect(listLogs).toHaveBeenCalled());
    const [query] = vi.mocked(listLogs).mock.calls[0] ?? [];
    expect(query?.timeFrom).toBe("2026-08-01T00:00:00.000Z");
    expect(query?.timeTo).toBe("2026-08-03T00:00:00.000Z");
  });

  it("系统管理日志入口复用统一工作台并保留对象下钻条件", async () => {
    window.history.replaceState({}, "", "/system/audit?target_type=user&target_id=user-a");
    render(<AuditLogPage />);
    await waitFor(() => expect(listLogs).toHaveBeenCalled());
    const [query] = vi.mocked(listLogs).mock.calls[0] ?? [];
    expect(query).toMatchObject({ categories: ["audit.admin"], targetId: "user-a", targetType: "user" });
    expect(dayjs(query?.timeTo).diff(dayjs(query?.timeFrom), "day")).toBe(30);
    expect(await screen.findByText("bknTrace.logs.auditTitle")).not.toBeNull();
  });

  it("按页读取日志并保留当前筛选条件", async () => {
    vi.mocked(listLogs)
      .mockResolvedValueOnce({
        count: { accuracy: "partial", value: 40 },
        data: [{
          action: "create", actor: { id: "user-a", name: "供应链管理员", type: "user" }, authMethod: "api_key",
          facts: { action: "create", targetId: "conv-a", targetNameSnapshot: "供应链分析助手", targetType: "conversation" },
          eventId: "audit-a", eventName: "conversation.created", eventTime: "2026-08-01T10:00:00Z",
          logCategory: "runtime.business", attributes: {}, businessModule: "domain_knowledge_network",
          outcome: "success", recordedAt: "2026-08-01T10:00:01Z", sourceChannel: "api", sourceId: "bkn-trace-core",
          target: { id: "conv-a", name: "供应链分析助手", type: "conversation" },
        }],
        page: 1, pageSize: 20, partial: false, sourceStatus: [],
      })
      .mockResolvedValueOnce({
        count: { accuracy: "exact", value: 40 },
        data: [{
          action: "update", actor: { id: "admin", name: "Administrator", type: "user" }, authMethod: "session",
          facts: { action: "update", targetId: "supplychain_hd0202", targetNameSnapshot: "HD供应链业务知识网络_v3", targetType: "knowledge_network" },
          eventId: "audit-b", eventName: "role.updated", eventTime: "2026-08-01T09:59:00Z",
          logCategory: "audit.admin", attributes: {}, businessModule: "system_management",
          outcome: "failure", recordedAt: "2026-08-01T09:59:01Z", sourceChannel: "studio", sourceId: "bkn-safe",
          target: { id: "supplychain_hd0202", name: "HD供应链业务知识网络_v3", type: "knowledge_network" },
        }],
        page: 2, pageSize: 20, partial: false, sourceStatus: [],
      });

    render(<ObservabilityLogsScene />);
    fireEvent.click(await screen.findByTitle("2"));
    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(2));
    const [query] = vi.mocked(listLogs).mock.calls[1] ?? [];
    expect(query).toMatchObject({ page: 2, pageSize: 20 });
    expect(query?.timeFrom).toEqual(expect.any(String));
    expect(query?.timeTo).toEqual(expect.any(String));
    expect(await screen.findByText("HD供应链业务知识网络_v3")).not.toBeNull();
  });

	 it("点击日志打开受控详情并可下钻 Trace", async () => {
		 render(<ObservabilityLogsScene />);
		 const summary = await screen.findByText("供应链分析助手 的业务会话");
		 fireEvent.click(summary);
		 await waitFor(() => expect(getLogDetail).toHaveBeenCalledWith("audit-a"));
		 expect(await screen.findByText("bknTrace.logs.detail.title")).not.toBeNull();
		 expect(screen.getAllByText("bknTrace.logs.auditActions.startAgentConversation").length).toBeGreaterThan(0);
		 expect(screen.getByText("bknTrace.logs.detail.businessObject")).not.toBeNull();
		 expect(screen.getAllByText("供应链分析助手 的业务会话").length).toBeGreaterThan(0);
		 expect(screen.getAllByText("通过 API Key").length).toBeGreaterThan(0);
		 expect(screen.getByText("managed")).not.toBeNull();
		 expect(screen.getByText("bknTrace.logs.detail.rawFacts")).not.toBeNull();
		 expect(screen.getByRole("link", { name: "bknTrace.logs.detail.openBusinessProvenance" }).getAttribute("href")).toBe("/studio/observability/business-provenance?conversation_id=conv-a");
		 expect(screen.getByRole("link", { name: "bknTrace.logs.detail.openTrace" }).getAttribute("href")).toBe("/studio/observability/traces?trace_id=4b3d59daeff5bfbb23d46c47a5051ec9");
	 });

  it("旧会话日志用用户目录把操作者 UUID 解析为用户名", async () => {
    vi.mocked(listLogs).mockResolvedValueOnce({
      count: { accuracy: "exact", value: 1 },
      data: [{
        action: "create", actor: { id: "266c6a42-6131-4d62-8f39-853e7093701c", name: "266c6a42-6131-4d62-8f39-853e7093701c", type: "user" }, authMethod: "api_key",
        facts: { action: "create", targetId: "conv-old", targetNameSnapshot: "mcp:933eef3eea1fde73392031e1a7aa74e7", targetType: "conversation" },
        conversationId: "conv-old", eventId: "audit-old", eventName: "conversation.created", eventTime: "2026-08-01T10:00:00Z",
        logCategory: "runtime.business", attributes: {}, businessModule: "domain_knowledge_network", outcome: "success", recordedAt: "2026-08-01T10:00:01Z",
        sourceChannel: "api", sourceId: "bkn-trace-core", target: { id: "conv-old", name: "mcp:933eef3eea1fde73392031e1a7aa74e7", type: "conversation" },
      }],
      partial: false, sourceStatus: [],
    });

    render(<ObservabilityLogsScene />);
    expect(await screen.findByText("未命名 Agent 的业务会话")).not.toBeNull();
    expect(screen.getByText("Administrator")).not.toBeNull();
    expect(screen.queryByText("已认证用户 · 266c6a42…")).toBeNull();
    expect(screen.queryByText("mcp:933eef3eea1fde73392031e1a7aa74e7")).toBeNull();
  });

  it("设置页按业务模块汇总采集来源与保留策略", async () => {
    vi.mocked(listLogSources).mockResolvedValue([
      { coveredModules: ["domain_knowledge_network"], collectionMethod: "source_api", reliability: "best_effort", sourceId: "bkn-backend", status: "healthy" },
      { coveredModules: ["data_resource_knowledge_network"], collectionMethod: "source_api", reliability: "best_effort", sourceId: "vega", status: "healthy" },
      { coveredModules: ["execution_factory"], collectionMethod: "source_api", reliability: "best_effort", sourceId: "execution-factory", status: "healthy" },
      { coveredModules: ["model_management"], collectionMethod: "source_api", reliability: "best_effort", sourceId: "model-manager", status: "healthy" },
      { coveredModules: ["system_management"], collectionMethod: "source_api", reliability: "best_effort", sourceId: "bkn-safe-admin", status: "healthy" },
    ]);
    render(<ObservabilitySettingsScene />);
    await waitFor(() => expect(listLogSources).toHaveBeenCalled());
    expect(await screen.findByText("bknTrace.logs.modules.domain_knowledge_network")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.modules.data_resource_knowledge_network")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.modules.execution_factory")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.modules.model_management")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.modules.system_management")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.modules.observability")).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.sourceLabels.bkn-backend")).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.status.not_integrated")).not.toBeNull();
    expect(screen.getByText("7 bknTrace.settings.days")).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.readOnlyNotice")).not.toBeNull();
  });

  it("设置页将部分管理审计覆盖说明为可读状态", async () => {
    vi.mocked(listLogSources).mockResolvedValueOnce([{ coveredModules: ["data_resource_knowledge_network"], collectionMethod: "source_adapter", reason: "partial_management_audit_coverage", reliability: "best_effort", sourceId: "vega", status: "healthy" }]);

    render(<ObservabilitySettingsScene />);

    expect(await screen.findByText("已接入部分管理操作；其余操作尚未纳入审计。")).not.toBeNull();
  });

  it("点击立即归档先显示不可逆清理确认，而不直接创建归档任务", async () => {
    vi.mocked(getArchiveOverview).mockResolvedValueOnce({ candidateCount: 1, cutoffAt: "2026-07-15T00:00:00Z", kind: "log", retentionDays: 30, storageStatus: "ready" });
    vi.mocked(getArchiveOverview).mockResolvedValueOnce({ candidateCount: 1, cutoffAt: "2026-08-07T00:00:00Z", kind: "trace", retentionDays: 7, storageStatus: "ready" });
    vi.mocked(listArchiveJobs).mockResolvedValue([]);
    render(<ObservabilitySettingsScene />);

		const [archiveButton] = await screen.findAllByRole("button", { name: "bknTrace.settings.archive.action" });
		if (!archiveButton) throw new Error("archive action button is missing");
		fireEvent.click(archiveButton);

    expect(await screen.findByText("bknTrace.settings.archive.confirmTitle")).not.toBeNull();
    expect(createArchive).not.toHaveBeenCalled();
  });

  it("刷新一种归档任务时保留另一种归档任务并本地化枚举", async () => {
    vi.mocked(getArchiveOverview).mockImplementation((kind) => Promise.resolve(kind === "log"
      ? { candidateCount: 1, cutoffAt: "2026-07-15T00:00:00Z", kind, retentionDays: 30, storageStatus: "ready" }
      : { candidateCount: 1, cutoffAt: "2026-08-07T00:00:00Z", kind, retentionDays: 7, storageStatus: "ready" }));
    vi.mocked(listArchiveJobs).mockImplementation((kind) => Promise.resolve(kind === "log"
      ? [{ id: "log-job", kind, range: { from: "2026-07-01", to: "2026-07-15" }, candidateCount: 1, status: "completed" }]
      : [{ id: "trace-job", kind, range: { from: "2026-08-01", to: "2026-08-07" }, candidateCount: 1, status: "cleanup_incomplete" }]));
    vi.mocked(createArchive).mockResolvedValue({ id: "log-job", kind: "log", range: { from: "2026-07-01", to: "2026-07-15" }, candidateCount: 1, status: "completed" });

    render(<ObservabilitySettingsScene />);
    expect(await screen.findByText("bknTrace.settings.archive.kinds.trace")).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.archive.statuses.cleanup_incomplete")).not.toBeNull();
	const [archiveButton] = screen.getAllByRole("button", { name: "bknTrace.settings.archive.action" });
	if (!archiveButton) throw new Error("log archive action button is missing");
	fireEvent.click(archiveButton);
	const confirmationButtons = await screen.findAllByRole("button", { name: "bknTrace.settings.archive.action" });
	const confirmationButton = confirmationButtons.at(-1);
	if (!confirmationButton) throw new Error("archive confirmation button is missing");
	fireEvent.click(confirmationButton);
    await waitFor(() => expect(vi.mocked(listArchiveJobs).mock.calls.filter(([kind]) => kind === "log")).toHaveLength(2));
    expect(screen.getByText("bknTrace.settings.archive.kinds.trace")).not.toBeNull();
  });

  it("设置页按高保真顺序展示五个只读维护分区", async () => {
    render(<ObservabilitySettingsScene />);
    await waitFor(() => expect(listLogSources).toHaveBeenCalled());

    const sectionKeys = [
      "overview", "sources", "storageRetention", "archive.title", "recentArchives",
    ].map((name) => `bknTrace.settings.${name}`);
    const sections = sectionKeys.map((key) => screen.getByText(key));
    sections.forEach((section, index) => {
      if (index > 0) expect(sections[index - 1]?.compareDocumentPosition(section)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
		expect(screen.getByText("bknTrace.settings.archive.logRule")).not.toBeNull();
		expect(screen.getByText("bknTrace.settings.archive.traceRule")).not.toBeNull();
		expect(screen.getAllByText("bknTrace.settings.archive.candidates")).toHaveLength(2);
		expect(screen.getAllByRole("button", { name: "bknTrace.settings.archive.action" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("无全局日志能力时不发起日志检索", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({ ...profile, globalLogSearch: false });
    render(<ObservabilityLogsScene />);
    expect(await screen.findByText("bknTrace.errors.accessDenied")).not.toBeNull();
    expect(listLogs).not.toHaveBeenCalled();
  });

	 it("普通用户可从本人 Trace 关联下钻日志但不能发起全局检索", async () => {
		 window.history.replaceState({}, "", "/observability/logs?trace_id=trace-a");
		 vi.mocked(getAccessProfile).mockResolvedValue({ ...profile, globalLogSearch: false });
		 render(<ObservabilityLogsScene />);
		 await waitFor(() => expect(listLogs).toHaveBeenCalled());
		 const [query] = vi.mocked(listLogs).mock.calls[0] ?? [];
		 expect(query).toMatchObject({ page: 1, pageSize: 20, traceId: "trace-a" });
		 expect(query?.timeFrom).toEqual(expect.any(String));
		 expect(query?.timeTo).toEqual(expect.any(String));
		 expect(await screen.findByText("trace-a")).not.toBeNull();
		 expect(screen.queryByPlaceholderText("bknTrace.logs.searchPlaceholder")).toBeNull();
	 });

  it("关联 Trace 无日志时说明所选时间范围内没有匹配事件", async () => {
    window.history.replaceState({}, "", "/observability/logs?trace_id=trace-a");
    vi.mocked(listLogs).mockResolvedValue({
      count: { accuracy: "exact", value: 0 }, data: [], partial: false, sourceStatus: [],
    });

    render(<ObservabilityLogsScene />);

    expect(await screen.findByText("bknTrace.logs.emptyAssociated")).not.toBeNull();
  });
});
