/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "@/app/locales/i18n";
import {
  extractRequestErrorDetails,
  readErrorCode,
  registerErrorCodeMessage,
} from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import { unwrapSingleEntryResponse, type SingleEntryResponse } from "@/framework/request/normalize";
import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import {
  mapFunctionContent,
  type BackendMetadata,
} from "@/modules/execution-factory/utils/metadata-content";
import {
  logServiceFallback,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";
import { deleteKnowledgeNetworkActionType } from "@/modules/knowledge-network/services/action-type.service";
import { deleteKnowledgeNetworkObjectType } from "@/modules/knowledge-network/services/object-type.service";
import type { ActionTypeCondition } from "@/modules/knowledge-network/types/action-type";
import type {
  KnEventCheckSchedule,
  KnEventCheckSubject,
  KnEventHandlingAction,
  KnEventHandlingCandidate,
  KnEventRecognitionBasis,
  KnEventRule,
  KnEventRuleCheck,
  KnEventRuleCheckResult,
  KnEventRuleParameter,
  KnEventRuleTool,
  KnEventRuleToolOption,
  KnEventRuleTrial,
  KnEventRuleTrialInput,
  KnEventRuleTrialResult,
  KnEventType,
  KnEventTypeInput,
  KnEventTypeUpdate,
} from "@/modules/knowledge-network/types/event-type";
import {
  mapActionTypeConditionFromBackend,
  toBackendActionCondition,
  type BackendActionCondition,
} from "@/modules/knowledge-network/utils/action-type-condition";

// The backend's text for a taken ID names only the ID; a create is also refused when the network
// has an object type with the same name.
registerErrorCodeMessage("BknBackend.KnEvent.EventTypeExisted", () =>
  i18n.t("knowledgeNetwork.eventClasses.errors.existed"),
);

/**
 * An event class is an object type of kind `event`; its recognition is a record-event action type
 * bound to it. This service keeps the `KnEventType` shape the components use and composes it from
 * the two, plus the platform schedule that "check now" runs.
 */

type BackendEventConfig = {
  handling_action?: KnEventHandlingAction;
  handling_note?: string;
  merge_hours?: number;
  severity?: string;
  source?: "rule" | "report";
  subject?: string;
};

type BackendAccount = { id?: string; name?: string; type?: string };

type BackendEventClass = {
  color?: string;
  comment?: string;
  concept_groups?: unknown;
  create_time?: number;
  creator?: BackendAccount;
  event?: BackendEventConfig;
  id: string;
  kinds?: string[];
  icon?: string;
  name?: string;
  tags?: string[];
  update_time?: number;
  updater?: BackendAccount;
};

/** One argument of a recognition action's target. */
export type BackendTargetParameter = {
  value?: unknown;
  value_from?: "const" | "check_time" | "check_date";
};

type BackendEventTargets = {
  cypher?: { parameters?: Record<string, BackendTargetParameter>; query?: string };
  function?: {
    box_id: string;
    parameters?: Record<string, BackendTargetParameter>;
    tool_id: string;
  };
  metric?: Record<string, unknown>;
};

type BackendRecognitionAction = {
  action_type?: string;
  color?: string;
  comment?: string;
  condition?: BackendActionCondition;
  execution_subject?: BackendAccount;
  icon?: string;
  id: string;
  name?: string;
  object_type_id?: string;
  operation_config?: {
    event_class?: string;
    targets?: BackendEventTargets;
    type?: string;
  };
  rule_version?: string;
  schedule?: { expression?: string; timezone?: string; type?: string };
  tags?: string[];
};

type BackendTrial = {
  hit_count?: number;
  limited?: boolean;
  row_filter_applied?: boolean;
};

type BackendTrialResponse = {
  event?: {
    hit_count?: number;
    hits?: Array<{ key?: string; name?: string }>;
    limited?: boolean;
    row_filter_applied?: boolean;
    subject?: string;
  };
};

type BackendActionSchedule = {
  action_type_id?: string;
  id: string;
  next_run_time?: number;
  source?: string;
};

type BackendPage<T> = { entries?: T[]; total_count?: number };

const BASE = "/bkn-backend/v1/knowledge-networks";
const QUERY_BASE = "/ontology-query/v1/knowledge-networks";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const DEFAULT_TIMEZONE = "Asia/Shanghai";
const RECOGNIZED_BY_ACTION = "BknBackend.KnEvent.RecognizedByAction";

function objectTypesPath(networkId: string) {
  return `${BASE}/${encodeURIComponent(networkId)}/object-types`;
}

function objectTypePath(networkId: string, id: string) {
  return `${objectTypesPath(networkId)}/${encodeURIComponent(id)}`;
}

function actionTypesPath(networkId: string) {
  return `${BASE}/${encodeURIComponent(networkId)}/action-types`;
}

function actionTypePath(networkId: string, id: string) {
  return `${actionTypesPath(networkId)}/${encodeURIComponent(id)}`;
}

function actionSchedulesPath(networkId: string) {
  return `${BASE}/${encodeURIComponent(networkId)}/action-schedules`;
}

/** The ID the recognition action of an event class gets when it is created. */
export function recognitionActionIdOf(classId: string) {
  return `${classId}_recognition`;
}

/** Reads a list in pages of 100, as the other definition lists do. */
async function readAll<T>(path: string, params: Record<string, unknown>): Promise<T[]> {
  const entries: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await http.get<BackendPage<T>>(path, {
      params: { ...params, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      skipErrorToast: true,
    });
    const batch = response.data.entries ?? [];
    entries.push(...batch);
    if (batch.length < PAGE_SIZE || entries.length >= (response.data.total_count ?? Infinity)) {
      break;
    }
  }
  return entries;
}

/** An event class argument in the form's shape from the backend's. */
export function parameterFromBackend(parameter: BackendTargetParameter | undefined): unknown {
  if (!parameter) return undefined;
  const from = parameter.value_from ?? "const";
  if (from === "check_date" && (parameter.value === undefined || parameter.value === "")) {
    return { check_time: "date" };
  }
  if (from === "const") return parameter.value;
  // A check time, or a check day moved by a duration, has no form of its own: kept as it is.
  return { value: parameter.value, value_from: from };
}

/** A form argument in the backend's shape: the day of the check, or a constant. */
export function parameterToBackend(value: unknown): BackendTargetParameter {
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (record.check_time === "date") return { value_from: "check_date" };
    if (
      record.value_from === "check_time" ||
      record.value_from === "check_date" ||
      record.value_from === "const"
    ) {
      return {
        ...(record.value === undefined ? {} : { value: record.value }),
        value_from: record.value_from,
      };
    }
  }
  return { value, value_from: "const" };
}

