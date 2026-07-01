/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExecutionUnitTabRedirect } from "@/modules/execution-factory/pages/ExecutionUnitTabRedirect";

/** @deprecated Use `ExecutionUnitListScene` via `/execution-factory/units?activeTab=skill` instead. */
export function SkillListPage() {
  return (
    <ExecutionUnitTabRedirect activeTab="skill" migrationFrom="legacy-skill-list" />
  );
}
