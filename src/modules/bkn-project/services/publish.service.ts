/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios, { AxiosError, type AxiosResponse } from "axios";

import { http } from "@/framework/request/http";
import { extractRequestErrorDetails, isRequestNotFound } from "@/framework/request/error-message";
import { defaultDevRuntimeUser } from "@/framework/runtime/dev-profile";
import {
  type BackendDraft,
  getDraft,
  mapDraft,
} from "@/modules/bkn-project/services/draft.service";
import { getProject } from "@/modules/bkn-project/services/project.service";
import {
  mockNextVersion,
  mockProjectRelease,
} from "@/modules/bkn-project/services/release.service";
import type { Draft, DraftTable } from "@/modules/bkn-project/types/draft";
import type {
  AffectedItem,
  CheckJoinResult,
  CheckKeyResult,
  CheckResults,
  ConfirmDraftInput,
  DataSourceCount,
  DataSourceState,
  IndexBuild,
  IndexItem,
  OntologyCheck,
  PendingItem,
  PendingQuestion,
  ProjectBlocker,
  ProjectIndex,
  ProjectNextAction,
  ProjectPending,
  ProjectStatus,
  UnderstandingCatalog,
  UnderstandingStatus,
  UnderstandInput,
  UnderstandSubmitted,
} from "@/modules/bkn-project/types/publish";

const API_PREFIX = "/bkn-project/v1/projects";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const ERROR_PREFIX = "BknProject.";

/** How often a running check is read again. */
export const CHECK_POLL_MS = 5000;
/** How often the index readiness is read again while a table is building. */
export const INDEX_POLL_MS = 10_000;
/** How often semantic understanding is read again while tables wait or run. */
export const UNDERSTANDING_POLL_MS = 10_000;
/** About how long semantic understanding takes per table: tables run one at a time. */
export const UNDERSTAND_SECONDS_PER_TABLE = 30;

type BackendTable = { catalog_id: string; name: string; reason?: string; resource_id: string };

type BackendDataSourceCount = { missing: number; state: DataSourceState; total: number };

const dataSourceCount = (item: BackendDataSourceCount): DataSourceCount => ({
  missing: item.missing,
  state: item.state,
  total: item.total,
});

type BackendStatus = {
  blockers: { code: string; count?: number; waiting_for: ProjectBlocker["waitingFor"] }[] | null;
  check?: { commit: string; current: boolean; status: string };
  confirmation?: { commit: string; current: boolean; time: number };
  data_sources?: {
    catalogs: BackendDataSourceCount;
    network: BackendDataSourceCount;
    tables: BackendDataSourceCount & { affected?: AffectedItem[] | null };
  };
  draft?: { decisions: number; placeholders: number; status: string; update_time: number };
  hints?: { code: string; count?: number; total?: number }[] | null;
  next_actions:
    | {
        accepts?: string[];
        action: string;
        allowed: boolean;
        discards_decisions?: number;
        reason?: string;
        retry_after_s?: number;
        suggested_version?: string;
      }[]
    | null;
  release?: { in_use: boolean; network_id: string; version: string };
  stage: ProjectStatus["stage"];
  stale: string[] | null;
  undecided: number;
  unresolved_conflicts?: number;
};

type BackendPending = {
  draft_update_time: number;
  items:
    | {
        because?: string;
        blocking: boolean;
        item_id: string;
        kind: string;
        name: string;
        needed_by?: { id: string; text: string }[];
        options?: { action: string; allowed: boolean; reason?: string; values?: string[] }[] | null;
        reason: string;
      }[]
    | null;
};

type BackendCountState = { reason?: string; state: CheckKeyResult["state"] };

