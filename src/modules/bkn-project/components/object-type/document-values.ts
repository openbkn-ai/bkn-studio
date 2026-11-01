/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { buildAppPath } from "@/app/router/app-paths";

import type {
  DraftRelationType,
  DraftRelationTypeSave,
  DraftObjectType,
  DraftObjectTypeSave,
  DraftSourceCitation,
  SamplePreview,
} from "@/modules/bkn-project/types/draft";

export function documentSave(object: DraftObjectType): DraftObjectTypeSave {
  return {
    name: object.name,
    description: object.description,
    displayKey: object.displayKey,
    incrementalKey: "",
    primaryKeys: [...object.primaryKeys],
    document: {
      timeProperty: object.document?.timeProperty ?? "",
      participantRelations: [...(object.document?.participantRelations ?? [])],
    },
    properties: object.properties.map((p) => ({
      name: p.name,
      type: p.type,
      displayName: p.displayName,
      description: p.description,
      ...(!p.readOnly && p.extraction ? { extraction: structuredClone(p.extraction) } : {}),
    })),
  };
}

/** Native offsets count Unicode code points, unlike browser string indices. */
export function selectedExample(
  fragment: SamplePreview["fragments"][number],
  quote: string,
): DraftSourceCitation | null {
  if (!quote || Array.from(quote).length > 4000) return null;
  const at = fragment.text.indexOf(quote);
  if (at < 0 || fragment.text.indexOf(quote, at + 1) >= 0) return null;
  const start = fragment.citation.start + Array.from(fragment.text.slice(0, at)).length;
  return { ...fragment.citation, start, end: start + Array.from(quote).length };
}
export function originalLocation(q: DraftSourceCitation): string {
  const params = new URLSearchParams({
    block: q.blockId,
    start: String(q.start),
    end: String(q.end),
  });
  return buildAppPath(
    `/knowledge-base/original/${encodeURIComponent(q.contentVersionId)}?${params.toString()}`,
  );
}

export function documentRelationSave(relation: DraftRelationType): DraftRelationTypeSave {
  return {
    name: relation.name,
    description: relation.description,
    source: relation.source,
    target: relation.target,
    mapping: [],
    cardinality: relation.cardinality,
    documentMapping: relation.documentMapping
      ? { ...relation.documentMapping }
      : { mode: "linking" },
  };
}

export function renameDocumentProperty(
  value: DraftObjectTypeSave,
  index: number,
  name: string,
): DraftObjectTypeSave {
  const old = value.properties[index].name;
  return {
    ...value,
    properties: value.properties.map((p, i) => (i === index ? { ...p, name } : p)),
    primaryKeys: value.primaryKeys.map((p) => (p === old ? name : p)),
    displayKey: value.displayKey === old ? name : value.displayKey,
    ...(value.document
      ? {
          document: {
            ...value.document,
            timeProperty: value.document.timeProperty === old ? name : value.document.timeProperty,
          },
        }
      : {}),
  };
}
const DOCUMENT_CARDINALITIES: Record<string, string> = {
  one_to_one: "oneToOne",
  one_to_many: "oneToMany",
  many_to_one: "manyToOne",
  many_to_many: "manyToMany",
};
export function documentCardinalityKey(value: string): string {
  return `bknProject.documentEditor.${DOCUMENT_CARDINALITIES[value] ?? "cardinality"}`;
}