function ruleToolFromBackend(fn: NonNullable<BackendEventTargets["function"]>): KnEventRuleTool {
  const parameters = Object.fromEntries(
    Object.entries(fn.parameters ?? {}).map(([name, parameter]) => [
      name,
      parameterFromBackend(parameter),
    ]),
  );
  return { box_id: fn.box_id, parameters, tool_id: fn.tool_id };
}

function ruleToolToBackend(tool: KnEventRuleTool): NonNullable<BackendEventTargets["function"]> {
  const entries = Object.entries(tool.parameters ?? {});
  return {
    box_id: tool.box_id,
    ...(entries.length
      ? {
          parameters: Object.fromEntries(
            entries.map(([name, value]) => [name, parameterToBackend(value)]),
          ),
        }
      : {}),
    tool_id: tool.tool_id,
  };
}

function basisOf(action: BackendRecognitionAction): KnEventRecognitionBasis {
  const targets = action.operation_config?.targets;
  if (targets?.function) return "function";
  if (targets?.cypher) return "cypher";
  if (targets?.metric) return "metric";
  return "condition";
}

function cypherParameterFromBackend(parameter: BackendTargetParameter): KnEventRuleParameter {
  return {
    ...(parameter.value === undefined ? {} : { value: parameter.value }),
    value_from: parameter.value_from ?? "const",
  };
}

function cypherParameterToBackend(parameter: KnEventRuleParameter): BackendTargetParameter {
  // A check time or day without a duration is the check's own.
  const empty =
    parameter.value === undefined || (typeof parameter.value === "string" && !parameter.value);
  return {
    ...(empty && parameter.value_from !== "const" ? {} : { value: parameter.value }),
    value_from: parameter.value_from,
  };
}

function mapValues<T, U>(record: Record<string, T> | undefined, map: (value: T) => U) {
  const entries = Object.entries(record ?? {});
  return entries.length
    ? Object.fromEntries(entries.map(([name, value]) => [name, map(value)]))
    : undefined;
}

