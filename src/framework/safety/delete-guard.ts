/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

// 后端拒删运行中对象 → 409 HasRunningExecution,body 带 running_ids。
// 返回 null = 非该错误;返回数组 = 命中(数组可能为空)。
export function runningIdsFromError(error: unknown): string[] | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) {
    return null;
  }
  const data = error.response?.data as { running_ids?: string[] } | undefined;
  return data?.running_ids ?? [];
}
