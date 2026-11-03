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
      ...(object.document?.factResolution
        ? {
            factResolution: {
              valueProperty: object.document.factResolution.valueProperty,
              subjectRelationId: object.document.factResolution.subjectRelationId,
              confirm:
                object.document.factResolution.confirmedAt > 0 &&
                object.document.factResolution.state !== "stale",
            },
          }
        : {}),
      ...(object.document?.filePeriod
        ? {
            filePeriod: {
              from: object.document.filePeriod.from,
              until: object.document.filePeriod.until,
              confirm: object.document.filePeriod.confirmedAt > 0,
            },
          }
        : {}),
      ...(object.document?.sentenceIdentity
        ? {
            sentenceIdentity: {
              properties: [...object.document.sentenceIdentity.properties],
              confirm: object.document.sentenceIdentity.confirmedAt > 0,
            },
          }
        : {}),
      ...(object.document?.fileIdentity
        ? {
            fileIdentity: {
              property: object.document.fileIdentity.property,
              confirm: object.document.fileIdentity.confirmedAt > 0,
            },
          }
        : {}),
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
  referenceName?: string,
): DraftObjectTypeSave {
  const old = referenceName ?? value.properties[index].name;
  if (
    !old ||
    !name ||
    value.properties.some(
      (property, at) => at !== index && (property.name === old || property.name === name),
    )
  ) {
    return {
      ...value,
      properties: value.properties.map((property, at) =>
        at === index ? { ...property, name } : property,
      ),
    };
  }
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
            ...(value.document.factResolution?.valueProperty === old
              ? {
                  factResolution: {
                    ...value.document.factResolution,
                    valueProperty: name,
                    confirm: false,
                  },
                }
              : {}),
            ...(value.document.sentenceIdentity?.properties.includes(old)
              ? {
                  sentenceIdentity: {
                    properties: value.document.sentenceIdentity.properties.map((key) =>
                      key === old ? name : key,
                    ),
                    confirm: false,
                  },
                }
              : {}),
            ...(value.document.filePeriod &&
            (value.document.filePeriod.from === old || value.document.filePeriod.until === old)
              ? {
                  filePeriod: {
                    ...value.document.filePeriod,
                    from:
                      value.document.filePeriod.from === old
                        ? name
                        : value.document.filePeriod.from,
                    until:
                      value.document.filePeriod.until === old
                        ? name
                        : value.document.filePeriod.until,
                    confirm: false,
                  },
                }
              : {}),
            ...(value.document.fileIdentity?.property === old
              ? { fileIdentity: { property: name, confirm: false } }
              : {}),
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

/** Drop only references owned by this row, including its retained editing name. */
export function removeDocumentProperty(
  value: DraftObjectTypeSave,
  index: number,
  referenceName?: string,
): DraftObjectTypeSave {
  const properties = value.properties.filter((_, at) => at !== index);
  const gone = new Set(
    [value.properties[index].name, referenceName].filter(
      (name): name is string => Boolean(name) && !properties.some((p) => p.name === name),
    ),
  );
  return {
    ...value,
    properties,
    primaryKeys: value.primaryKeys.filter((name) => !gone.has(name)),
    displayKey: gone.has(value.displayKey) ? "" : value.displayKey,
    ...(value.document
      ? {
          document: {
            ...value.document,
            ...(value.document.factResolution?.valueProperty &&
            gone.has(value.document.factResolution.valueProperty)
              ? {
                  factResolution: {
                    ...value.document.factResolution,
                    valueProperty: undefined,
                    confirm: false,
                  },
                }
              : {}),
            timeProperty: gone.has(value.document.timeProperty) ? "" : value.document.timeProperty,
            ...(value.document.sentenceIdentity?.properties.some((key) => gone.has(key))
              ? {
                  sentenceIdentity: {
                    properties: value.document.sentenceIdentity.properties.filter(
                      (key) => !gone.has(key),
                    ),
                    confirm: false,
                    ...(value.document.sentenceIdentity.properties.every((key) => gone.has(key))
                      ? { clear: true }
                      : {}),
                  },
                }
              : {}),
            ...(value.document.filePeriod &&
            [value.document.filePeriod.from, value.document.filePeriod.until].some(
              (name) => name && gone.has(name),
            )
              ? {
                  filePeriod: {
                    from: gone.has(value.document.filePeriod.from ?? "")
                      ? undefined
                      : value.document.filePeriod.from,
                    until: gone.has(value.document.filePeriod.until ?? "")
                      ? undefined
                      : value.document.filePeriod.until,
                    confirm: false,
                    ...([value.document.filePeriod.from, value.document.filePeriod.until].every(
                      (name) => !name || gone.has(name),
                    )
                      ? { clear: true }
                      : {}),
                  },
                }
              : {}),
            ...(value.document.fileIdentity && gone.has(value.document.fileIdentity.property)
              ? { fileIdentity: { property: "", confirm: false, clear: true } }
              : {}),
          },
        }
      : {}),
  };
}
