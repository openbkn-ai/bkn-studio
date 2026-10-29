/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";

import { http } from "@/framework/request/http";
import { isRequestNotFound } from "@/framework/request/error-message";
import { defaultDevRuntimeUser } from "@/framework/runtime/dev-profile";
import type {
  Draft,
  DraftItemEdit,
  DraftItemKind,
  DraftKeyEvidence,
  DraftObjectType,
  DraftRelationType,
  DraftTable,
  DraftValueType,
} from "@/modules/bkn-project/types/draft";

const API_PREFIX = "/bkn-project/v1/projects";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type BackendAccount = { id: string; type: string };

type BackendTable = {
  catalog_id: string;
  name: string;
  reason?: string;
  resource_id: string;
};

type BackendKey = {
  computed: boolean;
  distinct: number;
  field?: string;
  nulls: number;
  reason?: string;
  rows: number;
  source: string;
};

type BackendObjectType = {
  adopted: boolean;
  description: string;
  display_key: string;
  id: string;
  incremental_key?: string;
  key: BackendKey;
  name: string;
  needs_identity: boolean;
  primary_keys: string[] | null;
  properties:
    | {
        description: string;
        display_name: string;
        mapped_field: string;
        missing_description?: boolean;
        name: string;
        source_of_record: string;
        type: string;
        value_type_id?: string;
      }[]
    | null;
  table: BackendTable;
};

type BackendMapping = { source_property: string; target_property: string };

type BackendRelationType = {
  adopted: boolean;
  cardinality: string;
  description: string;
  evidence: {
    computed: boolean;
    hit_rate: number;
    hits: number;
    nulls: number;
    orphans: number;
    reason?: string;
    rows: number;
    source_distinct: number;
  };
  id: string;
  link_table?: BackendTable;
  mapping: BackendMapping[] | null;
  name: string;
  origin: string;
  source: string;
  target: string;
  verification: string;
};

type BackendValueType = {
  adopted: boolean;
  base_type: string;
  code_table: BackendTable;
  description: string;
  id: string;
  name: string;
  used_by: { object_type: string; property: string }[] | null;
  values: { display: string; value: string }[] | null;
};

export type BackendDraft = {
  create_time: number;
  drafter: BackendAccount;
  error: string;
  items: {
    decisions?: {
      action: string;
      after: unknown;
      before: unknown;
      by: BackendAccount;
      item_id: string;
      kind: string;
      time: number;
    }[];
    excluded: { field: string; keyword?: string; object_type: string; reason: string }[] | null;
    object_types: BackendObjectType[] | null;
    relation_types: BackendRelationType[] | null;
    unreadable: BackendTable[] | null;
    value_types: BackendValueType[] | null;
  };
  project_id: string;
  status: Draft["status"];
  update_time: number;
};

const mapTable = (table: BackendTable): DraftTable => ({
  catalogId: table.catalog_id,
  name: table.name,
  reason: table.reason,
  resourceId: table.resource_id,
});

const mapKey = (key: BackendKey): DraftKeyEvidence => ({
  computed: key.computed,
  distinct: key.distinct,
  field: key.field,
  nulls: key.nulls,
  reason: key.reason,
  rows: key.rows,
  source: key.source,
});

const mapObjectType = (item: BackendObjectType): DraftObjectType => ({
  adopted: item.adopted,
  description: item.description,
  displayKey: item.display_key,
  id: item.id,
  incrementalKey: item.incremental_key ?? "",
  key: mapKey(item.key),
  name: item.name,
  needsIdentity: item.needs_identity,
  primaryKeys: item.primary_keys ?? [],
  properties: (item.properties ?? []).map((property) => ({
    description: property.description,
    displayName: property.display_name,
    mappedField: property.mapped_field,
    missingDescription: property.missing_description ?? false,
    name: property.name,
    sourceOfRecord: property.source_of_record,
    type: property.type,
    valueTypeId: property.value_type_id,
  })),
  table: mapTable(item.table),
});

