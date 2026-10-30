/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { DraftedItem } from "@/modules/bkn-project/components/requirements/RequirementDialogs";
import type { QuestionInput, RequirementSpec } from "@/modules/bkn-project/types/requirements";

/** The object type of the draft a concept maps to; none for an unmapped concept or relation. */
export function objectTypeOf(spec: RequirementSpec, drafted: DraftedItem[], conceptId: string) {
  const mapsTo = spec.concepts.find((concept) => concept.id === conceptId)?.mapsTo;
  return mapsTo?.kind === "object_type"
    ? drafted.find((item) => item.kind === "object_type" && item.id === mapsTo.id)
    : undefined;
}

/**
 * An input as people read it: the concept's term and the property's name in the draft. A
 * property its object type no longer has keeps its own name and says so; without the object
 * type (the draft not read, or the concept not mapped) nothing is said about the property.
 */
export function describeInput(spec: RequirementSpec, drafted: DraftedItem[], input: QuestionInput) {
  const concept = spec.concepts.find((item) => item.id === input.conceptId);
  const objectType = objectTypeOf(spec, drafted, input.conceptId);
  const property = objectType?.properties.find((entry) => entry.name === input.property);
  return {
    concept: concept?.term ?? input.conceptId,
    known: !objectType || !input.property || Boolean(property),
    property: property ? property.displayName || property.name : input.property,
  };
}
