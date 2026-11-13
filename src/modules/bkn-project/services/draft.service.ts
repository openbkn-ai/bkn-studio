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
import { listObjectTypeResourceFields as listResourceFields } from "@/modules/knowledge-network/services/object-type-resource.service";
import type { ObjectTypeResourceField } from "@/modules/knowledge-network/types/object-type";
import { mockAddProjectCatalogs } from "@/modules/bkn-project/services/project.service";
import type {
  ExistingDefinitions,
  DraftSourceCitation,
  DraftExtractionField,
  DraftDocumentModel,
  DraftDocumentMapping,
  DualSourceChoice,
  SourceFieldRule,
  Candidate,
  Candidates,
  Draft,
  DraftItemEdit,
  DraftItemKind,
  DraftKeyEvidence,
  DraftObjectType,
  DraftObjectTypeSave,
  DraftRelationTypeSave,
  DraftRelationType,
  DraftTable,
  DraftValueType,
  SourceChanges,
} from "@/modules/bkn-project/types/draft";
import type {
  Concept,
  ConceptBinding,
  ConceptBlocker,
  ConceptRevision,
  Concepts,
  ConceptVerdict,
  RequirementConceptMatch,
  RequirementMatchTarget,
} from "@/modules/bkn-project/types/concepts";

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
  candidate?: string[];
  computed: boolean;
  distinct: number;
  field?: string;
  nulls: number;
  reason?: string;
  rows: number;
  source: string;
};

/** A citation as bkn-project sends it; the knowledge-base pages read samples with it too. */
export type BackendCitation = {
  knowledge_base_id: string;
  file_id: string;
  content_version_id: string;
  block_id: string;
  start: number;
  end: number;
  quote?: string;
};
type BackendExtraction = { instruction: string; examples: BackendCitation[] | null };
type BackendSourceChoice = {
  system_object_type_id: string;
  file_object_type_id: string;
  relation_type_id: string;
  fields: {
    name: string;
    category: SourceFieldRule["category"];
    source_of_record: SourceFieldRule["sourceOfRecord"];
    destination_object_type_id: string;
    evidence_order?: string[];
  }[];
};
const sourceChoiceBody = (choice: DualSourceChoice): BackendSourceChoice => ({
  system_object_type_id: choice.systemObjectTypeId,
  file_object_type_id: choice.fileObjectTypeId,
  relation_type_id: choice.relationTypeId,
  fields: choice.fields.map((field) => ({
    name: field.name,
    category: field.category,
    source_of_record: field.sourceOfRecord,
    destination_object_type_id: field.destinationObjectTypeId,
    ...(field.evidenceOrder?.length ? { evidence_order: field.evidenceOrder } : {}),
  })),
});
const mapSourceChoice = (choice: BackendSourceChoice): DualSourceChoice => ({
  systemObjectTypeId: choice.system_object_type_id,
  fileObjectTypeId: choice.file_object_type_id,
  relationTypeId: choice.relation_type_id,
  fields: choice.fields.map((field) => ({
    name: field.name,
    category: field.category,
    sourceOfRecord: field.source_of_record,
    destinationObjectTypeId: field.destination_object_type_id,
    ...(field.evidence_order?.length ? { evidenceOrder: field.evidence_order } : {}),
  })),
});
type BackendDocument = {
  fact_resolution?: {
    value_property: string;
    subject_relation_id: string;
    confirmed_at: number;
    state?: "proposed" | "confirmed" | "stale";
  };
  file_period?: { from?: string; until?: string; confirmed_at: number };
  sentence_identity?: { properties: string[]; confirmed_at: number };
  file_identity?: { property: string; confirmed_at: number };
  dual_source?: BackendSourceChoice & {
    confirmed_at: number;
    state?: "proposed" | "confirmed" | "stale";
  };
  role: string;
  layer: string;
  reason: string;
  citations: BackendCitation[] | null;
  time_property?: string;
  participant_relations?: string[] | null;
  selection_id: string;
  selection_revision: number;
};
type BackendDocumentMapping = {
  business_identity?: {
    rows: number;
    distinct: number;
    nulls: number;
    blanks: number;
    checked_at: number;
  };
  mode: string;
  mention_property?: string;
  identity_property?: string;
  source_name_property?: string;
  target_name_property?: string;
};
export const mapCitation = (q: BackendCitation): DraftSourceCitation => ({
  knowledgeBaseId: q.knowledge_base_id,
  fileId: q.file_id,
  contentVersionId: q.content_version_id,
  blockId: q.block_id,
  start: q.start,
  end: q.end,
  ...(q.quote ? { quote: q.quote } : {}),
});
const citationBody = (q: DraftSourceCitation): BackendCitation => ({
  knowledge_base_id: q.knowledgeBaseId,
  file_id: q.fileId,
  content_version_id: q.contentVersionId,
  block_id: q.blockId,
  start: q.start,
  end: q.end,
  ...(q.quote ? { quote: q.quote } : {}),
});
const mapDocument = (d: BackendDocument): DraftDocumentModel => ({
  ...(d.fact_resolution
    ? {
        factResolution: {
          valueProperty: d.fact_resolution.value_property,
          subjectRelationId: d.fact_resolution.subject_relation_id,
          confirmedAt: d.fact_resolution.confirmed_at,
          state: d.fact_resolution.state,
        },
      }
    : {}),
  ...(d.file_period
    ? {
        filePeriod: {
          from: d.file_period.from,
          until: d.file_period.until,
          confirmedAt: d.file_period.confirmed_at,
        },
      }
    : {}),
  ...(d.sentence_identity
    ? {
        sentenceIdentity: {
          properties: d.sentence_identity.properties,
          confirmedAt: d.sentence_identity.confirmed_at,
        },
      }
    : {}),
  ...(d.file_identity
    ? {
        fileIdentity: {
          property: d.file_identity.property,
          confirmedAt: d.file_identity.confirmed_at,
        },
      }
    : {}),
  ...(d.dual_source
    ? {
        dualSource: {
          ...mapSourceChoice(d.dual_source),
          confirmedAt: d.dual_source.confirmed_at,
          state: d.dual_source.state,
        },
      }
    : {}),
  role: d.role,
  layer: d.layer,
  reason: d.reason,
  citations: (d.citations ?? []).map(mapCitation),
  timeProperty: d.time_property ?? "",
  participantRelations: d.participant_relations ?? [],
  selectionId: d.selection_id,
  selectionRevision: d.selection_revision,
});
const mapExtraction = (e: BackendExtraction): DraftExtractionField => ({
  instruction: e.instruction,
  examples: (e.examples ?? []).map(mapCitation),
});
const mapDocumentMapping = (m: BackendDocumentMapping): DraftDocumentMapping => ({
  ...(m.business_identity
    ? {
        businessIdentity: {
          rows: m.business_identity.rows,
          distinct: m.business_identity.distinct,
          nulls: m.business_identity.nulls,
          blanks: m.business_identity.blanks,
          checkedAt: m.business_identity.checked_at,
        },
      }
    : {}),
  mode: m.mode,
  mentionProperty: m.mention_property,
  identityProperty: m.identity_property,
  sourceNameProperty: m.source_name_property,
  targetNameProperty: m.target_name_property,
});
const documentMappingBody = (m: DraftDocumentMapping): BackendDocumentMapping => ({
  mode: m.mode,
  mention_property: m.mentionProperty,
  identity_property: m.identityProperty,
  source_name_property: m.sourceNameProperty,
  target_name_property: m.targetNameProperty,
});