const mapRelationType = (item: BackendRelationType): DraftRelationType => ({
  adopted: item.adopted,
  cardinality: item.cardinality,
  description: item.description,
  evidence: {
    computed: item.evidence.computed,
    hitRate: item.evidence.hit_rate,
    hits: item.evidence.hits,
    nulls: item.evidence.nulls,
    orphans: item.evidence.orphans,
    reason: item.evidence.reason,
    rows: item.evidence.rows,
    sourceDistinct: item.evidence.source_distinct,
  },
  id: item.id,
  linkTable: item.link_table ? mapTable(item.link_table) : undefined,
  mapping: (item.mapping ?? []).map((mapping) => ({
    sourceProperty: mapping.source_property,
    targetProperty: mapping.target_property,
  })),
  name: item.name,
  origin: item.origin,
  source: item.source,
  target: item.target,
  verification: item.verification,
});

const mapValueType = (item: BackendValueType): DraftValueType => ({
  adopted: item.adopted,
  baseType: item.base_type,
  codeTable: mapTable(item.code_table),
  description: item.description,
  id: item.id,
  name: item.name,
  usedBy: (item.used_by ?? []).map((ref) => ({
    objectType: ref.object_type,
    property: ref.property,
  })),
  values: item.values ?? [],
});

export function mapDraft(draft: BackendDraft): Draft {
  const items = draft.items;
  return {
    createTime: draft.create_time,
    drafter: draft.drafter,
    error: draft.error,
    items: {
      decisions: (items.decisions ?? []).map((decision) => ({
        action: decision.action,
        after: decision.after,
        before: decision.before,
        by: decision.by,
        itemId: decision.item_id,
        kind: decision.kind,
        time: decision.time,
      })),
      excluded: (items.excluded ?? []).map((field) => ({
        field: field.field,
        keyword: field.keyword,
        objectType: field.object_type,
        reason: field.reason,
      })),
      objectTypes: (items.object_types ?? []).map(mapObjectType),
      relationTypes: (items.relation_types ?? []).map(mapRelationType),
      unreadable: (items.unreadable ?? []).map(mapTable),
      valueTypes: (items.value_types ?? []).map(mapValueType),
    },
    projectId: draft.project_id,
    status: draft.status,
    updateTime: draft.update_time,
  };
}

/* ----------------------------- Mock (local development) ----------------------------- */

const mockDrafter = { id: defaultDevRuntimeUser.id ?? "mock-user", type: "user" };

