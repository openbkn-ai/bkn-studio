/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type { ResourceLocalIndexStatus } from "@/modules/data-catalog/types/data-catalog";

/** Resource local_index_status is the authoritative query-availability signal. */
export function hasServingResourceIndex(status: ResourceLocalIndexStatus | undefined) {
  return status === "available";
}

export function formatResourceIndexStateLabel(
  status: ResourceLocalIndexStatus | undefined,
  t: TFunction,
) {
  return status === "available"
    ? t("dataCatalog.indexState.built")
    : t("dataCatalog.indexState.none");
}