type BackendCheck = {
  attempt: number;
  error: string;
  finish_time: number;
  results: {
    coverage: { counted: number; total: number };
    excluded_mapped: { field: string; object_type: string; property: string }[] | null;
    keys:
      | (BackendCountState & {
          duplicates: number;
          fields: string[] | null;
          nulls: number;
          object_type: string;
          rows: number;
        })[]
      | null;
    relations:
      | {
          joins:
            | (BackendCountState & {
                hit_rate: number;
                nulls: number;
                object_type: string;
                orphans: number;
                rows: number;
              })[]
            | null;
          relation_type: string;
        }[]
      | null;
  } | null;
  start_time: number;
  status: OntologyCheck["status"];
};

type BackendIndex = {
  counts: Record<string, number> | null;
  object_types:
    | {
        build?: { outcome: IndexBuild["outcome"]; reason?: string; task_id?: string; time: number };
        id: string;
        missing?: string[];
        name: string;
        state: IndexItem["state"];
        table: BackendTable;
        task?: { id: string; status: string };
      }[]
    | null;
  tasks_visible: boolean;
};

type BackendSubmitted = {
  catalogs: { catalog_id: string; permitted: boolean; tables: number }[] | null;
};

type BackendUnderstanding = {
  catalogs:
    | {
        catalog_id: string;
        counts: UnderstandingCatalog["counts"] | null;
        tables?:
          | {
              applied?: boolean;
              finish_time?: number;
              name: string;
              resource_id: string;
              status: UnderstandingStatus;
            }[]
          | null;
        visible: boolean;
      }[]
    | null;
};

const mapTable = (table: BackendTable): DraftTable => ({
  catalogId: table.catalog_id,
  name: table.name,
  ...(table.reason ? { reason: table.reason } : {}),
  resourceId: table.resource_id,
});

const countState = (item: BackendCountState) => ({
  ...(item.reason ? { reason: item.reason } : {}),
  state: item.state,
});

function mapStatus(status: BackendStatus): ProjectStatus {
  return {
    blockers: (status.blockers ?? []).map((blocker) => ({
      code: blocker.code,
      count: blocker.count ?? 0,
      waitingFor: blocker.waiting_for,
    })),
    check: status.check ? { current: status.check.current, status: status.check.status } : null,
    confirmation: status.confirmation
      ? { current: status.confirmation.current, time: status.confirmation.time }
      : null,
    dataSources: status.data_sources
      ? {
          catalogs: dataSourceCount(status.data_sources.catalogs),
          network: dataSourceCount(status.data_sources.network),
          tables: {
            ...dataSourceCount(status.data_sources.tables),
            affected: (status.data_sources.tables.affected ?? []).map((item) => ({
              id: item.id,
              kind: item.kind,
              name: item.name,
              table: item.table,
            })),
          },
        }
      : null,
    draft: status.draft
      ? {
          decisions: status.draft.decisions,
          placeholders: status.draft.placeholders,
          status: status.draft.status,
          updateTime: status.draft.update_time,
        }
      : null,
    hints: (status.hints ?? []).map((hint) => ({
      code: hint.code,
      count: hint.count ?? 0,
      total: hint.total ?? 0,
    })),
    nextActions: (status.next_actions ?? []).map((action) => ({
      accepts: action.accepts ?? [],
      action: action.action,
      allowed: action.allowed,
      discardsDecisions: action.discards_decisions ?? 0,
      ...(action.reason ? { reason: action.reason } : {}),
      ...(action.retry_after_s ? { retryAfterS: action.retry_after_s } : {}),
      ...(action.suggested_version ? { suggestedVersion: action.suggested_version } : {}),
    })),
    release: status.release
      ? {
          inUse: status.release.in_use,
          networkId: status.release.network_id,
          version: status.release.version,
        }
      : null,
    stage: status.stage,
    stale: status.stale ?? [],
    undecided: status.undecided,
    unresolvedConflicts: status.unresolved_conflicts ?? 0,
  };
}