const wait = async <T>(value: T, delay = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

const mockTable = (name: string, catalogId = "cat-001"): BackendTable => ({
  catalog_id: catalogId,
  name,
  resource_id: `res-${name}`,
});

const mockProperty = (name: string, type: string) => ({
  description: "",
  display_name: name,
  mapped_field: name,
  missing_description: true,
  name,
  source_of_record: "table",
  type,
});

/**
 * p-001 is a ready draft with each case the page marks: a key that is not unique, a count
 * that failed, an object type waiting for its identity, a relation adopted before #2577's
 * rule, excluded fields and an unreadable table. p-002 reads a catalog that is gone.
 */
export function mockDraft(projectId: string, catalogId = "cat-001"): BackendDraft {
  const now = Date.parse("2026-10-27T09:00:00Z");
  return {
    create_time: now,
    drafter: mockDrafter,
    error: "",
    items: {
      decisions: [],
      excluded: [
        { field: "contact_phone", keyword: "phone", object_type: "customers", reason: "privacy" },
        { field: "contact_email", keyword: "email", object_type: "customers", reason: "privacy" },
      ],
      object_types: [
        {
          adopted: true,
          description: "",
          display_key: "name",
          id: "customers",
          key: { computed: true, distinct: 60, nulls: 0, rows: 60, source: "primary_key" },
          name: "customers",
          needs_identity: false,
          primary_keys: ["customer_id"],
          properties: [mockProperty("customer_id", "string"), mockProperty("name", "string")],
          table: mockTable("customers", catalogId),
        },
        {
          adopted: true,
          description: "",
          display_key: "order_no",
          id: "sales_orders",
          key: {
            computed: true,
            distinct: 911,
            field: "id",
            nulls: 0,
            rows: 1972,
            source: "chosen",
          },
          name: "sales_orders",
          needs_identity: false,
          primary_keys: ["id"],
          properties: [
            mockProperty("id", "integer"),
            mockProperty("order_no", "string"),
            mockProperty("customer_id", "string"),
          ],
          table: mockTable("sales_orders", catalogId),
        },
        {
          adopted: false,
          description: "",
          display_key: "material_code",
          id: "material_bom",
          key: {
            computed: false,
            distinct: 0,
            nulls: 0,
            reason: "query_failed: vega-backend returned HTTP 403: Public.Forbidden",
            rows: 0,
            source: "inferred",
          },
          name: "material_bom",
          needs_identity: true,
          primary_keys: null,
          properties: [
            mockProperty("bom_material_code", "string"),
            mockProperty("material_code", "string"),
          ],
          table: mockTable("material_bom", catalogId),
        },
      ],
      relation_types: [
        {
          adopted: true,
          cardinality: "many_to_one",
          description: "",
          evidence: {
            computed: true,
            hit_rate: 0.995,
            hits: 796,
            nulls: 0,
            orphans: 4,
            rows: 800,
            source_distinct: 60,
          },
          id: "sales_orders_to_customers",
          mapping: [{ source_property: "customer_id", target_property: "customer_id" }],
          name: "sales_orders_to_customers",
          origin: "name_match",
          source: "sales_orders",
          target: "customers",
          verification: "unconfirmed",
        },
        {
          adopted: true,
          cardinality: "many_to_one",
          description: "",
          evidence: {
            computed: true,
            hit_rate: 1,
            hits: 31423,
            nulls: 0,
            orphans: 0,
            rows: 31423,
            source_distinct: 30,
          },
          id: "material_bom_to_sales_orders",
          mapping: [{ source_property: "material_code", target_property: "order_no" }],
          name: "material_bom_to_sales_orders",
          origin: "foreign_key",
          source: "material_bom",
          target: "sales_orders",
          verification: "confirmed",
        },
      ],
      unreadable: [{ ...mockTable("audit_log", catalogId), reason: "not_visible" }],
      value_types: [
        {
          adopted: true,
          base_type: "string",
          code_table: mockTable("customer_levels", catalogId),
          description: "",
          id: "customer_levels",
          name: "customer_levels",
          used_by: [{ object_type: "customers", property: "level" }],
          values: [
            { display: "Tier 1", value: "T1" },
            { display: "Tier 2", value: "T2" },
          ],
        },
      ],
    },
    project_id: projectId,
    status: "ready",
    update_time: now,
  };
}

const mockDrafts: Record<string, BackendDraft> = {
  "p-001": mockDraft("p-001"),
  "p-002": mockDraft("p-002", "fi_ar_receipts"),
};

/** The 409 bkn-project answers, for the mock to refuse as it does. */
function mockConflict(code: string, description: string) {
  return new AxiosError(description, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description, error_code: `BknProject.Draft.${code}` },
    status: 409,
  } as AxiosResponse);
}

type MockItem = { adopted: boolean; description: string; id: string; name: string };

