/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const httpCalls = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/framework/request/http", () => ({ http: httpCalls }));

describe("permission request mock service", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.resetModules();
    httpCalls.get.mockReset();
    httpCalls.post.mockReset();
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
