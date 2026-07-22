/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { catalogListAllQuery, listCatalogs } from "@/shared/catalog";
import { listDataConnectConnectorTypes } from "@/modules/data-connect/services/data-connect.service";
import type {
  ObjectTypeResourceListQuery,
  ObjectTypeResourceListResult,
  ObjectTypeResourcePreview,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  mockObjectTypeResourceFields,
  mockObjectTypeResourceGroups,
  mockObjectTypeResourcePreviewRows,
  mockObjectTypeResources,
} from "@/modules/knowledge-network/services/mock/state";
import { useMock, wait } from "@/modules/knowledge-network/services/shared/runtime";

type BackendResourceListEntry = {
  catalog_id?: string;
  id: string;
  name?: string;
};

type BackendResourceListResponse = {
  entries?: BackendResourceListEntry[];
  total_count?: number;
};

type BackendResourceField = {
  description?: string;
  display_name?: string;
  name?: string;
  original_name?: string;
  type?: string;
};

type BackendResourceDetail = {
  id: string;
  name?: string;
  schema_definition?: BackendResourceField[] | null;
};

type BackendResourceDetailResponse = {
  entries?: BackendResourceDetail[];
};

type BackendResourcePreviewResponse = {
  entries?: Array<Record<string, unknown>>;
  total_count?: number;
};

async function getResourceDetail(resourceId: string): Promise<BackendResourceDetail | null> {
  const response = await http.get<BackendResourceDetailResponse>(
    `/vega-backend/v1/resources/${resourceId}`,
  );
  return response.data.entries?.[0] ?? null;
}

function normalizePreviewCellValue(value: unknown): string | number {
  if (value == null) {
    return "";
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "number" || typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "";
    }

    if (value.every((item) => typeof item === "string" || typeof item === "number")) {
      return value.join(", ");
    }

    if (value.every((item) => typeof item === "number") && value.length > 8) {
      return `[${value.length} values]`;
    }

    return value
      .map((item) => normalizePreviewCellValue(item))
      .filter((item) => item !== "")
      .join("; ");
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sourceProperty = record.source_property as
      | { display_name?: string; name?: string }
      | undefined;
    const targetProperty = record.target_property as
      | { display_name?: string; name?: string }
      | undefined;

    if (sourceProperty || targetProperty) {
      const source = sourceProperty?.name ?? sourceProperty?.display_name ?? "";
      const target = targetProperty?.name ?? targetProperty?.display_name ?? "";
      return [source, target].filter(Boolean).join(" → ");
    }

    const displayName = record.display_name;
    if (typeof displayName === "string" && displayName) {
      return displayName;
    }

    const name = record.name;
    if (typeof name === "string" && name) {
      return name;
    }

    const id = record.id;
    if (typeof id === "string" && id) {
      return id;
    }

    try {
      const serialized = JSON.stringify(value);
      return serialized.length > 120 ? `${serialized.slice(0, 120)}…` : serialized;
    } catch {
      return "[object]";
    }
  }

  return "";
}

function normalizeResourcePreviewRows(rows: Array<Record<string, unknown>> | undefined) {
  return (rows ?? []).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, normalizePreviewCellValue(value)]),
    ),
  );
}

function mapResourceField(field: BackendResourceField) {
  const fieldName = field.name ?? field.display_name ?? field.original_name ?? "";
  return {
    comment: field.description,
    displayName: field.display_name ?? fieldName,
    name: fieldName,
    type: field.type ?? "string",
  };
}

function getConnectorTypeLabel(type: string, fallback?: string) {
  if (type === "mysql") {
    return "MySQL";
  }

  if (type === "mariadb") {
    return "MariaDB";
  }

  if (type === "postgresql" || type === "postgres") {
    return "PostgreSQL";
  }

  if (type === "opensearch" || type === "index_base") {
    return "Index Base";
  }

  return fallback ?? type;
}

