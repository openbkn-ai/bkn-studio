/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ClearedDeclaration,
  DeclarationDefinitionKind,
} from "@/modules/knowledge-network/types/knowledge-network";

const PREFIX = "knowledgeNetwork.declarations";

const DECLARATION_FIELDS = new Set([
  "aliases",
  "cardinality",
  "constraints",
  "fallback_for",
  "importance",
  "lifecycle",
  "properties",
  "required",
  "reverse_name",
  "semantic",
  "verification",
]);

/**
 * The locale key for a declaration's name, or undefined for one this release does not know yet,
 * which is then shown as the backend names it.
 */
export const declarationFieldKey = (field: string) =>
  DECLARATION_FIELDS.has(field) ? `${PREFIX}.field.${field}` : undefined;

export const declarationKindKey = (kind: DeclarationDefinitionKind) => `${PREFIX}.kind.${kind}`;

export const definitionKey = (kind: DeclarationDefinitionKind, id: string) => `${kind}:${id}`;

/** One definition's declarations an overwrite would clear: its own, then each property's. */
export type ClearedDefinition = {
  id: string;
  kind: DeclarationDefinitionKind;
  ownFields: string[];
  properties: Array<{ fields: string[]; name: string }>;
};

/** Groups the backend's list by definition, keeping the order the backend sent. */
export function groupClearedDeclarations(cleared: ClearedDeclaration[]): ClearedDefinition[] {
  const groups = new Map<string, ClearedDefinition>();

  cleared.forEach((entry) => {
    const key = definitionKey(entry.kind, entry.id);
    const group = groups.get(key) ?? {
      id: entry.id,
      kind: entry.kind,
      ownFields: [],
      properties: [],
    };
    groups.set(key, group);

    if (entry.property) {
      // One property split over several entries is still one row.
      const property = group.properties.find((item) => item.name === entry.property) ?? {
        fields: [],
        name: entry.property,
      };
      if (!group.properties.includes(property)) {
        group.properties.push(property);
      }
      property.fields.push(...entry.fields.filter((field) => !property.fields.includes(field)));
    } else {
      group.ownFields.push(...entry.fields.filter((field) => !group.ownFields.includes(field)));
    }
  });

  return [...groups.values()];
}

const PAYLOAD_LISTS: Array<[DeclarationDefinitionKind, string]> = [
  ["object_type", "object_types"],
  ["relation_type", "relation_types"],
  ["action_type", "action_types"],
];

function collectNames(container: unknown, names: Map<string, string>) {
  if (!container || typeof container !== "object") {
    return;
  }

  PAYLOAD_LISTS.forEach(([kind, listKey]) => {
    const list = (container as Record<string, unknown>)[listKey];
    if (!Array.isArray(list)) {
      return;
    }

    list.forEach((item) => {
      const { id, name } = (item ?? {}) as { id?: unknown; name?: unknown };
      if (typeof id === "string" && id && typeof name === "string" && name) {
        names.set(definitionKey(kind, id), name);
      }
    });
  });
}

/**
 * The names a JSON export gives its definitions, keyed by `definitionKey`: those of a network
 * export, including the ones under its concept groups, or those of a concept group export.
 */
export function definitionNamesFromPayload(payload: Record<string, unknown>) {
  const names = new Map<string, string>();
  collectNames(payload, names);
  if (Array.isArray(payload.concept_groups)) {
    payload.concept_groups.forEach((group) => collectNames(group, names));
  }
  return names;
}
