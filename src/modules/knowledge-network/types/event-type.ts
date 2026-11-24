/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Event classes of a knowledge network, in the shape the Studio components use. An event class is
 * an object type with `kinds: ["event"]` and an `event` block. Its recognition is a record-event
 * action type (`operation_config.type = "event"`) bound to the class, which the platform runs on
 * its schedule. `event-type.service.ts` composes the two into one `KnEventType`; `code` is the ID
 * of the object type.
 */

export type KnEventSource = "rule" | "report";

/**
 * A rule tool argument that each check replaces with the day of the check. It is the shape the
 * form edits; the backend keeps it as `{ value_from: "check_date" }`.
 */
export type KnEventCheckTimeArgument = { check_time: "date" };

export type KnEventRuleTool = {
  box_id: string;
  tool_id: string;
  /** By the tool's parameter names: a fixed value, or the day of the check. */
  parameters?: Record<string, unknown>;
};

export type KnEventCheckSchedule = {
  /** Five fields: minute, hour, day of month, month, day of week. */
  cron: string;
  /** IANA time zone; the backend takes `Asia/Shanghai` when it is empty. */
  timezone?: string;
};

export type KnEventCheckSubject = {
  id?: string;
  name?: string;
  type?: string;
};

/** What the recognition action found when a save ran it once. */
export type KnEventRuleTrial = {
  /** How many objects were found. */
  hits?: number;
  limited?: boolean;
  row_filter_applied?: boolean;
};

/** What the recognition action selects objects by. */
export type KnEventRecognitionBasis = "condition" | "cypher" | "function" | "metric";

export type KnEventType = {
  check_schedule?: KnEventCheckSchedule | null;
  /** The account the scheduled checks run as (the action type's `execution_subject`). */
  check_subject?: KnEventCheckSubject | null;
  /** The ID of the event class, which is the ID of its object type. */
  code: string;
  create_time?: number;
  creator?: string;
  handling_note?: string;
  kn_id?: string;
  merge_hours?: number;
  name: string;
  /** The platform schedule's next run, when the recognition action has one. */
  next_check_at?: number;
  /** The event class; the same as `code`. */
  object_type_id?: string;
  /** The recognition action type of a rule class; absent for a class without one. */
  recognition_action_id?: string;
  /**
   * What the recognition action selects by. Only `function` is edited by the form, as `rule_tool`;
   * a class with another basis keeps its action when the form saves without a rule tool.
   */
  recognition_basis?: KnEventRecognitionBasis;
  /** The recognition action's function target, in the shape the form edits. */
  rule_tool?: KnEventRuleTool | null;
  /** Names what the recognition action finds; kept by the platform. */
  rule_version?: string;
  severity?: string;
  source: KnEventSource;
  /** The object type the events are about. */
  subject?: string;
  /** What the save's trial run of the recognition action found; only on a save's result. */
  trial?: KnEventRuleTrial;
  update_time?: number;
  updater?: string;
};

/** What a create sends. `code` and `source` cannot change afterwards. */
export type KnEventTypeInput = {
  check_schedule?: KnEventCheckSchedule | null;
  /** The ID of the new object type: lowercase letters, digits, `_` and `-`, at most 64. */
  code: string;
  handling_note?: string;
  merge_hours?: number;
  name: string;
  rule_tool?: KnEventRuleTool | null;
  severity?: string;
  source: KnEventSource;
  subject: string;
};

/**
 * What a replace sends. Every changeable field is sent: one left out takes its zero value. A
 * `rule_tool` of null removes a function recognition action; a recognition action with another
 * basis is kept.
 */
export type KnEventTypeUpdate = Omit<KnEventTypeInput, "code" | "source">;

export type KnEventRuleCheck = {
  checked_by?: string;
  event_type: string;
  hits?: number;
  last_ok?: number;
  message?: string;
  rule_version?: string;
  status: "ok" | "unknown";
  time?: number;
};

/** A check now starts an execution of the platform schedule; it finishes in the background. */
export type KnEventRuleCheckResult = {
  execution_id: string;
};

/** A Cypher function of the network whose result is a table: what a rule may use. */
export type KnEventRuleToolOption = {
  boxId: string;
  boxName: string;
  description?: string;
  parameters: KnEventRuleToolParameter[];
  toolId: string;
  toolName: string;
};

export type KnEventRuleToolParameter = {
  description?: string;
  name: string;
  required?: boolean;
  type?: string;
};
