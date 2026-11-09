/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { readErrorCode, readErrorDetails } from "@/framework/request/error-message";
import type { DeclarationDefinitionKind } from "@/modules/knowledge-network/types/knowledge-network";

/** A definition a refusal names. */
export type NamedDefinition = { id: string; kind: DeclarationDefinitionKind };

const KIND_BY_LABEL: Record<string, DeclarationDefinitionKind> = {
  "action type": "action_type",
  "object type": "object_type",
  "relation type": "relation_type",
};

// Until openbkn-ai/bkn-foundry#2991 gives structured details, the backend names definitions in
// English: `object type "a"`, and the one it points at, `replaced_by "b"` of the same kind, or
// `fallback_for "c"`, a relation type.
const NAMED_IN_DETAILS =
  /(object type|relation type|action type) "([^"]+)"|(replaced_by|fallback_for) "([^"]+)"/g;

/**
 * The definitions a refusal's details name, once each and in the order they appear, other than the
 * one being saved.
 */
export function definitionsInDetails(
  details: string | undefined,
  saved?: NamedDefinition,
): NamedDefinition[] {
  const named: NamedDefinition[] = [];
  let lastKind: DeclarationDefinitionKind | undefined;
  for (const match of (details ?? "").matchAll(NAMED_IN_DETAILS)) {
    const [, label, labelled, pointer, pointed] = match;
    let item: NamedDefinition | undefined;
    if (label && labelled) {
      lastKind = KIND_BY_LABEL[label];
      item = lastKind ? { id: labelled, kind: lastKind } : undefined;
    } else if (pointer === "fallback_for" && pointed) {
      item = { id: pointed, kind: "relation_type" };
    } else if (pointed && lastKind) {
      item = { id: pointed, kind: lastKind };
    }
    if (
      item &&
      !(saved && item.kind === saved.kind && item.id === saved.id) &&
      !named.some((other) => other.kind === item.kind && other.id === item.id)
    ) {
      named.push(item);
    }
  }
  return named;
}

// What a refusal of the definition itself says, as opposed to one of its properties.
const DEFINITION_LEVEL_DETAILS = /\b(?:alias|lifecycle|replaced_by|deprecated)\b/;

/**
 * Whether a declaration refusal concerns the aliases or lifecycle of the definition saved, rather
 * than one of its properties, so the form shows it in the basic info.
 */
export function isDefinitionLevelRefusal(refusal: { details?: string; property?: string }) {
  return !refusal.property && DEFINITION_LEVEL_DETAILS.test(refusal.details ?? "");
}

// What a refusal of a relation's own declarations names; the relation form edits them on its
// mapping step, apart from the aliases and lifecycle.
const RELATION_DECLARATION_DETAILS =
  /\b(?:cardinality|characteristics|fallback_for|importance|required|reverse_name|verification)\b/;

/**
 * Whether a refusal of a relation type save concerns only its aliases or lifecycle, which the
 * relation form holds in its basic info.
 */
export function isRelationBasicInfoRefusal(refusal: { details?: string; property?: string }) {
  return (
    isDefinitionLevelRefusal(refusal) && !RELATION_DECLARATION_DETAILS.test(refusal.details ?? "")
  );
}

const STILL_REFERENCED_CODE = /^BknBackend\.(ActionType|ObjectType|RelationType)\.StillReferenced$/;

/** A delete refused because other definitions still point at the one deleted. */
export class DefinitionStillReferencedError extends Error {
  constructor(
    message: string,
    readonly definition: NamedDefinition,
    /** The backend's sentences, one per reference, such as `... is the lifecycle replaced_by of ...`. */
    readonly references: string[],
  ) {
    super(message);
    this.name = "DefinitionStillReferencedError";
  }
}

function errorDescription(error: unknown, fallback: string) {
  const description = (error as { response?: { data?: { description?: unknown } } } | null)
    ?.response?.data?.description;
  return (typeof description === "string" && description.trim()) || fallback;
}

/**
 * Throws a `DefinitionStillReferencedError` for the backend's 409 on deleting a definition that
 * another one still names in `replaced_by` or `fallback_for`; does nothing for any other error.
 */
export function throwIfStillReferenced(error: unknown, definition: NamedDefinition) {
  const code = readErrorCode(error);
  if (!code || !STILL_REFERENCED_CODE.test(code)) {
    return;
  }
  const details = readErrorDetails(error) as { references?: unknown } | undefined;
  const references = Array.isArray(details?.references)
    ? details.references.filter((item): item is string => typeof item === "string" && item !== "")
    : [];
  throw new DefinitionStillReferencedError(errorDescription(error, code), definition, references);
}
