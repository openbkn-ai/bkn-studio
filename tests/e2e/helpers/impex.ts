import { randomUUID } from "node:crypto";

import type { APIRequestContext } from "@playwright/test";

import { buildUniqueName } from "./common";

export type ImpexImportMode = "create" | "upsert";

export function cloneOperatorImpexForCreate(exported: Record<string, unknown>, newName: string) {
  const payload = JSON.parse(JSON.stringify(exported)) as {
    operator?: { configs?: Array<Record<string, unknown>> };
  };
  const item = payload.operator?.configs?.[0];
  if (!item) {
    throw new Error("Operator impex payload missing configs[0]");
  }
  const metadataVersion = randomUUID();
  item.operator_id = randomUUID();
  item.operator_name = newName;
  item.version = metadataVersion;
  item.status = "unpublish";
  const metadata = item.metadata as Record<string, unknown> | undefined;
  if (metadata) {
    metadata.version = metadataVersion;
  }
  return payload;
}

export function cloneToolboxImpexForCreate(exported: Record<string, unknown>, newName: string) {
  const payload = JSON.parse(JSON.stringify(exported)) as {
    toolbox?: { configs?: Array<Record<string, unknown>> };
  };
  const item = payload.toolbox?.configs?.[0];
  if (!item) {
    throw new Error("Toolbox impex payload missing configs[0]");
  }
  const newBoxId = randomUUID();
  item.box_id = newBoxId;
  item.box_name = newName;
  item.status = "unpublish";
  if (Array.isArray(item.tools)) {
    for (const tool of item.tools as Array<Record<string, unknown>>) {
      tool.box_id = newBoxId;
      tool.tool_id = randomUUID();
    }
  }
  return payload;
}

export function cloneMcpImpexForCreate(exported: Record<string, unknown>, newName: string) {
  const payload = JSON.parse(JSON.stringify(exported)) as {
    mcp?: { configs?: Array<Record<string, unknown>> };
    toolbox?: { configs?: Array<Record<string, unknown>> };
  };
  const item = payload.mcp?.configs?.[0];
  if (!item) {
    throw new Error("MCP impex payload missing configs[0]");
  }

  const boxIdMap = new Map<string, string>();
  const toolIdMap = new Map<string, string>();

  if (payload.toolbox?.configs) {
    for (const toolbox of payload.toolbox.configs) {
      const oldBoxId = String(toolbox.box_id);
      const newBoxId = randomUUID();
      boxIdMap.set(oldBoxId, newBoxId);
      toolbox.box_id = newBoxId;
      toolbox.status = "unpublish";
      if (Array.isArray(toolbox.tools)) {
        for (const tool of toolbox.tools as Array<Record<string, unknown>>) {
          const oldToolId = String(tool.tool_id);
          toolIdMap.set(oldToolId, randomUUID());
          tool.box_id = newBoxId;
          tool.tool_id = toolIdMap.get(oldToolId);
          if (tool.source_id) {
            tool.source_id = randomUUID();
          }
        }
      }
    }
  }

  item.mcp_id = randomUUID();
  item.name = newName;
  item.version = 1;
  item.status = "unpublish";
  if (Array.isArray(item.mcp_tools)) {
    for (const tool of item.mcp_tools as Array<Record<string, unknown>>) {
      tool.mcp_id = item.mcp_id;
      tool.mcp_tool_id = randomUUID();
      tool.mcp_version = 1;
      const mappedBoxId = boxIdMap.get(String(tool.box_id));
      const mappedToolId = toolIdMap.get(String(tool.tool_id));
      if (mappedBoxId) {
        tool.box_id = mappedBoxId;
      }
      if (mappedToolId) {
        tool.tool_id = mappedToolId;
      }
    }
  }
  return payload;
}

export function buildImpexImportName(prefix: string) {
  return buildUniqueName(prefix);
}

export async function writeImpexTempFile(
  _request: APIRequestContext,
  payload: unknown,
  filename = "import.adp.json",
) {
  return {
    name: filename,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload)),
  };
}