/** A recognition action's rule in the form's shape; null for a basis the form does not edit. */
export function ruleFromBackend(action: BackendRecognitionAction): KnEventRule | null {
  const targets = action.operation_config?.targets;
  if (targets?.function) return { basis: "function", tool: ruleToolFromBackend(targets.function) };
  if (targets?.cypher) {
    const parameters = mapValues(targets.cypher.parameters, cypherParameterFromBackend);
    return {
      basis: "cypher",
      cypher: { query: targets.cypher.query ?? "", ...(parameters ? { parameters } : {}) },
    };
  }
  if (targets?.metric) return null;
  const condition = mapActionTypeConditionFromBackend(action.condition);
  return condition ? { basis: "condition", condition } : null;
}

/** A condition whose every row is on the subject, as the backend requires of a recognition action. */
function onSubject(condition: ActionTypeCondition, subject: string): ActionTypeCondition {
  return {
    ...condition,
    objectTypeId: subject,
    ...(condition.subConditions
      ? { subConditions: condition.subConditions.map((item) => onSubject(item, subject)) }
      : {}),
  };
}

/**
 * A rule in the backend's shape. A recognition action selects by its condition or by exactly one
 * target, never both: the condition is sent only without targets.
 */
export function ruleToBackend(
  rule: KnEventRule,
  subject: string,
): { condition?: BackendActionCondition; targets?: BackendEventTargets } {
  switch (rule.basis) {
    case "condition":
      return { condition: toBackendActionCondition(onSubject(rule.condition, subject)) };
    case "cypher": {
      const parameters = mapValues(rule.cypher.parameters, cypherParameterToBackend);
      return {
        targets: {
          cypher: { query: rule.cypher.query, ...(parameters ? { parameters } : {}) },
        },
      };
    }
    case "function":
      return { targets: { function: ruleToolToBackend(rule.tool) } };
  }
}

/**
 * A fixed rate in the cron the form edits, when one says the same thing: a step that divides an
 * hour or a day evenly. Any other rate has no cron of the same meaning and shows as none.
 */
export function cronOfFixedRate(expression: string): string | undefined {
  const match = /^(\d+)([mhd])$/.exec(expression.trim());
  if (!match) return undefined;
  const minutes = Number(match[1]) * { d: 1440, h: 60, m: 1 }[match[2] as "d" | "h" | "m"];
  if (minutes === 1440) return "0 0 * * *";
  if (minutes > 0 && minutes < 60 && 60 % minutes === 0) return `*/${minutes} * * * *`;
  const hours = minutes / 60;
  if (Number.isInteger(hours) && hours > 0 && hours < 24 && 24 % hours === 0) {
    return hours === 1 ? "0 * * * *" : `0 */${hours} * * *`;
  }
  return undefined;
}

function scheduleFromBackend(action: BackendRecognitionAction): KnEventCheckSchedule | null {
  const schedule = action.schedule;
  if (!schedule?.expression) return null;
  const timezone = schedule.timezone || undefined;
  if (schedule.type === "FIX_RATE") {
    const cron = cronOfFixedRate(schedule.expression);
    return cron ? { cron, timezone } : null;
  }
  if (schedule.type && schedule.type !== "CRON") return null;
  return { cron: schedule.expression, timezone };
}

function accountFromBackend(account: BackendAccount | undefined): KnEventCheckSubject | null {
  return account?.id || account?.name
    ? { id: account.id, name: account.name, type: account.type }
    : null;
}

function trialFromBackend(trial: BackendTrial | undefined): KnEventRuleTrial | undefined {
  if (!trial) return undefined;
  return {
    hits: trial.hit_count,
    limited: trial.limited,
    ...(trial.row_filter_applied === undefined
      ? {}
      : { row_filter_applied: trial.row_filter_applied }),
  };
}

function isEventClass(record: BackendEventClass) {
  return Array.isArray(record.kinds) && record.kinds.includes("event");
}

