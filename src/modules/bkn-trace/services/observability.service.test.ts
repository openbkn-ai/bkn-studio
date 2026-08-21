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

  it("queries the operation audit API with stable business filters", async () => {
    getMock.mockResolvedValue({
      data: {
        data: [{
          schema_version: "1.0",
          event_id: "audit-a",
          log_category: "runtime.business",
          event_name: "conversation.created",
          event_time: "2026-08-01T10:00:00Z",
          recorded_at: "2026-08-01T10:00:01Z",
          actor_id: "user-a",
          actor_name_snapshot: "供应链管理员",
          actor_type: "user",
          auth_method: "api_key",
          credential_id: "key-a",
          tenant_id: "tenant-a",
          source_channel: "api",
          source_id: "bkn-trace-core",
          business_module: "domain_knowledge_network",
          outcome: "success",
          facts: { action: "create", target_type: "conversation", target_id: "conv-a", target_name_snapshot: "供应链分析助手", operation_type: "conversation.create", operation_status: "completed", business_context: "managed" },
          correlation: { request_id: "req-a", conversation_id: "conv-a", trace_id: "4b3d59daeff5bfbb23d46c47a5051ec9" },
          attributes: {},
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
      categories: ["audit.admin"],
      businessModule: "domain_knowledge_network",
      actorId: "user-a",
      action: "create",
      targetType: "conversation",
      targetId: "conv-a",
      outcomes: ["success"],
      conversationId: "conv-a",
      page: 2,
      pageSize: 20,
      timeFrom: "2026-08-01T00:00:00.000Z",
      timeTo: "2026-08-02T00:00:00.000Z",
      traceId: "4b3d59daeff5bfbb23d46c47a5051ec9",
    });

    expect(getMock).toHaveBeenCalledWith("/observability/v1/logs", {
      headers: { "x-business-domain": "bd_demo" },
      params: {
        categories: ["audit.admin"],
        business_module: "domain_knowledge_network",
        actor_id: "user-a",
        action: "create",
        target_type: "conversation",
        target_id: "conv-a",
        outcomes: ["success"],
        conversation_id: "conv-a",
        page: 2,
        page_size: 20,
        time_from: "2026-08-01T00:00:00.000Z",
        time_to: "2026-08-02T00:00:00.000Z",
        trace_id: "4b3d59daeff5bfbb23d46c47a5051ec9",
      },
      paramsSerializer: { indexes: null },
      skipErrorToast: true,
    });
    expect(result.data[0]).toMatchObject({
      eventId: "audit-a",
      eventName: "conversation.created",
      logCategory: "runtime.business",
      businessModule: "domain_knowledge_network",
      action: "create",
      target: { id: "conv-a", name: "供应链分析助手", type: "conversation" },
      actor: { id: "user-a", name: "供应链管理员", type: "user" },
      authMethod: "api_key",
      conversationId: "conv-a",
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

  it("keeps log and trace archive overview endpoints separate", async () => {
    getMock
      .mockResolvedValueOnce({ data: { archive_kind: "log", retention_days: 30, cutoff_at: "2026-07-15T00:00:00+08:00", candidate_count: 4, storage: { status: "ready" } } })
      .mockResolvedValueOnce({ data: { archive_kind: "trace", retention_days: 7, cutoff_at: "2026-08-07T00:00:00+08:00", candidate_count: 2, storage: { status: "ready" } } });
    const { getArchiveOverview } = await import("@/modules/bkn-trace/services/observability.service");

    const [logs, traces] = await Promise.all([getArchiveOverview("log"), getArchiveOverview("trace")]);

    expect(logs).toMatchObject({ kind: "log", retentionDays: 30, candidateCount: 4 });
    expect(traces).toMatchObject({ kind: "trace", retentionDays: 7, candidateCount: 2 });
    expect(getMock).toHaveBeenNthCalledWith(1, "/observability/v1/log-archive-overview", expect.objectContaining({ skipErrorToast: true }));
    expect(getMock).toHaveBeenNthCalledWith(2, "/observability/v1/trace-archive-overview", expect.objectContaining({ skipErrorToast: true }));
  });

  it("downloads an archive through the observability API instead of exposing an object-store URL", async () => {
    const archive = { type: "application/x-ndjson" } as Blob;
    getMock.mockResolvedValue({ data: archive, headers: { "content-disposition": 'attachment; filename="trace-archive.jsonl"' } });
    const { downloadArchive } = await import("@/modules/bkn-trace/services/observability.service");

    const data = await downloadArchive("arc-log-1");

    expect(getMock).toHaveBeenCalledWith("/observability/v1/archive-jobs/arc-log-1/download", {
      headers: { "x-business-domain": "bd_demo" },
      responseType: "blob",
      skipErrorToast: true,
    });
    expect(data).toEqual({ content: archive, fileName: "trace-archive.jsonl" });
  });

	 it("loads an authorized operation audit detail from the gateway", async () => {
		 getMock.mockResolvedValueOnce({ data: {
				 data: {
				 event_id: "audit-a", log_category: "audit.admin", event_name: "role.updated",
				 event_time: "2026-08-01T10:00:00Z", recorded_at: "2026-08-01T10:00:01Z",
					 actor_id: "user-a", actor_name_snapshot: "Administrator", actor_type: "user", auth_method: "session",
					 tenant_id: "tenant-a", source_channel: "studio", source_id: "bkn-safe-admin",
					 business_module: "system_management", outcome: "success",
					 facts: { action: "grant", target_type: "knowledge_network", target_id: "supplychain_hd0202", target_name_snapshot: "HD供应链业务知识网络_v3" },
					 correlation: { request_id: "req-a", trace_id: "4b3d59daeff5bfbb23d46c47a5051ec9" }, attributes: {},
				 },
				 field_projection: { policy_revision: "r6.2-default", redacted_fields: ["attributes.query"] },
				 request_trace_context: { current_trace_id: "trace-a", related_trace_ids: ["trace-a"] },
			 } });
		 const { getLogDetail } = await import("@/modules/bkn-trace/services/observability.service");

		 const detail = await getLogDetail("log-a");

		 expect(getMock).toHaveBeenCalledWith("/observability/v1/logs/log-a", {
			 headers: { "x-business-domain": "bd_demo" }, skipErrorToast: true,
		 });
		 expect(detail).toMatchObject({
			 data: { eventId: "audit-a", businessModule: "system_management", action: "grant", target: { id: "supplychain_hd0202" } },
			 policyRevision: "r6.2-default", redactedFields: ["attributes.query"],
		 });
	 });
});
