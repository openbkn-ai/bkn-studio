/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { formatAuditUserDisplay } from "@/framework/audit/audit-user-display";
import { createRuntimeConfig, setRuntimeConfig } from "@/framework/runtime/config";

describe("formatAuditUserDisplay", () => {
  beforeEach(() => {
    setRuntimeConfig(
      createRuntimeConfig({
        currentUser: {
          id: "266c6a42-6131-4d62-8f39-853e7093701c",
          name: "Local Admin",
        },
      }),
    );
  });

  it("prefers a backend-provided user name", () => {
    expect(
      formatAuditUserDisplay({
        id: "266c6a42-6131-4d62-8f39-853e7093701c",
        name: "Alice Zhang",
      }),
    ).toBe("Alice Zhang");
  });

  it("uses the current user name when an audit snapshot only repeats its id", () => {
    expect(
      formatAuditUserDisplay({
        id: "266c6a42-6131-4d62-8f39-853e7093701c",
        name: "266c6a42-6131-4d62-8f39-853e7093701c",
      }),
    ).toBe("Local Admin");
  });

  it("keeps readable account identifiers", () => {
    expect(formatAuditUserDisplay({ id: "local-admin" })).toBe("local-admin");
  });

  it("keeps unresolved UUIDs as stable audit identifiers", () => {
    expect(formatAuditUserDisplay({ id: "1f4e4df0-6851-4ec5-b6c8-d7586f1f32e8" })).toBe(
      "1f4e4df0-6851-4ec5-b6c8-d7586f1f32e8",
    );
  });

  it("falls back to a placeholder only when both name and id are missing", () => {
    expect(formatAuditUserDisplay({ id: " ", name: " " })).toBe("-");
  });
});
