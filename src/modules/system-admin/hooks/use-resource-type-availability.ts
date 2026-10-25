/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback } from "react";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { useCapability } from "@/framework/entitlement/use-entitlement";

/**
 * Resource types owned by a separately delivered product. bkn-safe's registry lists them on every
 * edition, but their instances exist only where the product is installed and licensed: without
 * it bkn-safe cannot list them, so the type is not offered at all.
 */
const KNOWLEDGE_BASE = "knowledge_base";

/** Whether a resource type may be offered in authorization editors right now. */
export function useResourceTypeAvailability(): (type: string) => boolean {
  const knowledgeBase = useCapability(CAPABILITIES.KNOWLEDGE_BASE) === "available";
  return useCallback((type: string) => type !== KNOWLEDGE_BASE || knowledgeBase, [knowledgeBase]);
}
