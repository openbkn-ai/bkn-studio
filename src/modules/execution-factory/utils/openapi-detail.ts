/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ToolIoSpec } from "@/modules/execution-factory/types/tool";
import { parseOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";
import { parseOpenApiOperationIo } from "@/modules/execution-factory/utils/openapi-operation-io";

export type OpenApiEndpointDetail = {
  ioSpec?: ToolIoSpec;
  method?: string;
  path?: string;
  serverUrl?: string;
};

const HTTP_METHODS = new Set([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
]);

export function parseOpenApiEndpointDetail(
  openapiSpec?: string,
): OpenApiEndpointDetail | undefined {
  if (!openapiSpec?.trim()) {
    return undefined;
  }

  const parseResult = parseOpenApiDocumentText(openapiSpec);
  if (!parseResult.ok) {
    return undefined;
  }
  const document = parseResult.document;

  const servers = document.servers as Array<{ url?: string }> | undefined;
  const serverUrl = servers?.[0]?.url;
  const paths = document.paths as Record<string, Record<string, unknown>> | undefined;

  if (!paths) {
    return { serverUrl };
  }

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) {
        continue;
      }

      if (typeof operation !== "object" || operation === null) {
        continue;
      }

      return {
        serverUrl,
        path,
        method: method.toUpperCase(),
        ioSpec: parseOpenApiOperationIo(operation, document, pathItem),
      };
    }
  }

  return { serverUrl };
}
