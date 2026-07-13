/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { listMcpMarket, listMcpTools } from "@/modules/execution-factory/services/mcp.service";
import { getToolDetail, listTools } from "@/modules/execution-factory/services/tool.service";
import {
  getToolboxMarket,
  listToolboxMarket,
} from "@/modules/execution-factory/services/toolbox.service";
import type { ToolRecord } from "@/modules/execution-factory/types/tool";

import type { ActionTypeActionSource } from "@/modules/knowledge-network/types/knowledge-network";
import {
  findCatalogTool,
  MOCK_EXECUTION_FACTORY_CATALOG,
} from "@/modules/knowledge-network/services/mock/action-type-tool-catalog";
import {
  AGENT_OPERATOR_API_PREFIX,
  AGENT_OPERATOR_PAGE_SIZE,
  getAgentOperatorHeaders,
} from "@/modules/knowledge-network/services/shared/agent-operator-client";
import {
  logServiceFallback,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";
import {
  getInputParamsFromToolOpenAPISpec,
  type ActionTypeToolInputParam,
} from "@/modules/knowledge-network/utils/tool-input-params";

/** Backend validates PageSize with a max tag; Vega uses 100. */
const CATALOG_PAGE_SIZE = AGENT_OPERATOR_PAGE_SIZE;

type MarketSearchToolBox = {
  box_desc?: string;
  box_id?: string;
  box_name?: string;
  tools?: Array<{
    description?: string;
    name?: string;
    status?: string;
    tool_id?: string;
  }>;
};

type MarketToolboxDetailEntry = {
  box_id?: string;
  box_name?: string;
  tools?: Array<{
    description?: string;
    name?: string;
    tool_id?: string;
    use_rule?: string;
  }>;
};

function mapCatalogToolsFromRecords(
  tools:
    | Array<{
        description?: string;
        name?: string;
        status?: ToolRecord["status"];
        toolId?: string;
        useRule?: string;
      }>
    | undefined,
): ActionTypeCatalogTool[] {
  return (tools ?? []).reduce<ActionTypeCatalogTool[]>((result, tool) => {
      const toolId = tool.toolId || tool.name;
      const toolName = tool.name || tool.toolId;
      if (!toolId || !toolName) {
        return result;
      }

      result.push({
        description: tool.description ?? tool.useRule,
        parameters: [],
        toolId,
        toolName,
      });

      return result;
    }, []);
}

export type ActionTypeCatalogTool = {
  description?: string;
  parameters: Array<{ name: string; required?: boolean; type?: string }>;
  toolId: string;
  toolName: string;
};

export type ActionTypeToolBox = {
  boxId: string;
  boxName: string;
  description?: string;
  tools: ActionTypeCatalogTool[];
};

export type ActionTypeMcpServer = {
  description?: string;
  mcpId: string;
  mcpName: string;
  tools: ActionTypeCatalogTool[];
};

export type ActionTypeExecutionFactoryCatalog = {
  mcpServers: ActionTypeMcpServer[];
  toolBoxes: ActionTypeToolBox[];
};

export type ActionTypeCatalogSelection =
  | {
      boxId: string;
      boxName: string;
      kind: "tool";
      tool: ActionTypeCatalogTool;
    }
  | {
      kind: "mcp";
      mcpId: string;
      mcpName: string;
      tool: ActionTypeCatalogTool;
    };

function filterCatalogByKeyword(
  catalog: ActionTypeExecutionFactoryCatalog,
  keyword: string,
): ActionTypeExecutionFactoryCatalog {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return catalog;
  }

  const matches = (values: Array<string | undefined>) =>
    values.some((value) => value?.toLowerCase().includes(normalizedKeyword));

  return {
    mcpServers: catalog.mcpServers
      .map((server) => {
        const serverMatched = matches([server.mcpName, server.description]);
        const tools = server.tools.filter((tool) =>
          serverMatched
            ? true
            : matches([tool.toolName, tool.description, server.mcpName, server.description]),
        );
        return tools.length > 0 ? { ...server, tools } : null;
      })
      .filter((item): item is ActionTypeMcpServer => Boolean(item)),
    toolBoxes: catalog.toolBoxes
      .map((box) => {
        const boxMatched = matches([box.boxName, box.description]);
        const tools = box.tools.filter((tool) =>
          boxMatched ? true : matches([tool.toolName, tool.description, box.boxName, box.description]),
        );
        return tools.length > 0 ? { ...box, tools } : null;
      })
      .filter((item): item is ActionTypeToolBox => Boolean(item)),
  };
}

