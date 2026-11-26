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

import type { ActionTypeCondition } from "@/modules/knowledge-network/types/action-type";

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
  /** Five fields: minute, hour, day of month, month, day of week; empty when `rate` is kept. */
  cron: string;
  /**
   * A fixed rate the platform runs the recognition action at, such as `90m`, that no cron here
   * says the same: the form cannot edit it, and a save that leaves the schedule alone keeps it.
   */
  rate?: string;
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

/** Where a check takes a value of a rule from: a constant, or the time or the day of the check. */
export type KnEventValueFrom = "const" | "check_time" | "check_date";

/**
 * A parameter of a Cypher rule. With `check_time` or `check_date` the value is an optional
 * ISO 8601 duration that moves the check's time or day, such as `-PT48H` or `-P1D`.
 */
export type KnEventRuleParameter = {
  value?: unknown;
  value_from: KnEventValueFrom;
};

export type KnEventCypherRule = {
  /** By name, as `$name` in the query; `$check_time` and `$check_date` are given by the platform. */
  parameters?: Record<string, KnEventRuleParameter>;
  query: string;
};

/**
 * What a recognition action selects its objects by, in the shape the form edits: a condition on
 * the subject's properties, a Cypher query, or a rule tool (a Cypher function of the network).
 */
export type KnEventRule =
  | { basis: "condition"; condition: ActionTypeCondition }
  | { basis: "cypher"; cypher: KnEventCypherRule }
  | { basis: "function"; tool: KnEventRuleTool };

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
  /** What the recognition action selects by. */
  recognition_basis?: KnEventRecognitionBasis;
  /**
   * The recognition action's rule, in the shape the form edits. Null without an action, and for a
   * basis the form does not edit (a metric).
   */
  rule?: KnEventRule | null;
  /** The recognition action's function target, when it selects by a rule tool. */
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
  /** The rule of a rule class's recognition action. */
  rule?: KnEventRule | null;
  severity?: string;
  source: KnEventSource;
  subject: string;
};

/**
 * What a replace sends. Every changeable field is sent: one left out takes its zero value. A
 * `rule` replaces the recognition action, whatever it selected by; a `rule` of null leaves the
 * action as it is.
 */
export type KnEventTypeUpdate = Omit<KnEventTypeInput, "code" | "source">;

/** One object a trial found. */
export type KnEventTrialHit = {
  key: string;
  name: string;
};

/** What a recognition rule would find if it checked now, before it is saved. */
export type KnEventRuleTrialResult = {
  /** All objects found, also those not listed in `hits`. */
  hit_count: number;
  /** The first 200 hits. */
  hits: KnEventTrialHit[];
  /** The selection was cut short; a check would cover only the objects it kept. */
  limited: boolean;
  /** A row filter hid objects from the caller. Absent when the rule cannot tell (a function). */
  row_filter_applied?: boolean;
};

/** The unsaved recognition rule a trial runs. */
export type KnEventRuleTrialInput = {
  check_schedule: KnEventCheckSchedule;
  /** The event class; may be empty while a new class has no code yet. */
  code: string;
  name: string;
  rule: KnEventRule;
  subject: string;
};

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
