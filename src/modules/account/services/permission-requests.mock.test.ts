/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const httpCalls = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/framework/request/http", () => ({ http: httpCalls }));

describe("permission request mock service", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_USER", "admin");
    vi.resetModules();
    httpCalls.get.mockReset();
    httpCalls.post.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("keeps viewer requests separate from administrator requests and review tasks", async () => {
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    const service = await import("./permission-requests.service");
    for (const kind of ["mine", "todo", "reviewed"] as const) {
      await expect(service.listPermissionRequests(kind)).resolves.toEqual({
        entries: [],
        total_count: 0,
      });
    }
    await expect(service.getPermissionRequestTodoSummary()).resolves.toEqual({ pending_count: 0 });
    await expect(service.getPermissionRequest("mock-permission-request-3")).rejects.toThrow();
    await expect(
      service.listPermissionRequestReviews("mock-permission-request-3"),
    ).rejects.toThrow();

    await service.createPermissionRequest({
      resourceType: "resource",
      resourceID: "viewer-resource",
      operations: ["view_detail"],
      reason: "Read resource details",
    });
    const mine = await service.listPermissionRequests("mine");
    expect(mine).toMatchObject({
      total_count: 1,
      entries: [
        { requester_id: "local-mock-viewer", requester_name: "业务只读用户", status: "pending" },
      ],
    });
    const id = mine.entries[0].id;
    await expect(service.getPermissionRequest(id)).resolves.toMatchObject({
      requester_id: "local-mock-viewer",
    });
    await expect(service.listPermissionRequestReviews(id)).resolves.toEqual([]);
    await expect(service.listPermissionRequests("todo")).resolves.toMatchObject({ total_count: 0 });
    await expect(service.getPermissionRequestTodoSummary()).resolves.toEqual({ pending_count: 0 });
    expect(httpCalls.get).not.toHaveBeenCalled();
    expect(httpCalls.post).not.toHaveBeenCalled();
  });

  it("uses the active reviewer identity across viewer and administrator switches", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    const service = await import("./permission-requests.service");
    await service.createPermissionRequest({
      resourceType: "resource",
      resourceID: "viewer-resource",
      reason: "Viewer request",
    });
    const viewerRequest = (await service.listPermissionRequests("mine")).entries[0];

    vi.stubEnv("VITE_MOCK_USER", "admin");
    const admin = (await import("@/framework/runtime/dev-profile")).getDevRuntimeUser();
    await expect(service.listPermissionRequests("mine")).resolves.toMatchObject({
      total_count: 1,
      entries: [{ id: "mock-permission-request-3" }],
    });
    expect(
      (await service.listPermissionRequests("todo")).entries.map((request) => request.id),
    ).toContain(viewerRequest.id);
    await expect(service.getPermissionRequestTodoSummary()).resolves.toEqual({ pending_count: 3 });
    await expect(service.cancelPermissionRequest(viewerRequest.id)).rejects.toThrow();
    await service.decidePermissionRequest(
      viewerRequest.id,
      "approve",
      "Approved by the administrator",
    );
    await expect(service.listPermissionRequests("reviewed")).resolves.toMatchObject({
      total_count: 1,
      entries: [{ id: viewerRequest.id, reviewer_id: admin.id, reviewer_name: admin.name }],
    });
    await service.createPermissionRequest({
      resourceType: "resource",
      resourceID: "admin-resource",
      reason: "Admin request",
    });
    const adminRequest = (await service.listPermissionRequests("mine")).entries.find(
      (request) => request.resource_id === "admin-resource",
    );
    expect(adminRequest?.id).not.toBe(viewerRequest.id);

    vi.stubEnv("VITE_MOCK_USER", "viewer");
    await expect(service.listPermissionRequests("mine")).resolves.toMatchObject({
      total_count: 1,
      entries: [{ id: viewerRequest.id, requester_id: "local-mock-viewer", status: "granted" }],
    });
    await expect(service.listPermissionRequestReviews(viewerRequest.id)).resolves.toMatchObject([
      { reviewer_id: admin.id, reviewer_name: admin.name, decision: "approve" },
    ]);
    await expect(service.listPermissionRequests("reviewed")).resolves.toMatchObject({
      total_count: 0,
    });
    await expect(service.getPermissionRequestTodoSummary()).resolves.toEqual({ pending_count: 0 });
  });

  it("refuses viewer decisions and cancellations of others without changing stored requests", async () => {
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    const service = await import("./permission-requests.service");
    await expect(
      service.decidePermissionRequest("mock-permission-request-1", "approve"),
    ).rejects.toThrow();
    await expect(service.cancelPermissionRequest("mock-permission-request-3")).rejects.toThrow();
    await service.createPermissionRequest({
      resourceType: "resource",
      resourceID: "viewer-resource",
      reason: "Viewer request",
    });
    const ownRequest = (await service.listPermissionRequests("mine")).entries[0];
    await expect(service.decidePermissionRequest(ownRequest.id, "approve")).rejects.toThrow();
    await service.cancelPermissionRequest(ownRequest.id);
    await expect(service.getPermissionRequest(ownRequest.id)).resolves.toMatchObject({
      status: "cancelled",
    });

    vi.stubEnv("VITE_MOCK_USER", "admin");
    await expect(service.getPermissionRequest("mock-permission-request-1")).resolves.toMatchObject({
      status: "pending",
    });
    await expect(service.getPermissionRequest("mock-permission-request-3")).resolves.toMatchObject({
      status: "granted",
    });
    await expect(
      service.listPermissionRequestReviews("mock-permission-request-1"),
    ).resolves.toEqual([]);
    await expect(service.getPermissionRequestTodoSummary()).resolves.toEqual({ pending_count: 2 });
  });

  it("serves lists, details, review history, and proposal preview without HTTP calls", async () => {
    const service = await import("./permission-requests.service");

    await expect(service.listPermissionRequests("todo")).resolves.toMatchObject({
      total_count: 2,
      entries: [
        { id: "mock-permission-request-1", status: "pending" },
        { id: "mock-permission-request-2", status: "pending" },
      ],
    });
    await expect(service.getPermissionRequest("mock-permission-request-1")).resolves.toMatchObject({
      resource_name: "示例知识网络",
    });
    await expect(
      service.listPermissionRequestReviews("mock-permission-request-3"),
    ).resolves.toMatchObject([{ decision: "approve", reviewer_name: "Demo Reviewer" }]);
    await expect(service.getPermissionRequestProposalPreview("object-1")).resolves.toEqual({
      property_grants: { entries: [] },
      row_filter: null,
    });
    expect(httpCalls.get).not.toHaveBeenCalled();
  });

  it("updates mock state when creating, deciding, and cancelling requests", async () => {
    const service = await import("./permission-requests.service");

    await service.createPermissionRequest({
      resourceType: "resource",
      resourceID: "resource-1",
      resourceName: "Demo resource",
      operations: ["view"],
      reason: "Need to inspect this resource",
    });
    await expect(service.listPermissionRequests("mine")).resolves.toMatchObject({
      entries: [
        { resource_name: "Demo resource", status: "pending" },
        { resource_name: "示例数据目录", status: "granted" },
      ],
    });

    await service.decidePermissionRequest(
      "mock-permission-request-1",
      "approve",
      "Approved locally",
    );
    await expect(service.getPermissionRequest("mock-permission-request-1")).resolves.toMatchObject({
      status: "granted",
      reviewer_name: "Local Admin",
    });
    await expect(
      service.listPermissionRequestReviews("mock-permission-request-1"),
    ).resolves.toMatchObject([{ decision: "approve", comment: "Approved locally" }]);

    await service.cancelPermissionRequest("mock-permission-request-3");
    await expect(service.getPermissionRequest("mock-permission-request-3")).resolves.toMatchObject({
      status: "cancelled",
    });
    expect(httpCalls.get).not.toHaveBeenCalled();
    expect(httpCalls.post).not.toHaveBeenCalled();
  });
});
