/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectMetricExpressionV1,
  ObjectMetricPropertyRefV1,
  ObjectMetricRecordV1,
} from "@/modules/knowledge-network/types/object-metric";

export type MetricLineageReference = { metric_id: string; version: number };

export type MetricLineageEntry = {
  depth: number;
  key: string;
  record?: ObjectMetricRecordV1;
  reference: MetricLineageReference;
};

export type MetricReferenceResolution = {
  error?: unknown;
  key: string;
  record?: ObjectMetricRecordV1;
  reference: MetricLineageReference;
};

export function objectMetricVersionKey(metricId: string, version: number) {
  return `${metricId}@${version}`;
}

/** Only measure inputs are data sources; grouping and query dimensions are not calculation inputs. */
export function atomicMeasureProperties(metric: ObjectMetricRecordV1): ObjectMetricPropertyRefV1[] {
  if (metric.definition.specification.kind !== "atomic") return [];
  const properties = new Map<string, ObjectMetricPropertyRefV1>();
  const visit = (expression: ObjectMetricExpressionV1): void => {
    if (expression.node_type === "property") {
      const property = expression.property_ref;
      properties.set(
        `${property.object_type_id}:${property.relation_path_alias ?? ""}:${property.property_name}`,
        property,
      );
    } else if (expression.node_type === "call") {
      expression.arguments.forEach(visit);
    } else if (expression.node_type === "binary") {
      visit(expression.left);
      visit(expression.right);
    } else if (expression.node_type === "unary") {
      visit(expression.left);
    }
  };
  const expression = metric.definition.specification.measure.expression;
  if (expression) visit(expression);
  return [...properties.values()];
}

/** Loads the immutable versions named by dependency references, never their latest replacements. */
export async function resolveObjectMetricReferences(
  references: MetricLineageReference[],
  load: (metricId: string, version: number) => Promise<ObjectMetricRecordV1 | undefined>,
): Promise<MetricReferenceResolution[]> {
  const uniqueReferences = Array.from(
    new Map(
      references.map((reference) => [
        objectMetricVersionKey(reference.metric_id, reference.version),
        reference,
      ]),
    ).values(),
  );
  return Promise.all(
    uniqueReferences.map(async (reference) => {
      const key = objectMetricVersionKey(reference.metric_id, reference.version);
      try {
        const record = await load(reference.metric_id, reference.version);
        return record
          ? { key, record, reference }
          : { error: new Error("Referenced metric version was not found"), key, reference };
      } catch (error) {
        return { error, key, reference };
      }
    }),
  );
}

/** Returns only version-pinned metric dependencies declared by the definition. */
export function directObjectMetricReferences(
  metric: ObjectMetricRecordV1,
): MetricLineageReference[] {
  const specification = metric.definition.specification;
  if (specification.kind === "derived") return [specification.base_metric];
  if (specification.kind === "composite") {
    return specification.dependencies.map((item) => item.metric_ref);
  }
  return [];
}

/**
 * Walks a definition's fixed-version dependencies. A missing record is retained so the
 * caller can make unavailable historic definitions visible instead of silently hiding them.
 */
export function collectObjectMetricUpstream(
  root: ObjectMetricRecordV1,
  metricsByKey: Map<string, ObjectMetricRecordV1>,
): MetricLineageEntry[] {
  const result: MetricLineageEntry[] = [];
  const visited = new Set([objectMetricVersionKey(root.definition.id, root.definition.version)]);
  const walk = (metric: ObjectMetricRecordV1, depth: number) => {
    directObjectMetricReferences(metric).forEach((reference) => {
      const key = objectMetricVersionKey(reference.metric_id, reference.version);
      if (visited.has(key)) return;
      visited.add(key);
      const record = metricsByKey.get(key);
      result.push({ depth, key, record, reference });
      if (record) walk(record, depth + 1);
    });
  };
  walk(root, 1);
  return result;
}

/** Finds all metrics that directly or transitively reference the root's fixed version. */
export function collectObjectMetricDownstream(
  root: ObjectMetricRecordV1,
  records: ObjectMetricRecordV1[],
): MetricLineageEntry[] {
  const result: MetricLineageEntry[] = [];
  const visited = new Set([objectMetricVersionKey(root.definition.id, root.definition.version)]);
  const walk = (metric: ObjectMetricRecordV1, depth: number) => {
    records
      .filter((candidate) =>
        directObjectMetricReferences(candidate).some(
          (reference) =>
            reference.metric_id === metric.definition.id &&
            reference.version === metric.definition.version,
        ),
      )
      .forEach((candidate) => {
        const key = objectMetricVersionKey(candidate.definition.id, candidate.definition.version);
        if (visited.has(key)) return;
        visited.add(key);
        result.push({
          depth,
          key,
          record: candidate,
          reference: { metric_id: candidate.definition.id, version: candidate.definition.version },
        });
        walk(candidate, depth + 1);
      });
  };
  walk(root, 1);
  return result;
}