/** Composes a `KnEventType` from an event class, its recognition action and that action's schedule. */
export function eventTypeFromBackend(
  networkId: string,
  record: BackendEventClass,
  action?: BackendRecognitionAction,
  schedule?: BackendActionSchedule,
): KnEventType {
  const event = record.event ?? {};
  const fn = action?.operation_config?.targets?.function;
  const rule = action ? ruleFromBackend(action) : null;
  return {
    check_schedule: action ? scheduleFromBackend(action) : null,
    check_subject: accountFromBackend(action?.execution_subject),
    code: record.id,
    create_time: record.create_time,
    creator: record.creator?.name ?? record.creator?.id,
    handling_action: event.handling_action ?? null,
    handling_note: event.handling_note,
    kn_id: networkId,
    merge_hours: event.merge_hours,
    name: record.name ?? record.id,
    next_check_at: schedule?.next_run_time,
    object_type_id: record.id,
    recognition_action_id: action?.id,
    recognition_basis: action ? basisOf(action) : undefined,
    rule,
    rule_tool: fn ? ruleToolFromBackend(fn) : null,
    rule_version: action?.rule_version,
    severity: event.severity,
    source: event.source ?? "report",
    subject: event.subject,
    update_time: record.update_time,
    updater: record.updater?.name ?? record.updater?.id,
  };
}

async function listRecognitionActions(
  networkId: string,
  eventClass?: string,
): Promise<BackendRecognitionAction[]> {
  const actions = await readAll<BackendRecognitionAction>(actionTypesPath(networkId), {
    ...(eventClass ? { event_class: eventClass } : {}),
    operation_kind: "event",
  });
  // The filters apply on the backend; this keeps a backend that ignores them from mixing in others.
  return actions.filter(
    (action) =>
      action.operation_config?.type === "event" &&
      (!eventClass || action.operation_config.event_class === eventClass),
  );
}

type BackendHandlingCandidate = {
  id: string;
  name?: string;
  object_type_id?: string;
  operation_config?: { type?: string };
  parameters?: { comment?: string; name?: string; type?: string; value_from?: string }[];
};

/**
 * The action types that can handle the events of a class about `subject`: those that act on it,
 * other than recognition actions, which record events.
 */
export async function listKnEventHandlingCandidates(
  networkId: string,
  subject: string,
): Promise<KnEventHandlingCandidate[]> {
  const actions = await readAll<BackendHandlingCandidate>(actionTypesPath(networkId), {
    object_type_id: subject,
  });
  return actions
    .filter(
      (action) => action.object_type_id === subject && action.operation_config?.type !== "event",
    )
    .map((action) => ({
      id: action.id,
      inputs: (action.parameters ?? [])
        .filter((parameter) => parameter.name && (parameter.value_from ?? "input") === "input")
        .map((parameter) => ({
          ...(parameter.comment ? { comment: parameter.comment } : {}),
          name: parameter.name as string,
          ...(parameter.type ? { type: parameter.type } : {}),
        })),
      name: action.name || action.id,
    }));
}

async function listPlatformSchedules(
  networkId: string,
  actionTypeId?: string,
): Promise<BackendActionSchedule[]> {
  const schedules = await readAll<BackendActionSchedule>(actionSchedulesPath(networkId), {
    ...(actionTypeId ? { action_type_id: actionTypeId } : {}),
  });
  return schedules.filter(
    (item) =>
      item.source === "action_type" && (!actionTypeId || item.action_type_id === actionTypeId),
  );
}

// -- Mock store -----------------------------------------------------------------------------

const mockEventTypes = new Map<string, KnEventType[]>();

function mockList(networkId: string) {
  const list = mockEventTypes.get(networkId) ?? [];
  mockEventTypes.set(networkId, list);
  return list;
}

/** What the platform keeps of a recognition action saved with a rule, in the mock. */
function mockRecognition(rule: KnEventRule, code: string) {
  return {
    check_subject: { id: "mock", name: "mock" },
    next_check_at: Date.now() + 3_600_000,
    recognition_action_id: recognitionActionIdOf(code),
    recognition_basis: rule.basis,
    rule,
    rule_tool: rule.basis === "function" ? rule.tool : null,
    trial: { hits: 3, limited: false },
  };
}

function mockTrial(): KnEventRuleTrialResult {
  const hits = [1, 2, 3].map((index) => ({ key: `mock-${index}`, name: `Mock ${index}` }));
  return { hit_count: hits.length, hits, limited: false, row_filter_applied: false };
}

// -- Reads ----------------------------------------------------------------------------------

