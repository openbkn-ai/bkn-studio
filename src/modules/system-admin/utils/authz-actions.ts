/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { authzPoints } from "@/modules/system-admin/permissions";

/**
 * Determines which permission point receives an operation-chip click in the object-grant drawer.
 *
 * Backend object-grant writes use replacement semantics: changing operations sends POST
 * (admin-authz:grant), while clearing them sends DELETE (admin-authz:revoke). Frontend
 * upsertObjectGrant automatically switches to revoke for an empty set, so removing the last
 * operation revokes the entire grant and requires revoke rather than grant.
 *
 * Kept as a pure function because this mapping is easy to get wrong: the opposite of selected is
 * not always revoke; only a selected last operation is.
 */
export function chipTogglePoint(selected: boolean, currentOpCount: number): string {
  if (selected && currentOpCount <= 1) {
    return authzPoints.revoke;
  }
  return authzPoints.grant;
}
