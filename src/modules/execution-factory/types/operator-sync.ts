/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { OperatorCategory, OperatorExecuteControl } from "@/modules/execution-factory/types/operator";

export type OperatorSyncPublishInput = {
  enabled?: boolean;
  name?: string;
  category?: OperatorCategory;
  executeControl?: OperatorExecuteControl;
  directPublish?: boolean;
};