export async function listKnEventTypes(networkId: string): Promise<KnEventType[]> {
  if (useMock) {
    return wait(mockList(networkId).map((item) => ({ ...item })));
  }
  const classes = (
    await readAll<BackendEventClass>(objectTypesPath(networkId), { kinds: "event" })
  ).filter(isEventClass);
  if (!classes.length) return [];
  const [actions, schedules] = await Promise.all([
    listRecognitionActions(networkId).catch((error) => {
      logServiceFallback("listKnEventTypes.actions", error, `networkId=${networkId}`);
      return [] as BackendRecognitionAction[];
    }),
    listPlatformSchedules(networkId).catch((error) => {
      logServiceFallback("listKnEventTypes.schedules", error, `networkId=${networkId}`);
      return [] as BackendActionSchedule[];
    }),
  ]);
  return classes.map((record) => {
    const action = actions.find((item) => item.operation_config?.event_class === record.id);
    const schedule = action
      ? schedules.find((item) => item.action_type_id === action.id)
      : undefined;
    return eventTypeFromBackend(networkId, record, action, schedule);
  });
}

export async function getKnEventType(networkId: string, code: string): Promise<KnEventType> {
  if (useMock) {
    const found = mockList(networkId).find((item) => item.code === code);
    if (!found) {
      throw new Error(i18n.t("common.notFound"));
    }
    return wait({ ...found });
  }
  const response = await http.get<SingleEntryResponse<BackendEventClass>>(
    objectTypePath(networkId, code),
  );
  const record = unwrapSingleEntryResponse(response.data);
  if (!record || !isEventClass(record)) {
    throw new Error(i18n.t("common.notFound"));
  }
  const [action] = await listRecognitionActions(networkId, code);
  let schedule: BackendActionSchedule | undefined;
  if (action) {
    schedule = (
      await listPlatformSchedules(networkId, action.id).catch(() => [] as BackendActionSchedule[])
    )[0];
  }
  return eventTypeFromBackend(networkId, record, action, schedule);
}

// -- Writes ---------------------------------------------------------------------------------

type EventClassFields = Pick<
  KnEventTypeInput,
  "handling_action" | "handling_note" | "merge_hours" | "name" | "severity" | "subject"
>;

/**
 * The object type's body. A create leaves empty fields out; a replace sends them, so a field the
 * form cleared is cleared.
 */
function eventClassBody(
  fields: EventClassFields,
  source: "rule" | "report",
  options: { id?: string; replace: boolean },
) {
  const { replace } = options;
  return {
    ...(options.id ? { id: options.id } : {}),
    event: {
      // A replace that leaves it out clears it.
      ...(fields.handling_action ? { handling_action: fields.handling_action } : {}),
      ...(replace || fields.handling_note ? { handling_note: fields.handling_note ?? "" } : {}),
      ...(replace || fields.merge_hours ? { merge_hours: fields.merge_hours ?? 0 } : {}),
      ...(replace || fields.severity ? { severity: fields.severity ?? "" } : {}),
      source,
      subject: fields.subject,
    },
    kinds: ["event"],
    name: fields.name,
  };
}

/**
 * The definition of a recognition action: it selects by the rule, on the subject, on the schedule.
 * The rule replaces what the stored action selected by; what the form does not edit is kept.
 */
function recognitionDefinition(
  existing: BackendRecognitionAction | undefined,
  classId: string,
  fields: Pick<KnEventTypeInput, "check_schedule" | "name" | "subject">,
  rule: KnEventRule,
) {
  const { condition, targets } = ruleToBackend(rule, fields.subject);
  return {
    action_type: "add",
    ...(existing?.color ? { color: existing.color } : {}),
    ...(existing?.comment ? { comment: existing.comment } : {}),
    ...(condition ? { condition } : {}),
    ...(existing?.icon ? { icon: existing.icon } : {}),
    id: existing?.id ?? recognitionActionIdOf(classId),
    name: existing?.name ?? `${fields.name} recognition`,
    object_type_id: fields.subject,
    operation_config: {
      event_class: classId,
      ...(targets ? { targets } : {}),
      type: "event",
    },
    schedule: {
      expression: fields.check_schedule?.cron ?? "",
      timezone: fields.check_schedule?.timezone || DEFAULT_TIMEZONE,
      type: "CRON",
    },
    ...(existing?.tags ? { tags: existing.tags } : {}),
  };
}

