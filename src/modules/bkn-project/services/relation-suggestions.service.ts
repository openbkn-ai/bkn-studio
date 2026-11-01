/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { getDraft } from "@/modules/bkn-project/services/draft.service";
import type {
  AskEnds,
  IsolatedObjectType,
  RelationSuggestion,
  RelationSuggestions,
} from "@/modules/bkn-project/types/draft";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

/** AI answers within about 45 seconds; the page waits a little longer than that. */
export const ASK_RELATIONS_TIMEOUT_MS = 60_000;

const suggestionsPath = (projectId: string) =>
  `/bkn-project/v1/projects/${encodeURIComponent(projectId)}/ontology/draft/relation-suggestions`;

type BackendPair = { source_property?: { name?: string }; target_property?: { name?: string } };

type BackendSuggestion = {
  evidence?: {
    computed?: boolean;
    hit_rate?: number;
    hits?: number;
    nulls?: number;
    orphans?: number;
    reason?: string;
    rows?: number;
    source_distinct?: number;
  } | null;
  mapping_rules?:
    | BackendPair[]
    | {
        backing_data_source?: { id?: string };
        source_mapping_rules?: BackendPair[];
        target_mapping_rules?: BackendPair[];
      }
    | null;
  name?: string;
  origin?: string;
  reason?: string;
  relation_type_id?: string;
  source_object_type_id?: string;
  target_object_type_id?: string;
  type?: string;
};

type BackendSuggestions = {
  answer?: string;
  candidates?: BackendSuggestion[] | null;
  object_type: { id: string; name: string };
};

const pairs = (rules: BackendPair[] | undefined) =>
  (rules ?? []).map((pair) => ({
    sourceProperty: pair.source_property?.name ?? "",
    targetProperty: pair.target_property?.name ?? "",
  }));

function mapEnds(item: BackendSuggestion): AskEnds {
  const rules = item.mapping_rules;
  const ends = {
    source: item.source_object_type_id ?? "",
    target: item.target_object_type_id ?? "",
  };
  if (item.type === "indirect" && rules && !Array.isArray(rules)) {
    return {
      ...ends,
      link: {
        resourceId: rules.backing_data_source?.id ?? "",
        sourceMapping: pairs(rules.source_mapping_rules),
        targetMapping: pairs(rules.target_mapping_rules),
      },
      mapping: [],
    };
  }
  return { ...ends, mapping: pairs(Array.isArray(rules) ? rules : []) };
}

const mapSuggestion = (item: BackendSuggestion): RelationSuggestion => {
  const rows = item.evidence?.rows ?? 0;
  const hits = item.evidence?.hits ?? 0;
  return {
    ends: mapEnds(item),
    // Counted as a drafted relation is, so it reads the same.
    evidence: {
      computed: item.evidence?.computed ?? false,
      hitRate: item.evidence?.hit_rate ?? 0,
      hits,
      nulls: item.evidence?.nulls ?? 0,
      orphans: item.evidence?.orphans ?? Math.max(0, rows - hits),
      ...(item.evidence?.reason ? { reason: item.evidence.reason } : {}),
      rows,
      sourceDistinct: item.evidence?.source_distinct ?? 0,
    },
    name: item.name ?? "",
    origin: item.origin ?? "",
    reason: item.reason ?? "",
    relationTypeId: item.relation_type_id ?? "",
  };
};

export const mapSuggestions = (data: BackendSuggestions): RelationSuggestions => ({
  // AI may give no answer, only its suggestions: none is shown then.
  answer: data.answer?.trim() ?? "",
  candidates: (data.candidates ?? []).map(mapSuggestion),
  objectType: data.object_type,
});

/* ----------------------------- Mock (local development) ----------------------------- */

const wait = async <T>(value: T, delay = 300) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

async function mockIsolated(projectId: string): Promise<IsolatedObjectType[]> {
  const draft = await getDraft(projectId);
  if (!draft) {
    return [];
  }
  const adopted = draft.items.objectTypes.filter((item) => item.adopted);
  const connected = new Set(
    draft.items.relationTypes
      .filter((relation) => relation.adopted)
      .flatMap((relation) => [relation.source, relation.target]),
  );
  return adopted.filter((item) => !connected.has(item.id)).map(({ id, name }) => ({ id, name }));
}

