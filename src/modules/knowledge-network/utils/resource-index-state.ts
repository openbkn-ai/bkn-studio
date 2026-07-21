/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import { formatIndexStateLabel } from "@/modules/data-catalog/lib/format-index-state";
import { effectiveIndexOf, indexStateOf } from "@/modules/data-catalog/lib/index-state";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

/** Whether the resource currently has a serving index (built or active streaming). */
export function hasServingResourceIndex(tasks: BuildTask[]) {
  return effectiveIndexOf(tasks) !== null;
}

export function formatResourceIndexStateLabel(tasks: BuildTask[], t: TFunction) {
  return formatIndexStateLabel(indexStateOf(tasks), t);
}
