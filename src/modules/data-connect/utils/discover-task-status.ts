/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  DataConnectDiscoverResult,
  DataConnectDiscoverTaskStatus,
} from "@/modules/data-connect/types/discover";

export function isPartiallyCompletedDiscoverTask(
  status: DataConnectDiscoverTaskStatus,
  result?: Pick<DataConnectDiscoverResult, "failedCount" | "skippedCount">,
): boolean {
  return (
    status === "completed" && ((result?.failedCount ?? 0) > 0 || (result?.skippedCount ?? 0) > 0)
  );
}