function recognitionBody(
  existing: BackendRecognitionAction | undefined,
  classId: string,
  fields: Pick<KnEventTypeInput, "check_schedule" | "name" | "subject">,
  rule: KnEventRule,
) {
  return { ...recognitionDefinition(existing, classId, fields, rule), branch: "main" };
}

async function createRecognitionAction(
  networkId: string,
  body: ReturnType<typeof recognitionBody>,
): Promise<KnEventRuleTrial | undefined> {
  const response = await http.post<Array<{ id?: string; trial?: BackendTrial }>>(
    actionTypesPath(networkId),
    { entries: [body] },
    { skipErrorToast: true },
  );
  return trialFromBackend(Array.isArray(response.data) ? response.data[0]?.trial : undefined);
}

export async function createKnEventType(
  networkId: string,
  input: KnEventTypeInput,
): Promise<KnEventType> {
  if (useMock) {
    const list = mockList(networkId);
    const { rule, ...fields } = input;
    const created: KnEventType = {
      ...fields,
      ...(fields.source === "rule" && rule
        ? mockRecognition(rule, input.code)
        : { rule: null, rule_tool: null }),
      kn_id: networkId,
      object_type_id: input.code,
    };
    list.push(created);
    return wait({ ...created });
  }
  await http.post(
    objectTypesPath(networkId),
    { entries: [eventClassBody(input, input.source, { id: input.code, replace: false })] },
    { skipErrorToast: true },
  );
  let trial: KnEventRuleTrial | undefined;
  if (input.source === "rule" && input.rule) {
    try {
      trial = await createRecognitionAction(
        networkId,
        recognitionBody(undefined, input.code, input, input.rule),
      );
    } catch (error) {
      // A class without its rule would never find an event: take it back, so a save is whole.
      try {
        await deleteKnowledgeNetworkObjectType(networkId, input.code);
      } catch (rollbackError) {
        logServiceFallback("createKnEventType.rollback", rollbackError, `code=${input.code}`);
      }
      throw error;
    }
  }
  const created = await getKnEventType(networkId, input.code);
  return { ...created, trial };
}

export async function updateKnEventType(
  networkId: string,
  code: string,
  update: KnEventTypeUpdate,
): Promise<KnEventType> {
  if (useMock) {
    const list = mockList(networkId);
    const index = list.findIndex((item) => item.code === code);
    if (index < 0) {
      throw new Error(i18n.t("common.notFound"));
    }
    const current = list[index];
    const { rule, ...fields } = update;
    // As on the platform: a rule replaces the recognition action, and no rule leaves it alone.
    const updated: KnEventType = {
      ...current,
      ...fields,
      ...(current?.source === "rule" && rule ? mockRecognition(rule, code) : { trial: undefined }),
      object_type_id: code,
    };
    list[index] = updated;
    return wait({ ...updated });
  }
  const response = await http.get<SingleEntryResponse<BackendEventClass>>(
    objectTypePath(networkId, code),
  );
  const stored = unwrapSingleEntryResponse(response.data);
  if (!stored || !isEventClass(stored)) {
    throw new Error(i18n.t("common.notFound"));
  }
  const source = stored.event?.source ?? "report";
  // An update replaces the object type: what the form does not edit is sent back as stored.
  const kept = Object.fromEntries(
    (["color", "comment", "concept_groups", "icon", "tags"] as const)
      .filter((field) => stored[field] !== undefined)
      .map((field) => [field, stored[field]]),
  );
  await http.put(
    objectTypePath(networkId, code),
    { ...kept, ...eventClassBody(update, source, { replace: true }) },
    { skipErrorToast: true },
  );

  let trial: KnEventRuleTrial | undefined;
  // A rule replaces the recognition action, whatever it selected by; no rule leaves it as it is.
  if (source === "rule" && update.rule) {
    const [action] = await listRecognitionActions(networkId, code);
    const body = recognitionBody(action, code, update, update.rule);
    if (action) {
      const result = await http.put<{ trial?: BackendTrial } | "" | undefined>(
        actionTypePath(networkId, action.id),
        body,
        { skipErrorToast: true },
      );
      const data = result.data;
      trial = trialFromBackend(typeof data === "object" && data !== null ? data.trial : undefined);
    } else {
      trial = await createRecognitionAction(networkId, body);
    }
  }
  const saved = await getKnEventType(networkId, code);
  return { ...saved, trial };
}