function mapPending(pending: BackendPending): ProjectPending {
  return {
    draftUpdateTime: pending.draft_update_time,
    items: (pending.items ?? []).map((item): PendingItem => {
      const setKey = (item.options ?? []).find((option) => option.action === "set_incremental_key");
      return {
        blocking: item.blocking,
        ...(item.because ? { because: item.because } : {}),
        itemId: item.item_id,
        kind: item.kind,
        name: item.name,
        neededBy: (item.needed_by ?? []).map(({ id, text }) => ({ id, text })),
        reason: item.reason,
        ...(setKey
          ? {
              updateField: {
                allowed: setKey.allowed,
                ...(setKey.reason ? { reason: setKey.reason } : {}),
                values: setKey.values ?? [],
              },
            }
          : {}),
      };
    }),
  };
}

function mapCheck(check: BackendCheck): OntologyCheck {
  const results = check.results;
  return {
    attempt: check.attempt,
    error: check.error,
    finishTime: check.finish_time,
    results: results
      ? {
          coverage: results.coverage,
          excludedMapped: (results.excluded_mapped ?? []).map((item) => ({
            field: item.field,
            objectType: item.object_type,
            property: item.property,
          })),
          keys: (results.keys ?? []).map((key): CheckKeyResult => ({
            ...countState(key),
            duplicates: key.duplicates,
            fields: key.fields ?? [],
            nulls: key.nulls,
            objectType: key.object_type,
            rows: key.rows,
          })),
          relations: (results.relations ?? []).map((relation) => ({
            joins: (relation.joins ?? []).map((join): CheckJoinResult => ({
              ...countState(join),
              hitRate: join.hit_rate,
              nulls: join.nulls,
              objectType: join.object_type,
              orphans: join.orphans,
              rows: join.rows,
            })),
            relationType: relation.relation_type,
          })),
        }
      : null,
    startTime: check.start_time,
    status: check.status,
  };
}

function mapIndex(index: BackendIndex): ProjectIndex {
  return {
    counts: index.counts ?? {},
    objectTypes: (index.object_types ?? []).map((item) => ({
      build: item.build
        ? {
            outcome: item.build.outcome,
            ...(item.build.reason ? { reason: item.build.reason } : {}),
            time: item.build.time,
          }
        : null,
      id: item.id,
      missing: item.missing ?? [],
      name: item.name,
      state: item.state,
      table: mapTable(item.table),
      task: item.task ? { id: item.task.id, status: item.task.status } : null,
    })),
    tasksVisible: index.tasks_visible,
  };
}

function mapUnderstanding(understanding: BackendUnderstanding): UnderstandingCatalog[] {
  return (understanding.catalogs ?? []).map((catalog) => ({
    catalogId: catalog.catalog_id,
    counts: catalog.counts ?? {},
    tables: (catalog.tables ?? []).map((table) => ({
      applied: table.applied ?? false,
      finishTime: table.finish_time || null,
      name: table.name,
      resourceId: table.resource_id,
      status: table.status,
    })),
    visible: catalog.visible,
  }));
}

/** bkn-project's error code without its prefix, such as `Draft.Stale`; undefined for others. */
export function projectErrorCode(error: unknown): string | undefined {
  const { code } = extractRequestErrorDetails(error);
  return code?.startsWith(ERROR_PREFIX) ? code.slice(ERROR_PREFIX.length) : undefined;
}

/** The `error_details` of a refusal as bkn-project sent them, for the page to name what is wrong. */
export function projectErrorDetails(error: unknown): unknown {
  return axios.isAxiosError<{ error_details?: unknown }>(error)
    ? error.response?.data?.error_details
    : undefined;
}

/* ----------------------------- Mock (local development) ----------------------------- */
// The mock confirms the mock draft, then checks it and builds its tables over a few seconds.

