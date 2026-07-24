/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type {
  ToolboxEditInput,
  ToolboxListQuery,
  ToolboxListResult,
  ToolboxMutationInput,
  ToolboxRecord,
  ToolboxStatus,
  ToolboxToolRecord,
} from "@/modules/execution-factory/types/toolbox";
import { normalizeTimestamp } from "@/modules/execution-factory/utils/format-timestamp";
import { parseOpenApiDataPayload } from "@/modules/execution-factory/utils/metadata-content";

type BackendToolInfo = {
  description?: string;
  name?: string;
  status?: string;
  tool_id: string;
};

type BackendToolboxInfo = {
  box_desc?: string;
  box_id: string;
  box_name: string;
  box_svc_url?: string;
  category_name?: string;
  category_type?: string;
  create_time?: number;
  create_user?: string;
  is_internal?: boolean;
  metadata_type?: string;
  release_time?: number;
  release_user?: string;
  status?: string;
  tools?: Array<BackendToolInfo | string>;
  update_time?: number;
  update_user?: string;
};

type BackendToolboxListResponse = {
  data?: BackendToolboxInfo[];
  page?: number;
  page_size?: number;
  total?: number;
};

const API_PREFIX = "/agent-operator-integration/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";

let mockToolboxes: ToolboxRecord[] = [
  {
    boxId: "tb_context_loader",
    name: "Context Loader Toolbox",
    description: "Built-in toolbox for context loader tools.",
    serviceUrl: "https://example.com/context-loader",
    status: "published",
    categoryType: "box_category",
    categoryName: "Platform",
    metadataType: "openapi",
    toolCount: 2,
    tools: [
      { toolId: "tool_search", name: "Search", status: "enabled" },
      { toolId: "tool_rank", name: "Rank", status: "enabled" },
    ],
    createUser: "system",
    updateTime: Date.now() - 172_800_000,
    isInternal: true,
  },
  {
    boxId: "tb_custom_ops",
    name: "Custom Operations",
    description: "User-defined HTTP tools for business workflows.",
    serviceUrl: "https://example.com/custom-ops",
    status: "unpublish",
    categoryType: "box_category",
    categoryName: "Custom",
    metadataType: "openapi",
    toolCount: 1,
    tools: [{ toolId: "tool_invoke", name: "Invoke", status: "disabled" }],
    createUser: "test",
    updateTime: Date.now() - 7_200_000,
    isInternal: false,
  },
];

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
}

function mapTool(item: BackendToolInfo): ToolboxToolRecord {
  return {
    toolId: item.tool_id,
    name: item.name ?? item.tool_id,
    description: item.description,
    status: item.status as ToolboxToolRecord["status"],
  };
}

function mapToolbox(item: BackendToolboxInfo): ToolboxRecord {
  const tools = Array.isArray(item.tools)
    ? item.tools.map((tool) =>
        typeof tool === "string"
          ? { toolId: tool, name: tool, status: "disabled" as const }
          : mapTool(tool),
      )
    : undefined;

  return {
    boxId: item.box_id,
    name: item.box_name,
    description: item.box_desc,
    serviceUrl: item.box_svc_url,
    status: (item.status ?? "unpublish") as ToolboxStatus,
    categoryType: item.category_type,
    categoryName: item.category_name,
    metadataType: item.metadata_type as ToolboxRecord["metadataType"],
    toolCount: tools?.length ?? 0,
    tools,
    createTime: normalizeTimestamp(item.create_time),
    updateTime: normalizeTimestamp(item.update_time),
    createUser: item.create_user,
    updateUser: item.update_user,
    releaseUser: item.release_user,
    releaseTime: normalizeTimestamp(item.release_time),
    isInternal: item.is_internal,
  };
}

function filterMockToolboxes(query: ToolboxListQuery) {
  const keyword = query.keyword?.trim().toLowerCase();

  return mockToolboxes.filter((item) => {
    if (query.status && item.status !== query.status) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(keyword) ||
      item.boxId.toLowerCase().includes(keyword)
    );
  });
}