async function fetchMarketToolboxDetailTools(boxId: string): Promise<ActionTypeCatalogTool[]> {
  const response = await http.get<MarketToolboxDetailEntry[] | MarketToolboxDetailEntry>(
    `${AGENT_OPERATOR_API_PREFIX}/tool-box/market/${boxId}/box_name,tools`,
    {
      headers: getAgentOperatorHeaders(),
      skipErrorToast: true,
    },
  );

  const detail = Array.isArray(response.data) ? response.data[0] : response.data;

  return (detail?.tools ?? [])
    .filter((tool) => tool.tool_id)
    .map((tool) => ({
      description: tool.description ?? tool.use_rule,
      parameters: [],
      toolId: tool.tool_id!,
      toolName: tool.name ?? tool.tool_id!,
    }));
}

async function searchMarketToolBoxes(keyword: string): Promise<ActionTypeToolBox[]> {
  const response = await http.get<{ data?: MarketSearchToolBox[] }>(
    `${AGENT_OPERATOR_API_PREFIX}/tool-box/market/tools`,
    {
      headers: getAgentOperatorHeaders(),
      params: {
        all: true,
        sort_by: "create_time",
        sort_order: "desc",
        status: "enabled",
        tool_name: keyword.trim(),
      },
      skipErrorToast: true,
    },
  );

  return (response.data.data ?? [])
    .reduce<ActionTypeToolBox[]>((result, box) => {
      if (!box.box_id || !box.box_name) {
        return result;
      }

      const tools = (box.tools ?? [])
        .filter((tool) => tool.tool_id)
        .map((tool) => ({
          description: tool.description,
          parameters: [],
          toolId: tool.tool_id!,
          toolName: tool.name ?? tool.tool_id!,
        }));

      result.push({
        boxId: box.box_id,
        boxName: box.box_name,
        description: box.box_desc,
        tools,
      });

      return result;
    }, []);
}

async function fetchAgentOperatorCatalog(
  keyword = "",
): Promise<ActionTypeExecutionFactoryCatalog> {
  const normalizedKeyword = keyword.trim();

  if (normalizedKeyword) {
    const [toolBoxes, mcpResult] = await Promise.all([
      searchMarketToolBoxes(normalizedKeyword),
      listMcpMarket({
        all: true,
        page: 1,
        pageSize: CATALOG_PAGE_SIZE,
        keyword: normalizedKeyword,
      }),
    ]);

    return {
      mcpServers: mcpResult.items.map((server) => ({
        description: server.description,
        mcpId: server.mcpId,
        mcpName: server.name,
        tools: [],
      })),
      toolBoxes,
    };
  }

  const [toolboxResult, mcpResult] = await Promise.all([
    listToolboxMarket({
      all: true,
      page: 1,
      pageSize: CATALOG_PAGE_SIZE,
    }),
    listMcpMarket({
      all: true,
      page: 1,
      pageSize: CATALOG_PAGE_SIZE,
    }),
  ]);

  return {
    mcpServers: mcpResult.items.map((server) => ({
      description: server.description,
      mcpId: server.mcpId,
      mcpName: server.name,
      tools: [],
    })),
    // Match Vega: market list only returns toolboxes; tools load on expand.
    toolBoxes: toolboxResult.items.map((box) => ({
      boxId: box.boxId,
      boxName: box.name,
      description: box.description,
      tools: [],
    })),
  };
}

