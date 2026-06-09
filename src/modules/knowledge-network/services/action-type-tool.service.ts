import { http } from "@/framework/request/http";

import type { MockActionTool } from "@/modules/knowledge-network/components/action-type/execution-utils";
import type { ActionTypeActionSource } from "@/modules/knowledge-network/types/knowledge-network";
import {
  findCatalogTool,
  flattenCatalogTools,
  MOCK_EXECUTION_FACTORY_CATALOG,
} from "@/modules/knowledge-network/services/mock/action-type-tool-catalog";
import { useMock, wait } from "@/modules/knowledge-network/services/shared/runtime";

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

type BackendCatalogTool = {
  comment?: string;
  description?: string;
  id?: string;
  name?: string;
  parameters?: Array<{ name: string; required?: boolean; type?: string }>;
  tool_id?: string;
  tool_name?: string;
};

type BackendToolBox = {
  comment?: string;
  description?: string;
  id?: string;
  name?: string;
  tools?: BackendCatalogTool[];
};

type BackendMcpServer = {
  comment?: string;
  description?: string;
  id?: string;
  mcp_id?: string;
  mcp_name?: string;
  name?: string;
  tools?: BackendCatalogTool[];
};

type BackendExecutionFactoryCatalog = {
  mcp_servers?: BackendMcpServer[];
  tool_boxes?: BackendToolBox[];
};

type LegacyToolBoxMarketListItem = {
  box_desc?: string;
  box_id?: string;
  box_name?: string;
  tools?: string[];
};

type LegacyToolBoxMarketListResponse = {
  data?: LegacyToolBoxMarketListItem[];
};

type LegacyToolSchema = {
  properties?: Record<string, { type?: string }>;
  required?: string[];
};

type LegacyToolMetadata = {
  api_spec?: {
    components?: {
      schemas?: Record<string, LegacyToolSchema>;
    };
    request_body?: {
      content?: Record<
        string,
        {
          schema?: LegacyToolSchema & {
            $ref?: string;
          };
        }
      >;
    };
  };
};

type LegacyToolEntry = {
  description?: string;
  metadata?: LegacyToolMetadata;
  name?: string;
  tool_id?: string;
  use_rule?: string;
};

type LegacyToolBoxDetailItem = {
  box_desc?: string;
  box_id?: string;
  box_name?: string;
  tools?: LegacyToolEntry[];
};

function mapBackendCatalogTool(entry: BackendCatalogTool): ActionTypeCatalogTool | null {
  const toolId = entry.tool_id ?? entry.id;
  const toolName = entry.tool_name ?? entry.name;
  if (!toolId || !toolName) {
    return null;
  }

  return {
    description: entry.description ?? entry.comment,
    parameters: (entry.parameters ?? []).map((item) => ({
      name: item.name,
      required: item.required,
      type: item.type,
    })),
    toolId,
    toolName,
  };
}

function mapBackendToolBox(entry: BackendToolBox): ActionTypeToolBox | null {
  const boxId = entry.id;
  const boxName = entry.name;
  if (!boxId || !boxName) {
    return null;
  }

  const tools = (entry.tools ?? [])
    .map(mapBackendCatalogTool)
    .filter((item): item is ActionTypeCatalogTool => Boolean(item));

  return {
    boxId,
    boxName,
    description: entry.description ?? entry.comment,
    tools,
  };
}

function mapBackendMcpServer(entry: BackendMcpServer): ActionTypeMcpServer | null {
  const mcpId = entry.mcp_id ?? entry.id;
  const mcpName = entry.mcp_name ?? entry.name;
  if (!mcpId || !mcpName) {
    return null;
  }

  const tools = (entry.tools ?? [])
    .map(mapBackendCatalogTool)
    .filter((item): item is ActionTypeCatalogTool => Boolean(item));

  return {
    description: entry.description ?? entry.comment,
    mcpId,
    mcpName,
    tools,
  };
}

function mapBackendExecutionFactoryCatalog(
  payload: BackendExecutionFactoryCatalog,
): ActionTypeExecutionFactoryCatalog {
  return {
    mcpServers: (payload.mcp_servers ?? [])
      .map(mapBackendMcpServer)
      .filter((item): item is ActionTypeMcpServer => Boolean(item)),
    toolBoxes: (payload.tool_boxes ?? [])
      .map(mapBackendToolBox)
      .filter((item): item is ActionTypeToolBox => Boolean(item)),
  };
}

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

