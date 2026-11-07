/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** The kinds of definition that carry BKN spec 3.0 declarations. */
export type DeclarationDefinitionKind = "action_type" | "object_type" | "relation_type";

/**
 * A stored declaration an overwrite import would clear, because the file it imports does not
 * carry it (a 2.x package or an older JSON export never does).
 */
export type ClearedDeclaration = {
  /** Declaration names as the backend sends them, such as `aliases` or `semantic`. */
  fields: string[];
  id: string;
  kind: DeclarationDefinitionKind;
  /** Empty for a declaration of the definition itself, such as its aliases. */
  property?: string;
};

/** How a parameter of an action type or logic property takes its value. */
export type NetworkCheckParameterValue = {
  source?: string;
  value?: unknown;
  valueFrom?: string;
};

/** Where a checked parameter is defined: an action type, or a logic property of an object type. */
export type NetworkCheckParameterOwner = {
  actionTypeId?: string;
  logicProperty?: string;
  objectTypeId?: string;
};

/** A parameter whose value source is written in the legacy place, with the rewrite 3.0 accepts. */
export type NetworkCheckMisplacedParameter = NetworkCheckParameterOwner & {
  /** The parameter already has a value that the suggested rewrite would replace. */
  conflict: boolean;
  current: NetworkCheckParameterValue;
  parameter: string;
  suggested: NetworkCheckParameterValue;
};

/** A parameter with no value source the backend can read, and so no rewrite to suggest. */
export type NetworkCheckInvalidParameter = NetworkCheckParameterOwner & {
  current: NetworkCheckParameterValue;
  parameter: string;
};

/** The network check (`GET /bkns/{kn_id}/check`), which a BKN spec 3.0 export must pass. */
export type NetworkCheckResult = {
  invalidParameters: NetworkCheckInvalidParameter[];
  misplacedParameters: NetworkCheckMisplacedParameter[];
};
