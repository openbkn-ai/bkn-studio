/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock },
}));

describe("observability service", () => {
  it("maps the latest background run, its result and retained interactions", async () => {
    const run = {
      run_id: "arc_trace_1",
      archive_kind: "trace",
      trigger: "archive",
      status: "completed",
      eligible_at_start: 10,
      processed_count: 9,
      retained_count: 1,
      batch_count: 2,
      retry_count: 1,
      last_failure_code: "temporarily_unavailable",
      created_at: "2026-11-27T06:00:00Z",
      started_at: "2026-11-27T06:00:01Z",
      finished_at: "2026-11-27T06:10:00Z",
    };
    const retained = {
      interaction_id: "large",
      run_id: "arc_trace_1",
      stage: "sql_payload",
      measured: 12582912,
      budget: 8388608,
      unit: "bytes",
      retained_at: "2026-11-27T06:05:00Z",
    };
    getMock
      .mockResolvedValueOnce({
        data: {
          archive_kind: "trace",
          retention_days: 7,
          cutoff_at: "2026-11-20T00:00:00Z",
          candidate_count: 0,
          storage: { status: "ready" },
          current_run: run,
          retained_count: 1,
        },
      })
      .mockResolvedValueOnce({ data: { ...run, retained: [retained] } })
      .mockResolvedValueOnce({ data: [retained] })
      .mockResolvedValueOnce({
        data: {
          archive_kind: "log",
          retention_days: 30,
          cutoff_at: "2026-10-28T00:00:00Z",
          candidate_count: 3,
          storage: { status: "ready" },
        },
      });
    const {
      getArchiveOverview,
      getArchiveRunResult,
      isArchiveRunActive,
      listRetainedInteractions,
    } = await import("./observability.service");
    const overview = await getArchiveOverview("trace");
    expect(overview.retainedCount).toBe(1);
    expect(overview.currentRun).toMatchObject({
      id: "arc_trace_1",
      status: "completed",
      processedCount: 9,
      retainedCount: 1,
      lastFailureCode: "temporarily_unavailable",
      finishedAt: "2026-11-27T06:10:00Z",
    });
    expect(isArchiveRunActive(overview.currentRun)).toBe(false);
    const result = await getArchiveRunResult("arc_trace_1");
    expect(result.retained).toEqual([
      {
        interactionId: "large",
        runId: "arc_trace_1",
        stage: "sql_payload",
        measured: 12582912,
        atLeast: false,
        budget: 8388608,
        unit: "bytes",
        retainedAt: "2026-11-27T06:05:00Z",
      },
    ]);
    expect((await listRetainedInteractions())[0]?.interactionId).toBe("large");
    // An older service without runs still yields a usable overview.
    const legacy = await getArchiveOverview("log");
    expect(legacy.currentRun).toBeUndefined();
    expect(legacy.retainedCount).toBe(0);
    expect(isArchiveRunActive({ ...overview.currentRun!, status: "retry_wait" })).toBe(true);
  });

  it("preserves archive diagnostics consistently for create, history and cleanup retry", async () => {
    const job = {
      archive_job_id: "blocked",
      archive_kind: "trace",
      candidate_count: 0,
      range: { from: null, to: "2026-11-01" },
      status: "failed",
      error_message: "safe diagnostic",
      batch_progress: {
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
    };
    postMock.mockResolvedValue({ data: job });
    getMock.mockResolvedValueOnce({ data: [job] });
    const { createArchive, listArchiveJobs, retryArchiveCleanup } =
      await import("./observability.service");
    const expected = {
      id: "blocked",
      kind: "trace",
      candidateCount: 0,
      range: job.range,
      status: "failed",
      errorMessage: job.error_message,
      batchProgress: job.batch_progress,
    };
    await createArchive("trace");
    expect(await listArchiveJobs("trace")).toEqual([expected]);
    await retryArchiveCleanup("blocked");
    expect(postMock).toHaveBeenCalledWith(
      "/observability/v1/archive-jobs/blocked/retry-cleanup",
      {},
      { skipErrorToast: true },
    );
    getMock.mockResolvedValueOnce({
      data: [{ ...job, batch_progress: undefined, error_message: undefined }],
    });
    expect((await listArchiveJobs("trace"))[0]?.batchProgress).toBeUndefined();
  });

  it("distinguishes an unconfigured audit consumer from a temporary source failure", async () => {
    const { isAuditConsumerNotConfigured } = await import("./observability.service");
    const response = {
      config: { headers: new AxiosHeaders() },
      data: { error: { code: "audit_consumer_not_configured", retryable: false } },
      headers: {},
      status: 503,
      statusText: "Service Unavailable",
    };
    expect(
      isAuditConsumerNotConfigured(
        new AxiosError("503", undefined, undefined, undefined, response),
      ),
    ).toBe(true);
    response.data.error.code = "sources_unavailable";
    expect(
      isAuditConsumerNotConfigured(
        new AxiosError("503", undefined, undefined, undefined, response),
      ),
    ).toBe(false);
    expect(isAuditConsumerNotConfigured(new Error("audit_consumer_not_configured"))).toBe(false);
    expect(
      isAuditConsumerNotConfigured(
        new AxiosError("409", undefined, undefined, undefined, {
          ...response,
          data: undefined,
        }),
      ),
    ).toBe(false);
  });

  it("recognizes only the structured 409 cursor_stale error", async () => {
    const { isLogCursorStale } = await import("./observability.service");
    const response = {
      config: { headers: new AxiosHeaders() },
      data: { error: { code: "cursor_stale", retryable: false } },
      headers: {},
      status: 409,
      statusText: "Conflict",
    };
    const error = () => new AxiosError("409", undefined, undefined, undefined, response);
    expect(isLogCursorStale(error())).toBe(true);
    expect(
      isLogCursorStale(
        new AxiosError("409", undefined, undefined, undefined, {
          ...response,
          data: undefined,
        }),
      ),
    ).toBe(false);
    response.data.error.code = "cursor_invalid";
    expect(isLogCursorStale(error())).toBe(false);
    response.data.error.code = "cursor_stale";
    response.status = 503;
    expect(isLogCursorStale(error())).toBe(false);
    expect(isLogCursorStale(new Error("cursor_stale"))).toBe(false);
  });

  it.each(["sources", "logs"] as const)(
    "preserves publisher diagnostics and unknown values in %s",
    async (endpoint) => {
      const collection: Record<string, unknown> = {
        scope: "bkn-safe-publisher-instance",
        instance_id: "safe-current",
        status: "healthy",
        reason: "delivery_observed",
        observed_at: "2026-10-24T12:00:00Z",
        last_delivered_at: "2026-10-24T11:59:00Z",
        last_failure_at: null,
        dropped_records: 0,
        historical_gap: true,
        historical_gap_since: "2026-10-23T12:00:00Z",
      };
      const source = {
        source_id: "audit-ledger",
        status: "healthy",
        status_scope: "query",
        reliability: "best_effort",
        dropped_records: 7,
        dropped_records_since: "2026-10-23T12:00:00Z",
        collection_status: collection,
      };
      const response = () =>
        endpoint === "sources"
          ? { data: [source] }
          : {
              data: [],
              count: { value: 0, accuracy: "exact" },
              partial: false,
              next_cursor: null,
              source_status: [source],
            };
      const service = await import("./observability.service");
      const load = async () =>
        endpoint === "sources"
          ? service.listLogSources()
          : (await service.listLogs({})).sourceStatus;
      getMock.mockResolvedValueOnce({ data: response() });
      const [mapped] = await load();
      expect(mapped).toMatchObject({
        statusScope: "query",
        droppedRecords: 7,
        collectionStatus: {
          scope: "bkn-safe-publisher-instance",
          instanceId: "safe-current",
          status: "healthy",
          reason: "delivery_observed",
          observedAt: collection.observed_at,
          lastDeliveredAt: collection.last_delivered_at,
          lastFailureAt: null,
          droppedRecords: 0,
          historicalGap: true,
          historicalGapSince: collection.historical_gap_since,
        },
      });
      collection.dropped_records = null;
      collection.historical_gap = null;
      collection.historical_gap_since = null;
      getMock.mockResolvedValueOnce({ data: response() });
      expect((await load())[0].collectionStatus).toMatchObject({
        droppedRecords: null,
        historicalGap: null,
        historicalGapSince: null,
      });
      const legacy = { source_id: "audit-ledger", status: "healthy", reliability: "best_effort" };
      getMock.mockResolvedValueOnce({
        data:
          endpoint === "sources" ? { data: [legacy] } : { ...response(), source_status: [legacy] },
      });
      const [old] = await load();
      expect(old).not.toHaveProperty("collectionStatus");
      expect(old).not.toHaveProperty("droppedRecords");
    },
  );

  it.each(["sources", "logs"] as const)(
    "normalizes future publisher states in %s",
    async (endpoint) => {
      const source = {
        source_id: "audit-ledger",
        status: "healthy",
        reliability: "best_effort",
        collection_status: {
          scope: "bkn-safe-publisher-instance",
          status: "unhealthy",
          reason: "private_future_status_reason",
          observed_at: null,
          last_delivered_at: null,
          last_failure_at: null,
          dropped_records: null,
          historical_gap: null,
          historical_gap_since: null,
        },
      };
      getMock.mockResolvedValueOnce({
        data:
          endpoint === "sources"
            ? { data: [source] }
            : {
                data: [],
                count: { value: 0, accuracy: "exact" },
                next_cursor: null,
                partial: false,
                source_status: [source],
              },
      });
      const service = await import("./observability.service");
      const sources =
        endpoint === "sources"
          ? await service.listLogSources()
          : (await service.listLogs({})).sourceStatus;
      expect(sources[0].collectionStatus).toMatchObject({
        status: "unknown",
        reason: "unsupported_publisher_status",
      });
      expect(JSON.stringify(sources[0])).not.toContain("unhealthy");
      expect(JSON.stringify(sources[0])).not.toContain("private_future_status_reason");
    },
  );

  beforeEach(() => {
    vi.resetModules();
    getMock.mockReset();
  });

  it("queries the operation audit API with stable business filters", async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
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
            source_channel: "api",
            source_id: "bkn-trace-core",
            business_module: "domain_knowledge_network",
            outcome: "success",
            facts: {
              action: "create",
              target_type: "conversation",
              target_id: "conv-a",
              target_name_snapshot: "供应链分析助手",
              operation_type: "conversation.create",
              operation_status: "completed",
              business_context: "managed",
            },
            correlation: {
              request_id: "req-a",
              conversation_id: "conv-a",
              trace_id: "4b3d59daeff5bfbb23d46c47a5051ec9",
            },
            attributes: {},
          },
        ],
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
      sourceId: "bkn-safe-admin",
      failedOnly: true,
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
      params: {
        categories: ["audit.admin"],
        business_module: "domain_knowledge_network",
        source_id: "bkn-safe-admin",
        failed_only: true,
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

  it("preserves anonymous actors and unknown source channels from denied Audit", async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            event_id: "safe-denied-1",
            event_name: "safe.admin.operation.observed",
            event_time: "2026-09-29T00:00:00Z",
            recorded_at: "2026-09-29T00:00:01Z",
            actor_id: "anonymous",
            actor_name_snapshot: "",
            actor_type: "anonymous",
            auth_method: "unknown",
            source_channel: "unknown",
            source_id: "bkn-safe-admin",
            business_module: "system_management",
            log_category: "audit.admin",
            outcome: "denied",
            facts: {
              action: "create",
              target_type: "user",
              target_id: "user:req-denied",
              target_name_snapshot: "",
            },
            correlation: { request_id: "req-denied" },
            attributes: {},
          },
        ],
        count: { accuracy: "partial", value: 1 },
        next_cursor: null,
        partial: true,
        source_status: [],
        pagination: { page: 1, page_size: 20 },
      },
    });
    const { listLogs } = await import("@/modules/bkn-trace/services/observability.service");
    const result = await listLogs({ sourceId: "bkn-safe-admin" });
    const acceptedActorType: (typeof result.data)[number]["actor"]["type"] = "anonymous";
    const acceptedSourceChannel: (typeof result.data)[number]["sourceChannel"] = "unknown";
    expect(acceptedActorType).toBe("anonymous");
    expect(acceptedSourceChannel).toBe("unknown");
    expect(result.data[0]).toMatchObject({
      actor: { id: "anonymous", type: "anonymous" },
      sourceChannel: "unknown",
      outcome: "denied",
    });
  });

  it("loads source coverage and read-only policies from the gateway", async () => {
    getMock
      .mockResolvedValueOnce({
        data: { data: [{ source_id: "otel", status: "available", reliability: "best_effort" }] },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              category: "runtime.business",
              retention_days: 7,
              policy_kind: "runtime",
              policy_revision: "r1",
              scope: {},
            },
          ],
        },
      });
    const { listLogPolicies, listLogSources } =
      await import("@/modules/bkn-trace/services/observability.service");

    const sources = await listLogSources();
    const policies = await listLogPolicies();

    expect(getMock).toHaveBeenNthCalledWith(1, "/observability/v1/log-sources", {
      skipErrorToast: true,
    });
    expect(getMock).toHaveBeenNthCalledWith(2, "/observability/v1/log-policies", {
      skipErrorToast: true,
    });
    expect(sources[0]).toMatchObject({ sourceId: "otel", status: "available" });
    expect(policies[0]).toMatchObject({
      category: "runtime.business",
      retentionDays: 7,
      readOnly: true,
    });
  });

  it("lists the complete declared source inventory without treating it as producer coverage", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        registry_version: "0.3.15",
        data: [
          {
            source_id: "model-manager",
            owner: "Model Platform",
            modules: ["Model Manager"],
            declared_collection_method: "kafka_audit",
            declared_reliability: "best_effort",
            query_status: "not_listed",
            coverage_status: "unverified",
          },
        ],
      },
    });
    const { listLogSourceInventory } =
      await import("@/modules/bkn-trace/services/observability.service");

    const inventory = await listLogSourceInventory();

    expect(getMock).toHaveBeenCalledWith("/observability/v1/log-source-inventory", {
      skipErrorToast: true,
    });
    expect(inventory.registryVersion).toBe("0.3.15");
    expect(inventory.data[0]).toMatchObject({
      sourceId: "model-manager",
      declaredCollectionMethod: "kafka_audit",
      queryStatus: "not_listed",
      coverageStatus: "unverified",
    });
  });

  it("keeps log and trace archive overview endpoints separate", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          archive_kind: "log",
          retention_days: 30,
          cutoff_at: "2026-07-15T00:00:00+08:00",
          candidate_count: 4,
          storage: { status: "ready" },
        },
      })
      .mockResolvedValueOnce({
        data: {
          archive_kind: "trace",
          retention_days: 7,
          cutoff_at: "2026-08-07T00:00:00+08:00",
          candidate_count: 2,
          storage: { status: "ready" },
        },
      });
    const { getArchiveOverview } =
      await import("@/modules/bkn-trace/services/observability.service");

    const [logs, traces] = await Promise.all([
      getArchiveOverview("log"),
      getArchiveOverview("trace"),
    ]);

    expect(logs).toMatchObject({ kind: "log", retentionDays: 30, candidateCount: 4 });
    expect(traces).toMatchObject({ kind: "trace", retentionDays: 7, candidateCount: 2 });
    expect(getMock).toHaveBeenNthCalledWith(
      1,
      "/observability/v1/log-archive-overview",
      expect.objectContaining({ skipErrorToast: true }),
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      "/observability/v1/trace-archive-overview",
      expect.objectContaining({ skipErrorToast: true }),
    );
  });

  it("downloads an archive through the observability API instead of exposing an object-store URL", async () => {
    const archive = { type: "application/x-ndjson" } as Blob;
    getMock.mockResolvedValue({
      data: archive,
      headers: { "content-disposition": 'attachment; filename="trace-archive.jsonl"' },
    });
    const { downloadArchive } = await import("@/modules/bkn-trace/services/observability.service");

    const data = await downloadArchive("arc-log-1");

    expect(getMock).toHaveBeenCalledWith("/observability/v1/archive-jobs/arc-log-1/download", {
      responseType: "blob",
      skipErrorToast: true,
    });
    expect(data).toEqual({ content: archive, fileName: "trace-archive.jsonl" });
  });

  it("loads an authorized operation audit detail from the gateway", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: {
          event_id: "audit-a",
          log_category: "audit.admin",
          event_name: "role.updated",
          event_time: "2026-08-01T10:00:00Z",
          recorded_at: "2026-08-01T10:00:01Z",
          actor_id: "user-a",
          actor_name_snapshot: "Administrator",
          actor_type: "user",
          auth_method: "session",
          source_channel: "studio",
          source_id: "bkn-safe-admin",
          business_module: "system_management",
          outcome: "success",
          facts: {
            action: "grant",
            target_type: "knowledge_network",
            target_id: "supplychain_hd0202",
            target_name_snapshot: "HD供应链业务知识网络_v3",
          },
          correlation: { request_id: "req-a", trace_id: "4b3d59daeff5bfbb23d46c47a5051ec9" },
          attributes: {},
        },
        field_projection: {
          policy_revision: "r6.2-default",
          redacted_fields: ["attributes.query"],
        },
        request_trace_context: { current_trace_id: "trace-a", related_trace_ids: ["trace-a"] },
      },
    });
    const { getLogDetail } = await import("@/modules/bkn-trace/services/observability.service");

    const detail = await getLogDetail("log-a");

    expect(getMock).toHaveBeenCalledWith("/observability/v1/logs/log-a", {
      skipErrorToast: true,
    });
    expect(detail).toMatchObject({
      data: {
        eventId: "audit-a",
        businessModule: "system_management",
        action: "grant",
        target: { id: "supplychain_hd0202" },
      },
      policyRevision: "r6.2-default",
      redactedFields: ["attributes.query"],
    });
  });
});
