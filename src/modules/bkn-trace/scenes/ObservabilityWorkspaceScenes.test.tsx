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
import { getLogDetail, listLogPolicies, listLogs, listLogSources } from "@/modules/bkn-trace/services/observability.service";
import { getAccessProfile } from "@/modules/bkn-trace/services/trace.service";
import { AuditLogPage } from "@/modules/system-admin/pages/AuditLogPage";

const translate = (key: string) => ({
  "bknTrace.logs.authenticatedUser": "已认证用户",
  "bknTrace.logs.authMethods.api_key": "通过 API Key",
  "bknTrace.logs.businessConversationSuffix": " 的业务会话",
  "bknTrace.logs.conversationId": "Conversation ID",
  "bknTrace.logs.unnamedAgent": "未命名 Agent",
  "bknTrace.logs.modules.openbkn": "技术运行日志（非操作日志）",
  "bknTrace.settings.status.healthy": "已接入",
}[key] ?? key);

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
  return { ...original, getLogDetail: vi.fn(), listLogPolicies: vi.fn(), listLogs: vi.fn(), listLogSources: vi.fn() };
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

  it("设置页只读展示来源覆盖和保留策略", async () => {
    render(<ObservabilitySettingsScene />);
    await waitFor(() => expect(listLogSources).toHaveBeenCalled());
    expect(await screen.findByText("otel-ss4o")).not.toBeNull();
    expect(screen.getByText("7 bknTrace.settings.days")).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.readOnlyNotice")).not.toBeNull();
  });

  it("设置页明确区分技术运行来源与已接入状态", async () => {
    render(<ObservabilitySettingsScene />);
    await waitFor(() => expect(listLogSources).toHaveBeenCalled());
    expect(await screen.findByText("技术运行日志（非操作日志）")).not.toBeNull();
    expect(screen.getByText("已接入")).not.toBeNull();
    expect(screen.queryByText("openbkn")).toBeNull();
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
    expect(screen.getByText("bknTrace.settings.archive.fixedRule")).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.archive.unavailable")).not.toBeNull();
    expect(screen.getByRole("button", { name: "bknTrace.settings.archive.action" }).hasAttribute("disabled")).toBe(true);
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
