/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";
import type {
  BuildTask,
  IndexState,
  ResourceGate,
} from "@/modules/data-catalog/types/data-catalog";

/** 资源的全部任务,按创建时间倒序 */
export function sortTasks(tasks: BuildTask[]) {
  return [...tasks].sort((left, right) => right.createdAt - left.createdAt);
}

/**
 * 当前生效索引:最近一次成功构建,或仍在服务的 streaming 任务
 * (监听中 / 已暂停且已同步过数据)。检索由该版本提供。
 */
export function effectiveIndexOf(tasks: BuildTask[]): BuildTask | null {
  return (
    sortTasks(tasks).find(
      (task) =>
        task.status === "succeeded" ||
        (task.mode === "streaming" &&
          (task.status === "listening" || task.status === "paused") &&
          task.syncedCount > 0),
    ) ?? null
  );
}

/**
 * 索引状态 = 生效索引 × 最近任务 的组合:
 * 最近任务失败但旧索引仍生效时为 failed-stale(重建失败 · 沿用旧索引)。
 */
export function indexStateOf(tasks: BuildTask[]): IndexState {
  const sorted = sortTasks(tasks);
  const latest = sorted[0] ?? null;
  const effective = effectiveIndexOf(sorted);

  if (!latest) {
    return { key: "none", latest: null, effective: null };
  }

  if (latest.status === "running" || latest.status === "pending") {
    return {
      key: effective && effective.id !== latest.id ? "rebuilding" : "building",
      latest,
      effective,
    };
  }

  if (latest.status === "listening") {
    return { key: "listening", latest, effective };
  }

  if (latest.status === "paused") {
    return { key: "paused", latest, effective };
  }

  if (latest.status === "succeeded") {
    return { key: "built", latest, effective };
  }

  return { key: effective ? "failed-stale" : "failed", latest, effective };
}

/**
 * 停用闸门:physical 连接停用后,其下资源禁止预览 / 构建。
 * logical catalog 是平台内部命名空间,不受启停控制。
 */
export function resourceGateOf(catalog: DataConnectRecord | null): ResourceGate {
  if (!catalog) {
    return { ok: false };
  }

  if (catalog.type === "logical" || catalog.enabled) {
    return { ok: true, catalogName: catalog.name };
  }

  return { ok: false, catalogName: catalog.name };
}

export function isCatalogPhysical(catalog: DataConnectRecord) {
  return catalog.type !== "logical";
}
