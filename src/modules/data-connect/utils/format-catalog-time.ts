/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { formatDateTimeYmdHms } from "@/framework/i18n/format";
import type { CatalogTimestamp } from "@/shared/catalog/types";

export function formatCatalogTime(value: CatalogTimestamp) {
  return formatDateTimeYmdHms(value === 0 ? null : value);
}
