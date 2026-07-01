/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { registerOpenApiBundle } from "@/modules/execution-factory/services/capability-bundle.service";

import { createToolbox } from "@/modules/execution-factory/services/toolbox.service";

import { createTool } from "@/modules/execution-factory/services/tool.service";

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



  return {

    boxId,

    toolIds: result.successIds,

  };

}