export async function listObjectTypeResourceGroups(networkId: string) {
  if (useMock) {
    return wait((mockObjectTypeResourceGroups[networkId] ?? []).map((item) => ({ ...item })));
  }

  const [catalogsResult, connectorTypesResult] = await Promise.all([
    listCatalogs(catalogListAllQuery({ pageSize: 500 })),
    listDataConnectConnectorTypes(),
  ]);

  const connectorTypeNames = new Map(
    connectorTypesResult.map((item) => [item.type, item.name || item.type]),
  );
  const rootIds = new Set<string>();
  const result: Array<{
    id: string;
    name: string;
    parentId?: string;
    selectable?: boolean;
    type: string;
  }> = [];

  catalogsResult.items.forEach((catalog) => {
    const connectorType = catalog.connectorType || "other";
    const rootId = `source-type:${connectorType}`;

    if (!rootIds.has(rootId)) {
      rootIds.add(rootId);
      result.push({
        id: rootId,
        name: getConnectorTypeLabel(
          connectorType,
          connectorTypeNames.get(connectorType) ?? connectorType,
        ),
        selectable: false,
        type: connectorType,
      });
    }

    result.push({
      id: catalog.id,
      name: catalog.name,
      parentId: rootId,
      type: connectorType,
    });
  });

  return result;
}

export async function queryObjectTypeResources(
  networkId: string,
  query: ObjectTypeResourceListQuery = {},
): Promise<ObjectTypeResourceListResult> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;

  if (useMock) {
    let items = (mockObjectTypeResources[networkId] ?? []).map((item) => ({ ...item }));

    if (query.dataSourceId) {
      items = items.filter((item) => item.dataSourceId === query.dataSourceId);
    }

    if (query.name?.trim()) {
      const keyword = query.name.trim().toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(keyword));
    }

    const start = (page - 1) * pageSize;
    return wait({
      items: items.slice(start, start + pageSize),
      total: items.length,
    });
  }

  const response = await http.get<BackendResourceListResponse>("/vega-backend/v1/resources", {
    params: {
      catalog_id: query.dataSourceId || undefined,
      limit: pageSize,
      name: query.name?.trim() || undefined,
      offset: (page - 1) * pageSize,
      sort: "update_time",
    },
  });

  return {
    items: (response.data.entries ?? []).map((item) => ({
      dataSourceId: item.catalog_id,
      id: item.id,
      name: item.name ?? item.id,
    })),
    total: response.data.total_count ?? 0,
  };
}

export async function getObjectTypeResourcePreview(
  networkId: string,
  resourceId: string,
): Promise<ObjectTypeResourcePreview | null> {
  if (useMock) {
    const view = (mockObjectTypeResources[networkId] ?? []).find((item) => item.id === resourceId);
    const fields = mockObjectTypeResourceFields[networkId]?.[resourceId] ?? [];
    const rows =
      mockObjectTypeResourcePreviewRows[networkId]?.[resourceId] ??
      fields.slice(0, 3).map((field, index) => ({
        [field.name]: `${field.displayName}-${index + 1}`,
      }));

    if (!view) {
      return null;
    }

    return wait({
      columns: fields.map((field) => ({
        dataIndex: field.name,
        title: field.displayName,
      })),
      name: view.name,
      rowTotalCount: rows.length > 0 ? 10_401 : 0,
      rows,
    });
  }

  const [detail, previewResponse] = await Promise.all([
    getResourceDetail(resourceId),
    http.post<BackendResourcePreviewResponse>(
      `/vega-backend/v1/resources/${resourceId}/data`,
      {
        need_total: true,
        paging: {
          limit: 20,
          mode: "single",
          offset: 0,
        },
      },
      {
        headers: {
          "X-HTTP-Method-Override": "GET",
        },
      },
    ),
  ]);

  if (!detail) {
    return null;
  }

  const fields = (detail.schema_definition ?? []).map(mapResourceField);
  const rows = normalizeResourcePreviewRows(previewResponse.data.entries);
  const columns =
    fields.length > 0
      ? fields.map((item) => ({
          dataIndex: item.name,
          title: item.displayName,
        }))
      : Object.keys(rows[0] ?? {}).map((key) => ({
          dataIndex: key,
          title: key,
        }));

  return {
    columns,
    name: detail.name ?? resourceId,
    rowTotalCount: previewResponse.data.total_count,
    rows,
  };
}

export async function listObjectTypeResourceFields(networkId: string, resourceId: string) {
  if (useMock) {
    return wait(
      (mockObjectTypeResourceFields[networkId]?.[resourceId] ?? []).map((item) => ({
        ...item,
      })),
    );
  }

  const detail = await getResourceDetail(resourceId);

  return (detail?.schema_definition ?? []).map(mapResourceField);
}
