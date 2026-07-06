/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type { IndexState } from "@/modules/data-catalog/types/data-catalog";

export function formatIndexStateLabel(state: IndexState, t: TFunction) {
  if (state.key === "failed-stale") {
    return `${t("dataCatalog.indexState.rebuildFailed")} / ${t("dataCatalog.indexState.staleServing")}`;
  }

  let label = t(`dataCatalog.indexState.${state.key}`);

  if (
    (state.key === "building" || state.key === "rebuilding") &&
    state.latest &&
    state.latest.totalCount > 0
  ) {
    const percent = Math.min(
      100,
      Math.round((state.latest.vectorizedCount / state.latest.totalCount) * 100),
    );
    label = `${label} ${percent}%`;
  }

  return label;
}
