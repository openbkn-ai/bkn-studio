/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { readErrorCode, readErrorDetails } from "@/framework/request/error-message";
import type {
  ClearedDeclaration,
  DeclarationDefinitionKind,
  NetworkCheckParameterOwner,
  NetworkCheckParameterValue,
  NetworkCheckResult,
} from "@/modules/knowledge-network/types/knowledge-network";

/** The query parameter that lets an overwrite import clear the declarations it lists. */
export const CONFIRM_CLEAR_DECLARATIONS_PARAM = "confirm_clear_declarations";

const DECLARATIONS_WOULD_BE_CLEARED_CODES = new Set([
  "BknBackend.ActionType.DeclarationsWouldBeCleared",
  "BknBackend.ObjectType.DeclarationsWouldBeCleared",
  "BknBackend.RelationType.DeclarationsWouldBeCleared",
]);

const EXPORT_NEEDS_NETWORK_CHECK_CODE = "BknBackend.KnowledgeNetwork.ExportNeedsNetworkCheck";
const EXPORT_NOT_READABLE_AS_V3_CODE = "BknBackend.KnowledgeNetwork.ExportNotReadableAsV3";

/**
 * An overwrite import refused because it would clear stored declarations. Resending the same
 * request with `confirm_clear_declarations=true` clears them.
 */
export class DeclarationsWouldBeClearedError extends Error {
  readonly isDeclarationsWouldBeCleared = true as const;

  constructor(
    message: string,
    readonly cleared: ClearedDeclaration[],
  ) {
    super(message);
    this.name = "DeclarationsWouldBeClearedError";
  }
}

export type KnowledgeNetworkExportRefusal =
  | { check: NetworkCheckResult; kind: "network_check" }
  | { kind: "not_readable_as_v3"; reason: string };

/**
 * A BKN spec 3.0 export refused: the network check found parameters to fix, or the written
 * package did not read back under the 3.0 rules. A 2.x export (`bkn_spec=2.0`) is still possible.
 */
export class KnowledgeNetworkExportRefusedError extends Error {
  constructor(
    message: string,
    readonly refusal: KnowledgeNetworkExportRefusal,
  ) {
    super(message);
    this.name = "KnowledgeNetworkExportRefusedError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
}

function errorDescription(error: unknown, fallback: string) {
  const description = (error as { response?: { data?: { description?: unknown } } } | null)
    ?.response?.data?.description;
  return (typeof description === "string" && description.trim()) || fallback;
}

const CLEARED_ID_FIELDS: Array<[DeclarationDefinitionKind, string]> = [
  ["object_type", "object_type_id"],
  ["relation_type", "relation_type_id"],
  ["action_type", "action_type_id"],
];

/** Reads `error_details.cleared`; entries without a definition id or a field are left out. */
export function parseClearedDeclarations(details: unknown): ClearedDeclaration[] {
  return asRecords(asRecord(details)?.cleared).flatMap((entry) => {
    const owner = CLEARED_ID_FIELDS.find(([, idField]) => asString(entry[idField]));
    const fields = Array.isArray(entry.fields)
      ? entry.fields.filter((field): field is string => typeof field === "string" && field !== "")
      : [];
    if (!owner || !fields.length) {
      return [];
    }

    const [kind, idField] = owner;
    const property = asString(entry.property);
    return [{ fields, id: entry[idField] as string, kind, ...(property ? { property } : {}) }];
  });
}

function parseParameterValue(value: unknown): NetworkCheckParameterValue {
  const record = asRecord(value) ?? {};
  return {
    source: asString(record.source),
    value: record.value,
    valueFrom: asString(record.value_from),
  };
}

function parseParameterOwner(entry: Record<string, unknown>): NetworkCheckParameterOwner {
  return {
    actionTypeId: asString(entry.action_type_id),
    logicProperty: asString(entry.logic_property),
    objectTypeId: asString(entry.object_type_id),
  };
}

/** Reads the network check result, as `GET /bkns/{kn_id}/check` and an export refusal send it. */
export function parseNetworkCheckResult(details: unknown): NetworkCheckResult {
  const record = asRecord(details) ?? {};
  return {
    invalidParameters: asRecords(record.invalid_parameters).map((entry) => ({
      ...parseParameterOwner(entry),
      current: parseParameterValue(entry.current),
      parameter: asString(entry.parameter) ?? "",
    })),
    misplacedParameters: asRecords(record.misplaced_parameters).map((entry) => ({
      ...parseParameterOwner(entry),
      conflict: entry.conflict === true,
      current: parseParameterValue(entry.current),
      parameter: asString(entry.parameter) ?? "",
      suggested: parseParameterValue(entry.suggested),
    })),
  };
}

/** Throws `DeclarationsWouldBeClearedError` for that refusal; returns for any other error. */
export function throwIfDeclarationsWouldBeCleared(error: unknown) {
  const code = readErrorCode(error);
  if (code && DECLARATIONS_WOULD_BE_CLEARED_CODES.has(code)) {
    throw new DeclarationsWouldBeClearedError(
      errorDescription(error, code),
      parseClearedDeclarations(readErrorDetails(error)),
    );
  }
}

/** Throws `KnowledgeNetworkExportRefusedError` for a refused 3.0 export; returns otherwise. */
export function throwIfExportRefused(error: unknown) {
  const code = readErrorCode(error);
  if (code === EXPORT_NEEDS_NETWORK_CHECK_CODE) {
    throw new KnowledgeNetworkExportRefusedError(errorDescription(error, code), {
      check: parseNetworkCheckResult(readErrorDetails(error)),
      kind: "network_check",
    });
  }
  if (code === EXPORT_NOT_READABLE_AS_V3_CODE) {
    const details = readErrorDetails(error);
    throw new KnowledgeNetworkExportRefusedError(errorDescription(error, code), {
      kind: "not_readable_as_v3",
      reason: typeof details === "string" ? details : "",
    });
  }
}

const DECLARATIONS_INVALID_CODE =
  /^BknBackend\.(ActionType|ObjectType|RelationType)\.InvalidParameter\.Declarations$/;

// The backend names a data property this way, until its details are structured
// (openbkn-ai/bkn-foundry#2991): `data property "x"`, `data properties "x" and "y"` or
// `property constraints "x"`.
const PROPERTY_IN_DETAILS = /(?:data propert(?:y|ies)|property constraints) "([^"]+)"/;

/** A save refused for its declarations: the backend's description, its details, and the property. */
export type DeclarationRefusal = {
  description: string;
  details?: string;
  property?: string;
};

/** Reads a refusal of the declarations of a save; undefined for any other error. */
export function readDeclarationRefusal(error: unknown): DeclarationRefusal | undefined {
  const code = readErrorCode(error);
  if (!code || !DECLARATIONS_INVALID_CODE.test(code)) {
    return undefined;
  }
  const details = readErrorDetails(error);
  const text = typeof details === "string" && details.trim() ? details.trim() : undefined;
  const property = text ? PROPERTY_IN_DETAILS.exec(text)?.[1] : undefined;
  return {
    description: errorDescription(error, code),
    ...(text ? { details: text } : {}),
    ...(property ? { property } : {}),
  };
}
