/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { Concept, ConceptVerdict } from "@/modules/bkn-project/types/concepts";

/** Whether the verdict makes the concept's item part of the concept model. */
export function modelVerdict(verdict: ConceptVerdict) {
  return ["object", "event", "relation", "values"].includes(verdict);
}

/**
 * The concepts whose item is in the concept model now, as the modeling page counts it: adopted,
 * by drafting or by a person, whether anyone confirmed it yet or not.
 */
export function conceptsInModel(concepts: readonly Concept[]) {
  const inModel = concepts.filter((c) => c.item?.adopted && modelVerdict(c.verdict));
  return {
    count: inModel.length,
    unconfirmed: inModel.filter((c) => c.state === "pending").length,
  };
}
