/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import dayjs from "dayjs";
import { AxiosError, AxiosHeaders } from "axios";
import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { formatFileSize } from "@/framework/i18n/format";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ObservabilityLogsScene } from "@/modules/bkn-trace/scenes/ObservabilityLogsScene";
import { ObservabilitySettingsScene } from "@/modules/bkn-trace/scenes/ObservabilitySettingsScene";
import {
  createArchive,
  getArchiveOverview,
  getArchiveRunResult,
  getLogDetail,
  listArchiveJobs,
  listRetainedInteractions,
  listLogPolicies,
  listLogs,
  listLogSources,
  retryArchiveCleanup,
  type ArchiveRun,
  type PublisherCollectionStatus,
} from "@/modules/bkn-trace/services/observability.service";
import {
  changeTraceEvidenceConfiguration,
  getAccessProfile,
  getTraceEvidenceConfiguration,
  getTraceEvidenceOperation,
} from "@/modules/bkn-trace/services/trace.service";
import { AuditLogPage } from "@/modules/system-admin/pages/AuditLogPage";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

vi.mock("@/framework/compat/clipboard", () => ({
  writeTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

const translate = (key: string, options?: Record<string, unknown>) => {
  const value =
    {
      "bknTrace.logs.currentPage": "Page {{page}}",
      "bknTrace.logs.rowsPerPage": "{{size}} / page",
      "bknTrace.logs.authenticatedUser": "已认证用户",
      "bknTrace.logs.authMethods.api_key": "通过 API Key",
      "bknTrace.logs.businessConversationSuffix": " 的业务会话",
      "bknTrace.logs.conversationId": "Conversation ID",
      "bknTrace.logs.unnamedAgent": "未命名 Agent",
      "bknTrace.logs.modules.openbkn": "技术运行日志（非操作日志）",
      "bknTrace.logs.domainAction": "{{action}}{{target}}",
      "bknTrace.logs.domainAuditActions.create": "创建",
      "bknTrace.logs.targetTypes.object_type": "对象类",
      "bknTrace.settings.integration.integrated": "已接入",
      "bknTrace.settings.integration.not_integrated": "未接入",
      "bknTrace.settings.notReturned": "未返回",
      "bknTrace.settings.sourceLabels.audit-ledger": "管理操作审计",
      "bknTrace.settings.capturePolicy.dataUnavailable": "不可用（当前合同未提供）",
      "bknTrace.settings.capturePolicy.noActiveOperation": "无活动操作",
      "bknTrace.settings.capturePolicy.operationUnavailable":
        "当前没有可读取的活动操作；操作详情不在配置快照中。",
    }[key] ?? key;
  return value.replace(/{{(\w+)}}/g, (_match, name: string) =>
    typeof options?.[name] === "string" || typeof options?.[name] === "number"
      ? String(options[name])
      : "",
  );
};

let currentTranslate = translate;

const mockMessage = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

const mockCurrentUser = vi.hoisted(() => ({
  id: "user-a",
  isSuperAdmin: true,
  name: "Current Administrator",
}));

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return { ...original, useTranslation: () => ({ t: currentTranslate }) };
});

vi.mock("@/modules/bkn-trace/services/trace.service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/modules/bkn-trace/services/trace.service")>();
  return {
    ...original,
    changeTraceEvidenceConfiguration: vi.fn(),
    getAccessProfile: vi.fn(),
    getTraceEvidenceConfiguration: vi.fn(),
    getTraceEvidenceOperation: vi.fn(),
  };
});

vi.mock("@/modules/bkn-trace/services/observability.service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/modules/bkn-trace/services/observability.service")>();
  return {
    ...original,
    createArchive: vi.fn(),
    retryArchiveCleanup: vi.fn(),
    getArchiveOverview: vi.fn(),
    getArchiveRunResult: vi.fn(),
    getLogDetail: vi.fn(),
    listArchiveJobs: vi.fn(),
    listRetainedInteractions: vi.fn(),
    listLogPolicies: vi.fn(),
    listLogs: vi.fn(),
    listLogSources: vi.fn(),
  };
});

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    runtimeConfig: { currentUser: mockCurrentUser },
    message: mockMessage,
  }),
}));

const profile = {
  accessScopeFingerprint: "sha256:test",
  allowedLogCategories: ["runtime.business" as const],
  businessProvenanceManagedNetworks: false,
  businessProvenanceOwn: true,
  globalLogSearch: true,
  logExport: false,
  logPolicyRead: true,
  logSensitiveFields: false,
  managementAudit: false,
  securityAudit: false,
  technicalTrace: true,
  traceEvidenceConfigurationRead: true,
  traceEvidenceConfigurationWrite: false,
  observabilityArchiveManage: true,
};