function resolveLegacyToolSchema(tool: LegacyToolEntry): LegacyToolSchema | null {
  const content = tool.metadata?.api_spec?.request_body?.content;
  const schema = content?.["application/json"]?.schema;
  if (!schema) {
    return null;
  }

  if (schema.properties) {
    return schema;
  }

  const schemaRef = schema.$ref?.split("/").pop();
  if (!schemaRef) {
    return null;
  }

  return tool.metadata?.api_spec?.components?.schemas?.[schemaRef] ?? null;
}

function mapLegacyToolEntry(entry: LegacyToolEntry): ActionTypeCatalogTool | null {
  if (!entry.tool_id || !entry.name) {
    return null;
  }

  const schema = resolveLegacyToolSchema(entry);
  const required = new Set(schema?.required ?? []);
  const parameters = Object.entries(schema?.properties ?? {}).map(([name, value]) => ({
    name,
    required: required.has(name),
    type: value.type,
  }));

  return {
    description: entry.description ?? entry.use_rule,
    parameters,
    toolId: entry.tool_id,
    toolName: entry.name,
  };
}

function mapLegacyToolBoxDetail(entry: LegacyToolBoxDetailItem): ActionTypeToolBox | null {
  if (!entry.box_id || !entry.box_name) {
    return null;
  }

  const tools = (entry.tools ?? [])
    .map(mapLegacyToolEntry)
    .filter((item): item is ActionTypeCatalogTool => Boolean(item));

  if (tools.length === 0) {
    return null;
  }

  return {
    boxId: entry.box_id,
    boxName: entry.box_name,
    description: entry.box_desc,
    tools,
  };
}

async function fetchLegacyToolBoxCatalog(
  keyword: string,
): Promise<ActionTypeExecutionFactoryCatalog> {
  const response = await http.get<LegacyToolBoxMarketListResponse>(
    "/agent-operator-integration/v1/tool-box/market",
    {
      params: {
        limit: 200,
        offset: 0,
      },
    },
  );

  const filteredBoxes = (response.data.data ?? []).filter((item) => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return true;
    }

    const values = [item.box_name, item.box_desc, ...(item.tools ?? [])];
    return values.some((value) => value?.toLowerCase().includes(normalizedKeyword));
  });

  const detailResponses = await Promise.allSettled(
    filteredBoxes
      .filter((item): item is LegacyToolBoxMarketListItem & { box_id: string } =>
        typeof item.box_id === "string" && item.box_id.trim().length > 0,
      )
      .map((item) =>
        http.get<LegacyToolBoxDetailItem[]>(
          `/agent-operator-integration/v1/tool-box/market/${item.box_id}/box_name,tools`,
        ),
      ),
  );

  return {
    mcpServers: [],
    toolBoxes: detailResponses
      .flatMap((result) =>
        result.status === "fulfilled" ? result.value.data.map(mapLegacyToolBoxDetail) : [],
      )
      .filter((item): item is ActionTypeToolBox => Boolean(item)),
  };
}

export async function listActionTypeExecutionFactoryCatalog(
  keyword = "",
): Promise<ActionTypeExecutionFactoryCatalog> {
  if (useMock) {
    return wait(filterCatalogByKeyword(MOCK_EXECUTION_FACTORY_CATALOG, keyword));
  }

  try {
    const response = await http.get<BackendExecutionFactoryCatalog>(
      "/bkn-backend/v1/execution-factory/catalog",
      {
        params: {
          keyword: keyword.trim() || undefined,
          limit: 200,
          offset: 0,
        },
      },
    );

    return filterCatalogByKeyword(mapBackendExecutionFactoryCatalog(response.data), keyword);
  } catch {
    try {
      return filterCatalogByKeyword(await fetchLegacyToolBoxCatalog(keyword), keyword);
    } catch {
      return {
        mcpServers: [],
        toolBoxes: [],
      };
    }
  }
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

export function resolveCatalogToolParameters(actionSource?: ActionTypeActionSource) {
  if (!actionSource?.toolId) {
    return undefined;
  }

  if (useMock) {
    return findCatalogTool(MOCK_EXECUTION_FACTORY_CATALOG, actionSource)?.parameters;
  }

  return undefined;
}

export async function listActionTypeToolCatalog(): Promise<MockActionTool[]> {
  const catalog = await listActionTypeExecutionFactoryCatalog();
  return flattenCatalogTools(catalog);
}
