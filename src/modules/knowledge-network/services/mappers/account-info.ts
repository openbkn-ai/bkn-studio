/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { BackendAccountInfo } from "@/modules/knowledge-network/services/mappers/backend-types";

export function resolveAccountDisplayName(
  account?: BackendAccountInfo | string | null,
  fallback = "--",
): string {
  if (account == null) {
    return fallback;
  }

  if (typeof account === "string") {
    const trimmed = account.trim();
    return trimmed || fallback;
  }

  const name = account.name?.trim();
  if (name) {
    return name;
  }

  const id = account.id?.trim();
  if (id) {
    return id;
  }

  return fallback;
}