const wait = async <T>(value: T, delay = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

const MOCK_CHECK_MS = 4000;
const MOCK_BUILD_MS = 6000;
const MOCK_UNDERSTAND_MS = 3000;

/** When the draft was confirmed, and when its check last started: checking again keeps the first. */
type MockConfirmation = { checkStart: number; time: number; updateTime: number };
const mockConfirmations: Record<string, MockConfirmation> = {};
const mockUnderstanding: Record<string, { start: number }> = {};
const mockRebuilds: Record<string, number> = {};

function mockRefusal(status: number, code: string, details?: unknown) {
  return new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: `${ERROR_PREFIX}${code}`, error_details: details },
    status,
  } as AxiosResponse);
}

const mockOwnerId = defaultDevRuntimeUser.id ?? "mock-user";

async function mockOwns(projectId: string) {
  const project = await getProject(projectId).catch(() => null);
  return project?.owner.id === mockOwnerId;
}

const adoptedObjects = (draft: Draft) => draft.items.objectTypes.filter((item) => item.adopted);

function mockPendingOf(draft: Draft) {
  const adopted = new Set(adoptedObjects(draft).map((item) => item.id));
  const needsIdentity = adoptedObjects(draft).filter((item) => item.needsIdentity);
  const unadoptedEnds = draft.items.relationTypes.filter(
    (item) => item.adopted && !(adopted.has(item.source) && adopted.has(item.target)),
  );
  const decided = new Set(draft.items.decisions.map((decision) => decision.itemId));
  const undecided = [
    ...draft.items.objectTypes
      .filter((item) => !item.adopted && !decided.has(item.id))
      .map((item) => ({ item, kind: "object_types" })),
    ...draft.items.relationTypes
      .filter((item) => !item.adopted && !decided.has(item.id))
      .map((item) => ({ item, kind: "relation_types" })),
  ];
  return { needsIdentity, undecided, unadoptedEnds };
}

function mockCheckOf(draft: Draft, confirmation: MockConfirmation): OntologyCheck {
  const finished = Date.now() - confirmation.checkStart >= MOCK_CHECK_MS;
  const keys = adoptedObjects(draft).map((item): CheckKeyResult => ({
    duplicates: item.key.computed
      ? Math.max(0, item.key.rows - item.key.distinct - item.key.nulls)
      : 0,
    fields: item.primaryKeys,
    nulls: item.key.nulls,
    objectType: item.id,
    rows: item.key.rows,
    state: item.key.computed ? "counted" : "not_counted",
    ...(item.key.computed ? {} : { reason: "several_fields" }),
  }));
  const relations = draft.items.relationTypes
    .filter((item) => item.adopted)
    .map((item) => ({
      joins: [
        {
          hitRate: item.evidence.hitRate,
          nulls: item.evidence.nulls,
          objectType: item.target,
          orphans: item.evidence.orphans,
          rows: item.evidence.rows,
          state: "counted" as const,
        },
      ],
      relationType: item.id,
    }));
  const results: CheckResults = {
    coverage: {
      counted: keys.filter((key) => key.state === "counted").length + relations.length,
      total: keys.length + relations.length,
    },
    excludedMapped: [],
    keys,
    relations,
  };
  const issues = keys.some((key) => key.duplicates || key.nulls);
  const partial = results.coverage.counted < results.coverage.total;
  return {
    attempt: 1,
    error: "",
    finishTime: finished ? confirmation.checkStart + MOCK_CHECK_MS : 0,
    results: finished ? results : null,
    startTime: confirmation.checkStart,
    status: !finished ? "running" : issues ? "issues" : partial ? "partial" : "passed",
  };
}

