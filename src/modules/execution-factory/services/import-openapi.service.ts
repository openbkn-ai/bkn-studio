import { registerOpenApiBundle } from "@/modules/execution-factory/services/capability-bundle.service";

import { createToolbox } from "@/modules/execution-factory/services/toolbox.service";

import { importOpenApiTools } from "@/modules/execution-factory/services/tool.service";

import type { OperatorSyncPublishInput } from "@/modules/execution-factory/types/operator-sync";

import {

  analyzeOpenApiDocumentText,

  validateOpenApiDocumentText,

} from "@/modules/execution-factory/utils/metadata-content";



export type RegisterOpenApiImportInput = {

  openapiSpec: string;

  boxId?: string;

  toolboxName?: string;

  toolboxDescription?: string;

  serviceUrl?: string;

  useRule?: string;

  category?: string;

  operatorSync?: OperatorSyncPublishInput;

};



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



function isYamlOpenApiDocument(spec: string): boolean {

  const trimmed = spec.trim();

  return trimmed.startsWith("---") || /^\s*openapi\s*:/m.test(trimmed);

}



export async function registerOpenApiImport(

  input: RegisterOpenApiImportInput,

): Promise<RegisterOpenApiImportResult> {

  const openapiSpec = input.openapiSpec.trim();

  if (!openapiSpec) {

    throw new Error("请上传 OpenAPI 3.0 规范文件。");

  }



  if (!isYamlOpenApiDocument(openapiSpec)) {

    const validation = validateOpenApiDocumentText(openapiSpec);

    if (!validation.ok) {

      throw new Error(validation.reason);

    }

  }



  const serviceUrl = resolveServiceUrl(openapiSpec, input.serviceUrl);



  if (input.operatorSync?.enabled) {

    const toolboxName = input.toolboxName?.trim();

    if (!input.boxId && !toolboxName) {

      throw new Error("请选择已有工具集或填写新工具集名称。");

    }



    const bundle = await registerOpenApiBundle({

      openapiSpec,

      serviceUrl,

      boxId: input.boxId,

      toolboxName,

      toolboxDescription: input.toolboxDescription,

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

      serviceUrl,

    });

    boxId = toolbox.boxId;

  }



  const result = await importOpenApiTools(boxId, openapiSpec, input.useRule);



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
