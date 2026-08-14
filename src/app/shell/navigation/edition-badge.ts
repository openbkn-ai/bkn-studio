/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * A nav item's static tier label is useful only when the frontend cannot
 * determine whether its capability is currently available. When the item has
 * a capability key, EditionBadge can use the entitlement snapshot instead.
 */
export function shouldAlwaysShowEditionBadge(item: { paidCapability?: string }) {
  return !item.paidCapability || !capabilityReportedByEndpoint(item.paidCapability);
}
import { capabilityReportedByEndpoint } from "@/modules/subscription/capability-catalog";