function mockIndexOf(projectId: string, draft: Draft): ProjectIndex {
  const confirmation = mockConfirmations[projectId];
  const builtAt = mockRebuilds[projectId] ?? confirmation?.time;
  const objects = adoptedObjects(draft);
  const items = objects.map((item, at): IndexItem => {
    // The last table has no update field, so the page shows a table the build cannot configure.
    const unconfigurable = objects.length > 1 && at === objects.length - 1;
    const built = builtAt !== undefined && Date.now() - builtAt >= MOCK_BUILD_MS;
    const base = { id: item.id, missing: [], name: item.name, table: item.table, task: null };
    if (unconfigurable) {
      return {
        ...base,
        build: confirmation
          ? { outcome: "not_configurable", reason: "incremental_fields", time: confirmation.time }
          : null,
        missing: ["incremental_fields"],
        state: "not_configured",
      };
    }
    if (builtAt === undefined) {
      return { ...base, build: null, state: "not_built" };
    }
    return {
      ...base,
      build: { outcome: "created", time: builtAt },
      state: built ? "ready" : "building",
      task: built ? null : { id: `task-${item.id}`, status: "running" },
    };
  });
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    counts[item.state] = (counts[item.state] ?? 0) + 1;
  });
  return { counts, objectTypes: items, tasksVisible: true };
}

async function mockStatus(projectId: string): Promise<ProjectStatus> {
  const draft = await getDraft(projectId);
  const owns = await mockOwns(projectId);
  const confirmation = mockConfirmations[projectId];
  const base: ProjectStatus = {
    blockers: [],
    check: null,
    confirmation: null,
    dataSources: null,
    hints: [],
    draft: draft
      ? {
          decisions: draft.items.decisions.length,
          placeholders: 0,
          status: draft.status,
          updateTime: draft.updateTime,
        }
      : null,
    nextActions: [],
    release: null,
    stage: "no_draft",
    stale: [],
    undecided: 0,
    unresolvedConflicts: 0,
  };
  // The mock's sources all exist: what is read is checked once there is a draft to read for.
  const adopted = draft && draft.status === "ready" ? adoptedObjects(draft).length : 0;
  const catalogs = (await getProject(projectId).catch(() => null))?.catalogIds.length ?? 0;
  const sources: ProjectStatus["dataSources"] =
    draft && draft.status !== "drafting"
      ? {
          catalogs: { missing: 0, state: catalogs ? "ok" : "not_bound", total: catalogs },
          network: { missing: 0, state: "ok", total: 1 },
          tables: {
            affected: [],
            missing: 0,
            state: adopted ? "ok" : "not_bound",
            total: adopted,
          },
        }
      : null;
  base.dataSources = sources;
  if (!draft || draft.status !== "ready") {
    return {
      ...base,
      stage: !draft ? "no_draft" : draft.status === "drafting" ? "drafting" : "draft_failed",
    };
  }
  const { needsIdentity, undecided, unadoptedEnds } = mockPendingOf(draft);
  const blockers: ProjectBlocker[] = [
    ...(needsIdentity.length
      ? [{ code: "needs_identity", count: needsIdentity.length, waitingFor: "editor" as const }]
      : []),
    ...(unadoptedEnds.length
      ? [{ code: "unadopted_ends", count: unadoptedEnds.length, waitingFor: "editor" as const }]
      : []),
    ...(adoptedObjects(draft).length
      ? []
      : [{ code: "nothing_adopted", count: 0, waitingFor: "editor" as const }]),
  ];
  const current = confirmation?.updateTime === draft.updateTime;
  const check = confirmation ? mockCheckOf(draft, confirmation) : null;
  const confirm: ProjectNextAction = {
    accepts: [
      ...(draft.items.unreadable.length ? ["partial_draft"] : []),
      ...(undecided.length ? ["undecided_items"] : []),
    ],
    action: "confirm_draft",
    allowed: owns && !blockers.length,
    discardsDecisions: 0,
    ...(!owns ? { reason: "not_owner" } : blockers.length ? { reason: blockers[0].code } : {}),
  };
  const stage: ProjectStatus["stage"] = blockers.length
    ? "deciding"
    : !current || !check
      ? "ready_to_confirm"
      : check.status === "running"
        ? "checking"
        : check.status === "passed"
          ? "confirmed"
          : "check_needs_attention";
  // Once checked, the confirmation is reviewed and published; once published, consumers switch.
  const published = mockProjectRelease(projectId);
  if (current && published && confirmation && published.createTime >= confirmation.time) {
    return {
      ...base,
      check: check ? { current, status: check.status } : null,
      confirmation: { current, time: confirmation.time },
      // Once consumers use the release, it may be rolled back; the rollback says who may.
      nextActions: published.inUse
        ? [{ accepts: [], action: "review_rollback", allowed: true, discardsDecisions: 0 }]
        : [
            {
              accepts: [],
              action: "switch_consumers",
              allowed: owns,
              discardsDecisions: 0,
              ...(owns ? {} : { reason: "not_owner" }),
            },
          ],
      release: {
        inUse: published.inUse,
        networkId: published.latest.networkId,
        version: published.latest.version,
      },
      stage: "published",
    };
  }
  const review: ProjectNextAction = {
    accepts: [],
    action: "review_release",
    allowed: true,
    discardsDecisions: 0,
    suggestedVersion: mockNextVersion(),
  };
  return {
    ...base,
    blockers,
    check: check ? { current, status: check.status } : null,
    confirmation: confirmation ? { current, time: confirmation.time } : null,
    nextActions: !current ? [confirm] : stage === "confirmed" ? [review] : [],
    stage,
    stale: confirmation && !current ? ["confirmation_outdated", "check_outdated"] : [],
    undecided: undecided.length,
  };
}

