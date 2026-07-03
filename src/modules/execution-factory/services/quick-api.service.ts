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

  toolboxName?: string;

  toolboxDescription?: string;

  category?: string;

  operatorSync?: OperatorSyncPublishInput;

  toolName?: string;

};



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
      const list = await listToolboxes({
        keyword: input.toolboxName.trim(),
        page: 1,
        pageSize: 100,
      }).catch(() => null);
      toolboxVisible = Boolean(
        list?.items.some((item) => item.boxId === input.boxId),
      );
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



  if (input.operatorSync?.enabled) {

    const toolboxName = input.toolboxName?.trim();

    if (!input.boxId && !toolboxName) {

      throw new Error("请选择已有工具集或填写新工具集名称。");

    }



    const bundle = await registerOpenApiBundle({

      openapiSpec: input.openapiSpec,

      serviceUrl: input.serviceUrl,

      boxId: input.boxId,

      toolboxName,

      toolboxDescription: input.toolboxDescription,

      category: input.category,

      operatorSync: input.operatorSync,

    });



    await confirmQuickApiPersistence({
      boxId: bundle.boxId,
      toolIds: bundle.toolIds,
      toolboxName,
    });

    return {

      boxId: bundle.boxId,

      toolIds: bundle.toolIds,

      operatorId: bundle.operatorIds[0],

      operatorIds: bundle.operatorIds,

    };

  }



  let boxId = input.boxId;



  if (!boxId) {

    const toolboxName = input.toolboxName?.trim();

    if (!toolboxName) {

      throw new Error("请选择已有工具集或填写新工具集名称。");

    }



    const toolbox = await createToolbox({

      name: toolboxName,

      description: input.toolboxDescription,

      category: input.category ?? "other_category",

      metadataType: "openapi",

      serviceUrl: input.serviceUrl,

    });

    boxId = toolbox.boxId;

  }



  const result = await createTool(boxId, {

    metadataType: "openapi",

    openapiSpec: input.openapiSpec,

  });



  if (result.failureCount > 0 || result.successIds.length === 0) {

    const detail = result.failures[0]?.error ?? "工具创建失败";

    throw new Error(detail);

  }



  await confirmQuickApiPersistence({
    boxId,
    toolIds: result.successIds,
    toolboxName: input.toolboxName,
  });

  return {

    boxId,

    toolIds: result.successIds,

  };

}
