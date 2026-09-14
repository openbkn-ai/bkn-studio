/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

/** Whether the current account holds one effective operation on this Resource instance. */
export function hasResourceOperation(
  resource: Pick<CatalogResource, "operations"> | null | undefined,
  operation: string,
) {
  if (!resource) {
    return false;
  }
  return resource.operations?.includes("*") || resource.operations?.includes(operation) || false;
}