/** The mock's scenario questions that need a drafted item. */
const MOCK_NEEDED_BY: Record<string, PendingQuestion[]> = {
  material_bom: [{ id: "q3", text: "Which products use part P-100?" }],
};

async function mockPending(projectId: string): Promise<ProjectPending> {
  const draft = await getDraft(projectId);
  if (!draft || draft.status !== "ready") {
    return { draftUpdateTime: draft?.updateTime ?? 0, items: [] };
  }
  const { needsIdentity, undecided, unadoptedEnds } = mockPendingOf(draft);
  return {
    draftUpdateTime: draft.updateTime,
    items: [
      ...needsIdentity.map((item) => ({
        blocking: true,
        itemId: item.id,
        kind: "object_types",
        name: item.name,
        neededBy: MOCK_NEEDED_BY[item.id] ?? [],
        reason: "needs_identity",
      })),
      ...unadoptedEnds.map((item) => ({
        blocking: true,
        itemId: item.id,
        kind: "relation_types",
        name: item.name,
        neededBy: MOCK_NEEDED_BY[item.id] ?? [],
        reason: "unadopted_ends",
      })),
      ...undecided.map(({ item, kind }) => ({
        because: "needsIdentity" in item && item.needsIdentity ? "needs_identity" : "not_adopted",
        blocking: false,
        itemId: item.id,
        kind,
        name: item.name,
        neededBy: MOCK_NEEDED_BY[item.id] ?? [],
        reason: "undecided",
      })),
    ],
  };
}

async function mockConfirm(projectId: string, input: ConfirmDraftInput): Promise<Draft> {
  const draft = await getDraft(projectId);
  if (!(await mockOwns(projectId))) {
    throw mockRefusal(403, "Draft.NotOwner");
  }
  if (!draft || draft.status !== "ready") {
    throw mockRefusal(409, "Draft.NotReady");
  }
  if (draft.updateTime !== input.updateTime) {
    throw mockRefusal(409, "Draft.Stale");
  }
  const { needsIdentity, undecided, unadoptedEnds } = mockPendingOf(draft);
  if (needsIdentity.length || unadoptedEnds.length) {
    throw mockRefusal(409, "Draft.HasPending", {
      ...(needsIdentity.length ? { needs_identity: needsIdentity.map((item) => item.id) } : {}),
      ...(unadoptedEnds.length ? { unadopted_ends: unadoptedEnds.map((item) => item.id) } : {}),
    });
  }
  if (draft.items.unreadable.length && !input.acceptPartial) {
    throw mockRefusal(
      409,
      "Draft.PartialNotAccepted",
      draft.items.unreadable.map((table) => table.resourceId),
    );
  }
  if (!adoptedObjects(draft).length) {
    throw mockRefusal(400, "Draft.NothingAdopted");
  }
  if (undecided.length && !input.acceptUndecided) {
    throw mockRefusal(
      409,
      "Draft.UndecidedNotAccepted",
      undecided.map(({ item, kind }) => `${kind}/${item.id}`),
    );
  }
  const now = Date.now();
  mockConfirmations[projectId] = { checkStart: now, time: now, updateTime: draft.updateTime };
  delete mockRebuilds[projectId];
  return draft;
}

