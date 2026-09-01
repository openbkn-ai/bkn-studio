/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

export type ModelConfigConflict = {
  existingModel: { id: string; name: string; type: string };
  canSetDefault: boolean;
};

/** Reads the safe duplicate-model identity returned by the create APIs. */
export function getModelConfigConflict(error: unknown): ModelConfigConflict | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) {
    return null;
  }

  const data = error.response.data as {
    error_code?: unknown;
    details?: { existing_model?: { id?: unknown; name?: unknown; type?: unknown }; can_set_default?: unknown };
  } | undefined;
  const model = data?.details?.existing_model;
  if (data?.error_code !== "RESOURCE_EXISTED" || !model || typeof model.id !== "string" ||
      typeof model.name !== "string" || typeof model.type !== "string") {
    return null;
  }

  return {
    existingModel: { id: model.id, name: model.name, type: model.type },
    canSetDefault: data.details?.can_set_default === true,
  };
}