type BackendObjectType = {
  aliases?: string[] | null;
  document?: BackendDocument;
  adopted: boolean;
  description: string;
  display_key: string;
  existing?: boolean;
  id: string;
  incremental_key?: string;
  key: BackendKey;
  name: string;
  needs_identity: boolean;
  primary_keys: string[] | null;
  properties:
    | {
        aliases?: string[] | null;
        extraction?: BackendExtraction;
        read_only?: boolean;
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
  aliases?: string[] | null;
  document_repair?: string;
  document?: BackendDocument;
  document_mapping?: BackendDocumentMapping;
  adopted: boolean;
  cardinality: string;
  description: string;
  existing?: boolean;
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
  source_mapping?: BackendMapping[] | null;
  target: string;
  target_mapping?: BackendMapping[] | null;
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
  dataset_preparation?: Draft["datasetPreparation"];
  create_time: number;
  drafter: BackendAccount;
  error: string;
  items: {
    adding?: { by: BackendAccount; catalog_ids: string[] | null; since: number } | null;
    inputs?: { existing_tables?: string[] | null } | null;
    decisions?: {
      action: string;
      after: unknown;
      before: unknown;
      by: BackendAccount;
      item_id: string;
      kind: string;
      reason?: string;
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
  ...(key.candidate?.length ? { candidate: key.candidate } : {}),
  computed: key.computed,
  distinct: key.distinct,
  field: key.field,
  nulls: key.nulls,
  reason: key.reason,
  rows: key.rows,
  source: key.source,
});

const mapObjectType = (item: BackendObjectType): DraftObjectType => ({
  ...(item.document ? { document: mapDocument(item.document) } : {}),
  adopted: item.adopted,
  aliases: item.aliases ?? [],
  description: item.description,
  displayKey: item.display_key,
  ...(item.existing ? { existing: true } : {}),
  id: item.id,
  incrementalKey: item.incremental_key ?? "",
  key: mapKey(item.key),
  name: item.name,
  needsIdentity: item.needs_identity,
  primaryKeys: item.primary_keys ?? [],
  properties: (item.properties ?? []).map((property) => ({
    ...(property.extraction ? { extraction: mapExtraction(property.extraction) } : {}),
    ...(property.read_only ? { readOnly: true } : {}),
    ...(property.aliases?.length ? { aliases: property.aliases } : {}),
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

const mapMapping = (mapping: BackendMapping) => ({
  sourceProperty: mapping.source_property,
  targetProperty: mapping.target_property,
});

const mapRelationType = (item: BackendRelationType): DraftRelationType => ({
  ...(item.document_repair ? { documentRepair: item.document_repair } : {}),
  ...(item.document ? { document: mapDocument(item.document) } : {}),
  ...(item.document_mapping ? { documentMapping: mapDocumentMapping(item.document_mapping) } : {}),
  adopted: item.adopted,
  aliases: item.aliases ?? [],
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
  ...(item.existing ? { existing: true } : {}),
  id: item.id,
  linkTable: item.link_table ? mapTable(item.link_table) : undefined,
  mapping: (item.mapping ?? []).map(mapMapping),
  name: item.name,
  origin: item.origin,
  source: item.source,
  sourceMapping: (item.source_mapping ?? []).map(mapMapping),
  target: item.target,
  targetMapping: (item.target_mapping ?? []).map(mapMapping),
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
    ...(draft.dataset_preparation ? { datasetPreparation: draft.dataset_preparation } : {}),
    createTime: draft.create_time,
    drafter: draft.drafter,
    error: draft.error,
    items: {
      adding: items.adding
        ? {
            by: items.adding.by,
            catalogIds: items.adding.catalog_ids ?? [],
            since: items.adding.since,
          }
        : null,
      ...(items.inputs?.existing_tables?.length
        ? { existingTables: items.inputs.existing_tables }
        : {}),
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
  // Deciding whether to adopt confirms the item, the same decision again included.
  if (edit.adopted !== undefined) {
    markMockReviewed(projectId, kind, itemId, edit.adopted ? "" : (edit.reason ?? ""));
  }
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
  markMockReviewed(projectId, "object_types", itemId);
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

/** The 400 bkn-project answers for a property the save cannot take, and why. */
function mockInvalidProperty(details: Record<string, string>, description: string) {
  return new AxiosError(description, "ERR_BAD_REQUEST", undefined, undefined, {
    data: {
      description,
      error_code: "BknProject.Draft.InvalidProperty",
      error_details: details,
    },
    status: 400,
  } as AxiosResponse);
}

function saveMockObjectType(
  projectId: string,
  itemId: string,
  updateTime: number,
  value: DraftObjectTypeSave,
): BackendDraft {
  const draft = readyMockDraft(projectId, updateTime);
  const item = draft.items.object_types?.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw mockConflict("ItemNotFound", `No item ${itemId}.`);
  }
  markMockReviewed(projectId, "object_types", itemId);
  const kept = new Set(value.properties.map((property) => property.name));
  const objectName = (id: string) =>
    draft.items.object_types?.find((candidate) => candidate.id === id)?.name ?? id;
  // A property a relation joins by stays while the relation does.
  const uses = (draft.items.relation_types ?? []).flatMap((relation) =>
    (relation.mapping ?? [])
      .flatMap((pair) => [
        ...(relation.source === itemId ? [pair.source_property] : []),
        ...(relation.target === itemId ? [pair.target_property] : []),
      ])
      .filter((property) => !kept.has(property))
      .map((property) => ({
        property,
        relation: { id: relation.id, kind: "relation_types", name: relation.name },
        source: { id: relation.source, kind: "object_types", name: objectName(relation.source) },
        target: { id: relation.target, kind: "object_types", name: objectName(relation.target) },
      })),
  );
  if (uses.length) {
    const error = mockConflict("PropertyInUse", "A relation joins by the property.");
    (error.response!.data as { error_details?: unknown }).error_details = uses;
    throw error;
  }
  const columns = new Map<string, string>();
  for (const property of value.properties) {
    if (!property.mappedField) {
      throw mockInvalidProperty(
        { property: property.name, reason: "no_mapped_field" },
        "Every property maps a field.",
      );
    }
    if (columns.has(property.mappedField)) {
      throw mockInvalidProperty(
        { field: property.mappedField, reason: "field_mapped_twice" },
        "The field is mapped already.",
      );
    }
    columns.set(property.mappedField, property.name);
  }
  const now = Date.now();
  (draft.items.decisions ??= []).push({
    action: "save",
    after: value.name,
    before: item.name,
    by: mockDrafter,
    item_id: itemId,
    kind: "object_types",
    time: now,
  });
  const before = new Map((item.properties ?? []).map((property) => [property.name, property]));
  item.name = value.name;
  item.description = value.description;
  item.properties = value.properties.map((property) => ({
    ...(before.get(property.name) ?? mockProperty(property.name, property.type)),
    description: property.description,
    display_name: property.displayName,
    mapped_field: property.mappedField ?? "",
    missing_description: !property.description,
    type: property.type,
  }));
  // A column mapped again is no longer left out.
  draft.items.excluded = (draft.items.excluded ?? []).filter(
    (field) => field.object_type !== itemId || !columns.has(field.field),
  );
  item.primary_keys = value.primaryKeys;
  item.needs_identity = value.primaryKeys.length === 0;
  item.display_key = value.displayKey;
  item.incremental_key = value.incrementalKey;
  if (value.aliases) {
    item.aliases = value.aliases;
  }
  draft.update_time = now;
  return draft;
}

/** How long the mock takes to draft the tables of added catalogs. */
const MOCK_ADDING_MS = 6000;

function addMockCatalogs(projectId: string, catalogIds: string[]): BackendDraft {
  const draft = mockDrafts[projectId];
  if (!draft || draft.status !== "ready") {
    throw mockConflict("NotReady", "The draft is not ready.");
  }
  if (draft.items.adding) {
    throw mockConflict("Drafting", "Catalogs are being added.");
  }
  draft.items.adding = { by: mockDrafter, catalog_ids: catalogIds, since: Date.now() };
  mockAddProjectCatalogs(projectId, catalogIds);
  return draft;
}

/** Once its time is up, the mock's adding is done: it found nothing new, and says so. */
function finishMockAdding(projectId: string) {
  const draft = mockDrafts[projectId];
  const adding = draft?.items.adding;
  if (!draft || !adding || Date.now() - adding.since < MOCK_ADDING_MS) {
    return;
  }
  const now = Date.now();
  draft.items.adding = null;
  (draft.items.decisions ??= []).push({
    action: "add_catalogs",
    after: {
      catalog_ids: adding.catalog_ids,
      object_types: [],
      relation_types: [],
      value_types: [],
    },
    before: null,
    by: adding.by,
    item_id: "",
    kind: "draft",
    time: now,
  });
  draft.update_time = now;
}

/** The 400 bkn-project answers for a relation the save cannot take, and why. */
function mockInvalidRelation(details: Record<string, unknown>) {
  return new AxiosError("Invalid relation", "ERR_BAD_REQUEST", undefined, undefined, {
    data: {
      description: "Invalid relation",
      error_code: "BknProject.Draft.InvalidRelation",
      error_details: details,
    },
    status: 400,
  } as AxiosResponse);
}

const mockPairs = (mapping: DraftRelationTypeSave["mapping"]) =>
  mapping.map((pair) => ({
    source_property: pair.sourceProperty,
    target_property: pair.targetProperty,
  }));

/** The first id from `stem` no relation of the draft has: a deleted one leaves its number free. */
function freeMockRelationId(relations: { id: string }[], stem: string) {
  let n = relations.length + 1;
  while (relations.some((item) => item.id === `${stem}_${n}`)) {
    n += 1;
  }
  return `${stem}_${n}`;
}

function saveMockRelationType(
  projectId: string,
  updateTime: number,
  value: DraftRelationTypeSave,
  itemId?: string,
): BackendDraft {
  const draft = readyMockDraft(projectId, updateTime);
  const objects = draft.items.object_types ?? [];
  const relations = (draft.items.relation_types ??= []);
  const end = (id: string) => objects.find((item) => item.id === id);
  const source = end(value.source);
  const target = end(value.target);
  if (!source || !target) {
    throw mockInvalidRelation({
      object_type: source ? value.target : value.source,
      reason: "unknown_end",
    });
  }
  const pairs = value.link
    ? [...value.link.sourceMapping, ...value.link.targetMapping]
    : value.mapping;
  if (!pairs.length) {
    throw mockInvalidRelation({ reason: "no_mapping" });
  }
  const has = (item: typeof source, name: string) =>
    (item.properties ?? []).some((property) => property.name === name);
  const missing = value.link
    ? [
        ...value.link.sourceMapping
          .filter((pair) => !has(source, pair.sourceProperty))
          .map((pair) => ({ object_type: source.id, property: pair.sourceProperty })),
        ...value.link.targetMapping
          .filter((pair) => !has(target, pair.targetProperty))
          .map((pair) => ({ object_type: target.id, property: pair.targetProperty })),
      ]
    : [
        ...value.mapping
          .filter((pair) => !has(source, pair.sourceProperty))
          .map((pair) => ({ object_type: source.id, property: pair.sourceProperty })),
        ...value.mapping
          .filter((pair) => !has(target, pair.targetProperty))
          .map((pair) => ({ object_type: target.id, property: pair.targetProperty })),
      ];
  if (missing.length) {
    throw mockInvalidRelation({ ...missing[0], reason: "unknown_property" });
  }
  const join = JSON.stringify([value.source, value.target, mockPairs(value.mapping)]);
  const same = relations.find(
    (other) =>
      other.id !== itemId &&
      JSON.stringify([other.source, other.target, other.mapping ?? []]) === join,
  );
  if (same && !value.link) {
    throw mockInvalidRelation({
      reason: "duplicate",
      relation: { id: same.id, kind: "relation_types", name: same.name },
    });
  }
  const now = Date.now();
  const adopted =
    objects.some((item) => item.id === source.id && item.adopted) &&
    objects.some((item) => item.id === target.id && item.adopted);
  const joined = {
    link_table: value.link
      ? { catalog_id: "", name: value.link.resourceId, resource_id: value.link.resourceId }
      : undefined,
    mapping: value.link ? [] : mockPairs(value.mapping),
    source: value.source,
    source_mapping: value.link ? mockPairs(value.link.sourceMapping) : [],
    target: value.target,
    target_mapping: value.link ? mockPairs(value.link.targetMapping) : [],
  };
  const existing = itemId ? relations.find((item) => item.id === itemId) : undefined;
  if (itemId && !existing) {
    throw mockConflict("ItemNotFound", `No item ${itemId}.`);
  }
  if (existing) {
    Object.assign(existing, joined, {
      adopted: existing.adopted && adopted,
      ...(value.aliases ? { aliases: value.aliases } : {}),
      description: value.description,
      name: value.name,
    });
  } else {
    relations.push({
      ...joined,
      adopted,
      aliases: value.aliases ?? [],
      cardinality: "many_to_one",
      description: value.description,
      // Counted only for a single property within one catalog; the mock counts none.
      evidence: {
        computed: false,
        hit_rate: 0,
        hits: 0,
        nulls: 0,
        orphans: 0,
        reason: value.link ? "link_table" : "not_identity",
        rows: 0,
        source_distinct: 0,
      },
      id: freeMockRelationId(relations, `${value.source}_to_${value.target}`),
      name: value.name,
      origin: "manual",
      verification: "unconfirmed",
    });
  }
  (draft.items.decisions ??= []).push({
    action: existing ? "save" : "create",
    after: value.name,
    before: existing?.name ?? null,
    by: mockDrafter,
    item_id: markMockReviewed(
      projectId,
      "relation_types",
      existing?.id ?? relations[relations.length - 1].id,
    ),
    kind: "relation_types",
    time: now,
  });
  draft.update_time = now;
  return draft;
}

function deleteMockRelationType(
  projectId: string,
  itemId: string,
  updateTime: number,
): BackendDraft {
  const draft = readyMockDraft(projectId, updateTime);
  const relations = draft.items.relation_types ?? [];
  const at = relations.findIndex((item) => item.id === itemId);
  if (at < 0) {
    throw mockConflict("ItemNotFound", `No item ${itemId}.`);
  }
  if (relations[at].origin !== "manual") {
    throw mockInvalidRelation({ reason: "not_manual", relation: itemId });
  }
  const [gone] = relations.splice(at, 1);
  const now = Date.now();
  (draft.items.decisions ??= []).push({
    action: "delete",
    after: null,
    before: gone.name,
    by: mockDrafter,
    item_id: itemId,
    kind: "relation_types",
    time: now,
  });
  draft.update_time = now;
  return draft;
}

/** Who confirmed which items of a mock draft, and why one was left out. */
const mockReviews: Record<string, Map<string, { reason: string; time: number }>> = {};

/** Records a person's confirming an item; replies its id. */
function markMockReviewed(projectId: string, kind: string, itemId: string, reason = "") {
  (mockReviews[projectId] ??= new Map()).set(`${kind}/${itemId}`, { reason, time: Date.now() });
  return itemId;
}

/** How many items of a mock draft nobody confirmed yet; for the mock status. */
export function mockUnreviewedCount(projectId: string) {
  return mockCandidates(projectId).counts.pending;
}

function mockCandidates(projectId: string, catalogId = ""): Candidates {
  const draft = mockDrafts[projectId];
  const reviews = mockReviews[projectId] ?? new Map<string, { reason: string; time: number }>();
  // The mock specification needs the customers and the orders.
  const needed = new Set(["customers", "sales_orders"]);
  const items: Candidate[] = [
    ...(draft?.items.object_types ?? []).map((item) => ({
      item,
      kind: "object_types" as const,
      table: item.table,
    })),
    ...(draft?.items.relation_types ?? []).map((item) => ({
      item,
      kind: "relation_types" as const,
      table: item.link_table,
    })),
  ].map(({ item, kind, table }) => {
    const review = reviews.get(`${kind}/${item.id}`);
    const added = (item as { added_by_catalog?: string }).added_by_catalog ?? "";
    return {
      addedByCatalog: added,
      adopted: item.adopted,
      excludeReason: review?.reason ?? "",
      id: item.id,
      kind,
      name: item.name,
      neededBy: needed.has(item.id)
        ? { concepts: [{ id: `c-${item.id}`, term: item.name }], questions: [] }
        : null,
      reviewed: review ? { by: mockDrafter, time: review.time } : null,
      state: review ? (item.adopted ? "adopted" : "excluded") : "pending",
      table: table ? { name: table.name, rows: 120 } : null,
    } satisfies Candidate;
  });
  const order = (item: Candidate) => [
    item.neededBy ? 0 : 1,
    item.state === "pending" ? 0 : 1,
    item.kind === "object_types" ? 0 : 1,
  ];
  const sorted = items
    .filter((item) => !catalogId || item.addedByCatalog === catalogId)
    .sort((a, b) => {
      const [x, y] = [order(a), order(b)];
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || a.name.localeCompare(b.name);
    });
  const counts = { adopted: 0, excluded: 0, pending: 0 };
  sorted.forEach((item) => (counts[item.state] += 1));
  return { counts, items: sorted };
}

/**
 * Confirms every candidate nobody confirmed as drafting suggested it, adopted or not. An object
 * type waiting for its identity and a relation an end of which is not adopted are skipped.
 */
function acceptMockSuggestions(projectId: string, updateTime: number) {
  const draft = readyMockDraft(projectId, updateTime);
  const adopted = new Set(
    (draft.items.object_types ?? []).filter((item) => item.adopted).map((item) => item.id),
  );
  let accepted = 0;
  let skipped = 0;
  for (const candidate of mockCandidates(projectId).items) {
    if (candidate.state !== "pending") {
      continue;
    }
    const relation = draft.items.relation_types?.find((item) => item.id === candidate.id);
    const objectType = draft.items.object_types?.find((item) => item.id === candidate.id);
    const waits =
      candidate.kind === "object_types"
        ? Boolean(objectType?.needs_identity)
        : !relation || !adopted.has(relation.source) || !adopted.has(relation.target);
    if (waits) {
      skipped += 1;
    } else {
      markMockReviewed(projectId, candidate.kind, candidate.id);
      accepted += 1;
    }
  }
  draft.update_time = Date.now();
  return { accepted, draft, skipped };
}

/* ------------------------------- API ------------------------------- */

const draftPath = (projectId: string) =>
  `${API_PREFIX}/${encodeURIComponent(projectId)}/ontology/draft`;

type BackendExisting = {
  object_types:
    | {
        aliases?: string[] | null;
        description: string;
        id: string;
        name: string;
        primary_keys: string[] | null;
        property_count: number;
        table_id: string;
      }[]
    | null;
  relation_types:
    | { aliases?: string[] | null; id: string; name: string; source: string; target: string }[]
    | null;
};

/** What the project's network already has and the draft did not write; empty on a new network. */
export async function getExistingDefinitions(projectId: string): Promise<ExistingDefinitions> {
  if (useMock) {
    return wait({ objectTypes: [], relationTypes: [] });
  }
  const response = await http.get<BackendExisting>(
    `${API_PREFIX}/${encodeURIComponent(projectId)}/ontology/existing`,
    { skipErrorToast: true },
  );
  return {
    objectTypes: (response.data.object_types ?? []).map((item) => ({
      aliases: item.aliases ?? [],
      description: item.description,
      id: item.id,
      name: item.name,
      primaryKeys: item.primary_keys ?? [],
      propertyCount: item.property_count,
      tableId: item.table_id,
    })),
    relationTypes: (response.data.relation_types ?? []).map((item) => ({
      aliases: item.aliases ?? [],
      id: item.id,
      name: item.name,
      source: item.source,
      target: item.target,
    })),
  };
}

/** How often a draft that is drafting is read again, by every page that shows it. */
export const DRAFT_POLL_MS = 5000;

/** Returns the project's draft, or null before the first one. */
export async function getDraft(projectId: string): Promise<Draft | null> {
  if (useMock) {
    finishMockAdding(projectId);
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
 * Adds data catalogs to a project with a ready draft, as its owner; replies the draft, still ready
 * and editable, its `adding` naming them while their tables are drafted in the background. Read
 * it again to follow: once done, `adding` is cleared and an `add_catalogs` decision says what came.
 */
export async function addDraftCatalogs(projectId: string, catalogIds: string[]): Promise<Draft> {
  if (useMock) {
    return wait(mapDraft(addMockCatalogs(projectId, catalogIds)));
  }
  const response = await http.post<BackendDraft>(
    `${API_PREFIX}/${encodeURIComponent(projectId)}/catalogs:add`,
    { catalog_ids: catalogIds },
    { skipErrorToast: true },
  );
  return mapDraft(response.data);
}

type BackendCandidate = {
  document_repair?: string;
  source?: string;
  document?: BackendDocument;
  added_by_catalog?: string;
  adopted: boolean;
  exclude_reason?: string;
  id: string;
  kind: Candidate["kind"];
  name: string;
  needed_by_requirements?: {
    concepts?: { id: string; term: string }[] | null;
    questions?: { id: string; text: string }[] | null;
  } | null;
  reviewed?: { by: BackendAccount; time: number } | null;
  rows?: number;
  state: Candidate["state"];
  table?: BackendTable | null;
};

/**
 * The draft's object and relation types as candidates to confirm, in bkn-project's order;
 * `catalogId` keeps those an added catalog drafted.
 */
export async function getCandidates(projectId: string, catalogId = ""): Promise<Candidates> {
  if (useMock) {
    return wait(mockCandidates(projectId, catalogId));
  }
  const response = await http.get<{
    candidates?: BackendCandidate[] | null;
    counts?: Partial<Candidates["counts"]>;
  }>(`${API_PREFIX}/${encodeURIComponent(projectId)}/ontology/candidates`, {
    params: catalogId ? { catalog_id: catalogId } : undefined,
    skipErrorToast: true,
  });
  const { candidates: items, counts } = response.data;
  return {
    counts: {
      adopted: counts?.adopted ?? 0,
      excluded: counts?.excluded ?? 0,
      pending: counts?.pending ?? 0,
    },
    items: (items ?? []).map((item) => ({
      ...(item.document_repair ? { documentRepair: item.document_repair } : {}),
      ...(item.document ? { document: mapDocument(item.document) } : {}),
      ...(item.source ? { source: item.source } : {}),
      addedByCatalog: item.added_by_catalog ?? "",
      adopted: item.adopted,
      excludeReason: item.exclude_reason ?? "",
      id: item.id,
      kind: item.kind,
      name: item.name,
      neededBy: item.needed_by_requirements
        ? {
            concepts: item.needed_by_requirements.concepts ?? [],
            questions: item.needed_by_requirements.questions ?? [],
          }
        : null,
      reviewed: item.reviewed ?? null,
      state: item.state,
      table: item.table ? { name: item.table.name, rows: item.rows ?? null } : null,
    })),
  };
}

/**
 * Confirms every candidate nobody confirmed as drafting suggested it, over the draft made at
 * `updateTime`; replies the draft and how many were confirmed and skipped for a person to settle.
 */
export async function acceptDraftSuggestions(
  projectId: string,
  updateTime: number,
): Promise<{ accepted: number; draft: Draft; skipped: number }> {
  if (useMock) {
    const { accepted, draft, skipped } = acceptMockSuggestions(projectId, updateTime);
    return wait({ accepted, draft: mapDraft(draft), skipped });
  }
  // Both lists name the candidates as kind/item_id; the page counts them.
  const response = await http.post<{
    accepted?: string[] | null;
    draft: BackendDraft;
    skipped?: string[] | null;
  }>(
    `${draftPath(projectId)}:accept_suggestions`,
    { update_time: updateTime },
    {
      skipErrorToast: true,
    },
  );
  return {
    accepted: response.data.accepted?.length ?? 0,
    draft: mapDraft(response.data.draft),
    skipped: response.data.skipped?.length ?? 0,
  };
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
      aliases: edit.aliases,
      description: edit.description,
      incremental_key: edit.incrementalKey,
      name: edit.name,
      reason: edit.reason,
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

/** An object type as bkn-project saves it: the body saving sends, without its draft's time. */
export function objectTypeBody(value: DraftObjectTypeSave) {
  return {
    ...(value.document
      ? {
          document: {
            ...(value.document.fieldSources?.length
              ? {
                  field_sources: value.document.fieldSources
                    .filter((decision) =>
                      value.properties.some(
                        (field) =>
                          field.name === decision.property &&
                          (!decision.type || decision.type === field.type),
                      ),
                    )
                    .map((decision) => ({
                      property: decision.property,
                      source_of_record: decision.sourceOfRecord,
                      confirm: decision.confirm,
                    })),
                }
              : {}),
            ...(value.document.factResolution
              ? {
                  fact_resolution: {
                    ...(value.document.factResolution.valueProperty
                      ? { value_property: value.document.factResolution.valueProperty }
                      : {}),
                    ...(value.document.factResolution.subjectRelationId
                      ? { subject_relation_id: value.document.factResolution.subjectRelationId }
                      : {}),
                    confirm: value.document.factResolution.confirm,
                    ...(value.document.factResolution.clear ? { clear: true } : {}),
                  },
                }
              : {}),
            ...(value.document.filePeriod ? { file_period: value.document.filePeriod } : {}),
            ...(value.document.fileIdentity ? { file_identity: value.document.fileIdentity } : {}),
            ...(value.document.sentenceIdentity
              ? { sentence_identity: value.document.sentenceIdentity }
              : {}),
            time_property: value.document.timeProperty,
            participant_relations: value.document.participantRelations,
            ...(value.document.dualSource
              ? {
                  dual_source: {
                    ...sourceChoiceBody(value.document.dualSource),
                    confirm: value.document.dualSource.confirm,
                    ...(value.document.dualSource.clear ? { clear: true } : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
    comment: value.description,
    data_properties: value.properties.map((property) => ({
      ...(property.extraction
        ? {
            extraction: {
              instruction: property.extraction.instruction,
              examples: property.extraction.examples.map(citationBody),
            },
          }
        : {}),
      comment: property.description,
      display_name: property.displayName,
      ...(property.mappedField ? { mapped_field: { name: property.mappedField } } : {}),
      name: property.name,
      type: property.type,
    })),
    display_key: value.displayKey,
    incremental_key: value.incrementalKey,
    name: value.name,
    primary_keys: value.primaryKeys,
    ...(value.aliases ? { aliases: value.aliases } : {}),
  };
}

/**
 * Saves an object type whole, as the editor leaves it, over the draft made at `updateTime`;
 * replies the draft. bkn-project checks it as it checks each edit and records the decisions.
 */
export async function saveDraftObjectType(
  projectId: string,
  itemId: string,
  updateTime: number,
  value: DraftObjectTypeSave,
): Promise<Draft> {
  if (useMock) {
    return wait(mapDraft(saveMockObjectType(projectId, itemId, updateTime, value)));
  }
  const response = await http.put<BackendDraft>(
    `${draftPath(projectId)}/object_types/${encodeURIComponent(itemId)}`,
    { ...objectTypeBody(value), update_time: updateTime },
    { skipErrorToast: true },
  );
  return mapDraft(response.data);
}

/**
 * A relation type as bkn-backend's, the body making or saving it sends; without a time, what is
 * being edited, as Ask AI is told it.
 */
export function relationBody(value: DraftRelationTypeSave, updateTime?: number, id?: string) {
  const pairs = (mapping: DraftRelationTypeSave["mapping"]) =>
    mapping.map((pair) => ({
      source_property: { name: pair.sourceProperty },
      target_property: { name: pair.targetProperty },
    }));
  return {
    ...(id ? { id } : {}),
    ...(value.aliases ? { aliases: value.aliases } : {}),
    comment: value.description,
    ...(value.documentMapping
      ? {
          document_mapping: documentMappingBody(value.documentMapping),
          cardinality: value.cardinality,
          ...(value.verifyBusinessIdentity ? { verify_business_identity: true } : {}),
        }
      : {}),
    mapping_rules: value.documentMapping
      ? undefined
      : value.link
        ? {
            backing_data_source: { id: value.link.resourceId, type: "resource" },
            source_mapping_rules: pairs(value.link.sourceMapping),
            target_mapping_rules: pairs(value.link.targetMapping),
          }
        : pairs(value.mapping),
    name: value.name,
    source_object_type_id: value.source,
    target_object_type_id: value.target,
    type: value.link ? "indirect" : "direct",
    ...(updateTime === undefined ? {} : { update_time: updateTime }),
  };
}

/**
 * Makes a relation type in the draft made at `updateTime`; replies the draft. It is adopted when
 * both its ends are; bkn-project counts the join where it can.
 */
export async function createDraftRelationType(
  projectId: string,
  updateTime: number,
  value: DraftRelationTypeSave,
): Promise<Draft> {
  if (useMock) {
    return wait(mapDraft(saveMockRelationType(projectId, updateTime, value)));
  }
  const response = await http.post<BackendDraft>(
    `${draftPath(projectId)}/relation_types`,
    relationBody(value, updateTime),
    { skipErrorToast: true },
  );
  return mapDraft(response.data);
}

/** Saves a relation type whole, as the editor leaves it; replies the draft. */
export async function saveDraftRelationType(
  projectId: string,
  itemId: string,
  updateTime: number,
  value: DraftRelationTypeSave,
): Promise<Draft> {
  if (useMock) {
    return wait(mapDraft(saveMockRelationType(projectId, updateTime, value, itemId)));
  }
  const response = await http.put<BackendDraft>(
    `${draftPath(projectId)}/relation_types/${encodeURIComponent(itemId)}`,
    relationBody(value, updateTime),
    { skipErrorToast: true },
  );
  return mapDraft(response.data);
}

/** Deletes a relation type a person made; one drafting found is left out instead. */
export async function deleteDraftRelationType(
  projectId: string,
  itemId: string,
  updateTime: number,
): Promise<Draft> {
  if (useMock) {
    return wait(mapDraft(deleteMockRelationType(projectId, itemId, updateTime)));
  }
  const response = await http.delete<BackendDraft>(
    `${draftPath(projectId)}/relation_types/${encodeURIComponent(itemId)}`,
    { params: { update_time: updateTime }, skipErrorToast: true },
  );
  return mapDraft(response.data);
}

/**
 * A data resource's fields, such as a link table's, for a relation to map. The mock has no tables:
 * it reads an object type's off the draft and finds no others.
 */
export async function listDraftResourceFields(
  project: { id: string; knId: string },
  resourceId: string,
): Promise<ObjectTypeResourceField[]> {
  if (useMock) {
    const item = mockDrafts[project.id]?.items.object_types?.find(
      (candidate) => candidate.table.resource_id === resourceId,
    );
    return item ? listDraftTableFields(project, item.id, resourceId) : wait([]);
  }
  return listResourceFields(project.knId, resourceId);
}

/**
 * The columns of an object type's table, for the editor to map. The mock has no tables: it reads
 * them off the draft, the mapped columns and the ones left out.
 */
export async function listDraftTableFields(
  project: { id: string; knId: string },
  objectTypeId: string,
  resourceId: string,
): Promise<ObjectTypeResourceField[]> {
  if (useMock) {
    const draft = mockDrafts[project.id];
    const item = draft?.items.object_types?.find((candidate) => candidate.id === objectTypeId);
    const mapped = (item?.properties ?? []).map((property) => ({
      comment: property.description,
      displayName: property.mapped_field,
      name: property.mapped_field,
      type: property.type,
    }));
    const left = (draft?.items.excluded ?? [])
      .filter((field) => field.object_type === objectTypeId)
      .map((field) => ({ displayName: field.field, name: field.field, type: "string" }));
    return wait([...mapped, ...left]);
  }
  // A table's columns are its data resource's, whoever's network reads them.
  return listResourceFields(project.knId, resourceId);
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

type BackendItemRef = { id: string; kind?: string; name: string; table?: string };

/**
 * How the tables the project binds differ now from what its draft and release map, as the data
 * source last recorded them. Reading changes nothing.
 */
export async function getSourceChanges(projectId: string): Promise<SourceChanges> {
  if (useMock) {
    return wait({
      missingTables: [],
      objectTypes: [],
      relationTypes: [],
      signature: "mock",
      state: "in_step",
    });
  }
  const response = await http.get<{
    missing_tables: BackendItemRef[] | null;
    object_types:
      | {
          changes:
            | {
                change: string;
                excluded?: string;
                field: string;
                field_name?: string;
                from_type?: string;
                key?: boolean;
                property?: string;
                property_name?: string;
                relations?: BackendItemRef[] | null;
                to_type?: string;
                unsupported?: boolean;
              }[]
            | null;
          id: string;
          in_draft: boolean;
          name: string;
          published: boolean;
          table: string;
        }[]
      | null;
    relation_types: { id: string; name: string; removed: string[] | null; table: string }[] | null;
    signature: string;
    state: string;
  }>(`${API_PREFIX}/${encodeURIComponent(projectId)}/source-changes`, { skipErrorToast: true });
  const data = response.data;
  return {
    missingTables: (data.missing_tables ?? []).map((item) => ({
      id: item.id,
      kind: item.kind ?? "",
      name: item.name,
      table: item.table ?? "",
    })),
    objectTypes: (data.object_types ?? []).map((objectType) => ({
      changes: (objectType.changes ?? []).map((change) => ({
        change: change.change,
        excluded: change.excluded ?? "",
        field: change.field,
        fieldName: change.field_name ?? "",
        fromType: change.from_type ?? "",
        key: change.key ?? false,
        property: change.property ?? "",
        propertyName: change.property_name ?? "",
        relations: (change.relations ?? []).map(({ id, name }) => ({ id, name })),
        toType: change.to_type ?? "",
        unsupported: change.unsupported ?? false,
      })),
      id: objectType.id,
      inDraft: objectType.in_draft,
      name: objectType.name,
      published: objectType.published,
      table: objectType.table,
    })),
    relationTypes: (data.relation_types ?? []).map((relation) => ({
      id: relation.id,
      name: relation.name,
      removed: relation.removed ?? [],
      table: relation.table,
    })),
    signature: data.signature,
    state: data.state,
  };
}

/**
 * Applies the source changes read to the draft by drafting's own rules, keeping every decision;
 * replies the draft. The draft then needs confirming and publishing again.
 */
export async function draftSourceChanges(projectId: string, signature: string): Promise<Draft> {
  if (useMock) {
    const draft = await getDraft(projectId);
    if (!draft) {
      throw new AxiosError("Draft.NotReady", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { error_code: "BknProject.Draft.NotReady" },
        status: 409,
      } as AxiosResponse);
    }
    return wait(draft);
  }
  const response = await http.post<BackendDraft>(
    `${API_PREFIX}/${encodeURIComponent(projectId)}/source-changes:draft`,
    { signature },
    { skipErrorToast: true },
  );
  return mapDraft(response.data);
}

type BackendBinding = { id?: string; kind: ConceptBinding["kind"]; name?: string };

const mapBinding = (binding: BackendBinding | null | undefined): ConceptBinding | null =>
  binding ? { id: binding.id ?? "", kind: binding.kind, name: binding.name ?? "" } : null;

type BackendConcept = {
  ai?: boolean;
  binding?: BackendBinding | null;
  aliases?: string[] | null;
  blocked?: string;
  description?: string;
  item?: Concept["item"];
  judged?: Concept["judged"];
  key: string;
  merged?: { key: string; name: string }[] | null;
  name: string;
  reason?: string;
  sources?:
    | {
        document_ids?: string[] | null;
        id?: string;
        kind: Concept["sources"][number]["kind"];
        name?: string;
      }[]
    | null;
  state: Concept["state"];
  suggested: ConceptVerdict;
  suggested_because?: string;
  verdict: ConceptVerdict;
};

type BackendConcepts = {
  concepts?: BackendConcept[] | null;
  counts?: Record<string, number> | null;
  draft_update_time?: number;
  not_understood?: number;
  requirement_update_time?: number;
  requirements?:
    | {
        basis?: string;
        by?: string;
        category: string;
        definition?: string;
        id: string;
        match?: {
          binding?: BackendBinding | null;
          key: string;
          name: string;
          target?: RequirementMatchTarget | null;
        } | null;
        quote?: string;
        state: RequirementConceptMatch["state"];
        term: string;
      }[]
    | null;
};

function mapConcepts(data: BackendConcepts): Concepts {
  return {
    concepts: (data.concepts ?? []).map((concept) => ({
      ai: concept.ai ?? false,
      aliases: concept.aliases ?? [],
      binding: mapBinding(concept.binding),
      blocked: (concept.blocked as ConceptBlocker | undefined) || null,
      description: concept.description ?? "",
      item: concept.item ?? null,
      judged: concept.judged ?? null,
      key: concept.key,
      merged: concept.merged ?? [],
      name: concept.name,
      reason: concept.reason ?? "",
      sources: (concept.sources ?? []).map((source) => ({
        documentIds: source.document_ids ?? [],
        id: source.id ?? "",
        kind: source.kind,
        name: source.name ?? "",
      })),
      state: concept.state,
      suggested: concept.suggested,
      suggestedBecause: concept.suggested_because ?? "",
      verdict: concept.verdict,
    })),
    counts: data.counts ?? {},
    draftUpdateTime: data.draft_update_time ?? 0,
    notUnderstood: data.not_understood ?? 0,
    requirementUpdateTime: data.requirement_update_time ?? 0,
    requirements: (data.requirements ?? []).map((requirement) => ({
      basis: requirement.basis ?? "",
      by: requirement.by ?? "",
      category: requirement.category,
      definition: requirement.definition ?? "",
      id: requirement.id,
      match: requirement.match
        ? {
            binding: mapBinding(requirement.match.binding),
            key: requirement.match.key,
            name: requirement.match.name,
            target: requirement.match.target ?? null,
          }
        : null,
      quote: requirement.quote ?? "",
      state: requirement.state,
      term: requirement.term,
    })),
  };
}

/**
 * The mock's judgments and merges, read from its draft's decisions as bkn-project keeps them, so
 * drafting again asks before discarding them.
 */
function mockConceptDecisions(draft: BackendDraft | undefined) {
  const judgments = new Map<string, { reason: string; time: number; verdict: ConceptVerdict }>();
  const merges = new Map<string, string>();
  for (const decision of draft?.items.decisions ?? []) {
    if (decision.kind !== "concepts") {
      continue;
    }
    if (decision.action === "judge") {
      judgments.set(decision.item_id, {
        reason: decision.reason ?? "",
        time: decision.time,
        verdict: decision.after as ConceptVerdict,
      });
    } else if (decision.action === "merge") {
      merges.set(decision.item_id, decision.after as string);
    } else if (decision.action === "unmerge") {
      merges.delete(decision.item_id);
    }
  }
  return { judgments, merges };
}

function recordMockConceptDecision(
  draft: BackendDraft,
  action: string,
  key: string,
  after: unknown,
  reason = "",
) {
  (draft.items.decisions ??= []).push({
    action,
    after,
    before: null,
    by: mockDrafter,
    item_id: key,
    kind: "concepts",
    reason,
    time: Date.now(),
  });
  draft.update_time = Math.max(Date.now(), draft.update_time + 1);
}

/** The mock's concepts: one per draft item, judged as the mock recorded. */
function mockConcepts(projectId: string): Concepts {
  const draft = mockDrafts[projectId];
  const { judgments, merges } = mockConceptDecisions(draft);
  const reviews = mockReviews[projectId] ?? new Map<string, { reason: string; time: number }>();
  const all: Concept[] =
    draft?.status === "ready"
      ? [
          ...(draft.items.object_types ?? []).map((item) => ({
            blocker: item.needs_identity ? ("needs_identity" as const) : null,
            item: { adopted: item.adopted, id: item.id, kind: "object_types" as const },
            name: item.name,
            description: item.description,
            source: item.table.name,
            resource: item.table.resource_id,
            suggested: "object" as const,
            because: "table_entity",
          })),
          ...(draft.items.relation_types ?? []).map((item) => ({
            blocker: null,
            item: { adopted: item.adopted, id: item.id, kind: "relation_types" as const },
            name: item.name,
            description: item.description,
            // A relation without a table of its own is found in its source's table.
            source:
              item.link_table?.name ??
              draft.items.object_types?.find((entry) => entry.id === item.source)?.table.name ??
              item.source,
            resource:
              item.link_table?.resource_id ??
              draft.items.object_types?.find((entry) => entry.id === item.source)?.table
                .resource_id ??
              item.source,
            suggested: "relation" as const,
            because: item.origin,
          })),
          ...(draft.items.value_types ?? []).map((item) => ({
            blocker: null,
            item: { adopted: item.adopted, id: item.id, kind: "value_types" as const },
            name: item.name,
            description: item.description,
            source: item.code_table.name,
            resource: item.code_table.resource_id,
            suggested: "values" as const,
            because: "code_table",
          })),
        ].map((entry) => {
          const key = `${entry.item.kind}/${entry.item.id}`;
          const judgment = judgments.get(key);
          const review = reviews.get(key);
          const verdict: ConceptVerdict =
            judgment?.verdict ?? (review && !entry.item.adopted ? "none" : entry.suggested);
          const modelItem =
            (entry.item.kind === "object_types" && (verdict === "object" || verdict === "event")) ||
            (entry.item.kind === "relation_types" && verdict === "relation") ||
            (entry.item.kind === "value_types" && verdict === "values");
          const judged = judgment ?? review;
          const state: Concept["state"] = !judged
            ? "pending"
            : modelItem && entry.item.adopted
              ? "in_model"
              : modelItem && entry.blocker
                ? "blocked"
                : "judged";
          return {
            ai: false,
            aliases: [],
            binding: { id: entry.resource, kind: "table" as const, name: entry.source },
            blocked: state === "blocked" ? entry.blocker : null,
            description: entry.description,
            item: entry.item,
            judged: judged ? { by: mockDrafter, time: judged.time } : null,
            key,
            merged: [],
            name: entry.name,
            reason: judgment?.reason ?? review?.reason ?? "",
            sources: [
              { documentIds: [], id: entry.resource, kind: "table" as const, name: entry.source },
            ],
            state,
            suggested: entry.suggested,
            suggestedBecause: entry.because,
            verdict,
          };
        })
      : [];
  const byKey = new Map(all.map((concept) => [concept.key, concept]));
  for (const [key, into] of merges) {
    const target = byKey.get(into);
    const merged = byKey.get(key);
    if (target && merged) {
      target.merged.push({ key, name: merged.name });
      target.sources.push(...merged.sources);
    }
  }
  const rank = { blocked: 1, in_model: 3, judged: 2, pending: 0 };
  const concepts = all
    .filter((concept) => !merges.has(concept.key))
    .sort((a, b) => rank[a.state] - rank[b.state]);
  const counts: Record<string, number> = {};
  for (const concept of concepts) {
    counts[concept.state] = (counts[concept.state] ?? 0) + 1;
    counts[`verdict:${concept.verdict}`] = (counts[`verdict:${concept.verdict}`] ?? 0) + 1;
  }
  return {
    concepts,
    counts,
    draftUpdateTime: draft?.status === "ready" ? draft.update_time : 0,
    notUnderstood: 0,
    // The mock lists no requirement concept of its own.
    requirementUpdateTime: 0,
    requirements: [],
  };
}

/**
 * The project's concepts: one per draft item, with the requirement concepts that are it, then the
 * requirement concepts no item is, each with what it is judged to be and where it stands.
 */
export async function getConcepts(projectId: string): Promise<Concepts> {
  if (useMock) {
    return wait(mockConcepts(projectId));
  }
  const response = await http.get<BackendConcepts>(
    `${API_PREFIX}/${encodeURIComponent(projectId)}/ontology/concepts`,
    { skipErrorToast: true },
  );
  return mapConcepts(response.data);
}

/**
 * Judges a concept over the draft made at `updateTime`: its item goes into the model or out of it
 * in the same write. An item that cannot go in yet keeps the judgment and is blocked.
 */
export async function judgeConcept(
  projectId: string,
  updateTime: number,
  judgment: { key: string; reason: string; verdict: ConceptVerdict },
): Promise<Concepts> {
  if (useMock) {
    const draft = mockDrafts[projectId];
    if (!draft || draft.update_time !== updateTime) {
      throw mockConflict("Stale", "The draft changed since it was read; reload it.");
    }
    const concept = mockConcepts(projectId).concepts.find((item) => item.key === judgment.key);
    const item = concept?.item;
    if (item) {
      const adopted =
        (item.kind === "object_types" &&
          (judgment.verdict === "object" || judgment.verdict === "event")) ||
        (item.kind === "relation_types" && judgment.verdict === "relation") ||
        (item.kind === "value_types" && judgment.verdict === "values");
      // An object type without an identity cannot go in yet: the judgment waits.
      const blocked =
        adopted &&
        item.kind === "object_types" &&
        Boolean(
          (draft.items.object_types ?? []).find((entry) => entry.id === item.id)?.needs_identity,
        );
      if (!blocked) {
        editMockDraft(projectId, item.kind, item.id, updateTime, {
          adopted,
          reason: judgment.reason,
        });
      }
    }
    recordMockConceptDecision(draft, "judge", judgment.key, judgment.verdict, judgment.reason);
    return wait(mockConcepts(projectId));
  }
  const response = await http.post<BackendConcepts>(
    `${API_PREFIX}/${encodeURIComponent(projectId)}/ontology/concepts:judge`,
    {
      key: judgment.key,
      reason: judgment.reason,
      update_time: updateTime,
      verdict: judgment.verdict,
    },
    { skipErrorToast: true },
  );
  return mapConcepts(response.data);
}

/** Merges a concept into another over the draft made at `updateTime`, or takes it out (no `into`). */
export async function mergeConcept(
  projectId: string,
  updateTime: number,
  key: string,
  into = "",
): Promise<Concepts> {
  if (useMock) {
    const draft = mockDrafts[projectId];
    if (!draft || draft.update_time !== updateTime) {
      throw mockConflict("Stale", "The draft changed since it was read; reload it.");
    }
    recordMockConceptDecision(draft, into ? "merge" : "unmerge", key, into || null);
    return wait(mockConcepts(projectId));
  }
  const response = await http.post<BackendConcepts>(
    `${API_PREFIX}/${encodeURIComponent(projectId)}/ontology/concepts:merge`,
    { into, key, update_time: updateTime },
    { skipErrorToast: true },
  );
  return mapConcepts(response.data);
}

/**
 * Adopts a change Ask AI proposed of the concepts over the draft made at `updateTime`: recorded as
 * the person's decision, as judging or merging by hand is.
 */
export async function reviseConcept(
  projectId: string,
  updateTime: number,
  revision: ConceptRevision,
): Promise<Concepts> {
  if (useMock) {
    switch (revision.field) {
      case "verdict":
        return judgeConcept(projectId, updateTime, {
          key: revision.value.key,
          reason: revision.reason,
          verdict: revision.value.verdict,
        });
      case "merge":
        return mergeConcept(projectId, updateTime, revision.value.key, revision.value.into);
      default: {
        // The mock renames an item; what else is proposed it leaves as it is.
        const draft = mockDrafts[projectId];
        if (!draft || draft.update_time !== updateTime) {
          throw mockConflict("Stale", "The draft changed since it was read; reload it.");
        }
        if (revision.field === "define") {
          const [kind, id] = revision.value.key.split("/");
          const item =
            kind === "object_types"
              ? draft.items.object_types?.find((entry) => entry.id === id)
              : kind === "relation_types"
                ? draft.items.relation_types?.find((entry) => entry.id === id)
                : undefined;
          if (item) {
            item.name = revision.value.name;
            // A definition not given stays, as bkn-project keeps it.
            item.description = revision.value.description || item.description;
          }
        }
        draft.update_time = Math.max(Date.now(), draft.update_time + 1);
        return wait(mockConcepts(projectId));
      }
    }
  }
  const response = await http.post<BackendConcepts>(
    `${API_PREFIX}/${encodeURIComponent(projectId)}/ontology/concepts:revise`,
    {
      field: revision.field,
      reason: revision.reason,
      update_time: updateTime,
      value: revision.value,
    },
    { skipErrorToast: true },
  );
  return mapConcepts(response.data);
}
