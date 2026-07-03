/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { createRuntimeConfig, setRuntimeConfig } from "@/framework/runtime/config";
import {
  buildAuditUserDirectory,
  formatAuditUserDisplay,
} from "@/modules/execution-factory/utils/audit-user-display";

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

  it("shows current user name instead of the raw user id", () => {
    expect(
      formatAuditUserDisplay({ id: "266c6a42-6131-4d62-8f39-853e7093701c" }),
    ).toBe("Local Admin");
  });

  it("prefers an explicitly provided user name", () => {
    expect(
      formatAuditUserDisplay({
        id: "266c6a42-6131-4d62-8f39-853e7093701c",
        name: "Alice Zhang",
      }),
    ).toBe("Alice Zhang");
  });

  it("keeps readable non-uuid account names", () => {
    expect(formatAuditUserDisplay({ id: "local-admin" })).toBe("local-admin");
  });

  it("does not expose unresolved uuid values", () => {
    expect(formatAuditUserDisplay({ id: "1f4e4df0-6851-4ec5-b6c8-d7586f1f32e8" })).toBe(
      "-",
    );
  });

  it("resolves user ids from the user directory", () => {
    const directory = buildAuditUserDirectory([
      { id: "1f4e4df0-6851-4ec5-b6c8-d7586f1f32e8", name: "Chen Yanqiu" },
    ]);

    expect(
      formatAuditUserDisplay({
        directory,
        id: "1f4e4df0-6851-4ec5-b6c8-d7586f1f32e8",
      }),
    ).toBe("Chen Yanqiu");
  });
});
