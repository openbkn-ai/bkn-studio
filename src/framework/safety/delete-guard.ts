/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

// The backend rejects deletion of running objects with 409 HasRunningExecution and running_ids in the body.
// Return null for a different error; return an array for a match, including an empty array.
export function runningIdsFromError(error: unknown): string[] | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) {
    return null;
  }
  const data = error.response?.data as { running_ids?: string[] } | undefined;
  return data?.running_ids ?? [];
}
