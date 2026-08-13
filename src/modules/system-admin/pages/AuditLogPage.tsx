/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ObservabilityLogsScene } from "@/modules/bkn-trace/scenes/ObservabilityLogsScene";

export function AuditLogPage() {
  return <ObservabilityLogsScene mode="audit" />;
}
