/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { GrantRecord, ObjectGrant } from "@/modules/system-admin/types/authz";

/** The subject bkn-safe writes when the execution factory publishes something to everyone. */
export const PUBLIC_ACCESSOR_ID = "00000000-0000-0000-0000-000000000000";

/**
 * New records carry the authenticated user's ID in `createdBy`. Historical
 * records sometimes stored the authority kind there instead; synthetic system
 * actors are also not directory users. Only concrete user IDs should trigger a
 * user lookup.
 */
export function grantCreatorUserId(source: GrantRecord): string | undefined {
  const createdBy = source.createdBy?.trim();
  if (
    !createdBy ||
    createdBy === source.authoritySource ||
    createdBy.startsWith("system:")
  ) {
    return undefined;
  }
  return createdBy;
}

/**
 * New object-scoped responses identify role subjects explicitly. The source
 * fallback keeps Studio safe during a rolling deployment against an older
 * bkn-safe: direct role permissions always carry the protected role source.
 */
export function isRoleGrantSubject(grant: ObjectGrant) {
  return grant.accessorType === "role" ||
    (grant.grants ?? []).some((source) => source.policySource === "role_permission");
}

/** Only real users may be resolved through the user-directory API. */
export function isUserDirectorySubject(grant: ObjectGrant) {
  return grant.accessorType !== "public" &&
    grant.accessorId !== PUBLIC_ACCESSOR_ID &&
    !isRoleGrantSubject(grant);
}

/**
 * Whether bkn-safe will refuse a non-administrator write against this target
 * regardless of source ownership.
 *
 * Source-scoped writes no longer erase every permission held by the grantee, so
 * an unrelated `authorize` source must not lock the caller's own ordinary
 * source. The public accessor remains target-wide protected because changing it
 * publishes or unpublishes the object for everyone.
 */
export function isDelegateProtectedGrant(grant: ObjectGrant) {
  return grant.accessorId === PUBLIC_ACCESSOR_ID;
}

/**
 * A delegated writer can manage only source records it created. Older records
 * without a concrete creator are deliberately read-only for delegates: their
 * ownership cannot be reconstructed safely. Platform authorization admins may
 * manage every source through the administrator route.
 */
export function canManageGrantSource({
  currentUserId,
  isPlatformAuthzAdmin,
  source,
}: {
  currentUserId: string | null | undefined;
  isPlatformAuthzAdmin: boolean;
  source: GrantRecord;
}) {
  return isPlatformAuthzAdmin || (
    Boolean(currentUserId) &&
    source.createdBy === currentUserId &&
    source.policySource === "professional_rule" &&
    source.authoritySource === "owner_delegate" &&
    source.effect === "allow" &&
    source.operation !== "authorize"
  );
}

/**
 * Whether erasing this row would strip the caller's own `authorize` with nothing in the UI to put
 * it back: the row is theirs, it carries `authorize`, and they hold no `admin-authz:grant`.
 *
 * Restoring `authorize` is a grant. Without that point the only other route is the object-level
 * `authorize` itself — and that dies with the row — so the caller lands outside the object and
 * needs a second administrator to let them back in. bkn-safe would take the write; the guard is
 * about what the caller can undo, which is why it holds for an administrator too.
 *
 * It deliberately does not cover `authorize` reached through a department grant: the same trap,
 * but membership is not resolved on these surfaces.
 */
export function isSelfAuthorizeLockout({
  currentUserId,
  grant,
  isAdminGrantor,
}: {
  currentUserId: string | null;
  grant: ObjectGrant;
  isAdminGrantor: boolean;
}) {
  return (
    !isAdminGrantor &&
    currentUserId !== null &&
    grant.accessorId === currentUserId &&
    grant.operations.includes("authorize")
  );
}
