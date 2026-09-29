/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { capabilitySatisfied } from "@/framework/entitlement/upgrade-reason";
import type { EntitlementView } from "@/framework/entitlement/types";

export function canManageDerivedViews(snapshot: EntitlementView | null): boolean {
  return capabilitySatisfied("logic_view", snapshot, "professional", false);
}
