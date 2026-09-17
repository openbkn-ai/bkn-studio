/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { AUDIT_RESOURCES, auditActionToken } from "./audit-labels";

describe("auditActionToken", () => {
  it("identifies property-grant updates and exposes their resource filter", () => {
    expect(auditActionToken("PATCH", "property-grants")).toBe("property_grants_update");
    expect(AUDIT_RESOURCES).toContain("property-grants");
  });
});
