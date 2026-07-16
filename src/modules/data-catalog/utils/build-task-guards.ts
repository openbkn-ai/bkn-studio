/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

export const ACTIVE_BUILD_TASK_STATUSES = new Set<BuildTask["status"]>([
  "pending",
  "running",
  "listening",
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

/** start 被拒：配置漂移 / 已有更新成功任务等（常见 400/409/422）。 */
export function isBuildStartRejected(error: unknown): boolean {
  const status = extractRequestStatus(error);
  return status === 400 || status === 409 || status === 422;
}
