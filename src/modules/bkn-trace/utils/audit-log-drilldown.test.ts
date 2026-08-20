/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { readAuditLogDrilldown } from "./audit-log-drilldown";

describe("readAuditLogDrilldown", () => {
  it("normalizes legacy users target type without trusting its display label", () => {
    expect(readAuditLogDrilldown(new URLSearchParams("target_id=user-a&target_type=users&target_name=Administrator"))).toEqual({
      apiResourceType: "users",
      displayType: "user",
      targetId: "user-a",
    });
  });

  it("uses the canonical user type while preserving the BKN Safe resource value", () => {
    expect(readAuditLogDrilldown(new URLSearchParams("target_id=user-a&target_type=user"))).toEqual({
      apiResourceType: "users",
      displayType: "user",
      targetId: "user-a",
    });
  });

  it("accepts old resource links and preserves unknown resource types", () => {
    expect(readAuditLogDrilldown(new URLSearchParams("target_id=role-a&resource=roles"))).toEqual({
      apiResourceType: "roles",
      displayType: "roles",
      targetId: "role-a",
    });
  });
});
