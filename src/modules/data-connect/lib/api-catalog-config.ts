/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import BigNumber from "bignumber.js";

import {
  formatPrecisionSafeJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { getConnectorOptionDefinitions, validateConnectorOptions } from "./connector-options";
import { isCatalogVariable, protectCatalogConfigVariables } from "@/shared/catalog/config-security";

const CONFIG_KEYS = new Set(["base_url", "variables", "login_request", "options"]);
const OPTION_KEYS = new Set(getConnectorOptionDefinitions("http")?.map(({ key }) => key));
const LOGIN_KEYS = new Set(["request", "response", "success_rule"]);
const REQUEST_KEYS = new Set(["method", "path", "headers", "parameters", "body"]);
const PARAMETER_KEYS = new Set(["name", "value", "default_value", "required"]);
const RESPONSE_KEYS = new Set(["content_type", "statuses"]);
const RESPONSE_STATUS_KEYS = new Set(["description", "headers", "schema", "result"]);
const SUCCESS_KEYS = new Set(["http_status", "body_filter_condition"]);
const VARIABLE_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const MASK = "••••••••";
const CREDENTIAL_HEADER = /^(?:authorization|proxy-authorization|cookie|set-cookie)$/i;
const AUTH_TEMPLATE =
  /^[ \t]*(?:(?:Basic|Bearer)[ \t]+)?\{\{[ \t]*[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*|\[\d+\])*[ \t]*\}\}[ \t]*$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !BigNumber.isBigNumber(value)
  );
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Set<string>) {
  return Object.keys(value).every((key) => keys.has(key));
}

function hasKnownLoginFields(login: Record<string, unknown>) {
  if (!hasOnlyKeys(login, LOGIN_KEYS)) return false;
  if (login.request !== undefined) {
    if (!isRecord(login.request) || !hasOnlyKeys(login.request, REQUEST_KEYS)) return false;
    const parameters = login.request.parameters;
    if (
      parameters !== undefined &&
      (!Array.isArray(parameters) ||
        parameters.some(
          (parameter) => !isRecord(parameter) || !hasOnlyKeys(parameter, PARAMETER_KEYS),
        ))
    )
      return false;
  }
  if (login.response !== undefined) {
    const response = login.response;
    if (!isRecord(response) || !hasOnlyKeys(response, RESPONSE_KEYS)) return false;
    if (response.content_type !== undefined && response.content_type !== "application/json")
      return false;
    if (response.statuses !== undefined) {
      if (!isRecord(response.statuses)) return false;
      if (
        Object.values(response.statuses).some(
          (status) => !isRecord(status) || !hasOnlyKeys(status, RESPONSE_STATUS_KEYS),
        )
      )
        return false;
    }
  }
  return (
    login.success_rule === undefined ||
    (isRecord(login.success_rule) && hasOnlyKeys(login.success_rule, SUCCESS_KEYS))
  );
}

/** Copy editable structures without converting precise numbers to strings or plain objects. */
function copyConfigValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copyConfigValue);
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, copyConfigValue(child)]),
    );
  return value;
}

export function prepareApiCatalogConfigForEdit(
  config: Record<string, unknown>,
): Record<string, unknown> {
  return copyConfigValue(protectCatalogConfigVariables(config, "edit")) as Record<string, unknown>;
}

/** Unknown fixed fields cannot be silently discarded by a complete configuration replacement. */
export function isApiCatalogConfigEditable(config: Record<string, unknown>): boolean {
  if (!hasOnlyKeys(config, CONFIG_KEYS)) return false;
  if (config.base_url !== undefined && typeof config.base_url !== "string") return false;
  if (
    config.options !== undefined &&
    (!isRecord(config.options) || !hasOnlyKeys(config.options, OPTION_KEYS))
  )
    return false;
  if (config.variables !== undefined && !isRecord(config.variables)) return false;
  if (isRecord(config.variables) && !Object.values(config.variables).every(isCatalogVariable))
    return false;
  if (
    config.login_request !== undefined &&
    (!isRecord(config.login_request) || !hasKnownLoginFields(config.login_request))
  )
    return false;
  return true;
}

