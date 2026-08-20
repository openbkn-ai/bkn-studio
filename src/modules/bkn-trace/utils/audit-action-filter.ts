/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

type Translate = (key: string, options?: { defaultValue?: string }) => string;

const AUDIT_ACTIONS = [
  "activate", "add_members", "add_redirect_uri", "bind_role", "create", "delete",
  "grant", "grant_permission", "import", "import_receipt", "regenerate", "remove",
  "remove_members", "remove_redirect_uri", "reset_password", "revoke", "revoke_permission",
  "unbind_role", "update", "update_profile",
];

const SYSTEM_MANAGEMENT_ACTIONS: Array<[label: string, action: string]> = [
  ["createUser", "create"], ["updateUser", "update"], ["deleteUser", "delete"],
  ["createRole", "create"], ["updateRole", "update"], ["deleteRole", "delete"],
  ["createApiKey", "create"], ["deleteApiKey", "delete"],
];

/** Resolves a localized action label to the stable value expected by the log API. */
export function resolveAuditActionFilter(value: string, t: Translate): string {
  const normalized = value.trim();
  if (!normalized) return "";
  const needle = normalized.toLocaleLowerCase();
  const matches = new Set<string>();
  const candidates: Array<[action: string, label: string]> = [
    ...AUDIT_ACTIONS.map((action) => [action, t(`bknTrace.logs.auditActions.${action}`, { defaultValue: "" })] as const),
    ["login", t("bknTrace.logs.accessActions.login", { defaultValue: "" })],
    ["logout", t("bknTrace.logs.accessActions.logout", { defaultValue: "" })],
    ...SYSTEM_MANAGEMENT_ACTIONS.map(([label, action]) => [action, t(`bknTrace.logs.systemManagementActions.${label}`, { defaultValue: "" })] as const),
  ];
  for (const [action, label] of candidates) {
    if (action === normalized || (label && label.toLocaleLowerCase().includes(needle))) matches.add(action);
  }
  return matches.size === 1 ? [...matches][0] : normalized;
}
