import { http } from "@/framework/request/http";
import type {
  ObjectTypeDataViewListQuery,
  ObjectTypeDataViewListResult,
  ObjectTypeDataViewPreview,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  mockObjectTypeDataViewFields,
  mockObjectTypeDataViewGroups,
  mockObjectTypeDataViewPreviewRows,
  mockObjectTypeDataViews,
} from "@/modules/knowledge-network/services/mock/state";
import {
  logServiceFallback,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";

type LegacyDataViewGroupResponse = {
  entries?: Array<{
    builtin?: boolean;
    id: string;
    name?: string;
  }>;
};

type LegacyDataSourceConnectionResponse = {
  entries?: Array<{
    id: string;
    name?: string;
    type?: string;
  }>;
};

type LegacyDataViewListResponse = {
  entries?: Array<{
    data_source_id?: string;
    group_id?: string;
    group_name?: string;
    id: string;
    name: string;
  }>;
  total_count?: number;
};

type LegacyDataViewDetailField = {
  comment?: string;
  display_name?: string;
  name: string;
  type?: string;
};

type LegacyDataViewDetail = {
  fields?: LegacyDataViewDetailField[];
  id: string;
  name?: string;
};

type LegacyDataViewPreviewResponse = {
  entries?: Array<Record<string, string | number | boolean | null>>;
  view?: {
    fields?: LegacyDataViewDetailField[];
    name?: string;
  };
};

const DATA_VIEW_SOURCE_TYPE_LABELS: Record<string, string> = {
  index_base: "Index Base",
  mysql: "MySQL",
};

async function getLegacyDataViewDetail(dataViewId: string): Promise<LegacyDataViewDetail | null> {
  const response = await http.get<LegacyDataViewDetail[] | LegacyDataViewDetail>(
    `/mdl-data-model/v1/data-views/${dataViewId}`,
  );

  if (Array.isArray(response.data)) {
    return response.data[0] ?? null;
  }

  return response.data ?? null;
}

function getDataViewSourceTypeLabel(type: string) {
  return DATA_VIEW_SOURCE_TYPE_LABELS[type] ?? type.replaceAll("_", " ");
}

function normalizeDataViewPreviewRows(
  rows: Array<Record<string, string | number | boolean | null>> | undefined,
) {
  return (rows ?? []).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value == null ? "" : typeof value === "boolean" ? String(value) : value,
      ]),
    ),
  );
}

export async function listObjectTypeDataViewGroups(networkId: string) {
  if (useMock) {
    return wait((mockObjectTypeDataViewGroups[networkId] ?? []).map((item) => ({ ...item })));
  }

  const [groupsResult, dataSourcesResult] = await Promise.allSettled([
    http.get<LegacyDataViewGroupResponse>("/mdl-data-model/v1/data-view-groups", {
      params: {
        limit: -1,
      },
    }),
    http.get<LegacyDataSourceConnectionResponse>("/data-connection/v1/datasource"),
  ]);

  if (groupsResult.status === "rejected") {
    logServiceFallback("listObjectTypeDataViewGroups.groups", groupsResult.reason);
  }
  if (dataSourcesResult.status === "rejected") {
    logServiceFallback("listObjectTypeDataViewGroups.dataSources", dataSourcesResult.reason);
  }

  const groupEntries =
    groupsResult.status === "fulfilled" ? (groupsResult.value.data.entries ?? []) : [];
  const dataSourceEntries =
    dataSourcesResult.status === "fulfilled" ? (dataSourcesResult.value.data.entries ?? []) : [];

  const filteredGroups = groupEntries.filter((item) => item.id && item.name);
  if (dataSourceEntries.length === 0) {
    return filteredGroups.map((item) => ({
      id: item.id,
      name: item.name ?? item.id,
      type: item.id === "__index_base" ? "index_base" : item.builtin ? "mysql" : "custom",
    }));
  }

  const dataSourceById = new Map(dataSourceEntries.map((item) => [item.id, item]));
  const indexBaseDataSource = dataSourceEntries.find((item) => item.type === "index_base");
  const rootGroupIds = new Set<string>();
  const result: Array<{
    id: string;
    name: string;
    parentId?: string;
    selectable?: boolean;
    type: string;
  }> = [];

  filteredGroups.forEach((item) => {
    const matchedDataSource =
      dataSourceById.get(item.id) ?? (item.id === "__index_base" ? indexBaseDataSource : undefined);
    const type = matchedDataSource?.type ?? (item.id === "__index_base" ? "index_base" : "custom");
    const rootId = `source-type:${type}`;

    if (!rootGroupIds.has(rootId)) {
      rootGroupIds.add(rootId);
      result.push({
        id: rootId,
        name: getDataViewSourceTypeLabel(type),
        selectable: false,
        type,
      });
    }

    result.push({
      id: item.id,
      name: matchedDataSource?.name ?? item.name ?? item.id,
      parentId: rootId,
      type,
    });
  });

  return result;
}

