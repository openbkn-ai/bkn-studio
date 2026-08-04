/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ObservabilityLogsScene } from "@/modules/bkn-trace/scenes/ObservabilityLogsScene";
import { ObservabilitySettingsScene } from "@/modules/bkn-trace/scenes/ObservabilitySettingsScene";
import { getLogDetail, listLogFacets, listLogPolicies, listLogs, listLogSources } from "@/modules/bkn-trace/services/observability.service";
import { getAccessProfile } from "@/modules/bkn-trace/services/trace.service";

const translate = (key: string) => key;

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
  return { ...original, getLogDetail: vi.fn(), listLogFacets: vi.fn(), listLogPolicies: vi.fn(), listLogs: vi.fn(), listLogSources: vi.fn() };
});

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
        attributes: {}, category: "runtime.business", environment: "production",
        eventName: "operation.completed", eventTimestamp: "2026-08-01T10:00:00Z",
        logId: "log-a", observedTimestamp: "2026-08-01T10:00:01Z", outcome: "success",
        serviceName: "context-loader", severityNumber: 9, severityText: "INFO",
        sourceId: "otel-ss4o", summary: "OpenBKN operation completed", toolName: "run_sql", traceId: "trace-a",
      }],
      partial: true,
      sourceStatus: [{ coveredModules: ["openbkn"], reason: "source_query_failed", reliability: "best_effort", sourceId: "safe-audit", status: "unavailable" }],
    });
    vi.mocked(listLogSources).mockResolvedValue([{ coveredModules: ["openbkn"], collectionMethod: "direct_otlp", reliability: "best_effort", sourceId: "otel-ss4o", status: "healthy" }]);
    vi.mocked(listLogPolicies).mockResolvedValue([{ category: "runtime.system", legalHold: false, policyKind: "runtime", policyRevision: "r6.2-default", readOnly: true, retentionDays: 7, scope: { tenant_id: "tenant-a" } }]);
		vi.mocked(listLogFacets).mockResolvedValue({ data: [{ count: 1, value: "context-loader" }], partial: false, sourceStatus: [] });
		vi.mocked(getLogDetail).mockResolvedValue({
			data: {
				attributes: {}, category: "runtime.business", environment: "production", eventName: "knowledge.read.completed",
				eventTimestamp: "2026-08-01T10:00:00Z", logId: "log-a", observedTimestamp: "2026-08-01T10:00:01Z",
				outcome: "success", serviceName: "context-loader", severityNumber: 9, severityText: "INFO",
				requestId: "req-a", sourceId: "context-loader", summary: "读取需求预测对象", traceId: "trace-a",
			},
			policyRevision: "r6.2-default", redactedFields: [], relatedTraceIds: ["trace-a"],
		});
  });

  afterEach(() => cleanup());

  it("日志检索展示授权类别、局部结果和来源状态", async () => {
    render(<ObservabilityLogsScene />);
    await waitFor(() => expect(listLogs).toHaveBeenCalled());
    const [query] = vi.mocked(listLogs).mock.calls[0] ?? [];
    expect(query).toMatchObject({ page: 1, pageSize: 20 });
    expect(query?.timeFrom).toEqual(expect.any(String));
    expect(query?.timeTo).toEqual(expect.any(String));
    expect(await screen.findByText("bknTrace.operations.runSql")).not.toBeNull();
    expect(screen.queryByText("OpenBKN operation completed")).toBeNull();
    expect(screen.getByText("bknTrace.logs.partialWarning")).not.toBeNull();
    expect(screen.getByText("runtime.business")).not.toBeNull();
  });

  it("按页读取日志并保留当前筛选条件", async () => {
    vi.mocked(listLogs)
      .mockResolvedValueOnce({
        count: { accuracy: "partial", value: 40 },
        data: [{
          attributes: {}, category: "runtime.system", environment: "production", eventName: "service.started",
          eventTimestamp: "2026-08-01T10:00:00Z", logId: "log-a", observedTimestamp: "2026-08-01T10:00:01Z",
          outcome: "success", serviceName: "bkn-trace", severityNumber: 9, severityText: "INFO",
          sourceId: "otel-runtime", summary: "服务已启动",
        }],
        page: 1, pageSize: 20, partial: false, sourceStatus: [],
      })
      .mockResolvedValueOnce({
        count: { accuracy: "exact", value: 40 },
        data: [{
          attributes: {}, category: "runtime.system", environment: "production", eventName: "dependency.failed",
          eventTimestamp: "2026-08-01T09:59:00Z", logId: "log-b", observedTimestamp: "2026-08-01T09:59:01Z",
          outcome: "failure", serviceName: "bkn-trace", severityNumber: 17, severityText: "ERROR",
          sourceId: "otel-runtime", summary: "依赖调用失败",
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
    expect(await screen.findByText("依赖调用失败")).not.toBeNull();
  });

	 it("点击日志打开受控详情并可下钻 Trace", async () => {
		 render(<ObservabilityLogsScene />);
		 const summary = await screen.findByText("bknTrace.operations.runSql");
		 fireEvent.click(summary);
		 await waitFor(() => expect(getLogDetail).toHaveBeenCalledWith("log-a"));
		 expect(await screen.findByText("bknTrace.logs.detail.title")).not.toBeNull();
		 expect(screen.getByRole("link", { name: "bknTrace.logs.detail.openBusinessProvenance" }).getAttribute("href")).toBe("/studio/observability/business-provenance?view=requests&request_id=req-a");
		 expect(screen.getByRole("link", { name: "bknTrace.logs.detail.openTrace" }).getAttribute("href")).toBe("/studio/observability/traces?trace_id=trace-a");
	 });

  it("设置页只读展示来源覆盖和保留策略", async () => {
    render(<ObservabilitySettingsScene />);
    await waitFor(() => expect(listLogSources).toHaveBeenCalled());
    expect(await screen.findByText("otel-ss4o")).not.toBeNull();
    expect(screen.getByText("7 bknTrace.settings.days")).not.toBeNull();
    expect(screen.getByText("bknTrace.settings.readOnlyNotice")).not.toBeNull();
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
		 expect(await screen.findByText("Trace trace-a")).not.toBeNull();
		 expect(screen.queryByPlaceholderText("bknTrace.logs.searchPlaceholder")).toBeNull();
		 expect(listLogFacets).not.toHaveBeenCalled();
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
