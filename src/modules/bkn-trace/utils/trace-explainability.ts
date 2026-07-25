/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ExplainabilityRow = {
  id: string;
  kind: string;
  primary: string;
  secondary: string;
  status: string;
  versionStatus: string;
  visibility: string;
};

export function claimRows(claims: Array<Record<string, unknown>>): ExplainabilityRow[] {
  return claims.map((claim, index) => {
    const subjectRefs = objectField(claim, "subject_refs");
    const operation = stringField(subjectRefs, "operation") || stringField(claim, "operation");
    const model = stringField(subjectRefs, "model_name");
    const resource = stringField(subjectRefs, "resource_id");
    const schema = stringField(subjectRefs, "entity_kind");
    const queryHash = stringField(subjectRefs, "query_hash");

    return {
      id: stringField(claim, "claim_id") || `claim:${index}`,
      kind: stringField(claim, "claim_type") || "finding",
      primary: firstNonEmpty(model, resource, schema, queryHash, operation, stringField(claim, "claim_hash")),
      secondary: compactJoin([
        operation,
        model ? `model=${model}` : "",
        resource ? `resource=${resource}` : "",
        queryHash ? `query=${shortValue(queryHash)}` : "",
      ]),
      status: stringField(subjectRefs, "status") || "-",
      versionStatus: stringField(claim, "version_status") || "-",
      visibility: stringField(claim, "visibility") || "-",
    };
  });
}

export function evidenceRows(refs: Array<Record<string, unknown>>): ExplainabilityRow[] {
  return refs.map((ref, index) => {
    const summary = objectField(ref, "summary");
    const kind = stringField(summary, "kind") || stringField(ref, "ref_type") || "evidence";
    const primary = firstNonEmpty(
      stringField(summary, "model_name"),
      stringField(summary, "resource_id"),
      stringField(summary, "catalog_id"),
      stringField(summary, "id"),
      stringField(ref, "ref_id"),
    );
    const secondary = compactJoin([
      stringField(ref, "source_system"),
      stringField(summary, "model_provider"),
      stringField(summary, "status"),
      shortValue(stringField(summary, "message_hash")),
      shortValue(stringField(summary, "result_hash")),
      shortValue(stringField(summary, "row_hash")),
      shortValue(stringField(ref, "summary_hash")),
    ]);

    return {
      id: stringField(ref, "ref_id") || `evidence:${index}`,
      kind,
      primary,
      secondary,
      status: stringField(summary, "status") || stringField(ref, "validity") || "-",
      versionStatus: stringField(ref, "version_status") || stringField(summary, "version_status") || "-",
      visibility: stringField(ref, "visibility") || "-",
    };
  });
}

export function businessRows(nodes: Array<Record<string, unknown>>): ExplainabilityRow[] {
  return nodes.map((node, index) => {
    const properties = objectField(node, "properties");
    const nodeType = stringField(node, "node_type") || stringField(properties, "ref_type") || "business";
    const label = stringField(node, "label");
    const id = stringField(node, "id") || `business:${index}`;

    return {
      id,
      kind: nodeType,
      primary: firstNonEmpty(label, id),
      secondary: compactJoin([
        stringField(node, "claim_id"),
        stringField(properties, "source_system"),
        stringField(properties, "summary_hash") ? shortValue(stringField(properties, "summary_hash")) : "",
      ]),
      status: stringField(properties, "validity") || "-",
      versionStatus: stringField(node, "version_status") || stringField(properties, "version_status") || "-",
      visibility: stringField(node, "visibility") || stringField(properties, "visibility") || "-",
    };
  });
}

export function shortValue(value: string): string {
  if (!value) {
    return "";
  }
  if (value.length <= 28) {
    return value;
  }
  return `${value.slice(0, 18)}...${value.slice(-6)}`;
}

function objectField(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringField(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function firstNonEmpty(...values: string[]): string {
  return values.find((value) => value.trim()) ?? "-";
}

function compactJoin(values: string[]): string {
  return values.filter((value) => value.trim()).join(" · ") || "-";
}
