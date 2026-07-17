/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { registerOpenApiBundle } from "@/modules/execution-factory/services/capability-bundle.service";

import {
  createToolbox,
  getToolbox,
  listToolboxes,
} from "@/modules/execution-factory/services/toolbox.service";

import { createTool, listTools } from "@/modules/execution-factory/services/tool.service";

import type { OperatorSyncPublishInput } from "@/modules/execution-factory/types/operator-sync";

import { validateOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";



export type RegisterQuickApiInput = {

  openapiSpec: string;

  serviceUrl: string;

  boxId?: string;
  toolboxMode?: "existing" | "new";

  toolboxName?: string;

  toolboxDescription?: string;

  category?: string;

  operatorSync?: OperatorSyncPublishInput;

  toolName?: string;
  toolDescription?: string;

};

function resolveToolboxTarget(input: RegisterQuickApiInput) {
  const mode = input.toolboxMode ?? (input.boxId ? "existing" : "new");
  const boxId = input.boxId?.trim();
  const toolboxName = input.toolboxName?.trim();

  if (mode === "existing") {
    if (!boxId) {
      throw new Error("已选择使用已有工具集，但未提交工具集 ID，请重新选择。");
    }
    return { mode, boxId, toolboxName: undefined };
  }

  if (!toolboxName) {
    throw new Error("请填写新工具集名称。");
  }
  return { mode, boxId: undefined, toolboxName };
}



export type RegisterQuickApiResult = {

  boxId: string;

  toolIds: string[];

  operatorId?: string;

  operatorIds?: string[];

};

const CONFIRM_ATTEMPTS = 3;
const CONFIRM_RETRY_DELAY_MS = 150;

function delay(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function confirmQuickApiPersistence(input: {
  boxId: string;
  toolIds: string[];
  toolboxName?: string;
}) {
  let toolboxVisible = false;
  let toolsVisible = false;

  for (let attempt = 1; attempt <= CONFIRM_ATTEMPTS; attempt += 1) {
    const toolbox = await getToolbox(input.boxId).catch(() => null);
    toolboxVisible = Boolean(toolbox);

    if (toolboxVisible && input.toolboxName?.trim()) {
      void listToolboxes({
        keyword: input.toolboxName.trim(),
        page: 1,
        pageSize: 100,
      }).catch(() => null);
    }

    if (toolboxVisible) {
      const toolList = await listTools(input.boxId, {
        all: true,
        page: 1,
        pageSize: 100,
      }).catch(() => null);
      const visibleToolIds = new Set(toolList?.items.map((item) => item.toolId) ?? []);
      toolsVisible = input.toolIds.every((toolId) => visibleToolIds.has(toolId));
    }

    if (toolboxVisible && toolsVisible) {
      return;
    }

    if (attempt < CONFIRM_ATTEMPTS) {
      await delay(CONFIRM_RETRY_DELAY_MS);
    }
  }

  if (!toolboxVisible) {
    throw new Error("Toolbox creation was not persisted. Please retry saving.");
  }

  throw new Error("Tool creation was not persisted. Please retry saving.");
}



export async function registerQuickApi(

  input: RegisterQuickApiInput,

): Promise<RegisterQuickApiResult> {

  const validation = validateOpenApiDocumentText(input.openapiSpec);

  if (!validation.ok) {

    throw new Error(validation.reason);

  }

  const target = resolveToolboxTarget(input);



  if (input.operatorSync?.enabled) {
    const bundle = await registerOpenApiBundle({

      openapiSpec: input.openapiSpec,

      serviceUrl: input.serviceUrl,

      boxId: target.boxId,

      toolboxName: target.toolboxName,

      toolboxDescription: input.toolboxDescription,

      category: input.category,

      operatorSync: input.operatorSync,

    });



    await confirmQuickApiPersistence({
      boxId: bundle.boxId,
      toolIds: bundle.toolIds,
      toolboxName: target.toolboxName,
    });

    return {

      boxId: bundle.boxId,

      toolIds: bundle.toolIds,

      operatorId: bundle.operatorIds[0],

      operatorIds: bundle.operatorIds,

    };

  }



  let boxId = target.boxId;



  if (target.mode === "new") {
    const toolbox = await createToolbox({

      name: target.toolboxName,

      description: input.toolboxDescription,

      category: input.category ?? "other_category",

      metadataType: "openapi",

      serviceUrl: input.serviceUrl,

    });

    boxId = toolbox.boxId;

  }

  if (!boxId) {
    throw new Error("未能确定目标工具集。");
  }



  const result = await createTool(boxId, {

    metadataType: "openapi",

    name: input.toolName,

    description: input.toolDescription,

    openapiSpec: input.openapiSpec,

  });



  if (result.failureCount > 0 || result.successIds.length === 0) {

    const detail = result.failures[0]?.error ?? "工具创建失败";

    throw new Error(detail);

  }



  await confirmQuickApiPersistence({
    boxId,
    toolIds: result.successIds,
    toolboxName: target.toolboxName,
  });

  return {

    boxId,

    toolIds: result.successIds,

  };

}
