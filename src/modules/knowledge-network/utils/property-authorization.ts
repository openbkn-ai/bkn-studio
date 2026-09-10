/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectTypeDataProperty,
  PropertyAccessDecision,
  PropertyAccessLevel,
  PropertyAccessSelection,
  PropertyGrantEntry,
} from "@/modules/knowledge-network/types/knowledge-network";
import { isMaskRuleValid, maskRuleKindsForPropertyType } from "@/modules/knowledge-network/utils/mask-rule";

const LEVEL_ORDER: Record<PropertyAccessLevel, number> = {
  none: 0,
  schema: 1,
  masked: 2,
  full: 3,
};

export function basePropertyAccessLevel(operations: readonly string[]): PropertyAccessLevel {
  if (operations.includes("query_data")) {
    return "full";
  }
  if (operations.includes("view_detail")) {
    return "schema";
  }
  return "none";
}

export function clampPropertyAccessLevel(
  base: PropertyAccessLevel,
  explicit: PropertyAccessSelection,
): PropertyAccessLevel {
  const property = explicit === "inherit" ? "full" : explicit;
  return LEVEL_ORDER[base] <= LEVEL_ORDER[property] ? base : property;
}

export function applyPropertySelectionBatch(
  propertyNames: readonly string[],
  selectedProperties: readonly (number | string)[],
  next: PropertyAccessSelection,
  entries: ReadonlyMap<string, PropertyGrantEntry>,
  currentDraft: ReadonlyMap<string, PropertyAccessSelection>,
) {
  const selectedNames = new Set(selectedProperties.map(String));
  const result = new Map(currentDraft);
  for (const name of propertyNames) {
    if (!selectedNames.has(name)) {
      continue;
    }
    const original = entries.get(name)?.level ?? "inherit";
    if (next === original) {
      result.delete(name);
    } else {
      result.set(name, next);
    }
  }
  return result;
}

export function propertyMaskState(
  property: ObjectTypeDataProperty,
): "configured" | "missing" | "invalid" | "unsupported" {
  const kinds = maskRuleKindsForPropertyType(property.type);
  if (!kinds.length) {
    return "unsupported";
  }
  if (!property.maskRule) {
    return "missing";
  }
  return isMaskRuleValid(property.type, property.maskRule) ? "configured" : "invalid";
}

export function propertyAccessRowState(
  property: ObjectTypeDataProperty,
  baseLevel: PropertyAccessLevel,
  entries: ReadonlyMap<string, PropertyGrantEntry>,
  decisions: ReadonlyMap<string, PropertyAccessDecision>,
  draft: ReadonlyMap<string, PropertyAccessSelection>,
) {
  const entry = entries.get(property.name);
  const draftLevel = draft.get(property.name);
  const explicit = draftLevel ?? entry?.level ?? "inherit";
  const decision = draftLevel === undefined ? decisions.get(property.name) : undefined;
  const maskState = propertyMaskState(property);
  let effective = decision?.level ?? clampPropertyAccessLevel(baseLevel, explicit);
  if (explicit === "masked" && maskState !== "configured") {
    effective = LEVEL_ORDER[effective] > LEVEL_ORDER.schema ? "schema" : effective;
  }
  return {
    effective,
    explicit,
    maskState,
    source: decision?.source ?? (explicit === "inherit" ? "object_type" : "property"),
  } as const;
}

export function summarizePropertyGrantChanges(
  baseLevel: PropertyAccessLevel,
  entries: ReadonlyMap<string, PropertyGrantEntry>,
  draft: ReadonlyMap<string, PropertyAccessSelection>,
) {
  let raised = 0;
  let lowered = 0;
  let inherited = 0;
  let full = 0;
  for (const [name, next] of draft) {
    const before = clampPropertyAccessLevel(baseLevel, entries.get(name)?.level ?? "inherit");
    if (next === "inherit") {
      inherited += 1;
    } else {
      const after = clampPropertyAccessLevel(baseLevel, next);
      if (LEVEL_ORDER[after] > LEVEL_ORDER[before]) {
        raised += 1;
      } else if (LEVEL_ORDER[after] < LEVEL_ORDER[before]) {
        lowered += 1;
      }
      if (after === "full") {
        full += 1;
      }
    }
  }
  return { full, inherited, lowered, raised, total: draft.size };
}
