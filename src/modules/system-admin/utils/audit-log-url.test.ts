/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildAuditLogHref } from "./audit-log-url";

describe("buildAuditLogHref", () => {
  it("uses the canonical user target type and carries the known display name", () => {
    expect(buildAuditLogHref("user-a", "user", "Administrator")).toBe(
      "/system/audit?target_id=user-a&target_type=user&target_name=Administrator",
    );
  });
});