async function mockSuggestions(projectId: string, objectTypeId: string, asked: boolean) {
  const draft = await getDraft(projectId);
  const objectType = draft?.items.objectTypes.find((item) => item.id === objectTypeId);
  if (!draft || !objectType) {
    return { answer: "", candidates: [], objectType: { id: objectTypeId, name: objectTypeId } };
  }
  const drafted: RelationSuggestion[] = draft.items.relationTypes
    .filter(
      (relation) =>
        !relation.adopted && (relation.source === objectTypeId || relation.target === objectTypeId),
    )
    .map((relation) => ({
      ends: {
        mapping: relation.mapping,
        source: relation.source,
        target: relation.target,
      },
      evidence: relation.evidence,
      name: relation.name,
      origin: "drafted",
      reason: asked ? "Each record names the other by its key." : "",
      relationTypeId: relation.id,
    }));
  const other = draft.items.objectTypes.find((item) => item.adopted && item.id !== objectTypeId);
  const property = objectType.properties[0]?.name ?? "";
  const named: RelationSuggestion[] = other
    ? [
        {
          ends: {
            mapping: [{ sourceProperty: property, targetProperty: other.primaryKeys[0] ?? "" }],
            source: objectTypeId,
            target: other.id,
          },
          evidence: {
            computed: true,
            hitRate: 0.96,
            hits: 1180,
            nulls: 0,
            orphans: 54,
            rows: 1234,
            sourceDistinct: 0,
          },
          name: `${objectType.name} of ${other.name}`,
          origin: "name_match",
          reason: asked ? "The field names match and nearly every row finds its record." : "",
          relationTypeId: "",
        },
      ]
    : [];
  const ai: RelationSuggestion[] =
    asked && other
      ? [
          {
            ends: { mapping: [], source: other.id, target: objectTypeId },
            evidence: {
              computed: false,
              hitRate: 0,
              hits: 0,
              nulls: 0,
              orphans: 0,
              reason: "cross_catalog",
              rows: 0,
              sourceDistinct: 0,
            },
            name: `${other.name} serves ${objectType.name}`,
            origin: "ai",
            reason: "One usually serves the other in this business.",
            relationTypeId: "",
          },
        ]
      : [];
  return {
    answer: asked
      ? "It likely connects through the field it shares with another object; the drafted relation already says so."
      : "",
    candidates: [...drafted, ...named, ...ai],
    objectType: { id: objectType.id, name: objectType.name },
  };
}

/* ------------------------------------ API ------------------------------------ */

/**
 * The adopted object types no adopted relation type connects, directly or through a link table.
 * Nothing is counted, so it answers at once.
 */
export async function listIsolatedObjectTypes(projectId: string): Promise<IsolatedObjectType[]> {
  if (useMock) {
    return wait(await mockIsolated(projectId));
  }
  const response = await http.get<{ isolated?: IsolatedObjectType[] | null }>(
    suggestionsPath(projectId),
    { skipErrorToast: true },
  );
  return response.data.isolated ?? [];
}

/** The relation types the draft and its tables suggest for an object type, best first. */
export async function getRelationSuggestions(
  projectId: string,
  objectTypeId: string,
): Promise<RelationSuggestions> {
  if (useMock) {
    return wait(await mockSuggestions(projectId, objectTypeId, false));
  }
  const response = await http.get<BackendSuggestions>(suggestionsPath(projectId), {
    params: { object_type: objectTypeId },
    skipErrorToast: true,
  });
  return mapSuggestions(response.data);
}

/**
 * Asks AI to explain the suggestions and to add its own, each checked and counted by
 * bkn-project. Takes up to about 45 seconds.
 */
export async function askRelationSuggestions(
  projectId: string,
  objectTypeId: string,
): Promise<RelationSuggestions> {
  if (useMock) {
    return wait(await mockSuggestions(projectId, objectTypeId, true), 1500);
  }
  const response = await http.post<BackendSuggestions>(
    `${suggestionsPath(projectId)}:ask`,
    { object_type: objectTypeId },
    { skipErrorToast: true, timeout: ASK_RELATIONS_TIMEOUT_MS },
  );
  return mapSuggestions(response.data);
}
