import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type {
  OperatorDebugInput,
  OperatorDebugResult,
  OperatorEditInput,
  OperatorListQuery,
  OperatorListResult,
  OperatorRecord,
  OperatorRegisterInput,
  OperatorStatus,
  PublicOperatorStatus,
} from "@/modules/execution-factory/types/operator";

type BackendOperatorDataInfo = {
  create_time?: number;
  create_user?: string;
  description?: string;
  is_internal?: boolean;
  metadata_type?: string;
  name?: string;
  operator_id: string;
  operator_info?: { category?: string; category_name?: string };
  release_time?: number;
  release_user?: string;
  status?: string;
  update_time?: number;
  update_user?: string;
  version: string;
};

type BackendOperatorListResponse = {
  data?: BackendOperatorDataInfo[];
  page?: number;
  page_size?: number;
  total?: number;
};

type BackendOperatorRegisterResult = {
  operator_id?: string;
  status?: string;
  version?: string;
};

const API_PREFIX = "/agent-operator-integration/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";

let mockOperators: OperatorRecord[] = [
  {
    operatorId: "op_text_extract",
    name: "Text Extract",
    version: "1.0.0",
    status: "published",
    description: "Extract text from documents and URLs.",
    metadataType: "openapi",
    category: "data_extract",
    categoryName: "Data Extract",
    createUser: "system",
    updateTime: Date.now() - 86_400_000,
    isInternal: false,
  },
  {
    operatorId: "op_data_transform",
    name: "Data Transform",
    version: "0.2.1",
    status: "editing",
    description: "Transform tabular data with custom rules.",
    metadataType: "function",
    category: "data_transform",
    categoryName: "Data Transform",
    createUser: "test",
    updateTime: Date.now() - 3_600_000,
    isInternal: false,
  },
];

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
}

function mapOperator(item: BackendOperatorDataInfo): OperatorRecord {
  return {
    operatorId: item.operator_id,
    name: item.name ?? item.operator_id,
    version: item.version,
    status: (item.status ?? "unpublish") as OperatorStatus,
    description: item.description,
    metadataType: item.metadata_type as OperatorRecord["metadataType"],
    category: item.operator_info?.category as OperatorRecord["category"],
    categoryName: item.operator_info?.category_name,
    createTime: item.create_time,
    updateTime: item.update_time,
    createUser: item.create_user,
    updateUser: item.update_user,
    releaseUser: item.release_user,
    releaseTime: item.release_time,
    isInternal: item.is_internal,
  };
}

function filterMockOperators(query: OperatorListQuery) {
  const keyword = query.keyword?.trim().toLowerCase();

  return mockOperators.filter((item) => {
    if (query.status && item.status !== query.status) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(keyword) ||
      item.operatorId.toLowerCase().includes(keyword)
    );
  });
}