/**
 * Deletes an event class. The backend refuses a class with events first, and then a class its
 * recognition action records; only that second refusal deletes the action and tries again. When
 * the second try is refused as well (an event came in between), the action is created again so the
 * refusal does not leave the class without its rule.
 */
export async function deleteKnEventType(networkId: string, code: string): Promise<void> {
  if (useMock) {
    const list = mockList(networkId);
    mockEventTypes.set(
      networkId,
      list.filter((item) => item.code !== code),
    );
    await wait(null);
    return;
  }
  try {
    // The caller explains the refusals (events recorded, class in use) with their details.
    await deleteKnowledgeNetworkObjectType(networkId, code);
    return;
  } catch (error) {
    if (readErrorCode(error) !== RECOGNIZED_BY_ACTION) throw error;
  }
  const actions = await listRecognitionActions(networkId, code);
  for (const action of actions) {
    await deleteKnowledgeNetworkActionType(networkId, action.id);
  }
  try {
    await deleteKnowledgeNetworkObjectType(networkId, code);
  } catch (error) {
    for (const action of actions) {
      await restoreRecognitionAction(networkId, action);
    }
    throw error;
  }
}

async function restoreRecognitionAction(networkId: string, action: BackendRecognitionAction) {
  try {
    const body = {
      action_type: "add",
      branch: "main",
      ...(action.color ? { color: action.color } : {}),
      ...(action.comment ? { comment: action.comment } : {}),
      ...(action.condition ? { condition: action.condition } : {}),
      ...(action.icon ? { icon: action.icon } : {}),
      id: action.id,
      name: action.name,
      object_type_id: action.object_type_id,
      operation_config: action.operation_config,
      schedule: action.schedule,
      ...(action.tags ? { tags: action.tags } : {}),
    };
    await http.post(actionTypesPath(networkId), { entries: [body] }, { skipErrorToast: true });
  } catch (error) {
    logServiceFallback("deleteKnEventType.restore", error, `actionTypeId=${action.id}`);
  }
}

/**
 * Tries an unsaved recognition rule: what it would find if it checked now, as the caller, without
 * recording anything. A versioned network's rule reads the draft, where it is written.
 */
export async function trialKnEventRule(
  networkId: string,
  input: KnEventRuleTrialInput,
  options: { versioned: boolean },
): Promise<KnEventRuleTrialResult> {
  if (useMock) {
    return wait(mockTrial());
  }
  const response = await http.post<BackendTrialResponse>(
    `${QUERY_BASE}/${encodeURIComponent(networkId)}/action-trial`,
    recognitionDefinition(undefined, input.code, input, input.rule),
    { params: { branch: options.versioned ? "draft" : "main" }, skipErrorToast: true },
  );
  const event = response.data?.event ?? {};
  return {
    hit_count: event.hit_count ?? event.hits?.length ?? 0,
    hits: (event.hits ?? []).map((hit) => ({
      key: hit.key ?? "",
      name: hit.name || hit.key || "",
    })),
    limited: event.limited === true,
    ...(event.row_filter_applied === undefined
      ? {}
      : { row_filter_applied: event.row_filter_applied }),
  };
}

/**
 * Checks a rule class now: runs the platform's schedule of its recognition action once, as that
 * schedule runs on time. The run is asynchronous; the check shows in the last check afterwards.
 */
export async function checkKnEventType(
  networkId: string,
  code: string,
): Promise<KnEventRuleCheckResult> {
  if (useMock) {
    return wait({ execution_id: `mock-${code}` });
  }
  const [action] = await listRecognitionActions(networkId, code);
  if (!action) {
    throw new Error(i18n.t("knowledgeNetwork.eventClasses.recognition.noAction"));
  }
  const [schedule] = await listPlatformSchedules(networkId, action.id);
  if (!schedule) {
    throw new Error(i18n.t("knowledgeNetwork.eventClasses.recognition.noSchedule"));
  }
  const response = await http.post<KnEventRuleCheckResult>(
    `${actionSchedulesPath(networkId)}/${encodeURIComponent(schedule.id)}/run`,
    undefined,
    { skipErrorToast: true },
  );
  return response.data;
}

