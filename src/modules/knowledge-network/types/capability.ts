/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * A knowledge network binds capabilities that the execution factory owns: a Skill by its id, a
 * Function by the pair of its toolset and tool, an MCP tool by its Server and tool name. The
 * binding stores a reference only — name, description and status are backfilled by the backend
 * from the execution factory on read.
 */
export type CapabilityType = "function" | "mcp_tool" | "skill";

/** Marks a binding whose target is gone from the execution factory. Reported, never auto-deleted. */
export const CAPABILITY_STATUS_MISSING = "missing";

/**
 * How a capability came to be in this network. A row can have several: a tool mounted by hand and
 * later referenced by an action type carries both, and only the manual half can be released.
 */
export type CapabilitySourceKind = "action_type" | "box" | "manual" | "object_type";

export type CapabilitySourceRef = {
  id: string;
  name: string;
  /** Object-type sources name the property that uses the tool: deleting it is not deleting the type. */
  property?: string;
};

export type CapabilitySource = {
  kind: CapabilitySourceKind;
  refs: CapabilitySourceRef[];
};

export type CapabilityBindingRecord = {
  boundAsBox: boolean;
  /** Toolset of a function binding, MCP Server of an mcp_tool binding; empty for a skill. */
  boxId: string;
  boxName: string;
  branch: string;
  capabilityId: string;
  capabilityType: CapabilityType;
  comment: string;
  createTime: string;
  creatorName: string;
  description: string;
  id: string;
  name: string;
  /**
   * Empty until the backend reports provenance; a row is then a plain binding, which is what the
   * panel falls back to.
   */
  sources: CapabilitySource[];
  /** "missing" when the target is gone; otherwise the execution-factory status, or empty. */
  status: string;
  updateTime: string;
  updaterName: string;
};

/**
 * How much of a tool box this branch has mounted. A whole-box mount is expanded at write time and
 * does not follow the box afterwards, so tools added later show up here as unmounted.
 */
export type CapabilityBoxSummary = {
  boxId: string;
  boxMissing: boolean;
  boxName: string;
  mountedTools: number;
  totalTools: number;
  unmountedTools: number;
};

export type CapabilityBindingListResult = {
  boxes: CapabilityBoxSummary[];
  entries: CapabilityBindingRecord[];
  /** false when the execution factory was unreachable: names are missing, memberships are not. */
  metadataAvailable: boolean;
  totalCount: number;
};

export type CapabilityBindingListQuery = {
  boxId?: string;
  direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
  sort?: "create_time" | "update_time";
  type?: CapabilityType;
  /** Adds description and status to the response; the backend charges an extra call per skill. */
  withDetail?: boolean;
};

export type AttachCapabilityInput = {
  /** Mounts every enabled tool of the box; the backend expands it into one binding per tool. */
  allTools?: boolean;
  boxId?: string;
  capabilityId?: string;
  capabilityType: CapabilityType;
  comment?: string;
};