function buildMockListResult(query: OperatorListQuery): OperatorListResult {
  const filtered = filterMockOperators(query);
  const start = (query.page - 1) * query.pageSize;

  return {
    items: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function fetchOperatorList(
  path: string,
  query: OperatorListQuery,
): Promise<OperatorListResult> {
  const response = await http.get<BackendOperatorListResponse>(path, {
    headers: getBusinessDomainHeaders(),
    params: {
      page: query.page,
      page_size: query.pageSize,
      name: query.keyword || undefined,
      status: query.status,
      category: query.category || undefined,
      sort_by: "update_time",
      sort_order: "desc",
    },
  });
  const data = response.data;

  return {
    items: (data.data ?? []).map(mapOperator),
    total: data.total ?? 0,
    page: data.page ?? query.page,
    pageSize: data.page_size ?? query.pageSize,
  };
}

export async function listOperators(
  query: OperatorListQuery,
): Promise<OperatorListResult> {
  if (useMock) {
    return buildMockListResult(query);
  }

  return fetchOperatorList(`${API_PREFIX}/operator/info/list`, query);
}

export async function listOperatorMarket(
  query: OperatorListQuery,
): Promise<OperatorListResult> {
  if (useMock) {
    return buildMockListResult({ ...query, status: "published" });
  }

  return fetchOperatorList(`${API_PREFIX}/operator/market`, query);
}

export async function getOperator(operatorId: string): Promise<OperatorRecord> {
  if (useMock) {
    const record = mockOperators.find((item) => item.operatorId === operatorId);

    if (!record) {
      throw new Error("Operator not found");
    }

    return record;
  }

  const response = await http.get<BackendOperatorDataInfo>(
    `${API_PREFIX}/operator/info/${operatorId}`,
    { headers: getBusinessDomainHeaders() },
  );

  return mapOperator(response.data);
}

export async function registerOperator(
  input: OperatorRegisterInput,
): Promise<OperatorRecord> {
  if (useMock) {
    const operatorId = `op_${Date.now()}`;
    const record: OperatorRecord = {
      operatorId,
      name: input.name,
      version: "1.0.0",
      status: input.directPublish ? "published" : "unpublish",
      description: input.description,
      metadataType: input.metadataType,
      category: input.category,
      categoryName: input.category,
      createUser: "local-admin",
      updateTime: Date.now(),
      isInternal: false,
    };
    mockOperators = [record, ...mockOperators];
    return record;
  }

  const response = await http.post<BackendOperatorRegisterResult[]>(
    `${API_PREFIX}/operator/register`,
    {
      data: input.openapiSpec,
      direct_publish: input.directPublish ?? false,
      operator_info: {
        category: input.category ?? "other_category",
      },
      operator_metadata_type: input.metadataType,
    },
    { headers: getBusinessDomainHeaders() },
  );

  const result = response.data[0];

  if (!result?.operator_id) {
    throw new Error("Operator registration failed");
  }

  return getOperator(result.operator_id);
}

export async function updateOperator(input: OperatorEditInput): Promise<void> {
  if (useMock) {
    mockOperators = mockOperators.map((item) =>
      item.operatorId === input.operatorId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            category: input.category ?? item.category,
            categoryName: input.category ?? item.categoryName,
            updateTime: Date.now(),
          }
        : item,
    );
    return;
  }

  await http.post(
    `${API_PREFIX}/operator/info`,
    {
      description: input.description,
      name: input.name,
      operator_id: input.operatorId,
      operator_info: {
        category: input.category ?? "other_category",
      },
    },
    { headers: getBusinessDomainHeaders() },
  );
}

export async function updateOperatorStatus(
  operatorId: string,
  version: string,
  status: PublicOperatorStatus,
): Promise<void> {
  if (useMock) {
    mockOperators = mockOperators.map((item) =>
      item.operatorId === operatorId
        ? {
            ...item,
            status: status === "published" ? "published" : status,
            updateTime: Date.now(),
          }
        : item,
    );
    return;
  }

  await http.post(
    `${API_PREFIX}/operator/status`,
    [{ operator_id: operatorId, version, status }],
    { headers: getBusinessDomainHeaders() },
  );
}

export async function deleteOperator(
  operatorId: string,
  version: string,
): Promise<void> {
  if (useMock) {
    mockOperators = mockOperators.filter((item) => item.operatorId !== operatorId);
    return;
  }

  await http.delete(`${API_PREFIX}/operator/delete`, {
    data: [{ operator_id: operatorId, version }],
    headers: getBusinessDomainHeaders(),
  });
}

export async function getOperatorMarket(
  operatorId: string,
): Promise<OperatorRecord> {
  if (useMock) {
    const record = mockOperators.find((item) => item.operatorId === operatorId);

    if (!record) {
      throw new Error("Market operator not found");
    }

    return record;
  }

  const response = await http.get<BackendOperatorDataInfo>(
    `${API_PREFIX}/operator/market/${operatorId}`,
    { headers: getBusinessDomainHeaders() },
  );

  return mapOperator(response.data);
}

export async function debugOperator(
  input: OperatorDebugInput,
): Promise<OperatorDebugResult> {
  if (useMock) {
    return {
      statusCode: 200,
      body: {
        echo: input.body ?? {},
        operatorId: input.operatorId,
        version: input.version,
      },
      durationMs: 128,
    };
  }

  const response = await http.post<{
    body?: unknown;
    duration_ms?: number;
    error?: string;
    status_code?: number;
  }>(
    `${API_PREFIX}/operator/debug`,
    {
      body: input.body,
      operator_id: input.operatorId,
      version: input.version,
    },
    { headers: getBusinessDomainHeaders() },
  );

  return {
    statusCode: response.data.status_code,
    body: response.data.body,
    error: response.data.error,
    durationMs: response.data.duration_ms,
  };
}
