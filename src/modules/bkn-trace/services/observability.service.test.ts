/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const runtimeConfigMock = vi.hoisted(() => ({
  currentUser: { businessDomainId: "bd_demo" },
}));

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

vi.mock("@/framework/runtime/config", () => ({
  getRuntimeConfig: () => runtimeConfigMock,
}));

describe("observability service", () => {
  beforeEach(() => {
    vi.resetModules();
    getMock.mockReset();
  });

  it("queries the unified log API without exposing storage details", async () => {
    getMock.mockResolvedValue({
      data: {
        data: [{
          schema_version: "1.0.0",
          log_id: "log-a",
          source_id: "otel",
          source_log_id: "source-a",
          log_category: "runtime.business",
          event_name: "knowledge.read.completed",
          event_timestamp: "2026-08-01T10:00:00Z",
          observed_timestamp: "2026-08-01T10:00:01Z",
          severity_number: 9,
          severity_text: "INFO",
          outcome: "success",
          safe_summary: "读取需求预测对象",
          service_name: "context-loader",
          tool_name: "run_sql",
          deployment_environment: "local",
          tenant_id: "tenant-a",
          ingress_principal: "otel-collector",
          trust_level: "trusted",
          trace_id: "4b3d59daeff5bfbb23d46c47a5051ec9",
        }],
        next_cursor: null,
        pagination: { page: 2, page_size: 20 },
        partial: false,
        count: { value: 1, accuracy: "exact" },
        source_status: [],
        request_trace_context: { request_id: null, related_trace_ids: [] },
      },
    });
    const { listLogs } = await import("@/modules/bkn-trace/services/observability.service");

    const result = await listLogs({
      categories: ["runtime.business"],
      page: 2,
      pageSize: 20,
      timeFrom: "2026-08-01T00:00:00.000Z",
      timeTo: "2026-08-02T00:00:00.000Z",
      traceId: "4b3d59daeff5bfbb23d46c47a5051ec9",
    });

    expect(getMock).toHaveBeenCalledWith("/observability/v1/logs", {
      headers: { "x-business-domain": "bd_demo" },
      params: {
        categories: ["runtime.business"],
        page: 2,
        page_size: 20,
        time_from: "2026-08-01T00:00:00.000Z",
        time_to: "2026-08-02T00:00:00.000Z",
        trace_id: "4b3d59daeff5bfbb23d46c47a5051ec9",
      },
      skipErrorToast: true,
    });
    expect(result.data[0]).toMatchObject({
      category: "runtime.business",
      logId: "log-a",
      summary: "读取需求预测对象",
      toolName: "run_sql",
    });
    expect(result).toMatchObject({ page: 2, pageSize: 20 });
    expect(getMock.mock.calls.flat().join(" ")).not.toContain("_search");
  });

  it("loads source coverage and read-only policies from the gateway", async () => {
    getMock
      .mockResolvedValueOnce({ data: { data: [{ source_id: "otel", status: "available", reliability: "best_effort" }] } })
      .mockResolvedValueOnce({ data: { data: [{ category: "runtime.system", retention_days: 7, policy_kind: "runtime", policy_revision: "r1", scope: { tenant_id: "tenant-a" } }] } });
    const { listLogPolicies, listLogSources } = await import("@/modules/bkn-trace/services/observability.service");

    const sources = await listLogSources();
    const policies = await listLogPolicies();

    expect(getMock).toHaveBeenNthCalledWith(1, "/observability/v1/log-sources", {
      headers: { "x-business-domain": "bd_demo" },
      skipErrorToast: true,
    });
    expect(getMock).toHaveBeenNthCalledWith(2, "/observability/v1/log-policies", {
      headers: { "x-business-domain": "bd_demo" },
      skipErrorToast: true,
    });
    expect(sources[0]).toMatchObject({ sourceId: "otel", status: "available" });
    expect(policies[0]).toMatchObject({ category: "runtime.system", retentionDays: 7, readOnly: true });
  });

	 it("loads an authorized log detail and filtered facets from the gateway", async () => {
		 getMock
			 .mockResolvedValueOnce({ data: {
				 data: {
					 log_id: "log-a", source_id: "context-loader", log_category: "runtime.business",
					 event_name: "knowledge.read.completed", event_timestamp: "2026-08-01T10:00:00Z",
					 observed_timestamp: "2026-08-01T10:00:01Z", severity_number: 9, severity_text: "INFO",
					 outcome: "success", safe_summary: "读取需求预测对象", service_name: "context-loader",
					 deployment_environment: "production", trace_id: "trace-a",
				 },
				 field_projection: { policy_revision: "r6.2-default", redacted_fields: ["attributes.query"] },
				 request_trace_context: { current_trace_id: "trace-a", related_trace_ids: ["trace-a"] },
			 } })
			 .mockResolvedValueOnce({ data: { data: [{ value: "context-loader", count: 12 }], partial: false, source_status: [], next_cursor: null } });
		 const { getLogDetail, listLogFacets } = await import("@/modules/bkn-trace/services/observability.service");

		 const detail = await getLogDetail("log-a");
		 const facets = await listLogFacets("service_name", { categories: ["runtime.business"] });

		 expect(getMock).toHaveBeenNthCalledWith(1, "/observability/v1/logs/log-a", {
			 headers: { "x-business-domain": "bd_demo" }, skipErrorToast: true,
		 });
		 expect(getMock).toHaveBeenNthCalledWith(2, "/observability/v1/log-facets", {
			 headers: { "x-business-domain": "bd_demo" },
			 params: { categories: ["runtime.business"], facet: "service_name" },
			 skipErrorToast: true,
		 });
		 expect(detail).toMatchObject({ data: { logId: "log-a", summary: "读取需求预测对象" }, policyRevision: "r6.2-default", redactedFields: ["attributes.query"] });
		 expect(facets.data).toEqual([{ value: "context-loader", count: 12 }]);
	 });
});
