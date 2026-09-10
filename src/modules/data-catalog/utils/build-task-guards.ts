/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import { extractRequestErrorDetails } from "@/framework/request/error-message";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

export const ACTIVE_BUILD_TASK_STATUSES = new Set<BuildTask["status"]>([
  "pending",
  "running",
  "listening",
  "stopping",
]);

export function isActiveBuildTask(task: BuildTask | null | undefined): boolean {
  return Boolean(task && ACTIVE_BUILD_TASK_STATUSES.has(task.status));
}

export function extractRequestStatus(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) {
    return error.response?.status;
  }
  return undefined;
}

export type IndexConfigSaveConflictKey =
  | "dataCatalog.build.configConflict"
  | "dataCatalog.build.configRefreshInProgress"
  | "dataCatalog.build.configStale";

const INDEX_CONFIG_SAVE_CONFLICT_KEYS: Record<string, IndexConfigSaveConflictKey> = {
  "VegaBackend.BuildTask.Exist": "dataCatalog.build.configConflict",
  "VegaBackend.BuildTask.HasRunningExecution": "dataCatalog.build.configConflict",
  "VegaBackend.DiscoverTask.ResourceRefreshInProgress": "dataCatalog.build.configRefreshInProgress",
  "VegaBackend.Resource.UpdateConflict": "dataCatalog.build.configStale",
};

/**
 * Locale key for a resource-update rejection the UI can explain better than the raw backend text.
 * Vega answers 409 for several unrelated reasons (active build task, metadata refresh in flight,
 * stale expected_update_time, enabled-state mismatch, ...), so the decision is keyed on error_code,
 * never on the status alone. Unknown codes return undefined so the caller shows the backend message.
 */
export function indexConfigSaveConflictKey(error: unknown): IndexConfigSaveConflictKey | undefined {
  const code = extractRequestErrorDetails(error).code;
  return code ? INDEX_CONFIG_SAVE_CONFLICT_KEYS[code] : undefined;
}

/** start rejection caused by configuration drift, an existing newer successful task, and similar conditions (commonly 400/409/422). */
export function isBuildStartRejected(error: unknown): boolean {
  const status = extractRequestStatus(error);
  return status === 400 || status === 409 || status === 422;
}