function buildMockListResult(query: ToolboxListQuery): ToolboxListResult {
  const filtered = filterMockToolboxes(query);
  const start = (query.page - 1) * query.pageSize;

  return {
    items: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function fetchToolboxList(
  path: string,
  query: ToolboxListQuery,
): Promise<ToolboxListResult> {
  const response = await http.get<BackendToolboxListResponse>(path, {
    headers: getBusinessDomainHeaders(),
    params: {
      all: query.all || undefined,
      page: query.page,
      page_size: query.pageSize,
      name: query.keyword || undefined,
      status: query.status,
      category: query.category || undefined,
      metadata_type: query.metadataType || undefined,
      sort_by: "update_time",
      sort_order: "desc",
    },
    skipErrorToast: true,
  });
  const data = response.data;

  return {
    items: (data.data ?? []).map(mapToolbox),
    total: data.total ?? 0,
    page: data.page ?? query.page,
    pageSize: data.page_size ?? query.pageSize,
  };
}

export async function listToolboxes(
  query: ToolboxListQuery,
): Promise<ToolboxListResult> {
  if (useMock) {
    return buildMockListResult(query);
  }

  return fetchToolboxList(`${API_PREFIX}/tool-box/list`, query);
}

export async function listToolboxMarket(
  query: ToolboxListQuery,
): Promise<ToolboxListResult> {
  if (useMock) {
    return buildMockListResult({ ...query, status: "published" });
  }

  return fetchToolboxList(`${API_PREFIX}/tool-box/market`, query);
}

export async function getToolboxMarket(boxId: string): Promise<ToolboxRecord> {
  if (useMock) {
    const record = mockToolboxes.find(
      (item) => item.boxId === boxId && item.status === "published",
    ) ?? mockToolboxes.find((item) => item.boxId === boxId);

    if (!record) {
      throw new Error("Market toolbox not found");
    }

    return record;
  }

  const response = await http.get<BackendToolboxInfo>(
    `${API_PREFIX}/tool-box/market/${boxId}`,
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  return mapToolbox(response.data);
}

export async function getToolbox(boxId: string): Promise<ToolboxRecord> {
  if (useMock) {
    const record = mockToolboxes.find((item) => item.boxId === boxId);

    if (!record) {
      throw new Error("Toolbox not found");
    }

    return record;
  }

  const response = await http.get<BackendToolboxInfo>(
    `${API_PREFIX}/tool-box/${boxId}`,
    { headers: getBusinessDomainHeaders() },
  );

  return mapToolbox(response.data);
}

export async function createToolbox(
  input: ToolboxMutationInput,
): Promise<ToolboxRecord> {
  if (useMock) {
    const record: ToolboxRecord = {
      boxId: `tb_${Date.now()}`,
      name: input.name,
      description: input.description,
      serviceUrl: input.serviceUrl,
      status: "unpublish",
      categoryType: input.category,
      categoryName: input.category,
      metadataType: input.metadataType,
      toolCount: 0,
      tools: [],
      createUser: "local-admin",
      updateTime: Date.now(),
      isInternal: false,
    };
    mockToolboxes = [record, ...mockToolboxes];
    return record;
  }

  const response = await http.post<{ box_id?: string }>(
    `${API_PREFIX}/tool-box`,
    {
      box_category: input.category,
      box_desc: input.description,
      box_name: input.name,
      box_svc_url: input.serviceUrl,
      data: parseOpenApiDataPayload(input.openapiSpec, "edit"),
      metadata_type: input.metadataType,
    },
    { headers: getBusinessDomainHeaders() },
  );

  if (!response.data.box_id) {
    throw new Error("Toolbox creation failed");
  }

  return getToolbox(response.data.box_id);
}

export async function updateToolbox(input: ToolboxEditInput): Promise<void> {
  if (useMock) {
    mockToolboxes = mockToolboxes.map((item) =>
      item.boxId === input.boxId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            serviceUrl: input.serviceUrl,
            categoryType: input.category ?? item.categoryType,
            categoryName: input.category ?? item.categoryName,
            updateTime: Date.now(),
          }
        : item,
    );
    return;
  }

  await http.post(
    `${API_PREFIX}/tool-box/${input.boxId}`,
    {
      box_category: input.category,
      box_desc: input.description,
      box_name: input.name,
      box_svc_url: input.serviceUrl,
      data: parseOpenApiDataPayload(input.openapiSpec, "edit"),
      metadata_type: input.metadataType,
    },
    { headers: getBusinessDomainHeaders() },
  );
}

export async function updateToolboxStatus(
  boxId: string,
  status: ToolboxStatus,
): Promise<void> {
  if (useMock) {
    mockToolboxes = mockToolboxes.map((item) =>
      item.boxId === boxId ? { ...item, status, updateTime: Date.now() } : item,
    );
    return;
  }

  await http.post(
    `${API_PREFIX}/tool-box/${boxId}/status`,
    { status },
    { headers: getBusinessDomainHeaders() },
  );
}

export async function deleteToolbox(boxId: string): Promise<void> {
  if (useMock) {
    mockToolboxes = mockToolboxes.filter((item) => item.boxId !== boxId);
    return;
  }

  await http.delete(`${API_PREFIX}/tool-box/${boxId}`, {
    headers: getBusinessDomainHeaders(),
  });
}
