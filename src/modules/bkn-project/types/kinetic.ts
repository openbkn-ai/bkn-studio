/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { RequirementLogicNeed } from "@/modules/bkn-project/types/requirements";

/**
 * What implements a need in the live network: `object_metric`, `function` (a function or API in
 * its toolbox `boxId`), `skill`, `mcp_tool` (a tool of the MCP server `boxId`) or `action_type`.
 */
export type LogicNeedTarget = { boxId: string; id: string; type: string };

export type LogicNeedLink = LogicNeedTarget & { at: number; byId: string };

/**
 * The linked implementation as the live network has it now, read as the caller; nothing of it is
 * stored. `reason` when it could not be read: `missing`, `forbidden` or `unavailable`.
 */
export type LogicNeedImplementation = {
  available: boolean;
  description: string;
  name: string;
  ownerObjectTypeId: string;
  ownerObjectTypeName: string;
  reason: string;
  status: string;
  version: string;
};

export type LogicNeedView = RequirementLogicNeed & {
  implementation: LogicNeedImplementation | null;
  link: LogicNeedLink | null;
  /** Its object types the live network has; implementing a need takes one of them. */
  liveObjectTypeIds: string[];
};

/** The kinetic needs with what implements them in the project's live network. */
export type LogicNeeds = {
  needs: LogicNeedView[];
  /** The live network: the latest release's, or the lineage's own before one. */
  networkId: string;
  /** `unavailable` when the network's object types could not be read. */
  reason: string;
  /** The specification's, sent with a link. */
  updateTime: number;
};

/** An implementation of the live network a need could link to, and why it is offered. */
export type LogicNeedCandidate = LogicNeedTarget & {
  description: string;
  name: string;
  ownerObjectTypeId: string;
  /** `same_name`, `similar_name`, `same_object_type`. */
  reasons: string[];
};

export type LogicNeedCandidates = {
  candidates: LogicNeedCandidate[];
  networkId: string;
  reason: string;
};
