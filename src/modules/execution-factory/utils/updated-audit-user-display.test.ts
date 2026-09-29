/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { createRuntimeConfig, setRuntimeConfig } from "@/framework/runtime/config";
import { formatUpdatedAuditUserDisplay } from "@/modules/execution-factory/utils/updated-audit-user-display";

describe("formatUpdatedAuditUserDisplay", () => {
  beforeEach(() => {
    setRuntimeConfig(createRuntimeConfig());
  });

  it("does not pair an update user id with the create user name", () => {
    expect(
      formatUpdatedAuditUserDisplay({
        createUser: "creator-id",
        createUserName: "Creator Name",
        updateUser: "updater-id",
      }),
    ).toBe("updater-id");
  });

  it("uses the complete create-user pair when there is no update user", () => {
    expect(
      formatUpdatedAuditUserDisplay({
        createUser: "creator-id",
        createUserName: "Creator Name",
        updateUserName: "Stale Updater Name",
      }),
    ).toBe("Creator Name");
  });
});