function editMockDraft(
  projectId: string,
  kind: DraftItemKind,
  itemId: string,
  updateTime: number,
  edit: DraftItemEdit,
): BackendDraft {
  const draft = mockDrafts[projectId];
  if (!draft || draft.update_time !== updateTime) {
    throw mockConflict("Stale", "The draft changed since it was read; reload it.");
  }
  const items: MockItem[] = draft.items[kind] ?? [];
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw mockConflict("ItemNotFound", `No item ${itemId}.`);
  }
  const now = Date.now();
  const decide = (action: string, before: unknown, after: unknown) =>
    (draft.items.decisions ??= []).push({
      action,
      after,
      before,
      by: mockDrafter,
      item_id: itemId,
      kind,
      time: now,
    });
  if (edit.adopted !== undefined && edit.adopted !== item.adopted) {
    item.adopted = edit.adopted;
    decide(edit.adopted ? "adopt" : "unadopt", !edit.adopted, edit.adopted);
    if (kind === "object_types" && !edit.adopted) {
      for (const relation of draft.items.relation_types ?? []) {
        if (relation.adopted && (relation.source === itemId || relation.target === itemId)) {
          relation.adopted = false;
        }
      }
    }
  }
  if (edit.name !== undefined && edit.name !== item.name) {
    decide("rename", item.name, edit.name);
    item.name = edit.name;
  }
  if (edit.description !== undefined && edit.description !== item.description) {
    decide("describe", item.description, edit.description);
    item.description = edit.description;
  }
  // Only an object type has an update field, and choosing the one it has changes nothing.
  if (edit.incrementalKey !== undefined && kind === "object_types") {
    const objectType = item as MockItem & { incremental_key?: string };
    if (edit.incrementalKey !== (objectType.incremental_key ?? "")) {
      decide("incremental", objectType.incremental_key ?? "", edit.incrementalKey);
      objectType.incremental_key = edit.incrementalKey;
    }
  }
  draft.update_time = now;
  return draft;
}

function readyMockDraft(projectId: string, updateTime: number): BackendDraft {
  const draft = mockDrafts[projectId];
  if (!draft || draft.update_time !== updateTime) {
    throw mockConflict("Stale", "The draft changed since it was read; reload it.");
  }
  return draft;
}

function chooseMockIdentity(
  projectId: string,
  itemId: string,
  updateTime: number,
  properties: string[],
): BackendDraft {
  const draft = readyMockDraft(projectId, updateTime);
  const item = draft.items.object_types?.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw mockConflict("ItemNotFound", `No item ${itemId}.`);
  }
  const now = Date.now();
  (draft.items.decisions ??= []).push({
    action: "identity",
    after: properties,
    before: item.primary_keys ?? [],
    by: mockDrafter,
    item_id: itemId,
    kind: "object_types",
    time: now,
  });
  item.primary_keys = properties;
  item.needs_identity = false;
  // A single key is counted; the mock pretends every value is distinct.
  item.key =
    properties.length === 1
      ? {
          computed: true,
          distinct: 120,
          field: properties[0],
          nulls: 0,
          rows: 120,
          source: "chosen",
        }
      : {
          computed: false,
          distinct: 0,
          nulls: 0,
          reason: "composite_key",
          rows: 0,
          source: "chosen",
        };
  draft.update_time = now;
  return draft;
}

function restoreMockField(
  projectId: string,
  updateTime: number,
  objectType: string,
  field: string,
): BackendDraft {
  const draft = readyMockDraft(projectId, updateTime);
  const excluded = draft.items.excluded ?? [];
  const at = excluded.findIndex((item) => item.object_type === objectType && item.field === field);
  const item = draft.items.object_types?.find((candidate) => candidate.id === objectType);
  if (at < 0 || !item) {
    throw new AxiosError("Not found", "ERR_BAD_REQUEST", undefined, undefined, {
      data: {
        description: "The field is not left out.",
        error_code: "BknProject.Draft.ItemNotFound",
      },
      status: 404,
    } as AxiosResponse);
  }
  const now = Date.now();
  const [left] = excluded.splice(at, 1);
  (item.properties ??= []).push(mockProperty(field, "string"));
  (draft.items.decisions ??= []).push({
    action: "restore",
    after: field,
    before: left,
    by: mockDrafter,
    item_id: objectType,
    kind: "excluded",
    time: now,
  });
  draft.update_time = now;
  return draft;
}

/* ------------------------------- API ------------------------------- */

const draftPath = (projectId: string) =>
  `${API_PREFIX}/${encodeURIComponent(projectId)}/ontology/draft`;

