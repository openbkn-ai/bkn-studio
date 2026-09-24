/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { PermissionRequest } from "@/modules/account/services/permission-requests.service";

import { shouldRefreshPermissionRequestDetail } from "./permission-request-detail";

describe("shouldRefreshPermissionRequestDetail", () => {
  it("does not create a detail drawer state when cancellation starts from a list row", () => {
    expect(shouldRefreshPermissionRequestDetail(null, "request-1")).toBe(false);
  });

  it("refreshes only the detail drawer for the request being cancelled", () => {
    expect(
      shouldRefreshPermissionRequestDetail({ id: "request-1" } as PermissionRequest, "request-1"),
    ).toBe(true);
    expect(
      shouldRefreshPermissionRequestDetail({ id: "request-2" } as PermissionRequest, "request-1"),
    ).toBe(false);
  });
});
