/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  GrantAuthoritySource,
  GrantRecord,
  ObjectGrant,
} from "@/modules/system-admin/types/authz";

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
  if (!createdBy || createdBy === source.authoritySource || createdBy.startsWith("system:")) {
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
  if (grant.accessorType) return grant.accessorType === "role";
  return (grant.grants ?? []).some(
    (source) => source.policySource === "role_permission" && !source.inherited,
  );
}

export type ObjectGrantSubjectType = "user" | "role";

/** Match one grouped grant without confusing equal user and role identifiers. */
export function objectGrantMatchesSubject(
  grant: ObjectGrant,
  accessorId: string | undefined,
  subjectType: ObjectGrantSubjectType,
) {
  if (!accessorId || grant.accessorId !== accessorId) return false;
  if (subjectType === "role") return isRoleGrantSubject(grant);
  return (
    !isRoleGrantSubject(grant) &&
    grant.accessorType !== "public" &&
    grant.accessorId !== PUBLIC_ACCESSOR_ID
  );
}

/**
 * Sources replaced by one fine-grained object-grant write. Effective or inherited permissions and
 * independently authored source slices must never be copied into this editable draft.
 */
export function managedObjectGrantSources({
  authoritySource,
  createdBy,
  grant,
}: {
  authoritySource: GrantAuthoritySource;
  createdBy: string | null | undefined;
  grant: ObjectGrant | undefined;
}) {
  if (!createdBy) return [];
  return (grant?.grants ?? []).filter(
    (source) =>
      source.active &&
      !source.inherited &&
      source.effect === "allow" &&
      source.policySource === "professional_rule" &&
      source.authoritySource === authoritySource &&
      source.createdBy === createdBy,
  );
}

export function managedObjectGrantOperations(input: {
  authoritySource: GrantAuthoritySource;
  createdBy: string | null | undefined;
  grant: ObjectGrant | undefined;
}) {
  return [...new Set(managedObjectGrantSources(input).map((source) => source.operation))];
}

/** Only real users may be resolved through the user-directory API. */
export function isUserDirectorySubject(grant: ObjectGrant) {
  return (
    grant.accessorType !== "public" &&
    grant.accessorId !== PUBLIC_ACCESSOR_ID &&
    !isRoleGrantSubject(grant)
  );
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
 * A delegated writer can manage only source records it created, including an
 * ordinary authorization it approved through the permission-request workflow.
 * Older records without a concrete creator are deliberately read-only for
 * delegates: their ownership cannot be reconstructed safely. Platform
 * authorization admins may manage every source through the administrator route.
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
  return (
    isPlatformAuthzAdmin ||
    (Boolean(currentUserId) &&
      source.createdBy === currentUserId &&
      ((source.authoritySource === "owner_delegate" &&
        source.policySource === "professional_rule") ||
        (source.authoritySource === "permission_request" &&
          (source.policySource === "professional_rule" ||
            source.policySource === "community_bundle"))) &&
      source.effect === "allow" &&
      source.operation !== "authorize")
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