describe("observability workspace scenes", () => {
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
    currentTranslate = translate;
    vi.clearAllMocks();
    mockCurrentUser.isSuperAdmin = true;
    vi.mocked(createArchive).mockReset();
    vi.mocked(retryArchiveCleanup).mockReset();
    vi.mocked(getArchiveOverview).mockReset();
    vi.mocked(listArchiveJobs).mockReset();
    vi.mocked(getArchiveOverview).mockImplementation((kind) =>
      Promise.resolve({
        candidateCount: 0,
        cutoffAt: "2026-08-07T00:00:00Z",
        kind,
        retentionDays: kind === "log" ? 30 : 7,
        storageStatus: "unavailable",
        retainedCount: 0,
      }),
    );
    vi.mocked(listArchiveJobs).mockResolvedValue([]);
    window.history.replaceState({}, "", "/observability/logs");
    vi.mocked(getAccessProfile).mockResolvedValue(profile);
    vi.mocked(getTraceEvidenceConfiguration).mockResolvedValue({
      kind: "configuration_get",
      desiredState: "enabled",
      effectiveState: "enabled",
      policyRevision: 9,
      lastStableRevision: 8,
      heartbeatIntervalSeconds: 10,
      leaseTtlSeconds: 30,
    });
    vi.mocked(getTraceEvidenceOperation).mockReset();
    vi.mocked(listLogs).mockResolvedValue({
      count: { accuracy: "partial", value: 1 },
      data: [
        {
          action: "create",
          actor: { id: "user-a", name: "供应链管理员", type: "user" },
          authMethod: "api_key",
          facts: {
            action: "create",
            targetId: "conv-a",
            targetNameSnapshot: "供应链分析助手",
            targetType: "conversation",
          },
          conversationId: "conv-a",
          eventId: "audit-a",
          eventName: "conversation.created",
          eventTime: "2026-08-01T10:00:00Z",
          logCategory: "runtime.business",
          attributes: {
            agent_name: "供应链分析助手",
            external_conversation_key: "cursor-thread-a",
          },
          businessModule: "domain_knowledge_network",
          outcome: "success",
          recordedAt: "2026-08-01T10:00:01Z",
          requestId: "req-a",
          sourceChannel: "api",
          sourceId: "bkn-trace-core",
          target: { id: "conv-a", name: "供应链分析助手", type: "conversation" },
          traceId: "4b3d59daeff5bfbb23d46c47a5051ec9",
        },
      ],
      partial: true,
      sourceStatus: [
        {
          coveredModules: ["openbkn"],
          reason: "source_query_failed",
          reliability: "best_effort",
          sourceId: "safe-audit",
          status: "unavailable",
        },
      ],
    });
    vi.mocked(listLogSources).mockResolvedValue([
      {
        coveredModules: ["openbkn"],
        collectionMethod: "direct_otlp",
        reliability: "best_effort",
        sourceId: "otel-ss4o",
        status: "healthy",
      },
    ]);
    vi.mocked(listLogPolicies).mockResolvedValue([
      {
        category: "runtime.business",
        legalHold: false,
        policyKind: "runtime",
        policyRevision: "r6.2-default",
        readOnly: true,
        retentionDays: 7,
        scope: {},
      },
    ]);
    vi.mocked(getLogDetail).mockResolvedValue({
      data: {
        action: "create",
        actor: { id: "user-a", name: "供应链管理员", type: "user" },
        authMethod: "api_key",
        facts: {
          action: "create",
          operationType: "conversation.create",
          operationStatus: "completed",
          businessContext: "managed",
          targetId: "conv-a",
          targetNameSnapshot: "供应链分析助手",
          targetType: "conversation",
        },
        conversationId: "conv-a",
        eventId: "audit-a",
        eventName: "conversation.created",
        eventTime: "2026-08-01T10:00:00Z",
        logCategory: "runtime.business",
        attributes: { agent_name: "供应链分析助手", external_conversation_key: "cursor-thread-a" },
        businessModule: "domain_knowledge_network",
        outcome: "success",
        recordedAt: "2026-08-01T10:00:01Z",
        requestId: "req-a",
        sourceChannel: "api",
        sourceId: "bkn-trace-core",
        target: { id: "conv-a", name: "供应链分析助手", type: "conversation" },
        traceId: "4b3d59daeff5bfbb23d46c47a5051ec9",
      },
      policyRevision: "r6.2-default",
      redactedFields: [],
      relatedTraceIds: ["trace-a"],
    });
  });

  afterEach(() => cleanup());

  it("日志检索展示操作审计七列和结果不完整提示", async () => {
    renderWithoutAntdStyles(<ObservabilityLogsScene />);
    await waitFor(() => expect(listLogs).toHaveBeenCalled());
    const [query] = vi.mocked(listLogs).mock.calls[0] ?? [];
    expect(query).toMatchObject({ page: 1, pageSize: 20 });
    expect(query?.timeFrom).toEqual(expect.any(String));
    expect(query?.timeTo).toEqual(expect.any(String));
    expect(dayjs(query?.timeTo).diff(dayjs(query?.timeFrom), "day")).toBe(7);
    expect(
      await screen.findByText("bknTrace.logs.auditActions.startAgentConversation"),
    ).not.toBeNull();
    expect(screen.getByText("供应链分析助手 的业务会话")).not.toBeNull();
    expect(screen.getByText("供应链分析助手 的业务会话").closest("[aria-label]")).not.toBeNull();
    const actor = screen.getByText("供应链管理员").closest("[aria-label]");
    expect(actor).not.toBeNull();
    expect(actor?.getAttribute("aria-label")).toContain("通过 API Key");
    expect(screen.getByText("bknTrace.logs.partialWarning")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.modules.domain_knowledge_network")).not.toBeNull();
    for (const column of ["time", "module", "action", "target", "actor", "outcome", "source"]) {
      expect(screen.getByText(`bknTrace.logs.columns.${column}`)).not.toBeNull();
    }
  });

  it("从用户管理审计下钻按操作者筛选，不暴露内部来源故障", async () => {
    window.history.replaceState({}, "", "/system/audit?actor_id=user-a&actor_match=exact");
    renderWithoutAntdStyles(<ObservabilityLogsScene mode="audit" />);

    await waitFor(() => expect(listLogs).toHaveBeenCalled());
    const [query] = vi.mocked(listLogs).mock.calls[0] ?? [];
    expect(query).toMatchObject({
      actorId: "user-a",
      categories: ["audit.admin"],
    });
    expect(query).not.toHaveProperty("businessModule");
    expect(query).not.toHaveProperty("sourceId");
    expect(await screen.findByText("bknTrace.logs.actorPlaceholder")).not.toBeNull();
    expect(screen.getByText("Current Administrator")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.partialWarning")).not.toBeNull();
    expect(screen.queryByText(/safe-audit|source_query_failed/)).toBeNull();
  });

  it("将旧链接中的 actor_id 保持为自由文本操作者筛选", async () => {
    window.history.replaceState({}, "", "/observability/logs?actor_id=%E5%BC%A0%E4%B8%89");
    renderWithoutAntdStyles(<ObservabilityLogsScene />);

    await waitFor(() => expect(listLogs).toHaveBeenCalled());
    const [query] = vi.mocked(listLogs).mock.calls[0] ?? [];
    expect(query).toMatchObject({ actorQuery: "张三" });
    expect(query).not.toHaveProperty("actorId");
    expect(screen.getByDisplayValue("张三")).not.toBeNull();
    expect(screen.queryByText("bknTrace.logs.associatedTarget.user")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.reset" }));
    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(2));
    const [resetQuery] = vi.mocked(listLogs).mock.calls[1] ?? [];
    expect(resetQuery).not.toHaveProperty("actorId");
    expect(resetQuery).not.toHaveProperty("actorQuery");
    expect(new URLSearchParams(window.location.search).has("actor_id")).toBe(false);
  });

  it("系统审计未配置时展示配置提示，刷新成功后清除提示", async () => {
    vi.mocked(listLogs).mockRejectedValueOnce(
      new AxiosError("Request failed with status code 503", undefined, undefined, undefined, {
        config: { headers: new AxiosHeaders() },
        data: { error: { code: "audit_consumer_not_configured", retryable: false } },
        headers: {},
        status: 503,
        statusText: "Service Unavailable",
      }),
    );
    renderWithoutAntdStyles(<ObservabilityLogsScene mode="audit" />);
    expect(await screen.findByText("bknTrace.errors.auditNotConfigured")).not.toBeNull();
    expect(screen.queryByText("Request failed with status code 503")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.refresh" }));
    await waitFor(() =>
      expect(screen.queryByText("bknTrace.errors.auditNotConfigured")).toBeNull(),
    );
    expect(screen.getByText("供应链分析助手 的业务会话")).not.toBeNull();
  });

  it("混合查询保留可用数据并提示审计尚未配置", async () => {
    const result = await vi.mocked(listLogs)({});
    vi.mocked(listLogs).mockResolvedValueOnce({
      ...result,
      sourceStatus: [
        {
          sourceId: "audit-ledger",
          status: "not_integrated",
          reliability: "best_effort",
          coveredModules: ["system_management"],
          reason: "audit_consumer_not_configured",
        },
      ],
    });
    renderWithoutAntdStyles(<ObservabilityLogsScene />);
    expect(await screen.findByText("bknTrace.errors.auditNotConfigured")).not.toBeNull();
    expect(screen.getByText("供应链分析助手 的业务会话")).not.toBeNull();
  });

  it("查询失败时仅提示结果不完整，不显示内部来源和错误码", async () => {
    vi.mocked(listLogs).mockResolvedValueOnce({
      count: { accuracy: "partial", value: 0 },
      data: [],
      partial: true,
      sourceStatus: [
        {
          coveredModules: [],
          reliability: "best_effort",
          sourceId: "available-source",
          status: "available",
        },
        {
          coveredModules: [],
          reason: "network_timeout",
          reliability: "best_effort",
          sourceId: "unavailable-source",
          status: "unavailable",
        },
      ],
    });
    renderWithoutAntdStyles(<ObservabilityLogsScene />);

    expect(screen.queryByText(/available-source ·/)).toBeNull();
    expect(await screen.findByText("bknTrace.logs.partialWarning")).not.toBeNull();
    expect(screen.queryByText(/network_timeout|unavailable-source/)).toBeNull();
  });

  it.each(["source_status_probe_failed", "telemetry_dropped", "partial_management_audit_coverage"])(
    "查询覆盖不完整时保留结果并提示风险：%s",
    async (reason) => {
      const result = await vi.mocked(listLogs)({});
      vi.mocked(listLogs).mockResolvedValueOnce({
        ...result,
        partial: true,
        sourceStatus: [
          {
            sourceId: "private-source",
            status: "degraded",
            reliability: "best_effort",
            coveredModules: [],
            reason,
          },
        ],
      });
      renderWithoutAntdStyles(<ObservabilityLogsScene />);
      expect(await screen.findByText("bknTrace.logs.partialWarning")).not.toBeNull();
      expect(screen.getByText("供应链分析助手 的业务会话")).not.toBeNull();
      expect(
        screen.queryByText(
          /private-source|source_status_probe_failed|telemetry_dropped|partial_management_audit_coverage/,
        ),
      ).toBeNull();
    },
  );

  it("未接入来源不会被显示为查询故障", () => {
    vi.mocked(listLogs).mockResolvedValueOnce({
      count: { accuracy: "partial", value: 0 },
      data: [],
      partial: true,
      sourceStatus: [
        {
          coveredModules: [],
          reason: "source_not_integrated",
          reliability: "best_effort",
          sourceId: "not-integrated-source",
          status: "not_integrated",
        },
      ],
    });
    renderWithoutAntdStyles(<ObservabilityLogsScene />);

    expect(screen.queryByText(/not-integrated-source ·/)).toBeNull();
    expect(screen.queryByText("bknTrace.logs.partialWarning")).toBeNull();
    expect(
      screen.queryByText(
        (_content, element) =>
          element?.textContent?.includes("bknTrace.logs.sourceFailures") ?? false,
      ),
    ).toBeNull();
  });

  it("以业务语言展示领域知识网络管理事实", async () => {
    vi.mocked(listLogs).mockResolvedValueOnce({
      count: { accuracy: "exact", value: 1 },
      data: [
        {
          action: "create",
          actor: { id: "user-a", name: "供应链管理员", type: "user" },
          authMethod: "api_key",
          facts: {
            action: "create",
            targetId: "material",
            targetNameSnapshot: "物料",
            targetType: "object_type",
          },
          eventId: "evt-a",
          eventName: "resource_config.changed",
          eventTime: "2026-08-13T08:00:00Z",
          logCategory: "audit.admin",
          attributes: { method: "POST" },
          businessModule: "domain_knowledge_network",
          outcome: "success",
          recordedAt: "2026-08-13T08:00:01Z",
          requestId: "req-a",
          sourceChannel: "api",
          sourceId: "bkn-backend",
          target: { id: "material", name: "物料", type: "object_type" },
        },
      ],
      partial: false,
      sourceStatus: [
        {
          coveredModules: ["domain_knowledge_network"],
          reliability: "best_effort",
          sourceId: "bkn-backend",
          status: "healthy",
        },
      ],
    });

    renderWithoutAntdStyles(<ObservabilityLogsScene />);

    expect(await screen.findByText("创建对象类")).not.toBeNull();
    expect(screen.getByText("对象类: 物料")).not.toBeNull();
    expect(screen.getByText("供应链管理员")).not.toBeNull();
  });

  it.each([
    {
      name: "unknown idle source",
      status: "unknown",
      reason: "delivery_not_observed",
      historicalGap: null,
    },
    {
      name: "unavailable diagnostics",
      status: "unknown",
      reason: "audit_producer_status_unavailable",
      historicalGap: null,
    },
    {
      name: "stale diagnostics",
      status: "unknown",
      reason: "audit_producer_status_stale",
      historicalGap: null,
    },
    {
      name: "delivery failure",
      status: "degraded",
      reason: "private_internal_failure_code",
      historicalGap: true,
    },
    {
      name: "publisher unavailable without confirmed record loss",
      status: "degraded",
      reason: "publisher_unavailable",
      historicalGap: null,
    },
    {
      name: "recovered publisher with historical gap",
      status: "healthy",
      reason: "delivery_observed",
      historicalGap: true,
    },
    {
      name: "current delivery without known gap",
      status: "healthy",
      reason: "delivery_observed",
      historicalGap: false,
    },
  ] as const)(
    "keeps $name diagnostics out of log search",
    async ({ status, reason, historicalGap }) => {
      const collectionStatus: PublisherCollectionStatus = {
        scope: "bkn-safe-publisher-instance",
        instanceId: "safe-current",
        status,
        reason,
        observedAt: null,
        lastDeliveredAt: null,
        lastFailureAt: null,
        droppedRecords: status === "unknown" ? null : 0,
        historicalGap,
        historicalGapSince: historicalGap ? "2026-10-23T12:00:00Z" : null,
      };
      vi.mocked(listLogs).mockResolvedValueOnce({
        count: { accuracy: "exact", value: 0 },
        data: [],
        partial: false,
        sourceStatus: [
          {
            sourceId: "audit-ledger",
            status: "healthy",
            statusScope: "query",
            reliability: "best_effort",
            coveredModules: [],
            collectionStatus,
          },
        ],
      });
      renderWithoutAntdStyles(<ObservabilityLogsScene />);
      expect(await screen.findByText("bknTrace.logs.emptyRange")).not.toBeNull();
      expect(screen.queryByText(/bknTrace.logs.publisher/)).toBeNull();
      expect(
        screen.queryByText(/audit-ledger|safe-current|bkn-safe-publisher-instance/),
      ).toBeNull();
      expect(screen.queryByText(reason)).toBeNull();
      expect(screen.queryByText("bknTrace.logs.partialWarning")).toBeNull();
      expect(screen.queryByText("bknTrace.logs.historyWarning") !== null).toBe(
        historicalGap === true,
      );
      expect(screen.queryByText("bknTrace.logs.collectionWarning") !== null).toBe(
        status === "degraded",
      );
      expect(listLogs).toHaveBeenCalledTimes(1);
      expect(listLogSources).not.toHaveBeenCalled();
    },
  );

  it.each([0, 4])(
    "legacy sources show only confirmed record loss (dropped: %s)",
    async (droppedRecords) => {
      vi.mocked(listLogs).mockResolvedValueOnce({
        count: { accuracy: "exact", value: 0 },
        data: [],
        partial: false,
        sourceStatus: [
          {
            sourceId: "audit-ledger",
            status: "healthy",
            reliability: "best_effort",
            coveredModules: [],
            droppedRecords,
          },
        ],
      });
      renderWithoutAntdStyles(<ObservabilityLogsScene />);
      await screen.findByText("bknTrace.logs.emptyRange");
      expect(screen.queryByText(/bknTrace.logs.publisher|audit-ledger/)).toBeNull();
      expect(screen.queryByText("bknTrace.logs.historyWarning") !== null).toBe(droppedRecords > 0);
    },
  );

  it("unsupported internal diagnostics do not appear in log search", async () => {
    vi.mocked(listLogs).mockResolvedValueOnce({
      count: { accuracy: "exact", value: 0 },
      data: [],
      partial: false,
      sourceStatus: [
        {
          sourceId: "audit-ledger",
          status: "healthy",
          reliability: "best_effort",
          coveredModules: [],
          collectionStatus: {
            scope: "bkn-safe-publisher-instance",
            status: "unknown",
            reason: "unsupported_publisher_status",
            observedAt: null,
            lastDeliveredAt: null,
            lastFailureAt: null,
            droppedRecords: null,
            historicalGap: null,
            historicalGapSince: null,
          },
        },
      ],
    });
    renderWithoutAntdStyles(<ObservabilityLogsScene />);
    await screen.findByText("bknTrace.logs.emptyRange");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.queryByText(/bknTrace.logs.publisher|audit-ledger|unsupported_publisher_status/),
    ).toBeNull();
  });

  it("从链接恢复日志时间范围", async () => {
    window.history.replaceState(
      {},
      "",
      "/observability/logs?time_from=2026-08-01T00%3A00%3A00.000Z&time_to=2026-08-03T00%3A00%3A00.000Z",
    );

    renderWithoutAntdStyles(<ObservabilityLogsScene />);

    await waitFor(() => expect(listLogs).toHaveBeenCalled());
    const [query] = vi.mocked(listLogs).mock.calls[0] ?? [];
    expect(query?.timeFrom).toBe("2026-08-01T00:00:00.000Z");
    expect(query?.timeTo).toBe("2026-08-03T00:00:00.000Z");
  });

  it("忽略已废弃的 q 参数，仅保留结构化筛选", async () => {
    window.history.replaceState(
      {},
      "",
      "/observability/logs?q=legacy-keyword&actor=%E5%BC%A0%E4%B8%89&outcome=failure",
    );

    renderWithoutAntdStyles(<ObservabilityLogsScene />);

    await waitFor(() => expect(listLogs).toHaveBeenCalled());
    const [query] = vi.mocked(listLogs).mock.calls[0] ?? [];
    expect(query).toMatchObject({ actorQuery: "张三", outcomes: ["failure"] });
    expect(query).not.toHaveProperty("query");
    expect(screen.queryByPlaceholderText("bknTrace.logs.searchPlaceholder")).toBeNull();
  });

  it("系统管理日志入口复用统一工作台并保留对象下钻条件", async () => {
    window.history.replaceState({}, "", "/system/audit?target_type=user&target_id=user-a");
    renderWithoutAntdStyles(<AuditLogPage />);
    await waitFor(() => expect(listLogs).toHaveBeenCalled());
    const [query] = vi.mocked(listLogs).mock.calls[0] ?? [];
    expect(query).toMatchObject({
      categories: ["audit.admin"],
      targetId: "user-a",
      targetType: "user",
    });
    expect(dayjs(query?.timeTo).diff(dayjs(query?.timeFrom), "day")).toBe(30);
    expect(await screen.findByText("bknTrace.logs.auditTitle")).not.toBeNull();
  });

  it("按被操作用户精确查询，可同时限定操作者、时间和结果", async () => {
    window.history.replaceState(
      {},
      "",
      "/system/audit?time_from=2026-10-01T00:00:00Z&time_to=2026-10-31T00:00:00Z&outcome=failure",
    );
    renderWithoutAntdStyles(<AuditLogPage />);
    const target = await screen.findByPlaceholderText("bknTrace.logs.targetUserPlaceholder");
    fireEvent.change(target, { target: { value: " deleted-user-1 " } });
    fireEvent.change(screen.getByPlaceholderText("bknTrace.logs.actorPlaceholder"), {
      target: { value: "管理员甲" },
    });
    fireEvent.click(screen.getByText("bknTrace.actions.query"));
    await waitFor(() =>
      expect(listLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          targetId: "deleted-user-1",
          targetType: "user",
          actorQuery: "管理员甲",
          categories: ["audit.admin"],
          outcomes: ["failure"],
          timeFrom: "2026-10-01T00:00:00.000Z",
          timeTo: "2026-10-31T00:00:00.000Z",
        }),
      ),
    );
    expect(vi.mocked(listLogs).mock.lastCall?.[0]).not.toHaveProperty("actorId");
    expect(new URLSearchParams(window.location.search).get("target_id")).toBe("deleted-user-1");
  });

  it("用户管理记录下钻可改查另一个用户，重置不会残留原用户限制", async () => {
    window.history.replaceState(
      {},
      "",
      "/system/audit?target_type=user&target_id=deleted-user-old",
    );
    renderWithoutAntdStyles(<AuditLogPage />);
    const target = await screen.findByPlaceholderText("bknTrace.logs.targetUserPlaceholder");
    expect(target).toHaveValue("deleted-user-old");
    fireEvent.change(target, { target: { value: "recreated-user-new" } });
    fireEvent.click(screen.getByText("bknTrace.actions.query"));
    await waitFor(() =>
      expect(listLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          targetId: "recreated-user-new",
          targetType: "user",
        }),
      ),
    );
    expect(screen.queryByText(/deleted-user-old/)).toBeNull();
    fireEvent.click(screen.getByText("bknTrace.actions.reset"));
    await waitFor(() => expect(target).toHaveValue(""));
    expect(vi.mocked(listLogs).mock.lastCall?.[0]).not.toHaveProperty("targetId");
    expect(vi.mocked(listLogs).mock.lastCall?.[0]).not.toHaveProperty("targetType");
    expect(new URLSearchParams(window.location.search).has("target_id")).toBe(false);
  });

  it("被操作用户查询的分页和刷新只使用已提交条件", async () => {
    const base = await vi.mocked(listLogs)({});
    vi.mocked(listLogs).mockClear();
    vi.mocked(listLogs).mockResolvedValue({ ...base, nextCursor: "user-page-2" });
    window.history.replaceState({}, "", "/system/audit?target_type=user&target_id=old-user");
    renderWithoutAntdStyles(<AuditLogPage />);
    const target = await screen.findByPlaceholderText("bknTrace.logs.targetUserPlaceholder");
    await screen.findByText("bknTrace.logs.resultCountUnknown");
    fireEvent.change(target, { target: { value: "new-user" } });
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
    await waitFor(() =>
      expect(listLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          targetId: "old-user",
          targetType: "user",
          page: 2,
          cursor: "user-page-2",
        }),
      ),
    );
    fireEvent.click(screen.getByText("bknTrace.actions.query"));
    await waitFor(() =>
      expect(listLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ targetId: "new-user", page: 1 }),
      ),
    );
    expect(vi.mocked(listLogs).mock.lastCall?.[0]).not.toHaveProperty("cursor");
    fireEvent.change(target, { target: { value: "unsubmitted-user" } });
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.refresh" }));
    await waitFor(() =>
      expect(listLogs).toHaveBeenLastCalledWith(expect.objectContaining({ targetId: "new-user" })),
    );
  });

  it("非用户对象下钻和普通日志不显示被操作用户筛选", async () => {
    window.history.replaceState({}, "", "/system/audit?target_type=role&target_id=role-1");
    const view = renderWithoutAntdStyles(<AuditLogPage />);
    await waitFor(() => expect(listLogs).toHaveBeenCalled());
    expect(vi.mocked(listLogs).mock.lastCall?.[0]).toMatchObject({
      targetId: "role-1",
      targetType: "role",
    });
    expect(screen.queryByPlaceholderText("bknTrace.logs.targetUserPlaceholder")).toBeNull();
    view.unmount();
    window.history.replaceState({}, "", "/observability/logs");
    renderWithoutAntdStyles(<ObservabilityLogsScene />);
    await screen.findByText("bknTrace.logs.title");
    expect(screen.queryByPlaceholderText("bknTrace.logs.targetUserPlaceholder")).toBeNull();
  });

  it("无全局查询权限不能使用用户目标筛选扩大范围", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({
      ...profile,
      globalLogSearch: false,
      businessProvenanceOwn: false,
    });
    window.history.replaceState({}, "", "/system/audit?target_type=user&target_id=someone");
    renderWithoutAntdStyles(<AuditLogPage />);
    await screen.findByText("bknTrace.errors.accessDenied");
    expect(listLogs).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText("bknTrace.logs.targetUserPlaceholder")).toBeNull();
  });

  it("用户管理审计零命中说明查询范围，并保留查询不完整提示", async () => {
    const base = await vi.mocked(listLogs)({});
    vi.mocked(listLogs).mockClear();
    vi.mocked(listLogs).mockResolvedValue({
      ...base,
      data: [],
      count: { accuracy: "partial", value: 0 },
    });
    renderWithoutAntdStyles(<AuditLogPage />);
    expect(await screen.findByText("bknTrace.logs.emptyAuditRange")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.partialWarning")).not.toBeNull();
  });

  it("审计查询失败时仅展示错误，不伪装成零条结果", async () => {
    window.history.replaceState({}, "", "/system/audit?target_type=user&target_id=user-a");
    vi.mocked(listLogs).mockRejectedValueOnce(
      new Error("resource_type is not part of the operation audit query contract"),
    );

    renderWithoutAntdStyles(<AuditLogPage />);

    expect(
      await screen.findByText("resource_type is not part of the operation audit query contract"),
    ).not.toBeNull();
    expect(screen.queryByText("bknTrace.logs.resultCount")).toBeNull();
    expect(screen.queryByText("bknTrace.logs.emptyAssociated")).toBeNull();
    expect(screen.queryByText("bknTrace.logs.emptyAuditRange")).toBeNull();
  });

  it("刷新查询时保留已有结果并展示加载反馈", async () => {
    renderWithoutAntdStyles(<ObservabilityLogsScene />);
    expect(await screen.findByText("供应链分析助手 的业务会话")).not.toBeNull();
    vi.mocked(listLogs).mockImplementationOnce(() => new Promise(() => undefined));

    fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.refresh" }));

    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(2));
    expect(screen.getByText("供应链分析助手 的业务会话")).not.toBeNull();
    await waitFor(() => expect(document.querySelector(".ant-spin-spinning")).not.toBeNull());
  });

  it("总数不可知时不显示为零条结果", async () => {
    vi.mocked(listLogs).mockResolvedValueOnce({
      count: { accuracy: "partial", value: null },
      data: [],
      partial: true,
      sourceStatus: [],
    });

    renderWithoutAntdStyles(<ObservabilityLogsScene />);

    expect(await screen.findByText("bknTrace.logs.resultCountUnknown")).not.toBeNull();
    expect(screen.queryByText("bknTrace.logs.resultCount")).toBeNull();
  });

  it.each(["logs", "audit"] as const)(
    "%s partial 计数缩小后仍可遍历全部记录并返回上一页",
    async (mode) => {
      const base = await vi.mocked(listLogs)({});
      const records = Array.from({ length: 58 }, (_, index) => ({
        ...base.data[0],
        eventId: `event-${index}`,
        target: { ...base.data[0].target, name: `record-${index}` },
        facts: { ...base.data[0].facts, targetNameSnapshot: `record-${index}` },
      }));
      vi.mocked(listLogs).mockClear();
      vi.mocked(listLogs).mockImplementation((query) => {
        const page = query.page ?? 1;
        expect(query.cursor).toBe(page === 1 ? undefined : `cursor-${page}`);
        return Promise.resolve({
          ...base,
          data: records.slice((page - 1) * 20, page * 20),
          count: { accuracy: "partial", value: [58, 38, 24][page - 1] },
          nextCursor: page < 3 ? `cursor-${page + 1}` : undefined,
          page,
          pageSize: 20,
          partial: false,
          sourceStatus: [],
        });
      });
      renderWithoutAntdStyles(<ObservabilityLogsScene mode={mode} />);
      await waitFor(() =>
        expect(document.querySelector('tr[data-row-key="event-0"]')).not.toBeNull(),
      );
      expect(screen.queryByText("bknTrace.logs.resultCount")).toBeNull();
      const visited: string[] = [];
      for (let page = 1; page <= 3; page++) {
        await waitFor(() =>
          expect(
            document.querySelector(`tr[data-row-key="event-${(page - 1) * 20}"]`),
          ).not.toBeNull(),
        );
        visited.push(
          ...Array.from(document.querySelectorAll("tr[data-row-key]"), (row) =>
            row.getAttribute("data-row-key")!,
          ),
        );
        if (page < 3)
          fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
      }
      expect(visited).toEqual(records.map((record) => record.eventId));
      expect(screen.getByRole("button", { name: "bknTrace.logs.nextPage" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.previousPage" }));
      await waitFor(() =>
        expect(document.querySelector('tr[data-row-key="event-20"]')).not.toBeNull(),
      );
      fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.refresh" }));
      await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(5));
      expect(
        vi
          .mocked(listLogs)
          .mock.calls.every(([query]) =>
            mode === "audit" ? query.categories?.[0] === "audit.admin" : !query.categories,
          ),
      ).toBe(true);
    },
  );

  it.each(["logs", "audit"] as const)("%s 游标过期后保留已提交条件并重新开始", async (mode) => {
    window.history.replaceState({}, "", "/observability/logs?actor=committed");
    const base = await vi.mocked(listLogs)({});
    vi.mocked(listLogs).mockClear();
    const expired = new AxiosError("expired cursor", undefined, undefined, undefined, {
      config: { headers: new AxiosHeaders() },
      headers: {},
      status: 409,
      statusText: "Conflict",
      data: { error: { code: "cursor_stale", retryable: false } },
    });
    vi.mocked(listLogs)
      .mockResolvedValueOnce({ ...base, nextCursor: "expired-page-2" })
      .mockRejectedValueOnce(expired)
      .mockResolvedValueOnce({ ...base, nextCursor: "fresh-page-2" })
      .mockResolvedValueOnce({ ...base, nextCursor: undefined });
    renderWithoutAntdStyles(<ObservabilityLogsScene mode={mode} />);
    await screen.findByText(" 的业务会话", { exact: false });
    fireEvent.change(screen.getByPlaceholderText("bknTrace.logs.actorPlaceholder"), {
      target: { value: "draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
    await screen.findByText("bknTrace.errors.cursorStale");
    expect(listLogs).toHaveBeenCalledTimes(2); // Recovery requires an explicit action.
    expect(vi.mocked(listLogs).mock.calls[1]?.[0]).toMatchObject({
      cursor: "expired-page-2",
      page: 2,
    });
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.restartQuery" }));
    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(3));
    const restarted = vi.mocked(listLogs).mock.calls[2]?.[0];
    expect(restarted).toEqual({ ...vi.mocked(listLogs).mock.calls[0]?.[0], page: 1 });
    expect(restarted?.cursor).toBeUndefined();
    expect(restarted?.actorQuery).toBe("committed");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "bknTrace.logs.nextPage" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(4));
    expect(vi.mocked(listLogs).mock.calls[3]?.[0]).toMatchObject({
      cursor: "fresh-page-2",
      page: 2,
    });
  });

  it("游标过期后的刷新从首页恢复，普通错误仍可重试原续页", async () => {
    const base = await vi.mocked(listLogs)({});
    vi.mocked(listLogs).mockClear();
    const error = (code: string) =>
      new AxiosError(code, undefined, undefined, undefined, {
        config: { headers: new AxiosHeaders() },
        headers: {},
        status: 409,
        statusText: "Conflict",
        data: { error: { code } },
      });
    vi.mocked(listLogs)
      .mockResolvedValueOnce({ ...base, nextCursor: "page-2" })
      .mockRejectedValueOnce(error("conflict"))
      .mockRejectedValueOnce(error("cursor_stale"))
      .mockResolvedValueOnce({ ...base, nextCursor: "new-page-2" });
    renderWithoutAntdStyles(<ObservabilityLogsScene />);
    await screen.findByText(" 的业务会话", { exact: false });
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
    await screen.findByText("conflict");
    expect(screen.queryByRole("button", { name: "bknTrace.actions.restartQuery" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.refresh" }));
    await screen.findByText("bknTrace.errors.cursorStale");
    expect(vi.mocked(listLogs).mock.calls[2]?.[0]).toMatchObject({ cursor: "page-2", page: 2 });
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.refresh" }));
    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(4));
    expect(vi.mocked(listLogs).mock.calls[3]?.[0]).toEqual({
      ...vi.mocked(listLogs).mock.calls[0]?.[0],
      page: 1,
    });
  });

  it("合法空批次仍可通过游标继续查询", async () => {
    const base = await vi.mocked(listLogs)({});
    vi.mocked(listLogs).mockClear();
    vi.mocked(listLogs)
      .mockResolvedValueOnce({
        ...base,
        data: [],
        count: { accuracy: "partial", value: 0 },
        nextCursor: "after-filtered-batch",
      })
      .mockResolvedValueOnce({ ...base, nextCursor: undefined });
    renderWithoutAntdStyles(<ObservabilityLogsScene />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "bknTrace.logs.nextPage" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
    await screen.findByText(" 的业务会话", { exact: false });
    expect(vi.mocked(listLogs).mock.calls[1]?.[0]).toMatchObject({
      cursor: "after-filtered-batch",
      page: 2,
    });
  });

  it("审计首页 partial=21 不误报总数，第二页 exact=47 后保留精确页码", async () => {
    const base = await vi.mocked(listLogs)({});
    vi.mocked(listLogs).mockClear();
    vi.mocked(listLogs)
      .mockResolvedValueOnce({
        ...base,
        count: { accuracy: "partial", value: 21 },
        nextCursor: "audit-page-2",
        partial: false,
        sourceStatus: [],
      })
      .mockResolvedValueOnce({
        ...base,
        count: { accuracy: "exact", value: 47 },
        page: 2,
        pageSize: 20,
        nextCursor: "audit-page-3",
        partial: false,
        sourceStatus: [],
      });
    renderWithoutAntdStyles(<ObservabilityLogsScene mode="audit" />);
    await screen.findByText("bknTrace.logs.resultCountUnknown");
    expect(screen.queryByText("bknTrace.logs.resultCount")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
    await screen.findByTitle("3");
    expect(screen.getByText("bknTrace.logs.resultCount")).not.toBeNull();
    expect(vi.mocked(listLogs).mock.calls[1]?.[0]).toMatchObject({
      page: 2,
      cursor: "audit-page-2",
      categories: ["audit.admin"],
    });
  });

  it.each([null, 0])("partial=%s 仍按游标导航，未提交的筛选不改变当前查询", async (value) => {
    const base = await vi.mocked(listLogs)({});
    vi.mocked(listLogs).mockClear();
    vi.mocked(listLogs).mockResolvedValue({
      ...base,
      count: { accuracy: "partial", value },
      nextCursor: "continuation",
      partial: false,
      sourceStatus: [],
    });
    renderWithoutAntdStyles(<ObservabilityLogsScene />);
    await screen.findByText("bknTrace.logs.resultCountUnknown");
    fireEvent.change(screen.getByPlaceholderText("bknTrace.logs.actorPlaceholder"), {
      target: { value: "new actor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(2));
    expect(vi.mocked(listLogs).mock.calls[1]?.[0]).toMatchObject({
      page: 2,
      cursor: "continuation",
    });
    expect(vi.mocked(listLogs).mock.calls[1]?.[0].actorQuery).toBeUndefined();
    await screen.findByText("Page 2");
    fireEvent.click(screen.getByText("bknTrace.actions.query"));
    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(3));
    expect(vi.mocked(listLogs).mock.calls[2]?.[0]).toMatchObject({
      page: 1,
      actorQuery: "new actor",
    });
    expect(vi.mocked(listLogs).mock.calls[2]?.[0].cursor).toBeUndefined();
    await screen.findByText("Page 1");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "bknTrace.logs.pageSize" }));
    fireEvent.click(await screen.findByText("50 / page"));
    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(4));
    expect(vi.mocked(listLogs).mock.calls[3]?.[0]).toMatchObject({
      page: 1,
      pageSize: 50,
      actorQuery: "new actor",
    });
    expect(vi.mocked(listLogs).mock.calls[3]?.[0].cursor).toBeUndefined();
  });

  it.each(["success", "stale"])(
    "新的筛选查询完成后，旧翻页 %s 不能覆盖结果或游标",
    async (kind) => {
      const base = await vi.mocked(listLogs)({});
      vi.mocked(listLogs).mockClear();
      let rejectOldPage: ((error: Error) => void) | undefined;
      let finishOldPage: ((result: typeof base) => void) | undefined;
      vi.mocked(listLogs)
        .mockResolvedValueOnce({ ...base, nextCursor: "old-page-2", sourceStatus: [] })
        .mockImplementationOnce(
          () =>
            new Promise((resolve, reject) => {
              finishOldPage = resolve;
              rejectOldPage = reject;
            }),
        )
        .mockResolvedValueOnce({ ...base, nextCursor: "new-page-2", sourceStatus: [] })
        .mockResolvedValueOnce({ ...base, sourceStatus: [] });
      renderWithoutAntdStyles(<ObservabilityLogsScene />);
      await screen.findByText("bknTrace.logs.resultCountUnknown");
      fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
      await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(2));
      expect(screen.getByRole("button", { name: "bknTrace.logs.nextPage" })).toBeDisabled();
      fireEvent.change(screen.getByPlaceholderText("bknTrace.logs.actorPlaceholder"), {
        target: { value: "new actor" },
      });
      fireEvent.click(screen.getByText("bknTrace.actions.query"));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "bknTrace.logs.nextPage" })).toBeEnabled(),
      );
      await act(async () => {
        if (kind === "stale")
          rejectOldPage?.(
            new AxiosError("expired", undefined, undefined, undefined, {
              config: { headers: new AxiosHeaders() },
              headers: {},
              status: 409,
              statusText: "Conflict",
              data: { error: { code: "cursor_stale" } },
            }),
          );
        else finishOldPage?.({ ...base, nextCursor: "obsolete-page-3", page: 2, sourceStatus: [] });
        await Promise.resolve();
      });
      expect(screen.queryByText("bknTrace.errors.cursorStale")).toBeNull();
      expect(screen.getByText("Page 1")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
      await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(4));
      expect(vi.mocked(listLogs).mock.calls[3]?.[0]).toMatchObject({
        page: 2,
        cursor: "new-page-2",
        actorQuery: "new actor",
      });
    },
    20_000,
  );

  it.each(["query", "reset", "size"])(
    "%s 请求失败后刷新仍从请求的首页及页大小开始",
    async (action) => {
      const base = await vi.mocked(listLogs)({});
      vi.mocked(listLogs).mockClear();
      vi.mocked(listLogs).mockResolvedValue({ ...base, nextCursor: "next", sourceStatus: [] });
      renderWithoutAntdStyles(<ObservabilityLogsScene />);
      await screen.findByText("Page 1");
      for (const page of [2, 3]) {
        fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
        await screen.findByText(`Page ${page}`);
      }
      fireEvent.change(screen.getByPlaceholderText("bknTrace.logs.actorPlaceholder"), {
        target: { value: "new actor" },
      });
      vi.mocked(listLogs).mockRejectedValueOnce(new Error("query failed"));
      if (action === "size") {
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "bknTrace.logs.pageSize" }));
        fireEvent.click(await screen.findByText("50 / page"));
      } else {
        fireEvent.click(screen.getByText(`bknTrace.actions.${action}`));
      }
      await screen.findByText("query failed");
      const failedQuery = vi.mocked(listLogs).mock.calls[3]?.[0];
      expect(failedQuery).toMatchObject({ page: 1, pageSize: action === "size" ? 50 : 20 });
      expect(failedQuery?.cursor).toBeUndefined();
      fireEvent.click(screen.getByRole("button", { name: "bknTrace.actions.refresh" }));
      await screen.findByText("Page 1");
      expect(vi.mocked(listLogs).mock.calls[4]?.[0]).toEqual(failedQuery);
    },
  );

  it.each(["cursor_stale", "audit_consumer_not_configured"])(
    "%s 后切换语言遇到权限加载失败，应清除旧错误类型",
    async (code) => {
      const base = await vi.mocked(listLogs)({});
      vi.mocked(listLogs).mockClear();
      const stale = code === "cursor_stale";
      vi.mocked(listLogs)
        .mockResolvedValueOnce({ ...base, nextCursor: "page-2", sourceStatus: [] })
        .mockRejectedValueOnce(
          new AxiosError(code, undefined, undefined, undefined, {
            config: { headers: new AxiosHeaders() },
            headers: {},
            status: stale ? 409 : 503,
            statusText: stale ? "Conflict" : "Service Unavailable",
            data: { error: { code } },
          }),
        );
      const view = renderWithoutAntdStyles(<ObservabilityLogsScene />);
      await screen.findByText("Page 1");
      fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
      await screen.findByText(
        stale ? "bknTrace.errors.cursorStale" : "bknTrace.errors.auditNotConfigured",
      );
      expect(document.querySelector(".ant-alert-warning")).not.toBeNull();
      if (stale)
        expect(screen.getByRole("button", { name: "bknTrace.actions.restartQuery" })).toBeEnabled();
      vi.mocked(getAccessProfile).mockRejectedValueOnce(new Error("profile failed"));
      currentTranslate = (key, options) => translate(key, options);
      view.rerender(<ObservabilityLogsScene />);
      await screen.findByText("profile failed");
      expect(screen.queryByRole("button", { name: "bknTrace.actions.restartQuery" })).toBeNull();
      expect(document.querySelector(".ant-alert-warning")).toBeNull();
      expect(document.querySelector(".ant-alert-error")).not.toBeNull();
      expect(getAccessProfile).toHaveBeenCalledTimes(2);
      expect(listLogs).toHaveBeenCalledTimes(2);
    },
  );

  it("切换语言重查已提交筛选，下一页沿用相同条件与新游标", async () => {
    const base = await vi.mocked(listLogs)({});
    vi.mocked(listLogs).mockClear();
    vi.mocked(listLogs).mockResolvedValue({
      ...base,
      nextCursor: "committed-next",
      sourceStatus: [],
    });
    const view = renderWithoutAntdStyles(<ObservabilityLogsScene />);
    await screen.findByText("Page 1");
    fireEvent.change(screen.getByPlaceholderText("bknTrace.logs.actorPlaceholder"), {
      target: { value: "committed actor" },
    });
    fireEvent.click(screen.getByText("bknTrace.actions.query"));
    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "bknTrace.logs.nextPage" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
    await screen.findByText("Page 2");
    fireEvent.change(screen.getByPlaceholderText("bknTrace.logs.actorPlaceholder"), {
      target: { value: "draft actor" },
    });
    vi.mocked(listLogs).mockResolvedValue({
      ...base,
      nextCursor: "translated-next",
      sourceStatus: [],
    });
    currentTranslate = (key, options) => translate(key, options);
    view.rerender(<ObservabilityLogsScene />);
    await screen.findByText("Page 1");
    const languageQuery = vi.mocked(listLogs).mock.calls[3]?.[0];
    expect(languageQuery).toMatchObject({ page: 1, actorQuery: "committed actor" });
    expect(languageQuery?.cursor).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.logs.nextPage" }));
    await screen.findByText("Page 2");
    expect(vi.mocked(listLogs).mock.calls[4]?.[0]).toEqual({
      ...languageQuery,
      page: 2,
      cursor: "translated-next",
    });
  });

  it("按页读取日志并保留当前筛选条件", async () => {
    vi.mocked(listLogs)
      .mockResolvedValueOnce({
        count: { accuracy: "exact", value: 40 },
        data: [
          {
            action: "create",
            actor: { id: "user-a", name: "供应链管理员", type: "user" },
            authMethod: "api_key",
            facts: {
              action: "create",
              targetId: "conv-a",
              targetNameSnapshot: "供应链分析助手",
              targetType: "conversation",
            },
            eventId: "audit-a",
            eventName: "conversation.created",
            eventTime: "2026-08-01T10:00:00Z",
            logCategory: "runtime.business",
            attributes: {},
            businessModule: "domain_knowledge_network",
            outcome: "success",
            recordedAt: "2026-08-01T10:00:01Z",
            sourceChannel: "api",
            sourceId: "bkn-trace-core",
            target: { id: "conv-a", name: "供应链分析助手", type: "conversation" },
          },
        ],
        page: 1,
        pageSize: 20,
        partial: false,
        sourceStatus: [],
      })
      .mockResolvedValueOnce({
        count: { accuracy: "exact", value: 40 },
        data: [
          {
            action: "update",
            actor: { id: "admin", name: "Administrator", type: "user" },
            authMethod: "session",
            facts: {
              action: "update",
              targetId: "supplychain_hd0202",
              targetNameSnapshot: "HD供应链业务知识网络_v3",
              targetType: "knowledge_network",
            },
            eventId: "audit-b",
            eventName: "role.updated",
            eventTime: "2026-08-01T09:59:00Z",
            logCategory: "audit.admin",
            attributes: {},
            businessModule: "system_management",
            outcome: "failure",
            recordedAt: "2026-08-01T09:59:01Z",
            sourceChannel: "studio",
            sourceId: "bkn-safe",
            target: {
              id: "supplychain_hd0202",
              name: "HD供应链业务知识网络_v3",
              type: "knowledge_network",
            },
          },
        ],
        page: 2,
        pageSize: 20,
        partial: false,
        sourceStatus: [],
      });

    renderWithoutAntdStyles(<ObservabilityLogsScene />);
    fireEvent.click(await screen.findByTitle("2"));
    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(2));
    const [query] = vi.mocked(listLogs).mock.calls[1] ?? [];
    expect(query).toMatchObject({ page: 2, pageSize: 20 });
    expect(query?.timeFrom).toEqual(expect.any(String));
    expect(query?.timeTo).toEqual(expect.any(String));
    const sizeChanger = document.querySelector(
      ".ant-pagination-options-size-changer .ant-select-selector",
    );
    expect(sizeChanger).not.toBeNull();
    fireEvent.mouseDown(sizeChanger!);
    const options = await screen.findAllByRole("option");
    expect(
      options.map((option) => option.getAttribute("aria-label") ?? option.textContent),
    ).toEqual(["20 / page", "50 / page", "100 / page", "200 / page"]);
    expect(
      await screen.findByText((content) => content.includes("HD供应链业务知识网络_v3")),
    ).not.toBeNull();
  });

  it("点击日志打开受控详情并可下钻 Trace", async () => {
    renderWithoutAntdStyles(<ObservabilityLogsScene />);
    const summary = await screen.findByText("供应链分析助手 的业务会话");
    fireEvent.click(summary);
    await waitFor(() => expect(getLogDetail).toHaveBeenCalledWith("audit-a"));
    expect(await screen.findByText("bknTrace.logs.detail.title")).not.toBeNull();
    expect(
      screen.getAllByText("bknTrace.logs.auditActions.startAgentConversation").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("bknTrace.logs.detail.businessObject")).not.toBeNull();
    expect(screen.getAllByText("供应链分析助手 的业务会话").length).toBeGreaterThan(0);
    expect(screen.getAllByText("通过 API Key").length).toBeGreaterThan(0);
    expect(screen.getByText("bknTrace.logs.detail.contexts.managed")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.detail.statuses.completed")).not.toBeNull();
    expect(screen.getByTitle("conversation.create").textContent).toBe(
      "bknTrace.logs.auditActions.startAgentConversation",
    );
    const conversationId = screen.getByTitle("conv-a");
    const copyButton = conversationId.querySelector("button");
    expect(copyButton).not.toBeNull();
    expect(copyButton?.closest("a")).toBeNull();
    fireEvent.click(copyButton!);
    await waitFor(() => expect(writeTextToClipboard).toHaveBeenCalledWith("conv-a"));
    await waitFor(() =>
      expect(mockMessage.success).toHaveBeenCalledWith("bknTrace.logs.detail.idCopied"),
    );
    vi.mocked(writeTextToClipboard).mockRejectedValueOnce(new Error("Clipboard rejected"));
    fireEvent.click(copyButton!);
    await waitFor(() =>
      expect(mockMessage.error).toHaveBeenCalledWith("bknTrace.logs.detail.copyFailed"),
    );
    expect(mockMessage.success).toHaveBeenCalledTimes(1);
    expect(screen.getByText("bknTrace.logs.detail.rawFacts")).not.toBeNull();
    expect(
      screen
        .getByRole("link", { name: "bknTrace.logs.detail.openBusinessProvenance" })
        .getAttribute("href"),
    ).toBe("/studio/observability/business-provenance?conversation_id=conv-a");
    expect(
      screen.getByRole("link", { name: "bknTrace.logs.detail.openTrace" }).getAttribute("href"),
    ).toBe("/studio/observability/traces?trace_id=4b3d59daeff5bfbb23d46c47a5051ec9");
  });

  it("旧会话日志在缺少用户名快照时稳定展示原始操作者 ID", async () => {
    vi.mocked(listLogs).mockResolvedValueOnce({
      count: { accuracy: "exact", value: 1 },
      data: [
        {
          action: "create",
          actor: {
            id: "266c6a42-6131-4d62-8f39-853e7093701c",
            name: "266c6a42-6131-4d62-8f39-853e7093701c",
            type: "user",
          },
          authMethod: "api_key",
          facts: {
            action: "create",
            targetId: "conv-old",
            targetNameSnapshot: "mcp:933eef3eea1fde73392031e1a7aa74e7",
            targetType: "conversation",
          },
          conversationId: "conv-old",
          eventId: "audit-old",
          eventName: "conversation.created",
          eventTime: "2026-08-01T10:00:00Z",
          logCategory: "runtime.business",
          attributes: {},
          businessModule: "domain_knowledge_network",
          outcome: "success",
          recordedAt: "2026-08-01T10:00:01Z",
          sourceChannel: "api",
          sourceId: "bkn-trace-core",
          target: {
            id: "conv-old",
            name: "mcp:933eef3eea1fde73392031e1a7aa74e7",
            type: "conversation",
          },
        },
      ],
      partial: false,
      sourceStatus: [],
    });

    renderWithoutAntdStyles(<ObservabilityLogsScene />);
    expect(await screen.findByText("未命名 Agent 的业务会话")).not.toBeNull();
    expect(screen.getByText("266c6a42-6131-4d62-8f39-853e7093701c")).not.toBeNull();
    expect(screen.queryByText("已认证用户 · 266c6a42…")).toBeNull();
    expect(screen.queryByText("mcp:933eef3eea1fde73392031e1a7aa74e7")).toBeNull();
  });

  it("设置页按业务模块汇总采集来源与保留策略", async () => {
    vi.mocked(listLogSources).mockResolvedValue([
      {
        coveredModules: ["domain_knowledge_network"],
        collectionMethod: "source_api",
        reliability: "best_effort",
        sourceId: "bkn-backend",
        status: "healthy",
      },
      {
        coveredModules: ["data_resource_knowledge_network"],
        collectionMethod: "source_api",
        reliability: "best_effort",
        sourceId: "vega",
        status: "healthy",
      },
      {
        coveredModules: ["execution_factory"],
        collectionMethod: "source_api",
        reliability: "best_effort",
        sourceId: "execution-factory",
        status: "healthy",
      },
      {
        coveredModules: ["model_management"],
        collectionMethod: "source_api",
        reliability: "best_effort",
        sourceId: "model-manager",
        status: "healthy",
      },
      {
        coveredModules: ["system_management"],
        collectionMethod: "source_api",
        reliability: "best_effort",
        sourceId: "audit-ledger",
        status: "healthy",
      },
    ]);
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    await waitFor(() => expect(listLogSources).toHaveBeenCalled());
    expect(
      await screen.findByText("bknTrace.logs.modules.domain_knowledge_network"),
    ).not.toBeNull();
    expect(
      screen.getByText("bknTrace.logs.modules.data_resource_knowledge_network"),
    ).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.modules.execution_factory")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.modules.model_management")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.modules.system_management")).not.toBeNull();
    const systemManagementRow = screen
      .getByText("bknTrace.logs.modules.system_management")
      .closest("tr");
    expect(systemManagementRow).not.toBeNull();
    expect(within(systemManagementRow!).getByText("管理操作审计")).not.toBeNull();
    expect(within(systemManagementRow!).getByText("已接入")).not.toBeNull();
    expect(screen.getByText("bknTrace.logs.modules.observability")).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.sourceLabels.bkn-backend")).not.toBeNull();
    expect(screen.queryByText("bknTrace.settings.inventory.title")).toBeNull();
    const observabilityRow = screen.getByText("bknTrace.logs.modules.observability").closest("tr");
    expect(observabilityRow).not.toBeNull();
    expect(within(observabilityRow!).getByText("管理操作审计")).not.toBeNull();
    expect(within(observabilityRow!).getByText("已接入")).not.toBeNull();
    expect(screen.getByText("7 bknTrace.settings.days")).not.toBeNull();
  });

  it("维护接口失败或无维护权限不改变已注册的管理审计接入", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({
      ...profile,
      traceEvidenceConfigurationRead: false,
      observabilityArchiveManage: false,
    });
    vi.mocked(listLogSources).mockResolvedValue([
      {
        coveredModules: ["system_management"],
        collectionMethod: "kafka_audit",
        reliability: "best_effort",
        sourceId: "audit-ledger",
        status: "unavailable",
      },
    ]);
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    const row = (await screen.findByText("bknTrace.logs.modules.observability")).closest("tr");
    expect(within(row!).getByText("管理操作审计")).not.toBeNull();
    expect(within(row!).getByText("已接入")).not.toBeNull();
    expect(getTraceEvidenceConfiguration).not.toHaveBeenCalled();
    expect(getArchiveOverview).not.toHaveBeenCalled();
  });

  it("设置页将统一 OTEL 日志来源显示为业务模块已接入", async () => {
    vi.mocked(listLogSources).mockResolvedValue([
      {
        coveredModules: ["openbkn"],
        collectionMethod: "direct_otlp",
        reliability: "best_effort",
        sourceId: "otel-runtime",
        status: "healthy",
      },
    ]);

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);

    const dataResourceRow = (
      await screen.findByText("bknTrace.logs.modules.data_resource_knowledge_network")
    ).closest("tr");
    expect(dataResourceRow).not.toBeNull();
    expect(
      within(dataResourceRow!).getByText("bknTrace.settings.sourceLabels.otel-runtime"),
    ).not.toBeNull();
    expect(within(dataResourceRow!).getByText("已接入")).not.toBeNull();

    const observabilityRow = screen.getByText("bknTrace.logs.modules.observability").closest("tr");
    expect(observabilityRow).not.toBeNull();
    expect(within(observabilityRow!).getByText("未接入")).not.toBeNull();
  });

  it("按冻结合同分别读取配置快照和活动操作", async () => {
    vi.mocked(getTraceEvidenceConfiguration).mockResolvedValue({
      kind: "configuration_get",
      desiredState: "enabled",
      effectiveState: "disabled",
      policyRevision: 9,
      lastStableRevision: 8,
      activeOperationId: "op-9",
      heartbeatIntervalSeconds: 10,
      leaseTtlSeconds: 30,
    });
    vi.mocked(getTraceEvidenceOperation).mockResolvedValue({
      id: "op-9",
      phase: "enabling",
      requestedState: "enabled",
      expectedRevision: 9,
    });

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);

    await waitFor(() => expect(getTraceEvidenceConfiguration).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getTraceEvidenceOperation).toHaveBeenCalledWith("op-9"));
    expect(screen.getByText("bknTrace.settings.capturePolicy.phases.enabling")).not.toBeNull();
  });

  it("only a server write grant exposes a confirmed revision-guarded disable action", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({
      ...profile,
      traceEvidenceConfigurationWrite: true,
    });
    vi.mocked(getTraceEvidenceConfiguration)
      .mockResolvedValueOnce({
        desiredState: "enabled",
        effectiveState: "enabled",
        policyRevision: 9,
        lastStableRevision: 8,
        heartbeatIntervalSeconds: 10,
        leaseTtlSeconds: 30,
      })
      .mockResolvedValue({
        desiredState: "disabled",
        effectiveState: "enabled",
        policyRevision: 10,
        lastStableRevision: 9,
        activeOperationId: "op-10",
        heartbeatIntervalSeconds: 10,
        leaseTtlSeconds: 30,
      });
    vi.mocked(changeTraceEvidenceConfiguration).mockResolvedValue({
      desiredState: "disabled",
      effectiveState: "enabled",
      policyRevision: 10,
      lastStableRevision: 9,
      activeOperationId: "op-10",
      heartbeatIntervalSeconds: 10,
      leaseTtlSeconds: 30,
    });
    vi.mocked(getTraceEvidenceOperation).mockResolvedValue({
      id: "op-10",
      phase: "disabling",
      requestedState: "disabled",
      expectedRevision: 9,
    });

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    fireEvent.click(
      await screen.findByRole("button", { name: "bknTrace.settings.capturePolicy.disable" }),
    );
    expect(changeTraceEvidenceConfiguration).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "bknTrace.settings.capturePolicy.confirmAction" }),
    );
    await waitFor(() =>
      expect(changeTraceEvidenceConfiguration).toHaveBeenCalledWith("disabled", 9),
    );
    expect(
      await screen.findByText("bknTrace.settings.capturePolicy.phases.pending"),
    ).not.toBeNull();
    expect(
      await screen.findByText(
        "bknTrace.settings.capturePolicy.phases.disabling",
        {},
        { timeout: 4000 },
      ),
    ).not.toBeNull();
    expect(
      screen
        .getByRole("button", { name: "bknTrace.settings.capturePolicy.enable" })
        .hasAttribute("disabled"),
    ).toBe(true);
  }, 20000);

  it("does not expose switch controls without the exact write grant", async () => {
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    expect(await screen.findByText("bknTrace.settings.capturePolicy.title")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "bknTrace.settings.capturePolicy.disable" }),
    ).toBeNull();
  });

  it("keeps a rejected change visible as an error without claiming the switch changed", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({
      ...profile,
      traceEvidenceConfigurationWrite: true,
    });
    vi.mocked(changeTraceEvidenceConfiguration).mockRejectedValue(new Error("revision conflict"));

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    fireEvent.click(
      await screen.findByRole("button", { name: "bknTrace.settings.capturePolicy.disable" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "bknTrace.settings.capturePolicy.confirmAction" }),
    );

    expect(await screen.findByText("bknTrace.settings.capturePolicy.changeFailed")).not.toBeNull();
    expect(screen.getAllByText("bknTrace.settings.capturePolicy.states.enabled")).toHaveLength(2);
    expect(screen.queryByText("bknTrace.settings.capturePolicy.states.disabled")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    fireEvent.click(
      screen.getByRole("button", { name: "bknTrace.settings.capturePolicy.disable" }),
    );
    expect(screen.queryByText("bknTrace.settings.capturePolicy.changeFailed")).toBeNull();
  }, 20000);

  it("shows rollback as rollback, not a successful disable", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({
      ...profile,
      traceEvidenceConfigurationWrite: true,
    });
    vi.mocked(getTraceEvidenceConfiguration)
      .mockResolvedValueOnce({
        desiredState: "enabled",
        effectiveState: "enabled",
        policyRevision: 9,
        lastStableRevision: 9,
        heartbeatIntervalSeconds: 10,
        leaseTtlSeconds: 30,
      })
      .mockResolvedValue({
        desiredState: "enabled",
        effectiveState: "enabled",
        policyRevision: 10,
        lastStableRevision: 9,
        heartbeatIntervalSeconds: 10,
        leaseTtlSeconds: 30,
      });
    vi.mocked(changeTraceEvidenceConfiguration).mockResolvedValue({
      desiredState: "disabled",
      effectiveState: "enabled",
      policyRevision: 10,
      lastStableRevision: 9,
      activeOperationId: "op-10",
      heartbeatIntervalSeconds: 10,
      leaseTtlSeconds: 30,
    });
    vi.mocked(getTraceEvidenceOperation).mockResolvedValue({
      id: "op-10",
      phase: "rollback_completed",
      requestedState: "disabled",
      expectedRevision: 9,
    });

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    fireEvent.click(
      await screen.findByRole("button", { name: "bknTrace.settings.capturePolicy.disable" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "bknTrace.settings.capturePolicy.confirmAction" }),
    );

    expect(
      await screen.findByText(
        "bknTrace.settings.capturePolicy.phases.rollback_completed",
        {},
        { timeout: 4000 },
      ),
    ).not.toBeNull();
    expect(screen.getAllByText("bknTrace.settings.capturePolicy.states.enabled")).toHaveLength(2);
    expect(screen.queryByText("bknTrace.settings.capturePolicy.phases.succeeded")).toBeNull();
  });

  it("failed operation with divergent policy states remains locked and explains reconciliation", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({
      ...profile,
      traceEvidenceConfigurationWrite: true,
    });
    vi.mocked(getTraceEvidenceConfiguration)
      .mockResolvedValueOnce({
        desiredState: "enabled",
        effectiveState: "enabled",
        policyRevision: 9,
        lastStableRevision: 9,
        heartbeatIntervalSeconds: 10,
        leaseTtlSeconds: 30,
      })
      .mockResolvedValue({
        desiredState: "disabled",
        effectiveState: "enabled",
        policyRevision: 10,
        lastStableRevision: 9,
        heartbeatIntervalSeconds: 10,
        leaseTtlSeconds: 30,
      });
    vi.mocked(changeTraceEvidenceConfiguration).mockResolvedValue({
      desiredState: "disabled",
      effectiveState: "enabled",
      policyRevision: 10,
      lastStableRevision: 9,
      activeOperationId: "op-10",
      heartbeatIntervalSeconds: 10,
      leaseTtlSeconds: 30,
    });
    vi.mocked(getTraceEvidenceOperation).mockResolvedValue({
      id: "op-10",
      phase: "failed",
      requestedState: "disabled",
      expectedRevision: 9,
    });

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    fireEvent.click(
      await screen.findByRole("button", { name: "bknTrace.settings.capturePolicy.disable" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "bknTrace.settings.capturePolicy.confirmAction" }),
    );

    expect(
      await screen.findByText(
        "bknTrace.settings.capturePolicy.reconcileRequired",
        {},
        { timeout: 4000 },
      ),
    ).not.toBeNull();
    expect(
      screen
        .getByRole("button", { name: "bknTrace.settings.capturePolicy.enable" })
        .hasAttribute("disabled"),
    ).toBe(true);
  }, 20000);

  it("keeps polling after terminal operation until a fresh configuration clears the active ID", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({
      ...profile,
      traceEvidenceConfigurationWrite: true,
    });
    vi.mocked(getTraceEvidenceConfiguration)
      .mockResolvedValueOnce({
        desiredState: "enabled",
        effectiveState: "enabled",
        policyRevision: 9,
        lastStableRevision: 9,
        heartbeatIntervalSeconds: 10,
        leaseTtlSeconds: 30,
      })
      .mockResolvedValueOnce({
        desiredState: "disabled",
        effectiveState: "enabled",
        policyRevision: 10,
        lastStableRevision: 9,
        activeOperationId: "op-10",
        heartbeatIntervalSeconds: 10,
        leaseTtlSeconds: 30,
      })
      .mockResolvedValue({
        desiredState: "disabled",
        effectiveState: "disabled",
        policyRevision: 10,
        lastStableRevision: 10,
        heartbeatIntervalSeconds: 10,
        leaseTtlSeconds: 30,
      });
    vi.mocked(changeTraceEvidenceConfiguration).mockResolvedValue({
      desiredState: "disabled",
      effectiveState: "enabled",
      policyRevision: 10,
      lastStableRevision: 9,
      activeOperationId: "op-10",
      heartbeatIntervalSeconds: 10,
      leaseTtlSeconds: 30,
    });
    vi.mocked(getTraceEvidenceOperation).mockResolvedValue({
      id: "op-10",
      phase: "succeeded",
      requestedState: "disabled",
      expectedRevision: 9,
    });

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    fireEvent.click(
      await screen.findByRole("button", { name: "bknTrace.settings.capturePolicy.disable" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "bknTrace.settings.capturePolicy.confirmAction" }),
    );

    await waitFor(() => expect(getTraceEvidenceConfiguration).toHaveBeenCalledTimes(3), {
      timeout: 12000,
    });
    expect(
      screen
        .getByRole("button", { name: "bknTrace.settings.capturePolicy.enable" })
        .hasAttribute("disabled"),
    ).toBe(false);
  }, 20000);

  it("活动操作读取失败时将阶段标记为不可用而不是无活动操作", async () => {
    vi.mocked(getTraceEvidenceConfiguration).mockResolvedValue({
      kind: "configuration_get",
      desiredState: "enabled",
      effectiveState: "disabling",
      policyRevision: 10,
      lastStableRevision: 9,
      activeOperationId: "op-10",
      heartbeatIntervalSeconds: 10,
      leaseTtlSeconds: 30,
    });
    vi.mocked(getTraceEvidenceOperation).mockRejectedValueOnce(new Error("operation unavailable"));

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);

    await waitFor(() => expect(getTraceEvidenceOperation).toHaveBeenCalledWith("op-10"));
    expect(screen.getByText("不可用（当前合同未提供）")).not.toBeNull();
    expect(screen.getByText("当前没有可读取的活动操作；操作详情不在配置快照中。")).not.toBeNull();
    expect(screen.queryByText("无活动操作")).toBeNull();
  });

  it("操作详情不可用时仍刷新权威配置，并在活动 ID 清除后停止轮询", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({
      ...profile,
      traceEvidenceConfigurationWrite: true,
    });
    vi.mocked(getTraceEvidenceConfiguration)
      .mockResolvedValueOnce({
        desiredState: "disabled",
        effectiveState: "enabled",
        policyRevision: 10,
        lastStableRevision: 9,
        activeOperationId: "op-10",
        heartbeatIntervalSeconds: 10,
        leaseTtlSeconds: 30,
      })
      .mockResolvedValue({
        desiredState: "disabled",
        effectiveState: "disabled",
        policyRevision: 10,
        lastStableRevision: 10,
        heartbeatIntervalSeconds: 10,
        leaseTtlSeconds: 30,
      });
    vi.mocked(getTraceEvidenceOperation).mockRejectedValue(new Error("operation unavailable"));

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    await waitFor(() => expect(getTraceEvidenceConfiguration).toHaveBeenCalledTimes(2), {
      timeout: 10000,
    });
    expect(screen.getAllByText("bknTrace.settings.capturePolicy.states.disabled")).toHaveLength(2);
    expect(
      screen
        .getByRole("button", { name: "bknTrace.settings.capturePolicy.enable" })
        .hasAttribute("disabled"),
    ).toBe(false);
    await new Promise((resolve) => window.setTimeout(resolve, 2200));
    expect(getTraceEvidenceConfiguration).toHaveBeenCalledTimes(2);
  }, 20000);

  it("持续故障最多重试五轮，不会永久每两秒请求服务端", async () => {
    vi.mocked(getTraceEvidenceConfiguration).mockResolvedValue({
      desiredState: "disabled",
      effectiveState: "enabled",
      policyRevision: 10,
      lastStableRevision: 9,
      activeOperationId: "op-10",
      heartbeatIntervalSeconds: 10,
      leaseTtlSeconds: 30,
    });
    vi.mocked(getTraceEvidenceOperation).mockRejectedValue(new Error("operation unavailable"));

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    await waitFor(() => expect(getTraceEvidenceConfiguration).toHaveBeenCalledTimes(6), {
      timeout: 13000,
    });
    await new Promise((resolve) => window.setTimeout(resolve, 2200));
    expect(getTraceEvidenceConfiguration).toHaveBeenCalledTimes(6);
    expect(screen.getByText("当前没有可读取的活动操作；操作详情不在配置快照中。")).not.toBeNull();
  }, 30_000);

  it("稳定配置没有活动操作时显示中性阶段并不显示操作不可用告警", async () => {
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);

    await waitFor(() => expect(getTraceEvidenceConfiguration).toHaveBeenCalledTimes(1));
    expect(getTraceEvidenceOperation).not.toHaveBeenCalled();
    expect(screen.getByText("无活动操作")).not.toBeNull();
    expect(screen.queryByText("当前没有可读取的活动操作；操作详情不在配置快照中。")).toBeNull();
  });

  it("设置页将已声明但未接入的来源显示为未接入", async () => {
    vi.mocked(getTraceEvidenceConfiguration).mockRejectedValue(
      new Error("configuration unavailable"),
    );
    vi.mocked(getArchiveOverview).mockRejectedValue(new Error("archive unavailable"));
    vi.mocked(listLogSources).mockResolvedValue([
      {
        coveredModules: ["observability"],
        collectionMethod: "not_integrated",
        reliability: "best_effort",
        sourceId: "agent-observability",
        status: "not_integrated",
      },
    ]);
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    await waitFor(() => expect(listLogSources).toHaveBeenCalled());
    const observabilityRow = screen.getByText("bknTrace.logs.modules.observability").closest("tr");
    expect(observabilityRow).not.toBeNull();
    expect(within(observabilityRow!).getByText("未接入")).not.toBeNull();
    expect(
      within(observabilityRow!).getByText("bknTrace.settings.sourceNotIntegrated"),
    ).not.toBeNull();
  });

  it("非超级管理员仍按服务端能力访问设置页", async () => {
    mockCurrentUser.isSuperAdmin = false;

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);

    expect(await screen.findByText("bknTrace.settings.capturePolicy.title")).not.toBeNull();
    expect(getAccessProfile).toHaveBeenCalled();
  });

  it("设置页只展示可维护的日志保留项，不暴露内部 Trace 存储", async () => {
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);

    expect(await screen.findByText("bknTrace.settings.storage.runtimeLogs")).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.storage.auditLogs")).not.toBeNull();
    expect(screen.queryByText("bknTrace.settings.storage.traceIndex")).toBeNull();
    expect(screen.queryByText("bknTrace.settings.storage.interactionFacts")).toBeNull();
  });

  it("服务端未返回保留策略时展示本地化的中性值", async () => {
    vi.mocked(listLogPolicies).mockResolvedValueOnce([]);

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);

    expect(await screen.findAllByText("未返回")).toHaveLength(2);
    expect(screen.queryByText("bknTrace.settings.notReturned")).toBeNull();
  });

  it("设置页不展示来源覆盖范围或运行分级", async () => {
    vi.mocked(listLogSources).mockResolvedValueOnce([
      {
        coveredModules: ["data_resource_knowledge_network"],
        collectionMethod: "source_adapter",
        reason: "partial_management_audit_coverage",
        reliability: "best_effort",
        sourceId: "vega",
        status: "degraded",
      },
    ]);

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);

    expect(await screen.findAllByText("已接入")).toHaveLength(1);
    expect(screen.queryByText("partial_management_audit_coverage")).toBeNull();
    expect(screen.queryByText("bknTrace.settings.querySourceStatus")).toBeNull();
  });

  it("设置页未获来源查询权限时不伪造模块状态", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({
      ...profile,
      globalLogSearch: false,
      logPolicyRead: true,
    });

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);

    await waitFor(() => expect(getAccessProfile).toHaveBeenCalled());
    expect(screen.queryByText("bknTrace.settings.sources")).toBeNull();
  });

  it("设置页将 Trace 会话和操作来源作为领域知识网络的已接入来源", async () => {
    vi.mocked(listLogSources).mockResolvedValue([
      {
        coveredModules: ["domain_knowledge_network"],
        collectionMethod: "source_adapter",
        reliability: "best_effort",
        sourceId: "bkn-trace-runtime",
        status: "healthy",
      },
      {
        coveredModules: ["domain_knowledge_network"],
        collectionMethod: "source_adapter",
        reason: "source_timeout",
        reliability: "best_effort",
        sourceId: "bkn-trace-core",
        status: "unavailable",
      },
    ]);

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);

    const row = (await screen.findByText("bknTrace.logs.modules.domain_knowledge_network")).closest(
      "tr",
    );
    expect(row).not.toBeNull();
    expect(within(row!).getByText("已接入")).not.toBeNull();
    expect(
      within(row!).getByText(
        "bknTrace.settings.sourceLabels.bkn-trace-runtime、bknTrace.settings.sourceLabels.bkn-trace-core",
      ),
    ).not.toBeNull();
  });

  const traceRun = (overrides: Partial<ArchiveRun>): ArchiveRun => ({
    id: "arc_trace_1",
    kind: "trace",
    trigger: "archive",
    status: "running",
    eligibleAtStart: 10000,
    processedCount: 3200,
    retainedCount: 0,
    batchCount: 2,
    retryCount: 0,
    createdAt: "2026-11-27T06:00:00Z",
    ...overrides,
  });
  const overviewWithRun = (run?: ArchiveRun, retainedCount = 0) =>
    vi.mocked(getArchiveOverview).mockImplementation((kind) =>
      Promise.resolve({
        candidateCount: kind === "trace" ? 6800 : 0,
        cutoffAt: "2026-11-20T00:00:00Z",
        kind,
        retentionDays: kind === "log" ? 30 : 7,
        storageStatus: "ready",
        retainedCount: kind === "trace" ? retainedCount : 0,
        ...(kind === "trace" && run ? { currentRun: run } : {}),
      }),
    );

  it("后台归档进行中显示进度、禁用立即归档，并在完成后自动刷新", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      currentTranslate = (key, options) =>
        key === "bknTrace.settings.archive.run.running"
          ? `running ${String(options?.done)}/${String(options?.total)}`
          : key === "bknTrace.settings.archive.run.completed"
            ? `completed ${String(options?.archived)}`
            : translate(key, options);
      overviewWithRun(traceRun({}));
      renderWithoutAntdStyles(<ObservabilitySettingsScene />);
      expect(await screen.findByText("running 3,200/10,000")).not.toBeNull();
      const [, traceAction] = screen.getAllByRole("button", {
        name: "bknTrace.settings.archive.action",
      });
      expect(traceAction).toBeDisabled();
      expect(screen.queryByText("bknTrace.settings.archive.run.viewResult")).toBeNull();

      overviewWithRun(traceRun({ status: "completed", processedCount: 10000 }));
      await act(async () => {
        vi.advanceTimersByTime(3000);
        await Promise.resolve();
      });
      expect(await screen.findByText("completed 10,000")).not.toBeNull();
      expect(screen.getByText("bknTrace.settings.archive.run.viewResult")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("等待重试时说明原因和下次时间，失败时说明原因", async () => {
    currentTranslate = (key, options) =>
      key === "bknTrace.settings.archive.run.retryWait"
        ? `retry ${String(options?.reason)} ${String(options?.attempt)}/${String(options?.max)}`
        : translate(key, options);
    overviewWithRun(
      traceRun({
        status: "retry_wait",
        retryCount: 2,
        lastFailureCode: "temporarily_unavailable",
        nextAttemptAt: "2026-11-27T06:20:00Z",
      }),
    );
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    expect(
      await screen.findByText(
        "retry bknTrace.settings.archive.run.reasons.temporarily_unavailable 2/3",
      ),
    ).not.toBeNull();
  });

  it("完成但有超大交互保留时，可查看本次结果和保留列表", async () => {
    const retained = {
      interactionId: "itx_large",
      runId: "arc_trace_1",
      stage: "sql_payload",
      measured: 12 * 1024 * 1024,
      atLeast: false,
      budget: 8 * 1024 * 1024,
      unit: "bytes",
      retainedAt: "2026-11-27T06:05:00Z",
    };
    const run = traceRun({ status: "completed", processedCount: 6799, retainedCount: 1 });
    overviewWithRun(run, 1);
    vi.mocked(getArchiveRunResult).mockResolvedValue({ ...run, retained: [retained] });
    vi.mocked(listRetainedInteractions).mockResolvedValue([retained]);
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    expect(
      await screen.findByText("bknTrace.settings.archive.run.completedRetained"),
    ).not.toBeNull();
    fireEvent.click(screen.getByText("bknTrace.settings.archive.run.viewResult"));
    expect(await screen.findByText("bknTrace.settings.archive.run.resultTitle")).not.toBeNull();
    expect(await screen.findByText("itx_large")).not.toBeNull();
    expect(getArchiveRunResult).toHaveBeenCalledWith("arc_trace_1");
    fireEvent.click(screen.getByText("bknTrace.settings.archive.run.viewRetained"));
    expect(await screen.findByText("bknTrace.settings.archive.run.retainedTitle")).not.toBeNull();
    expect(listRetainedInteractions).toHaveBeenCalled();
  });

  it("点击立即归档先显示不可逆清理确认，而不直接创建归档任务", async () => {
    vi.mocked(getArchiveOverview).mockResolvedValueOnce({
      candidateCount: 1,
      cutoffAt: "2026-07-15T00:00:00Z",
      kind: "log",
      retentionDays: 30,
      storageStatus: "ready",
      retainedCount: 0,
    });
    vi.mocked(getArchiveOverview).mockResolvedValueOnce({
      candidateCount: 1,
      cutoffAt: "2026-08-07T00:00:00Z",
      kind: "trace",
      retentionDays: 7,
      storageStatus: "ready",
      retainedCount: 0,
    });
    vi.mocked(listArchiveJobs).mockResolvedValue([]);
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);

    const [archiveButton] = await screen.findAllByRole("button", {
      name: "bknTrace.settings.archive.action",
    });
    if (!archiveButton) throw new Error("archive action button is missing");
    fireEvent.click(archiveButton);

    expect(await screen.findByText("bknTrace.settings.archive.confirmTitle")).not.toBeNull();
    expect(createArchive).not.toHaveBeenCalled();
  });

  it("刷新一种归档任务时保留另一种归档任务并本地化枚举", async () => {
    vi.mocked(getArchiveOverview).mockImplementation((kind) =>
      Promise.resolve(
        kind === "log"
          ? {
              candidateCount: 1,
              cutoffAt: "2026-07-15T00:00:00Z",
              kind,
              retentionDays: 30,
              storageStatus: "ready",
              retainedCount: 0,
            }
          : {
              candidateCount: 1,
              cutoffAt: "2026-08-07T00:00:00Z",
              kind,
              retentionDays: 7,
              storageStatus: "ready",
              retainedCount: 0,
            },
      ),
    );
    vi.mocked(listArchiveJobs).mockImplementation((kind) =>
      Promise.resolve(
        kind === "log"
          ? [
              {
                id: "log-job",
                kind,
                range: { from: "2026-07-01", to: "2026-07-15" },
                candidateCount: 1,
                status: "completed",
              },
            ]
          : [
              {
                id: "trace-job",
                kind,
                range: { from: "2026-08-01", to: "2026-08-07" },
                candidateCount: 1,
                status: "cleanup_incomplete",
              },
            ],
      ),
    );
    vi.mocked(createArchive).mockResolvedValue(undefined);

    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    expect(await screen.findByText("bknTrace.settings.archive.kinds.trace")).not.toBeNull();
    expect(
      screen.getByText("bknTrace.settings.archive.statuses.cleanup_incomplete"),
    ).not.toBeNull();
    const [archiveButton] = screen.getAllByRole("button", {
      name: "bknTrace.settings.archive.action",
    });
    if (!archiveButton) throw new Error("log archive action button is missing");
    fireEvent.click(archiveButton);
    const confirmationButtons = await screen.findAllByRole("button", {
      name: "bknTrace.settings.archive.action",
    });
    const confirmationButton = confirmationButtons.at(-1);
    if (!confirmationButton) throw new Error("archive confirmation button is missing");
    fireEvent.click(confirmationButton);
    await waitFor(() =>
      expect(vi.mocked(listArchiveJobs).mock.calls.filter(([kind]) => kind === "log")).toHaveLength(
        2,
      ),
    );
    expect(screen.getByText("bknTrace.settings.archive.kinds.trace")).not.toBeNull();
  });

  it("设置页按高保真顺序展示五个只读维护分区", async () => {
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    await waitFor(() => expect(listLogSources).toHaveBeenCalled());

    const sectionKeys = [
      "overview",
      "sources",
      "storageRetention",
      "archive.title",
      "recentArchives",
    ].map((name) => `bknTrace.settings.${name}`);
    const sections = sectionKeys.map((key) => screen.getByText(key));
    sections.forEach((section, index) => {
      if (index > 0)
        expect(sections[index - 1]?.compareDocumentPosition(section)).toBe(
          Node.DOCUMENT_POSITION_FOLLOWING,
        );
    });
    expect(screen.getByText("bknTrace.settings.archive.logRule")).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.archive.traceRule")).not.toBeNull();
    expect(screen.getAllByText("bknTrace.settings.archive.candidates")).toHaveLength(2);
    expect(
      screen
        .getAllByRole("button", { name: "bknTrace.settings.archive.action" })
        .every((button) => button.hasAttribute("disabled")),
    ).toBe(true);
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("无全局日志能力时不发起日志检索", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({ ...profile, globalLogSearch: false });
    renderWithoutAntdStyles(<ObservabilityLogsScene />);
    expect(await screen.findByText("bknTrace.errors.accessDenied")).not.toBeNull();
    expect(listLogs).not.toHaveBeenCalled();
  });

  it("普通用户可从本人 Trace 关联下钻日志但不能发起全局检索", async () => {
    window.history.replaceState({}, "", "/observability/logs?trace_id=trace-a");
    vi.mocked(getAccessProfile).mockResolvedValue({ ...profile, globalLogSearch: false });
    renderWithoutAntdStyles(<ObservabilityLogsScene />);
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
      count: { accuracy: "exact", value: 0 },
      data: [],
      partial: false,
      sourceStatus: [],
    });

    renderWithoutAntdStyles(<ObservabilityLogsScene />);

    expect(await screen.findByText("bknTrace.logs.emptyAssociated")).not.toBeNull();
  });
  it("归档历史读取失败不显示无记录，刷新后恢复可操作状态", async () => {
    vi.mocked(getArchiveOverview).mockImplementation((kind) =>
      Promise.resolve({
        candidateCount: 1,
        cutoffAt: "2026-11-01",
        kind,
        retentionDays: 7,
        storageStatus: "ready",
        retainedCount: 0,
      }),
    );
    vi.mocked(listArchiveJobs).mockRejectedValue(new Error("unavailable"));
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    expect(await screen.findAllByText("bknTrace.settings.archive.historyUnavailable")).toHaveLength(
      2,
    );
    expect(screen.queryByText("bknTrace.settings.archive.noHistory")).toBeNull();
    for (const button of screen.getAllByRole("button", {
      name: "bknTrace.settings.archive.action",
    }))
      expect(button).toBeDisabled();
    vi.mocked(listArchiveJobs).mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.settings.archive.refresh" }));
    await waitFor(() =>
      expect(screen.queryByText("bknTrace.settings.archive.historyUnavailable")).toBeNull(),
    );
    expect(screen.getByText("bknTrace.settings.archive.noHistory")).not.toBeNull();
    for (const button of screen.getAllByRole("button", {
      name: "bknTrace.settings.archive.action",
    }))
      expect(button).not.toBeDisabled();
  });

  it("大交互显示受阻详情和大小下界，不提供继续清理", async () => {
    currentTranslate = (key, options) =>
      key === "bknTrace.settings.archive.blockedDetailsAtLeast"
        ? `${String(options?.interaction)} > ${String(options?.limit)}`
        : translate(key, options);
    vi.mocked(listArchiveJobs).mockImplementation((kind) =>
      Promise.resolve(
        kind === "trace"
          ? [
              {
                id: "blocked",
                kind,
                range: { to: "2026-11-01" },
                candidateCount: 0,
                status: "failed",
                batchProgress: {
                  run_id: "run",
                  batch_number: 2,
                  cleaned_in_run: 1,
                  remaining_at_selection: 2,
                  run_complete: false,
                  blocked: {
                    interaction_id: "large",
                    stage: "technical_response",
                    actual: 16777217,
                    limit: 16777216,
                    unit: "bytes",
                    at_least: true,
                  },
                },
              },
            ]
          : [],
      ),
    );
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    expect(await screen.findByText(`large > ${formatFileSize(16777216)}`)).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.archive.blockedAdvice")).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.archive.runIncomplete")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "bknTrace.settings.archive.retryCleanup" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "bknTrace.settings.archive.download" })).toBeNull();
  });

  it("归档请求失败后仍刷新已完成前缀和受阻任务，保留另一种历史", async () => {
    vi.mocked(getArchiveOverview).mockImplementation((kind) =>
      Promise.resolve({
        candidateCount: 3,
        cutoffAt: "2026-11-01",
        kind,
        retentionDays: 7,
        storageStatus: "ready",
        retainedCount: 0,
      }),
    );
    const logJob = {
      id: "log-kept",
      kind: "log" as const,
      range: { to: "2026-10-01" },
      candidateCount: 1,
      status: "completed" as const,
    };
    vi.mocked(listArchiveJobs).mockImplementation((kind) =>
      Promise.resolve(kind === "log" ? [logJob] : []),
    );
    vi.mocked(createArchive).mockImplementation(() => {
      vi.mocked(listArchiveJobs).mockImplementation((kind) =>
        Promise.resolve(
          kind === "log"
            ? [logJob]
            : [
                {
                  id: "prefix",
                  kind,
                  range: { to: "2026-11-01" },
                  candidateCount: 1,
                  status: "completed",
                  batchProgress: {
                    run_id: "run",
                    batch_number: 1,
                    cleaned_in_run: 1,
                    remaining_at_selection: 2,
                    run_complete: false,
                  },
                },
              ],
        ),
      );
      return Promise.reject(new Error("connection interrupted"));
    });
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    await screen.findByText("bknTrace.settings.archive.kinds.log");
    fireEvent.click(screen.getAllByRole("button", { name: "bknTrace.settings.archive.action" })[1]);
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "bknTrace.settings.archive.action" })).at(-1)!,
    );
    expect(await screen.findByText("bknTrace.settings.archive.actionUnconfirmed")).not.toBeNull();
    expect(await screen.findByText("bknTrace.settings.archive.runIncomplete")).not.toBeNull();
    // The dialog closes on failure, so a second submit must go through the gated panel button.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("bknTrace.settings.archive.kinds.log")).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.archive.kinds.trace")).not.toBeNull();
  });

  it("未完成清理阻止同类新归档，清理请求失败后仍刷新状态", async () => {
    vi.mocked(getArchiveOverview).mockImplementation((kind) =>
      Promise.resolve({
        candidateCount: 1,
        cutoffAt: "2026-11-01",
        kind,
        retentionDays: 7,
        storageStatus: "ready",
        retainedCount: 0,
      }),
    );
    vi.mocked(listArchiveJobs).mockImplementation((kind) =>
      Promise.resolve(
        kind === "log"
          ? [
              {
                id: "old-pending",
                kind,
                range: { to: "2026-09-01" },
                candidateCount: 1,
                status: "cleanup_incomplete",
              },
            ]
          : [],
      ),
    );
    vi.mocked(retryArchiveCleanup).mockRejectedValue(new Error("timeout"));
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    const retry = await screen.findByRole("button", {
      name: "bknTrace.settings.archive.retryCleanup",
    });
    const actions = screen.getAllByRole("button", { name: "bknTrace.settings.archive.action" });
    expect(actions[0]).toBeDisabled();
    expect(actions[1]).not.toBeDisabled();
    fireEvent.click(retry);
    await waitFor(() =>
      expect(vi.mocked(listArchiveJobs).mock.calls.filter(([kind]) => kind === "log")).toHaveLength(
        2,
      ),
    );
    expect(retryArchiveCleanup).toHaveBeenCalledWith("old-pending");
    expect(mockMessage.error).toHaveBeenCalledWith("bknTrace.settings.archive.actionUnconfirmed");
  });
  it("任务历史刷新失败时保留记录并停用旧记录上的清理操作", async () => {
    vi.mocked(listArchiveJobs).mockImplementation((kind) =>
      Promise.resolve(
        kind === "log"
          ? [
              {
                id: "pending",
                kind,
                range: { to: "2026-11-01" },
                candidateCount: 1,
                status: "cleanup_incomplete",
              },
            ]
          : [
              {
                id: "complete",
                kind,
                range: { to: "2026-11-01" },
                candidateCount: 1,
                status: "completed",
              },
            ],
      ),
    );
    renderWithoutAntdStyles(<ObservabilitySettingsScene />);
    const cleanupButton = await screen.findByRole("button", {
      name: "bknTrace.settings.archive.retryCleanup",
    });
    expect(cleanupButton).not.toBeDisabled();
    const history = screen
      .getByRole("columnheader", { name: "bknTrace.settings.archive.jobStatus" })
      .closest("table");
    expect(history?.querySelector("tbody tr")?.textContent).toContain(
      "bknTrace.settings.archive.statuses.cleanup_incomplete",
    );
    vi.mocked(listArchiveJobs).mockRejectedValue(new Error("history unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "bknTrace.settings.archive.refresh" }));
    await waitFor(() => expect(cleanupButton).toBeDisabled());
    expect(screen.getByText("bknTrace.settings.archive.kinds.trace")).not.toBeNull();
    expect(screen.queryByText("bknTrace.settings.archive.noHistory")).toBeNull();
  });
});