export async function queryObjectTypeDataViews(
  networkId: string,
  query: ObjectTypeDataViewListQuery = {},
): Promise<ObjectTypeDataViewListResult> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;

  if (useMock) {
    let items = (mockObjectTypeDataViews[networkId] ?? []).map((item) => ({ ...item }));

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

  const response = await http.get<LegacyDataViewListResponse>("/mdl-data-model/v1/data-views", {
    params: {
      direction: "desc",
      group_id: query.dataSourceId || "__all",
      keyword: query.name,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort: "update_time",
      type: "atomic",
    },
  });

  return {
    items: (response.data.entries ?? []).map((item) => ({
      dataSourceId: item.group_id ?? item.data_source_id,
      id: item.id,
      name: item.name,
    })),
    total: response.data.total_count ?? 0,
  };
}

export async function getObjectTypeDataViewPreview(
  networkId: string,
  dataViewId: string,
): Promise<ObjectTypeDataViewPreview | null> {
  if (useMock) {
    const view = (mockObjectTypeDataViews[networkId] ?? []).find((item) => item.id === dataViewId);
    const fields = mockObjectTypeDataViewFields[networkId]?.[dataViewId] ?? [];
    const rows =
      mockObjectTypeDataViewPreviewRows[networkId]?.[dataViewId] ??
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
      rows,
    });
  }

  const response = await http.post<LegacyDataViewPreviewResponse>(
    `/mdl-uniquery/v1/data-views/${dataViewId}?include_view=true`,
    {
      limit: 20,
      offset: 0,
    },
    {
      headers: {
        "x-http-method-override": "GET",
      },
    },
  );

  const previewView = response.data.view;
  if (previewView) {
    return {
      columns: (previewView.fields ?? []).map((item) => ({
        dataIndex: item.name,
        title: item.display_name ?? item.name,
      })),
      name: previewView.name ?? "",
      rows: normalizeDataViewPreviewRows(response.data.entries),
    };
  }

  const detail = await getLegacyDataViewDetail(dataViewId);
  if (!detail) {
    return null;
  }

  return {
    columns: (detail.fields ?? []).map((item) => ({
      dataIndex: item.name,
      title: item.display_name ?? item.name,
    })),
    name: detail.name ?? "",
    rows: [],
  };
}

export async function listObjectTypeDataViews(networkId: string) {
  if (useMock) {
    return wait((mockObjectTypeDataViews[networkId] ?? []).map((item) => ({ ...item })));
  }

  const result = await queryObjectTypeDataViews(networkId, { page: 1, pageSize: 9999 });
  return result.items;
}

export async function listObjectTypeDataViewFields(networkId: string, dataViewId: string) {
  if (useMock) {
    return wait(
      (mockObjectTypeDataViewFields[networkId]?.[dataViewId] ?? []).map((item) => ({
        ...item,
      })),
    );
  }

  const detail = await getLegacyDataViewDetail(dataViewId);

  return (detail?.fields ?? []).map((item) => ({
    comment: item.comment,
    displayName: item.display_name ?? item.name,
    name: item.name,
    type: item.type ?? "string",
  }));
}
