/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { mockObjectMetrics } from "@/modules/knowledge-network/services/mock/object-metrics";
import { syncKnowledgeNetworkStatistics } from "@/modules/knowledge-network/services/mock/state";
import { useMock, wait } from "@/modules/knowledge-network/services/shared/runtime";
import {
  inferObjectMetricOutputShapeV1,
  type ObjectMetricCapabilitiesV1,
  type ObjectMetricDataV1,
  type ObjectMetricDefinitionV1,
  type ObjectMetricListV1,
  type MetricPropertyBindingV1,
  type ObjectMetricPreviewV1,
  type ObjectMetricQueryRequestV1,
  type ObjectMetricRecordV1,
  type ObjectMetricValidationIssueV1,
  type ObjectMetricValidationResultV1,
} from "@/modules/knowledge-network/types/object-metric";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function mockGeneratedMetricCode(id: string): string {
  return `m_${id.replaceAll("-", "").toLowerCase()}`;
}

function mockValidation(definition: ObjectMetricDefinitionV1): ObjectMetricValidationResultV1 {
  const issues: ObjectMetricValidationIssueV1[] = [];
  if (!definition.name.trim()) {
    issues.push({
      code: "name_required",
      field: "name",
      message: objectMetricText("m548fb9a98bc0"),
    });
  }
  if (!definition.description.trim()) {
    issues.push({
      code: "description_required",
      field: "description",
      message: objectMetricText("m7eecb1b54667"),
    });
  }
  return {
    issues,
    output_shape: inferObjectMetricOutputShapeV1(definition),
    valid: issues.length === 0,
  };
}

export type ObjectMetricListQueryV1 = {
  keyword?: string;
  limit?: number;
  metricType?: ObjectMetricDefinitionV1["metric_type"];
  offset?: number;
  ownerObjectTypeId?: string;
  status?: ObjectMetricDefinitionV1["lifecycle"]["status"];
};

export async function listObjectMetricsV1(
  networkId: string,
  query: ObjectMetricListQueryV1 = {},
  options: { skipErrorToast?: boolean } = {},
): Promise<ObjectMetricListV1> {
  if (useMock) {
    const keyword = query.keyword?.trim().toLowerCase();
    const filtered = (mockObjectMetrics[networkId] ?? []).filter(
      ({ definition }) =>
        (!keyword ||
          definition.name.toLowerCase().includes(keyword) ||
          definition.code.includes(keyword)) &&
        (!query.ownerObjectTypeId || definition.owner_object_type_id === query.ownerObjectTypeId) &&
        (!query.metricType || definition.metric_type === query.metricType) &&
        (!query.status || definition.lifecycle.status === query.status),
    );
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;
    return wait({
      entries: clone(filtered.slice(offset, offset + limit)),
      total_count: filtered.length,
    });
  }
  const response = await http.get<ObjectMetricListV1>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics`,
    {
      params: {
        keyword: query.keyword || undefined,
        limit: query.limit ?? 20,
        metric_type: query.metricType,
        offset: query.offset ?? 0,
        owner_object_type_id: query.ownerObjectTypeId,
        status: query.status,
      },
      skipErrorToast: options.skipErrorToast,
    },
  );
  return response.data;
}

export async function getObjectMetricV1(
  networkId: string,
  metricId: string,
  version?: number,
  options: { skipErrorToast?: boolean } = {},
) {
  if (useMock) {
    const records = (mockObjectMetrics[networkId] ?? []).filter(
      (item) =>
        item.definition.id === metricId && (!version || item.definition.version === version),
    );
    return wait(clone(records.sort((a, b) => b.definition.version - a.definition.version)[0]));
  }
  const response = await http.get<ObjectMetricRecordV1>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics/${metricId}`,
    { params: { version }, skipErrorToast: options.skipErrorToast },
  );
  return response.data;
}