async function mockUnderstandingOf(projectId: string): Promise<UnderstandingCatalog[]> {
  const project = await getProject(projectId);
  const draft = await getDraft(projectId);
  // Every table drafting read is understood, adopted or not, one after another.
  const tables = draft?.items.objectTypes.map((item) => item.table) ?? [];
  const run = mockUnderstanding[projectId];
  const done = run ? Math.floor((Date.now() - run.start) / MOCK_UNDERSTAND_MS) : -1;
  const understood = tables.map((table, at) => {
    const status: UnderstandingStatus = !run
      ? "not_started"
      : at < done
        ? "completed"
        : at === done
          ? "running"
          : "pending";
    return {
      applied: status === "completed",
      catalogId: table.catalogId,
      finishTime: run && status === "completed" ? run.start + (at + 1) * MOCK_UNDERSTAND_MS : null,
      name: table.name,
      resourceId: table.resourceId,
      status,
    };
  });
  return project.catalogIds.map((catalogId) => {
    const own = understood
      .filter((table) => table.catalogId === catalogId)
      .map(({ applied, finishTime, name, resourceId, status }) => ({
        applied,
        finishTime,
        name,
        resourceId,
        status,
      }));
    const counts: UnderstandingCatalog["counts"] = {};
    own.forEach((table) => {
      counts[table.status] = (counts[table.status] ?? 0) + 1;
    });
    return { catalogId, counts, tables: own, visible: true };
  });
}

/* ------------------------------- API ------------------------------- */

const projectPath = (projectId: string) => `${API_PREFIX}/${encodeURIComponent(projectId)}`;

/** Where the project stands for the caller, and what they may do next. */
export async function getProjectStatus(projectId: string): Promise<ProjectStatus> {
  if (useMock) {
    return wait(await mockStatus(projectId));
  }
  const response = await http.get<BackendStatus>(`${projectPath(projectId)}/status`, {
    skipErrorToast: true,
  });
  return mapStatus(response.data);
}

/** What confirming checks for, and the items drafting left out that nobody decided on. */
export async function getProjectPending(projectId: string): Promise<ProjectPending> {
  if (useMock) {
    return wait(await mockPending(projectId));
  }
  try {
    const response = await http.get<BackendPending>(`${projectPath(projectId)}/pending`, {
      skipErrorToast: true,
    });
    return mapPending(response.data);
  } catch (error) {
    // 404 Draft.NotFound before the first draft: nothing waits.
    if (isRequestNotFound(error)) {
      return { draftUpdateTime: 0, items: [] };
    }
    throw error;
  }
}

/**
 * Confirms the ready draft read at `updateTime`: what is adopted is written to the project's
 * branch, then checked and indexed in the background. Replies the draft.
 */
export async function confirmDraft(projectId: string, input: ConfirmDraftInput): Promise<Draft> {
  if (useMock) {
    return wait(await mockConfirm(projectId, input));
  }
  const response = await http.post<BackendDraft>(
    `${projectPath(projectId)}/ontology/draft:confirm`,
    {
      accept_partial: input.acceptPartial ?? false,
      accept_undecided: input.acceptUndecided ?? false,
      accept_unresolved_conflicts: input.acceptUnresolvedConflicts ?? false,
      update_time: input.updateTime,
    },
    { skipErrorToast: true },
  );
  return mapDraft(response.data);
}

