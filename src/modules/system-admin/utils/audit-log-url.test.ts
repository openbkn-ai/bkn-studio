/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildAuditLogHref } from "./audit-log-url";

describe("buildAuditLogHref", () => {
  it("filters by the selected user as the audit actor without putting mutable display data in the URL", () => {
    expect(buildAuditLogHref("user-a")).toBe("/system/audit?actor_id=user-a&actor_match=exact");
  });
});
