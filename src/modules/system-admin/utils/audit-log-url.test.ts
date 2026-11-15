/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildAuditLogHref, buildUserManagementAuditHref } from "./audit-log-url";

describe("buildAuditLogHref", () => {
  it("filters by the selected user as the audit actor without putting mutable display data in the URL", () => {
    expect(buildAuditLogHref("user-a")).toBe("/system/audit?actor_id=user-a&actor_match=exact");
  });

  it("finds management actions affecting the user, independently of who performed them", () => {
    const url = new URL(buildUserManagementAuditHref("deleted user/a"), "http://localhost");
    expect(url.searchParams.get("target_type")).toBe("user");
    expect(url.searchParams.get("target_id")).toBe("deleted user/a");
    expect(url.searchParams.has("actor_id")).toBe(false);
  });
});