/** The check of the last confirmation, or null before the first one. */
export async function getOntologyCheck(projectId: string): Promise<OntologyCheck | null> {
  if (useMock) {
    const draft = await getDraft(projectId);
    const confirmation = mockConfirmations[projectId];
    return wait(draft && confirmation ? mockCheckOf(draft, confirmation) : null);
  }
  try {
    const response = await http.get<BackendCheck>(`${projectPath(projectId)}/ontology/check`, {
      skipErrorToast: true,
    });
    return mapCheck(response.data);
  } catch (error) {
    if (isRequestNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Checks the last confirmation again, as the caller; only the owner may. */
export async function runOntologyCheck(projectId: string): Promise<OntologyCheck> {
  if (useMock) {
    const draft = await getDraft(projectId);
    const confirmation = mockConfirmations[projectId];
    if (!draft || !confirmation) {
      throw mockRefusal(409, "Check.NothingConfirmed");
    }
    confirmation.checkStart = Date.now();
    return wait(mockCheckOf(draft, confirmation));
  }
  const response = await http.post<BackendCheck>(
    `${projectPath(projectId)}/ontology/check:run`,
    undefined,
    { skipErrorToast: true },
  );
  return mapCheck(response.data);
}

/** Whether the adopted object types' tables have a local index, or null before the first draft. */
export async function getOntologyIndex(projectId: string): Promise<ProjectIndex | null> {
  if (useMock) {
    const draft = await getDraft(projectId);
    return wait(draft ? mockIndexOf(projectId, draft) : null);
  }
  try {
    const response = await http.get<BackendIndex>(`${projectPath(projectId)}/ontology/index`, {
      skipErrorToast: true,
    });
    return mapIndex(response.data);
  } catch (error) {
    if (isRequestNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Builds again, as the caller, the indexes the last confirmation could not start; owner only. */
export async function buildOntologyIndex(projectId: string): Promise<ProjectIndex> {
  if (useMock) {
    const draft = await getDraft(projectId);
    if (!draft || !mockConfirmations[projectId]) {
      throw mockRefusal(409, "Index.NothingConfirmed");
    }
    mockRebuilds[projectId] = Date.now();
    return wait(mockIndexOf(projectId, draft));
  }
  const response = await http.post<BackendIndex>(
    `${projectPath(projectId)}/ontology/index:build`,
    undefined,
    { skipErrorToast: true },
  );
  return mapIndex(response.data);
}

/** Starts semantic understanding of the project's catalogs; owner only. Replies what was asked. */
export async function understandCatalogs(
  projectId: string,
  input: UnderstandInput = {},
): Promise<UnderstandSubmitted[]> {
  if (useMock) {
    const before = await mockUnderstandingOf(projectId);
    mockUnderstanding[projectId] = { start: Date.now() };
    return wait(
      before.map((catalog) => ({
        catalogId: catalog.catalogId,
        permitted: true,
        tables: catalog.tables.filter((table) => input.all || table.status === "not_started")
          .length,
      })),
    );
  }
  const response = await http.post<BackendSubmitted>(
    `${projectPath(projectId)}/catalogs:understand`,
    {
      ...(input.all ? { all: true } : {}),
      ...(input.applyMode ? { apply_mode: input.applyMode } : {}),
    },
    { skipErrorToast: true },
  );
  return (response.data.catalogs ?? []).map((catalog) => ({
    catalogId: catalog.catalog_id,
    permitted: catalog.permitted,
    tables: catalog.tables,
  }));
}

/** The semantic understanding of each table of the project's catalogs, read as the caller. */
export async function getUnderstanding(projectId: string): Promise<UnderstandingCatalog[]> {
  if (useMock) {
    return wait(await mockUnderstandingOf(projectId));
  }
  const response = await http.get<BackendUnderstanding>(
    `${projectPath(projectId)}/catalogs/understanding`,
    { skipErrorToast: true },
  );
  return mapUnderstanding(response.data);
}
