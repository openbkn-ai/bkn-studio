/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

const MODEL_TYPE_KEYS = ["llm", "rlm", "vu"] as const;

export function getLlmModelTypeLabel(modelType: string | undefined, t: TFunction) {
  if (!modelType) {
    return "--";
  }

  const normalized = modelType.toLowerCase();

  if ((MODEL_TYPE_KEYS as readonly string[]).includes(normalized)) {
    return t(`modelResources.models.types.${normalized}`);
  }

  return modelType;
}
