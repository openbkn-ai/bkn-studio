/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export { ApiRequestEditor } from "./ApiRequestEditor";
export { ApiResponseEditor } from "./ApiResponseEditor";
export { ApiSuccessRuleEditor } from "./ApiSuccessRuleEditor";
export type { ApiDefinitionEditorProps } from "./types";
export { ApiLoginEditor, type ApiLoginEditorProps } from "./ApiLoginEditor";
export { ApiSchemaEditor, type ApiSchemaEditorProps } from "./ApiSchemaEditor";
export { ApiValueEditor, ApiValueTypeSelect, type ValueEditorProps } from "./ApiValueEditor";
export { ApiVariableEditor } from "./ApiVariableEditor";
export { validateApiLoginDefinition } from "./model";

export function createApiLoginDefinition(): Record<string, unknown> {
  return {
    request: { method: "POST", path: "", headers: {} },
    response: {
      content_type: "application/json",
      statuses: {
        "200": { description: "", schema: { type: "object", properties: {} } },
      },
    },
    success_rule: { http_status: [200] },
  };
}