/**
 * Why an event class could not be saved or checked, for the page to show: the backend's
 * description with its details, or the text of an error the service raised itself. The requests
 * behind these do not toast, so this is the only place the user learns it.
 */
export function describeKnEventError(error: unknown): string {
  const details = extractRequestErrorDetails(error);
  const description = details.description || (error instanceof Error ? error.message : "");
  return details.details && details.details !== description
    ? `${description} ${details.details}`
    : description;
}

/** The last recorded check of each rule type; needs `query_data` on the network. */
export async function listKnEventRuleChecks(networkId: string): Promise<KnEventRuleCheck[]> {
  if (useMock) {
    return wait([]);
  }
  const response = await http.get<{ entries?: KnEventRuleCheck[] }>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/rule-checks`,
    { skipErrorToast: true },
  );
  return response.data.entries ?? [];
}

type BackendToolList = {
  data?: { has_next?: boolean; tools?: BackendTool[] };
  has_next?: boolean;
  tools?: BackendTool[];
};

type BackendTool = {
  description?: string;
  metadata?: BackendMetadata;
  name?: string;
  tool_id: string;
};

/** The largest page the tool box service returns; it refuses a larger one. */
const RULE_TOOL_PAGE_SIZE = 100;
/** Pages read at most, so a list that keeps reporting more cannot keep the form waiting. */
const RULE_TOOL_MAX_PAGES = 20;

async function listPublishedFunctionBoxes() {
  const boxes: ToolboxRecord[] = [];
  for (let page = 1; page <= RULE_TOOL_MAX_PAGES; page += 1) {
    const result = await listToolboxes({
      all: true,
      metadataType: "function",
      page,
      pageSize: RULE_TOOL_PAGE_SIZE,
      status: "published",
    });
    boxes.push(...result.items);
    if (result.items.length < RULE_TOOL_PAGE_SIZE || boxes.length >= result.total) break;
  }
  return boxes;
}

async function listEnabledTools(boxId: string) {
  const tools: BackendTool[] = [];
  for (let page = 1; page <= RULE_TOOL_MAX_PAGES; page += 1) {
    const response = await http.get<BackendToolList>(
      `/agent-operator-integration/v1/tool-box/${encodeURIComponent(boxId)}/tools/list`,
      {
        params: {
          all: true,
          box_id: boxId,
          page,
          page_size: RULE_TOOL_PAGE_SIZE,
          status: "enabled",
        },
        skipErrorToast: true,
      },
    );
    const entries = response.data.data?.tools ?? response.data.tools ?? [];
    tools.push(...entries);
    const hasNext = response.data.has_next ?? response.data.data?.has_next;
    if (entries.length < RULE_TOOL_PAGE_SIZE || hasNext === false) break;
  }
  return tools;
}

/**
 * The tools a rule of this network may use: enabled Cypher functions of the network that return a
 * table, in published tool boxes. The backend checks the same when the rule is saved.
 */
export async function listKnEventRuleTools(networkId: string): Promise<KnEventRuleToolOption[]> {
  if (useMock) {
    return wait([]);
  }
  const boxes = await listPublishedFunctionBoxes();
  const lists = await Promise.all(
    boxes.map(async (box) => {
      try {
        const tools = await listEnabledTools(box.boxId);
        return tools.flatMap((tool): KnEventRuleToolOption[] => {
          const content = mapFunctionContent(tool.metadata);
          if (
            content?.script_type !== "cypher" ||
            content.kn_id !== networkId ||
            content.result_shape !== "table"
          ) {
            return [];
          }
          return [
            {
              boxId: box.boxId,
              boxName: box.name,
              description: tool.description,
              parameters: (content.inputs ?? []).flatMap((input) =>
                input.name
                  ? [
                      {
                        description: input.description,
                        name: input.name,
                        required: input.required,
                        type: input.type,
                      },
                    ]
                  : [],
              ),
              toolId: tool.tool_id,
              toolName: tool.name ?? tool.tool_id,
            },
          ];
        });
      } catch (error) {
        // A box that cannot be read offers no tools; the others still can.
        logServiceFallback("listKnEventRuleTools", error, `boxId=${box.boxId}`);
        return [];
      }
    }),
  );
  return lists.flat();
}

/** Clears the mock store between tests. */
export function resetKnEventTypeMocksForTests() {
  mockEventTypes.clear();
}
