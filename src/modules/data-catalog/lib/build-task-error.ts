/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type BuildTaskErrorSummary = {
  message: string;
  raw: string;
  suggestion?: string;
  title: string;
};

function isZh(language?: string) {
  return (language ?? "").toLowerCase().startsWith("zh");
}

export function summarizeBuildTaskError(
  rawError: string | null | undefined,
  language?: string,
): BuildTaskErrorSummary | null {
  const raw = rawError?.trim();
  if (!raw) {
    return null;
  }

  const zh = isZh(language);
  const dataTooLong = raw.match(/Data too long for column '([^']+)'/i);
  if (dataTooLong) {
    const column = dataTooLong[1];
    const isSyncedMark = column === "f_synced_mark";
    return {
      title: zh ? "任务进度标记写入失败" : "Build checkpoint write failed",
      message: zh
        ? isSyncedMark
          ? "同步游标内容超过任务表可保存长度，导致后端更新任务状态失败。"
          : `字段 ${column} 的内容超过数据库可保存长度，导致任务状态更新失败。`
        : isSyncedMark
          ? "The sync checkpoint is longer than the task table column can store, so the backend could not update the task status."
          : `Column ${column} received a value longer than the database column allows, so the task status update failed.`,
      raw,
      suggestion: zh
        ? isSyncedMark
          ? "建议将任务表的 f_synced_mark 字段扩容，或缩短连接器返回的同步游标后重新构建。"
          : "建议检查对应字段长度配置，扩容后重新构建。"
        : isSyncedMark
          ? "Increase the task table f_synced_mark column length, or shorten the connector checkpoint before rebuilding."
          : "Check and increase the column length, then rebuild.",
    };
  }

  const duplicateEntry = raw.match(/Duplicate entry '([^']+)'/i);
  if (duplicateEntry) {
    return {
      title: zh ? "任务状态写入冲突" : "Task state write conflict",
      message: zh
        ? "后端写入任务状态时遇到唯一键冲突。"
        : "The backend hit a unique-key conflict while writing task state.",
      raw,
      suggestion: zh
        ? "请刷新任务列表确认是否已有同名或同批次任务，必要时删除异常任务后重试。"
        : "Refresh the task list and remove the conflicting task before retrying if needed.",
    };
  }

  if (/id is missing/i.test(raw)) {
    return {
      title: zh ? "索引文档缺少 ID" : "Index documents are missing IDs",
      message: zh
        ? "写入索引失败：部分文档没有生成稳定的 id 字段。"
        : "Index write failed because some documents did not include a stable id field.",
      raw,
      suggestion: zh
        ? "请检查资源索引配置中的增量键或主键映射，保存配置后重新构建。"
        : "Check the resource build key or primary-key mapping, save the index configuration, then rebuild.",
    };
  }

  return {
    title: zh ? "构建任务执行失败" : "Build task failed",
    message: zh
      ? "后端返回了未分类错误，请查看原始错误定位具体原因。"
      : "The backend returned an uncategorized error. See the raw error for details.",
    raw,
  };
}
