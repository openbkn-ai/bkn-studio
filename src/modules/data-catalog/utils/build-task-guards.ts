/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import type { BuildTask, BuildTaskExecuteType } from "@/modules/data-catalog/types/data-catalog";

export const ACTIVE_BUILD_TASK_STATUSES = new Set<BuildTask["status"]>([
  "pending",
  "running",
  "stopping",
]);

export const BUILD_TASK_EXECUTE_TYPE_LABELS = {
  full: "dataCatalog.build.executeFull",
  incremental: "dataCatalog.build.executeIncremental",
  keys: "dataCatalog.build.executeKeys",
} as const satisfies Record<BuildTaskExecuteType, string>;

export function isBuildTaskExecuteType(value: string | null): value is BuildTaskExecuteType {
  return value !== null && Object.hasOwn(BUILD_TASK_EXECUTE_TYPE_LABELS, value);
}

export function buildTaskExecuteTypeLabelKey(task: Pick<BuildTask, "mode" | "executeType">) {
  const { executeType, mode } = task;
  if (mode !== "batch" || !executeType || !isBuildTaskExecuteType(executeType)) return undefined;
  return BUILD_TASK_EXECUTE_TYPE_LABELS[executeType];
}

export function isActiveBuildTask(task: BuildTask | null | undefined): boolean {
  return Boolean(task && ACTIVE_BUILD_TASK_STATUSES.has(task.status));
}

export function extractRequestStatus(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) {
    return error.response?.status;
  }
  return undefined;
}

/** start rejection caused by configuration drift, an existing newer successful task, and similar conditions (commonly 400/409/422). */
export function isBuildStartRejected(error: unknown): boolean {
  const status = extractRequestStatus(error);
  return status === 400 || status === 409 || status === 422;
}
