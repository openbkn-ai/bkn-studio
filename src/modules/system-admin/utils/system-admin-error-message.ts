/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "@/app/locales/i18n";
import { extractRequestErrorMessage } from "@/framework/request/error-message";

/** bkn-safe admin API `error` strings → i18n keys. */
const KNOWN_SAFE_ADMIN_ERRORS: Record<string, string> = {
  "department has child departments or members": "systemAdmin.errors.deptNotEmpty",
  "department not found": "systemAdmin.errors.deptNotFound",
  "department code already exists": "systemAdmin.errors.deptCodeDuplicate",
  "department not empty": "systemAdmin.errors.deptNotEmpty",
  "invalid or inactive token": "systemAdmin.errors.invalidToken",
  "missing bearer token": "systemAdmin.errors.missingToken",
  "not authorized for admin operations": "systemAdmin.errors.notAdmin",
};

function isUserAccountDuplicate(raw: string) {
  const normalized = raw.toLowerCase();
  return (
    normalized.includes("idx_users_account") ||
    normalized.includes("user account already exists") ||
    normalized.includes("account already exists") ||
    raw.includes("登录名已存在")
  );
}

export function extractSystemAdminErrorMessage(error: unknown) {
  const raw = extractRequestErrorMessage(error).trim();
  const key = KNOWN_SAFE_ADMIN_ERRORS[raw];
  if (key) {
    return i18n.t(key);
  }
  if (isUserAccountDuplicate(raw)) {
    return i18n.t("systemAdmin.errors.userAccountDuplicate");
  }
  if (raw.startsWith("unknown user id")) {
    return i18n.t("systemAdmin.errors.unknownUser");
  }
  if (raw.includes("invalid department email")) {
    return i18n.t("systemAdmin.errors.deptEmailInvalid");
  }
  return raw;
}
