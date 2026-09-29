/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { formatAuditUserDisplay } from "@/framework/audit/audit-user-display";

type UpdatedAuditUserInput = {
  createUser?: string;
  createUserName?: string;
  updateUser?: string;
  updateUserName?: string;
};

/** Keep the selected actor ID and its optional name snapshot as one atomic pair. */
export function formatUpdatedAuditUserDisplay(input: UpdatedAuditUserInput) {
  if (input.updateUser?.trim()) {
    return formatAuditUserDisplay({ id: input.updateUser, name: input.updateUserName });
  }

  return formatAuditUserDisplay({ id: input.createUser, name: input.createUserName });
}
