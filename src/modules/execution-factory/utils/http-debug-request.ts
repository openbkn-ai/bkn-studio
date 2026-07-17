/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";
import type {
  ToolDebugInput,
  ToolIoParameter,
  ToolIoSpec,
} from "@/modules/execution-factory/types/tool";
import {
  buildDefaultDebugBody,
  buildSampleFromToolParameters,
} from "@/modules/execution-factory/utils/generate-sample-json";

export type HttpDebugFormValues = {
  requestBody?: string;
  requestHeaders?: string;
  requestPath?: string;
  requestQuery?: string;
};

export type HttpDebugInitialValues = Required<HttpDebugFormValues>;

function stringify(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function parametersAt(ioSpec: ToolIoSpec | undefined, location: string) {
  return (ioSpec?.parameters ?? []).filter((parameter) => parameter.in === location);
}

function parameterSample(parameters: ToolIoParameter[]) {
  return stringify(buildSampleFromToolParameters(parameters));
}

export function buildHttpDebugInitialValues(
  ioSpec?: ToolIoSpec,
  functionInput?: FunctionInputPayload,
  defaultRequestBody?: string,
): HttpDebugInitialValues {
  const bodyIoSpec = ioSpec ? { ...ioSpec, parameters: [] } : undefined;

  return {
    requestBody:
      defaultRequestBody ??
      buildDefaultDebugBody({
        ioSpec: bodyIoSpec,
        functionInput,
      }),
    requestHeaders: parameterSample(parametersAt(ioSpec, "header")),
    requestPath: parameterSample(parametersAt(ioSpec, "path")),
    requestQuery: parameterSample(parametersAt(ioSpec, "query")),
  };
}

export function parseJsonObject(
  value: string | undefined,
  label: string,
): Record<string, unknown> | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

function assertRequiredParameters(
  value: Record<string, unknown> | undefined,
  parameters: ToolIoParameter[],
  label: string,
) {
  const missing = parameters
    .filter((parameter) => parameter.required)
    .map((parameter) => parameter.name)
    .filter((name) => {
      const current = value?.[name];
      return current === undefined || current === null || current === "";
    });

  if (missing.length > 0) {
    throw new Error(`${label}: missing required parameters: ${missing.join(", ")}`);
  }
}

function assertPathTemplateResolved(
  pathTemplate: string | undefined,
  path: Record<string, string> | undefined,
) {
  if (!pathTemplate) {
    return;
  }

  const placeholderNames = Array.from(
    pathTemplate.matchAll(/\{([^}]+)\}|:([A-Za-z_][A-Za-z0-9_]*)/g),
    (match) => match[1] ?? match[2],
  );
  const missing = placeholderNames.filter((name) => !path?.[name]);

  if (missing.length > 0) {
    throw new Error(`Path: unresolved placeholders: ${missing.join(", ")}`);
  }
}

export function buildHttpDebugRequest(
  values: HttpDebugFormValues,
  ioSpec?: ToolIoSpec,
  pathTemplate?: string,
): ToolDebugInput {
  const body = parseJsonObject(values.requestBody, "Body");
  const header = parseJsonObject(values.requestHeaders, "Header");
  const query = parseJsonObject(values.requestQuery, "Query");
  const rawPath = parseJsonObject(values.requestPath, "Path");
  const path = rawPath
    ? Object.fromEntries(Object.entries(rawPath).map(([key, value]) => [key, String(value)]))
    : undefined;

  assertRequiredParameters(header, parametersAt(ioSpec, "header"), "Header");
  assertRequiredParameters(query, parametersAt(ioSpec, "query"), "Query");
  assertRequiredParameters(path, parametersAt(ioSpec, "path"), "Path");
  assertPathTemplateResolved(pathTemplate, path);

  return {
    ...(body && Object.keys(body).length > 0 ? { body } : {}),
    ...(header && Object.keys(header).length > 0 ? { header } : {}),
    ...(query && Object.keys(query).length > 0 ? { query } : {}),
    ...(path && Object.keys(path).length > 0 ? { path } : {}),
  };
}

export function parametersForLocation(
  ioSpec: ToolIoSpec | undefined,
  location: string,
): ToolIoParameter[] {
  return parametersAt(ioSpec, location);
}