/** Validate Catalog-owned fields only; the login editor and backend validate their own contracts. */
export function validateApiCatalogConfig(
  config: Record<string, unknown>,
  { requireSecrets = true }: { requireSecrets?: boolean } = {},
): string | undefined {
  if (!isApiCatalogConfigEditable(config)) return "dataConnect.apiCatalog.errors.unsupportedConfig";
  try {
    if (
      typeof config.base_url !== "string" ||
      !config.base_url ||
      config.base_url.trim() !== config.base_url ||
      /[\r\n\0?#]/.test(config.base_url) ||
      config.base_url.includes("{{")
    )
      return "dataConnect.apiCatalog.errors.baseUrl";
    const url = new URL(config.base_url);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return "dataConnect.apiCatalog.errors.baseUrl";
  } catch {
    return "dataConnect.apiCatalog.errors.baseUrl";
  }
  const variables = (config.variables ?? {}) as Record<string, unknown>;
  if (Object.keys(variables).some((name) => !VARIABLE_NAME.test(name) || CONFIG_KEYS.has(name)))
    return "dataConnect.apiCatalog.errors.variables";
  for (const variable of Object.values(variables)) {
    if (!isCatalogVariable(variable)) return "dataConnect.apiCatalog.errors.variables";
    if (!variable.sensitive) continue;
    const value = variable.value;
    if ((value === undefined || value === null) && !requireSecrets) continue;
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      /^enc:/i.test(value) ||
      /^(?:[•●*]+|<protected-value>|<\u654f\u611f\u503c\u5df2\u9690\u85cf>)$/.test(value)
    )
      return "dataConnect.apiCatalog.errors.missingSensitiveValue";
  }
  if (validateConnectorOptions("http", config.options))
    return "dataConnect.apiCatalog.errors.options";
  return undefined;
}

function catalogCredentialValues(config: Record<string, unknown>): string[] {
  const variables = isRecord(config.variables) ? config.variables : {};
  return Object.values(variables).flatMap((variable) => {
    if (typeof variable === "string") return variable ? [variable] : [];
    return isRecord(variable) &&
      (variable.sensitive === true || !isCatalogVariable(variable)) &&
      typeof variable.value === "string" &&
      variable.value
      ? [variable.value]
      : [];
  });
}

function redactCatalogPreviewValue(
  value: unknown,
  secretValues: string[],
  mode: "preview" | "details",
  key = "",
): unknown {
  if (typeof value === "string")
    return secretValues.reduce((text, secret) => text.replaceAll(secret, MASK), value);
  if (Array.isArray(value))
    return value.map((child) => redactCatalogPreviewValue(child, secretValues, mode));
  if (isRecord(value)) {
    const checkCredentialHeaders = mode === "preview" || key === "headers";
    return Object.fromEntries(
      Object.entries(value).map(([name, child]) => {
        if (checkCredentialHeaders && typeof child === "string" && CREDENTIAL_HEADER.test(name))
          return [name, mode === "details" && AUTH_TEMPLATE.test(child) ? child : MASK];
        return [name, redactCatalogPreviewValue(child, secretValues, mode, name)];
      }),
    );
  }
  return value;
}

/** Preserve structured values for the detail tables while masking credentials before rendering. */
export function redactApiCatalogDetails(config: Record<string, unknown>): Record<string, unknown> {
  return redactCatalogPreviewValue(
    protectCatalogConfigVariables(config, "display"),
    catalogCredentialValues(config),
    "details",
  ) as Record<string, unknown>;
}

/** Read-only preview keeps templates symbolic and never renders a declared credential value. */
export function buildApiCatalogPreview(
  config: Record<string, unknown>,
  previewValue?: unknown,
): string {
  return formatPrecisionSafeJSON(
    transformPrecisionSafeJSONRequest(
      redactCatalogPreviewValue(
        previewValue === undefined
          ? protectCatalogConfigVariables(config, "display")
          : previewValue,
        catalogCredentialValues(config),
        "preview",
      ),
    ),
    { allowSpecialKeys: true },
  );
}