export async function createObjectMetricDraftV1(
  networkId: string,
  definition: ObjectMetricDefinitionV1,
) {
  if (useMock) {
    const now = Date.now();
    const id = crypto.randomUUID();
    const record: ObjectMetricRecordV1 = {
      branch: "main",
      create_time: now,
      creator: { id: "local-admin", type: "user" },
      definition: {
        ...clone(definition),
        code: definition.code.trim() || mockGeneratedMetricCode(id),
        id,
        lifecycle: { ...definition.lifecycle, published_at: undefined, status: "draft" },
        version: 1,
      },
      kn_id: networkId,
      update_time: now,
      updater: { id: "local-admin", type: "user" },
    };
    mockObjectMetrics[networkId] = [record, ...(mockObjectMetrics[networkId] ?? [])];
    syncKnowledgeNetworkStatistics(networkId);
    return wait(clone(record));
  }
  const response = await http.post<ObjectMetricRecordV1>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics`,
    definition,
  );
  return response.data;
}

export async function updateObjectMetricDraftV1(
  networkId: string,
  metricId: string,
  definition: ObjectMetricDefinitionV1,
) {
  if (useMock) {
    let updated: ObjectMetricRecordV1 | undefined;
    mockObjectMetrics[networkId] = (mockObjectMetrics[networkId] ?? []).map((record) => {
      if (record.definition.id !== metricId || record.definition.version !== definition.version) {
        return record;
      }
      if (!["draft", "validated"].includes(record.definition.lifecycle.status)) {
        throw new Error("Published object metric versions are immutable");
      }
      const nextDefinition = clone(definition);
      nextDefinition.code = record.definition.code;
      nextDefinition.lifecycle.status = "draft";
      nextDefinition.lifecycle.published_at = undefined;
      updated = { ...record, definition: nextDefinition, update_time: Date.now() };
      return updated;
    });
    return wait(clone(updated));
  }
  const response = await http.put<ObjectMetricRecordV1>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics/${metricId}`,
    definition,
  );
  return response.data;
}

export async function deleteObjectMetricDraftV1(
  networkId: string,
  metricId: string,
  version: number,
) {
  if (useMock) {
    mockObjectMetrics[networkId] = (mockObjectMetrics[networkId] ?? []).filter(
      (record) =>
        record.definition.id !== metricId ||
        record.definition.version !== version ||
        record.definition.lifecycle.status === "published",
    );
    syncKnowledgeNetworkStatistics(networkId);
    return wait(undefined);
  }
  await http.delete(`/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics/${metricId}`, {
    params: { version },
  });
}

export async function createNextObjectMetricDraftV1(networkId: string, metricId: string) {
  if (useMock) {
    const current = await getObjectMetricV1(networkId, metricId);
    if (!current || current.definition.lifecycle.status !== "published") {
      return current;
    }
    const record = clone(current);
    record.definition.version += 1;
    record.definition.lifecycle.status = "draft";
    record.definition.lifecycle.published_at = undefined;
    record.create_time = Date.now();
    record.update_time = record.create_time;
    mockObjectMetrics[networkId] = [record, ...(mockObjectMetrics[networkId] ?? [])];
    return wait(clone(record));
  }
  const response = await http.post<ObjectMetricRecordV1>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics/${metricId}/versions`,
  );
  return response.data;
}

export async function listObjectMetricVersionsV1(
  networkId: string,
  metricId: string,
  options: { skipErrorToast?: boolean } = {},
) {
  if (useMock) {
    return wait(
      clone(
        (mockObjectMetrics[networkId] ?? [])
          .filter((item) => item.definition.id === metricId)
          .sort((left, right) => right.definition.version - left.definition.version),
      ),
    );
  }
  const response = await http.get<ObjectMetricRecordV1[]>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics/${metricId}/versions`,
    { skipErrorToast: options.skipErrorToast },
  );
  return response.data;
}

