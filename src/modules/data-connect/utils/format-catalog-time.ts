/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { formatDateTime } from "@/framework/i18n/format";
import { normalizeSupportedLocale } from "@/framework/i18n/locale";
import type { CatalogTimestamp } from "@/shared/catalog/types";

export function formatCatalogTime(value: CatalogTimestamp, locale?: string) {
  return formatDateTime(value, {
    locale: normalizeSupportedLocale(locale) ?? undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
