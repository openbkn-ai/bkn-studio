/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/object-type.service";
import {
  getObjectMetricV1,
  listObjectMetricsV1,
} from "@/modules/knowledge-network/services/object-metric.service";
import type {
  ObjectMetricDefinitionV1,
  ObjectMetricPropertyRefV1,
} from "@/modules/knowledge-network/types/object-metric";
import type {
  ObjectTypeDataProperty,
  ObjectTypeLogicMetricModelRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

const OBJECT_METRIC_SOURCE_PREFIX = "object_metric_v1:";

function buildObjectMetricSourceId(definition: ObjectMetricDefinitionV1) {
  return `${OBJECT_METRIC_SOURCE_PREFIX}${definition.id}@${definition.version}`;
}

function parseObjectMetricSourceId(sourceId: string) {
  if (!sourceId.startsWith(OBJECT_METRIC_SOURCE_PREFIX)) {
    return null;
  }
  const [metricId, rawVersion] = sourceId.slice(OBJECT_METRIC_SOURCE_PREFIX.length).split("@");
  const version = Number(rawVersion);
  return metricId && Number.isInteger(version) && version > 0 ? { metricId, version } : null;
}

function mapAnalysisDimensions(
  dimensions: ObjectMetricPropertyRefV1[],
  scopeProperties: ObjectTypeDataProperty[],
) {
  return dimensions.map(({ property_name: name }) => {
    const property = scopeProperties.find((item) => item.name === name);
    return {
      displayName: property?.displayName || name,
      name,
      type: property?.type ?? "string",
    };
  });
}

function mapObjectMetricToLogicMetricRecord(
  definition: ObjectMetricDefinitionV1,
  scopeProperties: ObjectTypeDataProperty[],
): ObjectTypeLogicMetricModelRecord {
  return {
    analysisDimensions: mapAnalysisDimensions(
      definition.query_capabilities.analysis_dimensions,
      scopeProperties,
    ),
    groupName: definition.metric_type,
    id: buildObjectMetricSourceId(definition),
    name: definition.name,
  };
}

async function loadScopeObjectTypeProperties(networkId: string, scopeRef: string) {
  if (!networkId || !scopeRef) {
    return [];
  }
  const detail = await getKnowledgeNetworkObjectTypeDetail(networkId, scopeRef);
  return detail?.dataProperties ?? [];
}

/**
 * Logical properties only accept immutable published object-instance metric versions.
 * Legacy metric IDs are deliberately excluded; historical records must be migrated first.
 */
export async function listObjectTypeLogicMetricModels(networkId: string, scopeRef: string) {
  if (!networkId || !scopeRef) {
    return [];
  }

  const [scopeProperties, result] = await Promise.all([
    loadScopeObjectTypeProperties(networkId, scopeRef),
    listObjectMetricsV1(networkId, {
      limit: 500,
      ownerObjectTypeId: scopeRef,
      status: "published",
    }),
  ]);

  return result.entries
    .filter(({ definition }) => definition.calculation_scope === "object_instance")
    .map(({ definition }) => mapObjectMetricToLogicMetricRecord(definition, scopeProperties));
}

export async function listObjectTypeLogicMetricModelFields(networkId: string, sourceId: string) {
  const reference = parseObjectMetricSourceId(sourceId);
  if (!networkId || !reference) {
    return [];
  }

  const record = await getObjectMetricV1(networkId, reference.metricId, reference.version);
  if (
    !record ||
    record.definition.lifecycle.status !== "published" ||
    record.definition.calculation_scope !== "object_instance"
  ) {
    return [];
  }

  const scopeProperties = await loadScopeObjectTypeProperties(
    networkId,
    record.definition.owner_object_type_id,
  );
  return mapAnalysisDimensions(
    record.definition.query_capabilities.analysis_dimensions,
    scopeProperties,
  );
}