function getMockToolBoxTools(boxId: string) {
  return (
    MOCK_EXECUTION_FACTORY_CATALOG.toolBoxes.find((item) => item.boxId === boxId)?.tools ?? []
  );
}

function getMockMcpServerTools(mcpId: string) {
  return (
    MOCK_EXECUTION_FACTORY_CATALOG.mcpServers.find((item) => item.mcpId === mcpId)?.tools ?? []
  );
}

export async function loadActionTypeToolBoxTools(
  boxId: string,
): Promise<ActionTypeCatalogTool[]> {
  if (useMock) {
    return getMockToolBoxTools(boxId);
  }

  const loaders: Array<() => Promise<ActionTypeCatalogTool[]>> = [
    async () => {
      const toolsResult = await listTools(boxId, {
        all: true,
        page: 1,
        pageSize: CATALOG_PAGE_SIZE,
        status: "enabled",
      });
      return mapCatalogToolsFromRecords(toolsResult.items);
    },
    async () => {
      const toolsResult = await listTools(boxId, {
        all: true,
        page: 1,
        pageSize: CATALOG_PAGE_SIZE,
      });
      return mapCatalogToolsFromRecords(toolsResult.items);
    },
    () => fetchMarketToolboxDetailTools(boxId),
    async () => {
      const marketToolbox = await getToolboxMarket(boxId);
      return mapCatalogToolsFromRecords(marketToolbox.tools);
    },
  ];

  for (const [index, load] of loaders.entries()) {
    try {
      const tools = await load();
      if (tools.length > 0) {
        return tools;
      }
    } catch (error) {
      logServiceFallback("loadActionTypeToolBoxTools", error, `loader=${index} boxId=${boxId}`);
    }
  }

  return [];
}

export async function loadActionTypeMcpServerTools(
  mcpId: string,
): Promise<ActionTypeCatalogTool[]> {
  if (useMock) {
    return getMockMcpServerTools(mcpId);
  }

  try {
    const mcpTools = await listMcpTools(mcpId, {
      all: true,
      page: 1,
      pageSize: CATALOG_PAGE_SIZE,
      status: "enabled",
    });

    return mcpTools.map((tool) => ({
      description: tool.description,
      parameters: [],
      toolId: tool.name,
      toolName: tool.name,
    }));
  } catch (error) {
    logServiceFallback("loadActionTypeMcpServerTools", error, `mcpId=${mcpId}`);
    return [];
  }
}

function resolveMockCatalog(keyword: string) {
  return wait(filterCatalogByKeyword(MOCK_EXECUTION_FACTORY_CATALOG, keyword));
}

export async function listActionTypeExecutionFactoryCatalog(
  keyword = "",
): Promise<ActionTypeExecutionFactoryCatalog> {
  if (useMock) {
    return resolveMockCatalog(keyword);
  }

  try {
    const catalog = await fetchAgentOperatorCatalog(keyword);
    return filterCatalogByKeyword(catalog, keyword);
  } catch (error) {
    logServiceFallback("listActionTypeExecutionFactoryCatalog", error, `keyword=${keyword}`);
    return {
      mcpServers: [],
      toolBoxes: [],
    };
  }
}

function mapFlatCatalogParameters(
  parameters: Array<{ name: string; required?: boolean; type?: string }>,
): ActionTypeToolInputParam[] {
  return parameters.map((item) => ({
    description: undefined,
    key: item.name,
    name: item.name,
    required: item.required,
    source: "Body",
    type: item.type ?? "string",
  }));
}