export async function validateObjectMetricV1(
  networkId: string,
  definition: ObjectMetricDefinitionV1,
) {
  if (useMock) {
    return wait(mockValidation(definition));
  }
  const response = await http.post<ObjectMetricValidationResultV1>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics/validate`,
    definition,
  );
  return response.data;
}

export async function validateObjectMetricVersionV1(
  networkId: string,
  metricId: string,
  version: number,
) {
  if (useMock) {
    const current = await getObjectMetricV1(networkId, metricId, version);
    if (!current) throw new Error("Object metric not found");
    if (!["draft", "validated"].includes(current.definition.lifecycle.status)) {
      throw new Error("Only a draft object metric version can be validated");
    }
    const validation = mockValidation(current.definition);
    if (!validation.valid) {
      const error = new Error("Object metric validation failed");
      Object.assign(error, { issues: validation.issues });
      throw error;
    }
    let validated: ObjectMetricRecordV1 | undefined;
    mockObjectMetrics[networkId] = (mockObjectMetrics[networkId] ?? []).map((record) => {
      if (record.definition.id !== metricId || record.definition.version !== version) {
        return record;
      }
      validated = clone(record);
      validated.definition.lifecycle.status = "validated";
      validated.update_time = Date.now();
      return validated;
    });
    return wait(clone(validated));
  }
  const response = await http.post<ObjectMetricRecordV1>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics/${metricId}/validate`,
    undefined,
    { params: { version } },
  );
  return response.data;
}

export async function previewObjectMetricV1(
  networkId: string,
  definition: ObjectMetricDefinitionV1,
) {
  if (useMock) {
    const validation = mockValidation(definition);
    const preview: ObjectMetricPreviewV1 = {
      output_schema: {
        dimensions: definition.result_semantics.statistical_grain.group_by_dimensions,
        shape: validation.output_shape,
        value: definition.result_semantics.value,
      },
      validation,
    };
    return wait(preview);
  }
  const response = await http.post<ObjectMetricPreviewV1>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics/preview`,
    definition,
  );
  return response.data;
}

export async function queryObjectMetricDataV1(
  networkId: string,
  metricId: string,
  version: number,
  query: ObjectMetricQueryRequestV1 = {},
) {
  if (useMock) {
    const metric = await getObjectMetricV1(networkId, metricId, version);
    if (!metric) throw new Error("Object metric not found");
    const data: ObjectMetricDataV1 = {
      entries: [],
      model: {
        metric_id: metricId,
        name: metric.definition.name,
        output_shape: inferObjectMetricOutputShapeV1(metric.definition),
        owner_object_type_id: metric.definition.owner_object_type_id,
        value: metric.definition.result_semantics.value,
        version,
      },
      overall_ms: 0,
      status: "no_data",
    };
    return wait(data);
  }
  const response = await http.post<ObjectMetricDataV1>(
    `/ontology-query/v1/knowledge-networks/${networkId}/object-metrics/${metricId}/data`,
    query,
    { params: { branch: "main", version } },
  );
  return response.data;
}

export async function trialObjectMetricDataV1(
  networkId: string,
  definition: ObjectMetricDefinitionV1,
  query: ObjectMetricQueryRequestV1 = {},
) {
  if (useMock) {
    const data: ObjectMetricDataV1 = {
      entries: [],
      model: {
        metric_id: definition.id || "trial",
        name: definition.name,
        output_shape: inferObjectMetricOutputShapeV1(definition),
        owner_object_type_id: definition.owner_object_type_id,
        value: definition.result_semantics.value,
        version: definition.version,
      },
      overall_ms: 0,
      status: "no_data",
    };
    return wait(data);
  }
  const response = await http.post<ObjectMetricDataV1>(
    `/ontology-query/v1/knowledge-networks/${networkId}/object-metrics/trial`,
    { definition, query },
    { params: { branch: "main" }, skipErrorToast: true },
  );
  return response.data;
}

export async function publishObjectMetricV1(networkId: string, metricId: string, version: number) {
  if (useMock) {
    const current = await getObjectMetricV1(networkId, metricId, version);
    if (!current) {
      throw new Error("Object metric not found");
    }
    if (current.definition.lifecycle.status !== "validated") {
      throw new Error("Only a validated object metric version can be published");
    }
    let published: ObjectMetricRecordV1 | undefined;
    mockObjectMetrics[networkId] = (mockObjectMetrics[networkId] ?? []).map((record) => {
      if (record.definition.id !== metricId || record.definition.version !== version) {
        return record;
      }
      published = clone(record);
      published.definition.lifecycle.status = "published";
      published.definition.lifecycle.published_at = new Date().toISOString();
      published.update_time = Date.now();
      return published;
    });
    return wait(clone(published));
  }
  const response = await http.post<ObjectMetricRecordV1>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics/${metricId}/publish`,
    undefined,
    { params: { version } },
  );
  return response.data;
}

