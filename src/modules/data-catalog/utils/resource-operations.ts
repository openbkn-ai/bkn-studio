/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

export function hasCatalogResourceOperation(
  resource: Pick<CatalogResource, "operations"> | null | undefined,
  operation: string,
) {
  const operations = resource?.operations ?? [];
  return operations.includes("*") || operations.includes(operation);
}