/** How often a draft that is drafting is read again, by every page that shows it. */
export const DRAFT_POLL_MS = 5000;

/** Returns the project's draft, or null before the first one. */
export async function getDraft(projectId: string): Promise<Draft | null> {
  if (useMock) {
    const draft = mockDrafts[projectId];
    return wait(draft ? mapDraft(draft) : null);
  }
  try {
    const response = await http.get<BackendDraft>(draftPath(projectId), { skipErrorToast: true });
    return mapDraft(response.data);
  } catch (error) {
    // bkn-project answers 404 Draft.NotFound before the first draft; a project that cannot be
    // seen is already handled by the workspace.
    if (isRequestNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Starts drafting from the tables of the project's catalogs; replies the draft, drafting.
 * Drafting over decisions people made is refused unless they agree to discard them.
 */
export async function generateDraft(
  projectId: string,
  options: { discardDecisions?: boolean } = {},
): Promise<Draft> {
  if (useMock) {
    const decisions = mockDrafts[projectId]?.items.decisions ?? [];
    if (decisions.length && !options.discardDecisions) {
      throw mockConflict("HasDecisions", "The draft has decisions.");
    }
    const draft = mockDraft(projectId);
    mockDrafts[projectId] = draft;
    return wait(mapDraft({ ...draft, status: "drafting" }));
  }
  const response = await http.post<BackendDraft>(
    `${draftPath(projectId)}:generate`,
    options.discardDecisions ? { discard_decisions: true } : {},
    { skipErrorToast: true },
  );
  return mapDraft(response.data);
}

/**
 * Edits one item of a ready draft made at `updateTime`; replies the draft. bkn-project records
 * the change as a decision and, for an object type no longer adopted, stops adopting the
 * relation types that connect it.
 */
export async function editDraftItem(
  projectId: string,
  kind: DraftItemKind,
  itemId: string,
  updateTime: number,
  edit: DraftItemEdit,
): Promise<Draft> {
  if (useMock) {
    return wait(mapDraft(editMockDraft(projectId, kind, itemId, updateTime, edit)));
  }
  const response = await http.patch<BackendDraft>(
    `${draftPath(projectId)}/items/${kind}/${encodeURIComponent(itemId)}`,
    {
      adopted: edit.adopted,
      description: edit.description,
      incremental_key: edit.incrementalKey,
      name: edit.name,
      update_time: updateTime,
    },
    { skipErrorToast: true },
  );
  return mapDraft(response.data);
}

/**
 * bkn-project counts a chosen key for up to 30 seconds and keeps the identity even when the
 * count does not finish, so the page waits longer: giving up first would report a saved choice
 * as failed.
 */
export const IDENTITY_TIMEOUT_MS = 45_000;

/** Chooses the properties that identify an object type's records; replies the draft. */
export async function chooseIdentity(
  projectId: string,
  itemId: string,
  updateTime: number,
  properties: string[],
): Promise<Draft> {
  if (useMock) {
    return wait(mapDraft(chooseMockIdentity(projectId, itemId, updateTime, properties)), 600);
  }
  const response = await http.put<BackendDraft>(
    `${draftPath(projectId)}/object_types/${encodeURIComponent(itemId)}/identity`,
    { properties, update_time: updateTime },
    { skipErrorToast: true, timeout: IDENTITY_TIMEOUT_MS },
  );
  return mapDraft(response.data);
}

/** Maps a field the privacy rules left out back to a property of its object type. */
export async function restoreField(
  projectId: string,
  updateTime: number,
  objectType: string,
  field: string,
): Promise<Draft> {
  if (useMock) {
    return wait(mapDraft(restoreMockField(projectId, updateTime, objectType, field)));
  }
  const response = await http.post<BackendDraft>(
    `${draftPath(projectId)}:restore`,
    { field, object_type: objectType, update_time: updateTime },
    { skipErrorToast: true },
  );
  return mapDraft(response.data);
}
