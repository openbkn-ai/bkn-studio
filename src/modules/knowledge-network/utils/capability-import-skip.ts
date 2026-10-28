/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

const PREFIX = "knowledgeNetwork.packageImport";

const REASONS = [
  "ambiguous_name",
  "execution_factory_unreachable",
  "knowledge_base_service_unreachable",
  "not_found",
  "not_supported",
  "not_usable",
];

const TYPES = ["function", "knowledge_base", "mcp_tool", "skill"];

/**
 * The words for why a declared capability was not bound. A reason this release does not know yet
 * reads as "another reason" rather than as the backend's value.
 */
export const capabilitySkipReasonKey = (reason: string) =>
  `${PREFIX}.reason.${REASONS.includes(reason) ? reason : "other"}`;

export const capabilitySkipTypeKey = (capabilityType: string) =>
  `${PREFIX}.type.${TYPES.includes(capabilityType) ? capabilityType : "other"}`;
