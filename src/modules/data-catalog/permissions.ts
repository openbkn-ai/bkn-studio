/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Permissions that allow the caller to read resource index/build state. */
export const dataCatalogResourceStatusPermissions = [
  "resource:view_detail",
  "catalog:task_manage",
] as const;
