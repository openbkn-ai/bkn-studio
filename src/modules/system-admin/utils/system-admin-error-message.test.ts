/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import { extractSystemAdminErrorMessage } from "@/modules/system-admin/utils/system-admin-error-message";

describe("extractSystemAdminErrorMessage", () => {
  it("maps duplicate user account database errors to a business message", () => {
    const message = extractSystemAdminErrorMessage(
      new Error("Error 1062 (23000): Duplicate entry 'e' for key 'idx_users_account'"),
    );

    expect(message).toBe(i18n.t("systemAdmin.errors.userAccountDuplicate"));
    expect(message).not.toContain("Duplicate entry");
    expect(message).not.toContain("idx_users_account");
  });
});
