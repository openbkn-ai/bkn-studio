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

/** What a data property means (BKN spec 3.0 §6.8). Each value goes on one property at most. */
export type PropertySemantic =
  | "end_time"
  | "event_time"
  | "latitude"
  | "location"
  | "longitude"
  | "severity"
  | "status"
  | "valid_from"
  | "valid_to";

/** The coordinate system of a location, latitude or longitude property. */
export type PropertyCrs = "bd09" | "gcj02" | "wgs84";

/** A closed interval: numbers for a numeric property, ISO 8601 text for a date or time property. */
export type PropertyValueRange = { max?: number | string; min?: number | string };

/** A closed interval on the number of characters of a string property. */
export type PropertyLengthRange = { max?: number; min?: number };

/** A JSON value as the backend sent it, for a key Studio writes back without reading it. */
export type DeclarationPassthroughValue = boolean | null | number | object | string;

/**
 * The constraints on a data property's values. The backend replaces them whole, so `passthrough`
 * keeps the keys this release does not know and writes them back unchanged.
 */
export type PropertyConstraints = {
  crs?: PropertyCrs;
  length?: PropertyLengthRange;
  passthrough?: Record<string, DeclarationPassthroughValue>;
  pattern?: string;
  range?: PropertyValueRange;
  timezone?: string;
  unique?: boolean;
  unit?: string;
  /** The ID of a value type of the network, whose `base_type` is the property's type. */
  valueType?: string;
};

/**
 * A data property's BKN spec 3.0 declarations. A declaration the property does not make is left
 * out; an empty list, an empty text or `required: false` never appears here.
 */
export type PropertyDeclarations = {
  aliases?: string[];
  constraints?: PropertyConstraints;
  required?: boolean;
  semantic?: PropertySemantic;
};

/**
 * A definition that is no longer in use (spec §4.3): why, and optionally the definition of the
 * same kind to use instead. An active definition has no lifecycle.
 */
export type DefinitionLifecycle = {
  reason: string;
  replacedBy?: string;
  status: "deprecated";
};

/**
 * The BKN spec 3.0 declarations of an object type or an action type itself, as opposed to those of
 * its properties. A declaration it does not make is left out.
 */
export type DefinitionDeclarations = {
  aliases?: string[];
  lifecycle?: DefinitionLifecycle;
};

/**
 * The declarations a form edits, against what they were when it read the definition; a save sends
 * only what changed. A save without it, such as a mask rule save, sends no declaration.
 */
export type DefinitionDeclarationEdit = {
  baseline?: DefinitionDeclarations;
  current?: DefinitionDeclarations;
};