async function fetchMcpToolInputSchema(
  mcpId: string,
  toolName: string,
): Promise<ActionTypeToolInputParam[]> {
  const response = await http.get<{
    tools?: Array<{
      description?: string;
      inputSchema?: {
        properties?: Record<
          string,
          {
            description?: string;
            properties?: Record<string, unknown>;
            required?: string[];
            type?: string;
          }
        >;
        required?: string[];
        type?: string;
      };
      name?: string;
    }>;
  }>(`${AGENT_OPERATOR_API_PREFIX}/mcp/proxy/${mcpId}/tools`, {
    headers: getAgentOperatorHeaders(),
    params: {
      all: true,
      page: 1,
      page_size: 100,
      status: "enabled",
    },
    skipErrorToast: true,
  });

  const tool = (response.data.tools ?? []).find((item) => item.name === toolName);
  const properties = tool?.inputSchema?.properties;
  if (!properties) {
    return [];
  }

  return Object.keys(properties)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => {
      const property = properties[name];
      const children = property.properties
        ? Object.keys(property.properties)
            .sort((left, right) => left.localeCompare(right))
            .map((childName) => {
              const child = property.properties?.[childName] as
                | { description?: string; type?: string }
                | undefined;

              return {
                name: childName,
                key: `${name}.${childName}`,
                type: child?.type ?? "string",
                description: child?.description,
                source: "Body",
              };
            })
        : undefined;

      return {
        name,
        key: name,
        type: property.type ?? "object",
        description: property.description ?? tool?.description,
        source: "Body",
        children,
      };
    });
}

export async function resolveActionTypeToolInputSchema(
  actionSource: ActionTypeActionSource,
): Promise<ActionTypeToolInputParam[]> {
  const mockParameters = findCatalogTool(MOCK_EXECUTION_FACTORY_CATALOG, actionSource)?.parameters;

  if (useMock) {
    return mapFlatCatalogParameters(mockParameters ?? []);
  }

  if (actionSource.type === "tool" && actionSource.boxId && actionSource.toolId) {
    try {
      const detail = await getToolDetail(actionSource.boxId, actionSource.toolId);
      const schema = getInputParamsFromToolOpenAPISpec(detail.apiSpec);
      if (schema.length > 0) {
        return schema;
      }
    } catch (error) {
      logServiceFallback(
        "resolveActionTypeToolInputSchema.toolDetail",
        error,
        `boxId=${actionSource.boxId} toolId=${actionSource.toolId}`,
      );
      return mapFlatCatalogParameters(mockParameters ?? []);
    }
  }

  if (actionSource.type === "mcp" && actionSource.mcpId && actionSource.toolName) {
    try {
      const schema = await fetchMcpToolInputSchema(actionSource.mcpId, actionSource.toolName);
      if (schema.length > 0) {
        return schema;
      }
    } catch (error) {
      logServiceFallback(
        "resolveActionTypeToolInputSchema.mcpProxy",
        error,
        `mcpId=${actionSource.mcpId} toolName=${actionSource.toolName}`,
      );
      return mapFlatCatalogParameters(mockParameters ?? []);
    }
  }

  return mapFlatCatalogParameters(mockParameters ?? []);
}

export async function resolveActionTypeToolParameters(
  actionSource: ActionTypeActionSource,
  fallback: Array<{ name: string; required?: boolean; type?: string }> = [],
): Promise<Array<{ name: string; required?: boolean; type?: string }>> {
  const schema = await resolveActionTypeToolInputSchema(actionSource);

  if (schema.length > 0) {
    return schema.map((item) => ({
      name: item.key,
      required: item.required,
      type: item.type,
    }));
  }

  return fallback;
}

export function buildActionSourceFromCatalogSelection(
  selection: ActionTypeCatalogSelection,
): ActionTypeActionSource {
  if (selection.kind === "mcp") {
    return {
      mcpId: selection.mcpId,
      mcpName: selection.mcpName,
      toolId: selection.tool.toolId,
      toolName: selection.tool.toolName,
      type: "mcp",
    };
  }

  return {
    boxId: selection.boxId,
    boxName: selection.boxName,
    toolId: selection.tool.toolId,
    toolName: selection.tool.toolName,
    type: "tool",
  };
}
