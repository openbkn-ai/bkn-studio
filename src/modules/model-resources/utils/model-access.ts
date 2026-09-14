/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export function getModelViewAccess(permissions: string[]) {
  return {
    canViewLargeModel: permissions.includes("model-resources:large-model:view"),
    canViewSmallModel: permissions.includes("model-resources:small-model:view"),
  };
}
