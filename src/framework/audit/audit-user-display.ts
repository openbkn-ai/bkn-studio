/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";

type AuditUserIdentity = {
  id?: string | null;
  name?: string | null;
};

export type AuditUserDisplayInput = {
  currentUser?: AuditUserIdentity;
  id?: string | null;
  name?: string | null;
};

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Format an audit actor without broadening access to the administrator user directory.
 * Backend-provided snapshots win, followed by the current user's name and the stable raw ID.
 */
export function formatAuditUserDisplay({ currentUser, id, name }: AuditUserDisplayInput) {
  const userId = clean(id);
  const displayName = clean(name);
  if (displayName && displayName !== userId) {
    return displayName;
  }

  if (!userId) {
    return displayName ?? "-";
  }

  const activeUser = currentUser ?? getRuntimeConfig().currentUser;
  if (userId === clean(activeUser.id)) {
    return clean(activeUser.name) ?? userId;
  }

  return userId;
}
