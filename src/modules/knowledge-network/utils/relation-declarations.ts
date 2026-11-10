/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  KnowledgeNetworkRelationTypeRecord,
  RelationCardinality,
  RelationCharacteristic,
  RelationDeclarations,
  RelationEnd,
  RelationVerification,
} from "@/modules/knowledge-network/types/knowledge-network";
import { areDeclarationValuesEqual } from "@/modules/knowledge-network/utils/property-declarations";

export const RELATION_CARDINALITIES: readonly RelationCardinality[] = [
  "one_to_one",
  "one_to_many",
  "many_to_one",
  "many_to_many",
];

/**
 * The locale key of each cardinality under `cardinalityOption`. The values themselves end in
 * `_one` or `_many`, which i18next reads as plural forms, so they cannot be keys.
 */
export const CARDINALITY_LABEL_KEYS: Readonly<Record<RelationCardinality, string>> = {
  many_to_many: "manyToMany",
  many_to_one: "manyToOne",
  one_to_many: "oneToMany",
  one_to_one: "oneToOne",
};

/** The short form of each cardinality, from source to target, as a badge shows it. */
export const CARDINALITY_NOTATION: Readonly<Record<RelationCardinality, string>> = {
  many_to_many: "N:N",
  many_to_one: "N:1",
  one_to_many: "1:N",
  one_to_one: "1:1",
};

/** The cardinalities a symmetric relation can declare: it reads the same from either end. */
export const SYMMETRIC_CARDINALITIES: readonly RelationCardinality[] = [
  "one_to_one",
  "many_to_many",
];

export const RELATION_ENDS: readonly RelationEnd[] = ["source", "target"];

export const RELATION_CHARACTERISTICS: readonly RelationCharacteristic[] = [
  "symmetric",
  "transitive",
];

export const RELATION_VERIFICATIONS: readonly RelationVerification[] = ["confirmed", "unconfirmed"];

export const isRelationCardinality = (value: unknown): value is RelationCardinality =>
  RELATION_CARDINALITIES.includes(value as RelationCardinality);

export const isRelationEnd = (value: unknown): value is RelationEnd =>
  RELATION_ENDS.includes(value as RelationEnd);

export const isRelationCharacteristic = (value: unknown): value is RelationCharacteristic =>
  RELATION_CHARACTERISTICS.includes(value as RelationCharacteristic);

export const isRelationVerification = (value: unknown): value is RelationVerification =>
  RELATION_VERIFICATIONS.includes(value as RelationVerification);

/** The values of `order` that `values` holds, once each and in that order. */
function ordered<T>(values: readonly T[] | undefined, order: readonly T[]): T[] | undefined {
  const kept = order.filter((item) => values?.includes(item));
  return kept.length ? kept : undefined;
}

/**
 * Drops what declares nothing: an empty text or list, an empty passthrough. Lists come back in a
 * fixed order, so two equal declarations compare equal.
 */
export function normalizeRelationDeclarations(
  value: RelationDeclarations | undefined,
): RelationDeclarations | undefined {
  if (!value) {
    return undefined;
  }
  const reverseName = value.reverseName?.trim();
  const fallbackFor = value.importance === "secondary" ? value.fallbackFor?.trim() : undefined;
  const next: RelationDeclarations = {
    ...(value.cardinality ? { cardinality: value.cardinality } : {}),
    ...(ordered(value.characteristics, RELATION_CHARACTERISTICS)
      ? { characteristics: ordered(value.characteristics, RELATION_CHARACTERISTICS) }
      : {}),
    ...(value.constraintsPassthrough && Object.keys(value.constraintsPassthrough).length
      ? { constraintsPassthrough: value.constraintsPassthrough }
      : {}),
    ...(fallbackFor ? { fallbackFor } : {}),
    ...(value.importance === "secondary" ? { importance: "secondary" as const } : {}),
    ...(ordered(value.requiredEnds, RELATION_ENDS)
      ? { requiredEnds: ordered(value.requiredEnds, RELATION_ENDS) }
      : {}),
    ...(reverseName ? { reverseName } : {}),
    ...(value.verification ? { verification: value.verification } : {}),
  };
  return Object.keys(next).length ? next : undefined;
}

