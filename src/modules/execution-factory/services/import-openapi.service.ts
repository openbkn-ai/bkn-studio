/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { registerOpenApiBundle } from "@/modules/execution-factory/services/capability-bundle.service";

import { createToolbox } from "@/modules/execution-factory/services/toolbox.service";

import { importOpenApiTools } from "@/modules/execution-factory/services/tool.service";

import type { OperatorSyncPublishInput } from "@/modules/execution-factory/types/operator-sync";

import {

  analyzeOpenApiDocumentText,

  normalizeGeneratedCapabilityName,

  normalizeGeneratedToolboxDescription,

  normalizeOpenApiDocumentText,

  rewriteOpenApiOperationSummaries,

  rewriteOpenApiServerUrl,

  validateOpenApiDocumentText,

} from "@/modules/execution-factory/utils/metadata-content";



export type RegisterOpenApiImportInput = {

  openapiSpec: string;

  boxId?: string;
  toolboxMode?: "existing" | "new";

  toolboxName?: string;

  toolboxDescription?: string;

  serviceUrl?: string;

  useRule?: string;

  category?: string;

  operatorSync?: OperatorSyncPublishInput;

};

function resolveToolboxTarget(input: RegisterOpenApiImportInput) {
  const mode = input.toolboxMode ?? (input.boxId ? "existing" : "new");
  const boxId = input.boxId?.trim();
  const toolboxName = normalizeGeneratedCapabilityName(input.toolboxName);

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



export type RegisterOpenApiImportResult = {

  boxId: string;

  toolIds: string[];

  successCount: number;

  failureCount: number;

  operatorId?: string;

  operatorIds?: string[];

};



function resolveServiceUrl(openapiSpec: string, override?: string): string {

  if (override?.trim()) {

    return override.trim();

  }



  const analysis = analyzeOpenApiDocumentText(openapiSpec);

  if (analysis.ok && analysis.serverUrl) {

    return analysis.serverUrl;

  }



  return "http://127.0.0.1:9000";

}



export async function registerOpenApiImport(

  input: RegisterOpenApiImportInput,

): Promise<RegisterOpenApiImportResult> {

  const openapiSpec = input.openapiSpec.trim();

  if (!openapiSpec) {

    throw new Error("请上传 OpenAPI 3.0 规范文件。");

  }



  const validation = validateOpenApiDocumentText(openapiSpec);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }



  const serviceUrl = resolveServiceUrl(openapiSpec, input.serviceUrl);
  const normalizedOpenapiSpec = rewriteOpenApiOperationSummaries(
    rewriteOpenApiServerUrl(normalizeOpenApiDocumentText(openapiSpec), serviceUrl),
  );
  const toolboxDescription = normalizeGeneratedToolboxDescription(input.toolboxDescription);
  const target = resolveToolboxTarget(input);



  if (input.operatorSync?.enabled) {
    const bundle = await registerOpenApiBundle({

      openapiSpec: normalizedOpenapiSpec,

      serviceUrl,

      boxId: target.boxId,

      toolboxName: target.toolboxName,

      toolboxDescription,

      category: input.category,

      useRule: input.useRule,

      operatorSync: input.operatorSync,

    });



    return {

      boxId: bundle.boxId,

      toolIds: bundle.toolIds,

      successCount: bundle.toolIds.length,

      failureCount: bundle.failureCount,

      operatorId: bundle.operatorIds[0],

      operatorIds: bundle.operatorIds,

    };

  }



  let boxId = target.boxId;



  if (target.mode === "new") {
    const toolbox = await createToolbox({

      name: target.toolboxName,

      description: toolboxDescription,

      category: input.category ?? "other_category",

      metadataType: "openapi",

      serviceUrl,

    });

    boxId = toolbox.boxId;

  }

  if (!boxId) {
    throw new Error("未能确定目标工具集。");
  }



  const result = await importOpenApiTools(boxId, normalizedOpenapiSpec, input.useRule);



  if (result.successCount === 0) {

    const detail = result.failures[0]?.error ?? "未能从 OpenAPI 文档导入任何工具。";

    throw new Error(detail);

  }



  return {

    boxId,

    toolIds: result.successIds,

    successCount: result.successCount,

    failureCount: result.failureCount,

  };

}
