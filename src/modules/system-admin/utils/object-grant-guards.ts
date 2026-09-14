/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectGrant } from "@/modules/system-admin/types/authz";

/** The subject bkn-safe writes when the execution factory publishes something to everyone. */
export const PUBLIC_ACCESSOR_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Whether bkn-safe will refuse a non-administrator write against this row (its
 * protectAuthorizeHolder guard), so a surface can lock it rather than offer a control that
 * always 403s.
 *
 * Two rows are off limits to a delegate, and both because the write erases: POST is
 * replace-semantics and DELETE removes everything the accessor holds.
 *
 * - A row carrying `authorize` — the object's creator, or anyone an administrator trusted with
 *   sharing. Letting a delegate rewrite it would let them take the object away from the person who
 *   made it, and `authorize` is administrator-conferred, so nobody outside the admin points could
 *   put it back. This covers the caller's OWN row.
 * - The public-access row, whose removal would un-publish the object platform-wide.
 */
export function isDelegateProtectedGrant(grant: ObjectGrant) {
  return grant.accessorId === PUBLIC_ACCESSOR_ID || grant.operations.includes("authorize");
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
