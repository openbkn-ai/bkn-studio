import axios from "axios";

import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";

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

// 后端拒删运行中对象 → 409 HasRunningExecution,body 带 running_ids。
// 返回 null = 非该错误;返回数组 = 命中(数组可能为空)。
export function runningIdsFromError(error: unknown): string[] | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) {
    return null;
  }
  const data = error.response?.data as { running_ids?: string[] } | undefined;
  return data?.running_ids ?? [];
}