export async function deprecateObjectMetricV1(
  networkId: string,
  metricId: string,
  version: number,
) {
  if (useMock) {
    const current = await getObjectMetricV1(networkId, metricId, version);
    if (!current) throw new Error("Object metric not found");
    if (current.definition.lifecycle.status !== "published") {
      throw new Error("Only a published object metric version can be deprecated");
    }
    let deprecated: ObjectMetricRecordV1 | undefined;
    mockObjectMetrics[networkId] = (mockObjectMetrics[networkId] ?? []).map((record) => {
      if (record.definition.id !== metricId || record.definition.version !== version) {
        return record;
      }
      deprecated = clone(record);
      deprecated.definition.lifecycle.status = "deprecated";
      deprecated.update_time = Date.now();
      return deprecated;
    });
    return wait(clone(deprecated));
  }
  const response = await http.post<ObjectMetricRecordV1>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics/${metricId}/deprecate`,
    undefined,
    { params: { version } },
  );
  return response.data;
}

export async function getObjectMetricCapabilitiesV1() {
  if (useMock) {
    return wait<ObjectMetricCapabilitiesV1>({
      aggregations: [
        "identity",
        "count_rows",
        "count",
        "count_distinct",
        "sum",
        "avg",
        "min",
        "max",
      ],
      boolean_operators: ["and", "or", "not"],
      calculation_scopes: ["object_instance", "object_set"],
      comparison_operators: [
        "eq",
        "neq",
        "gt",
        "gte",
        "lt",
        "lte",
        "between",
        "not_between",
        "in",
        "not_in",
        "contains",
        "not_contains",
        "starts_with",
        "ends_with",
        "is_empty",
        "is_not_empty",
        "is_null",
        "is_not_null",
        "is_true",
        "is_false",
        "before",
        "before_or_equal",
        "after",
        "after_or_equal",
      ],
      lifecycle_statuses: ["draft", "validated", "published", "deprecated"],
      expression_operators: ["add", "subtract", "multiply", "divide", "modulo", "negate"],
      functions: [
        "to_number",
        "abs",
        "ceil",
        "floor",
        "round",
        "coalesce",
        "greatest",
        "least",
        "duration_between",
        "date_diff",
        "date_part",
        "lower",
        "upper",
        "length",
      ],
      metric_types: ["atomic", "derived", "composite"],
      physical_types: ["int64", "decimal", "boolean", "string", "date", "datetime", "duration"],
      quantity_kinds: [
        "dimensionless",
        "count",
        "currency",
        "duration",
        "data_size",
        "rate",
        "weight",
        "length",
        "area",
        "volume",
        "custom",
      ],
      registry_versions: {
        aggregation: "1.0",
        expression_language: "1.0",
        function: "1.0",
        unit: "1.0",
      },
      semantic_types: [
        "measure",
        "count",
        "amount",
        "ratio",
        "percentage",
        "score",
        "rank",
        "timestamp",
        "duration",
        "date",
        "category",
        "boolean",
      ],
      time_granularities: ["minute", "hour", "day", "week", "month", "quarter", "year"],
      unit_systems: ["UCUM", "ISO_4217", "registered"],
    });
  }
  const response = await http.get<ObjectMetricCapabilitiesV1>(
    "/bkn-backend/v1/object-metrics/capabilities",
  );
  return response.data;
}

export async function bindObjectMetricLogicPropertyV1(
  networkId: string,
  metricId: string,
  version: number,
  binding: MetricPropertyBindingV1,
) {
  if (useMock) {
    return wait({
      comment: binding.comment ?? "",
      data_source: {
        id: `object_metric_v1:${metricId}@${version}`,
        name: metricId,
        type: "metric",
      },
      display_name: binding.display_name,
      name: binding.property_name,
      type: "metric",
    });
  }
  const response = await http.post<{
    comment: string;
    data_source: { id: string; name: string; type: "metric" };
    display_name: string;
    name: string;
    type: "metric";
  }>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-metrics/${metricId}/logic-properties`,
    binding,
    { params: { version } },
  );
  return response.data;
}
