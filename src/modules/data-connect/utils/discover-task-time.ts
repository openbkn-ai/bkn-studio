/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { formatDateTimeYmdHms } from "@/framework/i18n/format";

export function formatDiscoverTaskTime(value?: number) {
  return formatDateTimeYmdHms(value || undefined);
}
