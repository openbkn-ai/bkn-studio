/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

import { checkPermissionRequestResource } from "@/modules/account/services/permission-request-resource.service";

const request = {
  resource_id: "network-1",
  resource_type: "knowledge_network",
} as Parameters<typeof checkPermissionRequestResource>[0];

describe("checkPermissionRequestResource", () => {
  beforeEach(() => getMock.mockReset());

  it("does not mistake an empty single-entry envelope for a deleted resource", async () => {
    getMock.mockResolvedValue({ data: { entries: [] } });

    await expect(checkPermissionRequestResource(request)).resolves.toBe("unavailable");
    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks/network-1", {
      skipErrorToast: true,
    });
  });

  it("keeps a populated response available for navigation", async () => {
    getMock.mockResolvedValue({ data: { entries: [{ id: "network-1" }] } });

    await expect(checkPermissionRequestResource(request)).resolves.toBe("exists");
  });
});
