/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";

export type CatalogBlastRadius = {
  indexCount: number;
  runningIds: string[];
};

const ACTIVE_STATUSES = new Set(["running", "listening", "pending", "stopping"]);

function summarize(tasks: { id: string; status: string }[]): CatalogBlastRadius {
  return {
    indexCount: tasks.length,
    runningIds: tasks.filter((task) => ACTIVE_STATUSES.has(task.status)).map((task) => task.id),
  };
}

export async function catalogBlastRadius(catalogId: string): Promise<CatalogBlastRadius> {
  return summarize(await listBuildTasks({ catalogId }));
}

export async function resourceBlastRadius(resourceId: string): Promise<CatalogBlastRadius> {
  return summarize(await listBuildTasks({ resourceId }));
}