export function areRelationDeclarationsEqual(
  left: RelationDeclarations | undefined,
  right: RelationDeclarations | undefined,
) {
  return areDeclarationValuesEqual(
    normalizeRelationDeclarations(left),
    normalizeRelationDeclarations(right),
  );
}

/** A declaration the form cleared because the ends or the characteristics no longer allow it. */
export type ClearedRelationDeclaration =
  "cardinality" | "characteristics" | "reverseName" | "requiredEnds";

export type RelationEnds = { sourceObjectTypeId: string; targetObjectTypeId: string };

/** Characteristics apply only to a relation from an object type to itself. */
export const hasSameEnds = ({ sourceObjectTypeId, targetObjectTypeId }: RelationEnds) =>
  Boolean(sourceObjectTypeId) && sourceObjectTypeId === targetObjectTypeId;

export const isSymmetric = (value: RelationDeclarations | undefined) =>
  Boolean(value?.characteristics?.includes("symmetric"));

/**
 * Applies the rules the ends and the characteristics set, and says what it cleared:
 *
 * - characteristics only on a relation from an object type to itself;
 * - a symmetric relation has no reverse name, is one_to_one or many_to_many, and requires both
 *   ends or neither.
 */
export function fitRelationDeclarations(
  value: RelationDeclarations | undefined,
  ends: RelationEnds,
): { cleared: ClearedRelationDeclaration[]; value: RelationDeclarations | undefined } {
  const cleared: ClearedRelationDeclaration[] = [];
  let next: RelationDeclarations = { ...value };

  if (next.characteristics?.length && !hasSameEnds(ends)) {
    next = { ...next, characteristics: undefined };
    cleared.push("characteristics");
  }

  if (isSymmetric(next)) {
    if (next.reverseName?.trim()) {
      next = { ...next, reverseName: undefined };
      cleared.push("reverseName");
    }
    if (next.cardinality && !SYMMETRIC_CARDINALITIES.includes(next.cardinality)) {
      next = { ...next, cardinality: undefined };
      cleared.push("cardinality");
    }
    if (next.requiredEnds?.length === 1) {
      next = { ...next, requiredEnds: undefined };
      cleared.push("requiredEnds");
    }
  }

  return { cleared, value: normalizeRelationDeclarations(next) };
}

/** How many counterparts each instance of an end has, as the sentence under the form says. */
export type RelationEndCount = "atLeastOne" | "atMostOne" | "exactlyOne" | "oneOrMore" | "several";

export type RelationSentencePart = { count: RelationEndCount; from: RelationEnd };

function endCount(many: boolean | undefined, required: boolean): RelationEndCount | undefined {
  if (many === undefined) {
    return required ? "atLeastOne" : undefined;
  }
  if (many) {
    return required ? "oneOrMore" : "several";
  }
  return required ? "exactlyOne" : "atMostOne";
}

/**
 * What the cardinality and the required ends say, from each end in turn: how many targets a
 * source has, then how many sources a target has. Empty when the relation declares neither.
 */
export function relationSentenceParts(
  value: RelationDeclarations | undefined,
): RelationSentencePart[] {
  const cardinality = value?.cardinality;
  const required = value?.requiredEnds ?? [];
  // many_to_one: many sources share a target, so each source has one target.
  const manyTargets = cardinality ? cardinality.endsWith("_to_many") : undefined;
  const manySources = cardinality ? cardinality.startsWith("many_") : undefined;
  const parts: Array<RelationSentencePart | undefined> = [
    ((count) => (count ? { count, from: "source" as const } : undefined))(
      endCount(manyTargets, required.includes("source")),
    ),
    ((count) => (count ? { count, from: "target" as const } : undefined))(
      endCount(manySources, required.includes("target")),
    ),
  ];
  return parts.filter((part): part is RelationSentencePart => Boolean(part));
}

/** The relation types whose fallback path is the one given. */
export function fallbackPathsFor(
  relationTypeId: string,
  relationTypes: KnowledgeNetworkRelationTypeRecord[],
) {
  return relationTypes.filter((item) => item.declarations?.fallbackFor === relationTypeId);
}
