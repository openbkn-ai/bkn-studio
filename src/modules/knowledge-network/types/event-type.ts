/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Event types of a knowledge network, as bkn-backend's event module keeps them
 * (`/knowledge-networks/{kn_id}/event-types`). Every event type has an event class: an object type
 * of the network, written by the platform, whose objects are the events of that type.
 */

export type KnEventSource = "rule" | "report";

/** A rule tool argument that each check replaces with the day of the check. */
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

export type KnEventRuleTrial = {
  hits?: number;
  limited?: boolean;
};

export type KnEventType = {
  check_failures?: number;
  check_schedule?: KnEventCheckSchedule | null;
  check_subject?: KnEventCheckSubject | null;
  code: string;
  create_time?: number;
  creator?: string;
  /** The dataset behind the event class; empty like `object_type_id`. */
  dataset_id?: string;
  kn_id?: string;
  merge_hours?: number;
  name: string;
  next_check_at?: number;
  /** The event class; empty for a type whose class has not been created yet. */
  object_type_id?: string;
  rule?: Record<string, unknown>;
  rule_tool?: KnEventRuleTool | null;
  rule_version?: string;
  severity?: string;
  source: KnEventSource;
  /** The object type the events are about. */
  subject?: string;
  trial?: KnEventRuleTrial;
  update_time?: number;
  updater?: string;
};

/** What a create sends. `code` and `source` cannot change afterwards. */
export type KnEventTypeInput = {
  check_schedule?: KnEventCheckSchedule | null;
  code: string;
  merge_hours?: number;
  name: string;
  rule?: Record<string, unknown>;
  rule_tool?: KnEventRuleTool | null;
  rule_version?: string;
  severity?: string;
  source: KnEventSource;
  subject?: string;
};

/**
 * What a replace sends. Every changeable field is sent: one left out takes its zero value, so a
 * save that leaves out `rule_tool` would stop the platform's checks.
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

export type KnEventRuleCheckResult = {
  check?: KnEventRuleCheck;
  events?: Array<{ event_id?: string; status?: string }>;
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
