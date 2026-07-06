/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";

export { runningIdsFromError } from "@/framework/safety/delete-guard";

// 删除资源/连接前算「炸毁半径」:该对象下已构建多少索引,有哪些任务在跑。
export type BlastRadius = {
  indexCount: number;
  runningIds: string[];
};

const ACTIVE_STATUSES = new Set(["running", "listening", "pending", "stopping"]);

function summarize(tasks: { id: string; status: string }[]): BlastRadius {
  return {
    indexCount: tasks.length,
    runningIds: tasks.filter((task) => ACTIVE_STATUSES.has(task.status)).map((task) => task.id),
  };
}

export async function catalogBlastRadius(catalogId: string): Promise<BlastRadius> {
  return summarize(await listBuildTasks({ catalogId }));
}

export async function resourceBlastRadius(resourceId: string): Promise<BlastRadius> {
  return summarize(await listBuildTasks({ resourceId }));
}
