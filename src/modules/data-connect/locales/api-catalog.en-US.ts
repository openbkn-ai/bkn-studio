/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const apiCatalogEnUS = {
  details: {
    field: "Field",
    defaultLimits: "Uses the backend's default timeout and response size limits.",
    protected: "Sensitive value hidden",
    loginConfigured: "Login configured · View definition",
    noLogin: "No separate login request configured",
    additional: "Additional configuration",
    emptyArray: "Empty array",
    emptyObject: "Empty object",
    emptyString: "Empty string",
  },
  service: "Service settings",
  variables: "Variables and credentials",
  login: "Optional login",
  baseUrl: "Service address",
  baseUrlHint: "HTTP or HTTPS address without credentials, query parameters or a fragment.",
  variableName: "Variable name",
  variableValue: "Variable value",
  sensitiveValue: "Sensitive value",
  sensitive: "Sensitive",
  sensitiveHint:
    "Mark this variable as sensitive. When storage encryption is enabled, its value is encrypted before being stored in the database.",
  addVariable: "Add variable",
  removeVariable: "Remove variable",
  variablesHint:
    "Names are case-sensitive: start with a letter, then use letters, digits or underscores. Reference variables by name in request templates.",
  noVariables: "No variables configured. Anonymous services do not require credentials.",
  storedValue: "Saved value is not read back. Re-enter it when replacing configuration.",
  metadataPreserved:
    "Connection configuration is unchanged. Saving preserves stored configuration and credentials.",
  replacement:
    "Connection configuration will be replaced in full. Re-enter every sensitive variable you retain.",
  newConfig: "Saving runs a connection test. Passing it does not verify business Resource access.",
  readonly:
    "This configuration cannot be edited losslessly with the current editor. You can still update its basic information.",
  unavailable:
    "This API connector is unavailable. Confirm that it is installed, enabled and licensed for Professional or higher.",
  enableLogin: "Run one login before the business request",
  loginHint:
    "Reference Catalog variables for credentials. The backend manages Cookies for this call only.",
  noLogin:
    "Login is not configured. Resource request templates can reference variables to construct authentication headers.",
  preview: "Redacted preview",
  previewHint:
    "Read-only configuration preview. Sensitive values are hidden and templates are not evaluated. This is not a submission payload.",
  previewEmpty: "No connection configuration.",
  testTitle: "Test API connection",
  testScope: "Configuration to test",
  draft: "Current configuration (unsaved)",
  saved: "Saved Catalog configuration",
  loginTestHint:
    "The selected configuration defines a login request. The test runs one login and validates its response and success conditions.",
  transportTestHint:
    "The selected configuration has no login request. The test checks TCP/TLS reachability only; tokens, API keys and business access are not verified.",
  resourceTestHint:
    "Validate business responses and field mappings when saving an API Resource or previewing its data.",
  startTest: "Run test",
  connectionSuccess: "Connection test passed. Business Resource access has not been verified.",
  savedResult: "Result applies to saved configuration. It does not validate unsaved changes.",
  draftResult:
    "Result applies to the current unsaved connection configuration. No configuration was saved.",
  staleResult: "Configuration changed while or after testing. This result is out of date.",
  cannotTestDraft: "Testing unsaved configuration requires Catalog create permission.",
  conflict:
    "This Catalog was updated elsewhere. Your draft is retained. Reload the latest version before saving again.",
  reload: "Reload latest configuration",
  reloadTitle: "Discard the draft and reload?",
  reloadHint: "This clears unsaved changes and credentials entered in this editing session.",
  errors: {
    unsupportedConfig: "The current editor cannot safely replace this configuration.",
    baseUrl:
      "Enter an HTTP or HTTPS service address without credentials, query parameters or a fragment.",
    variables: "Variable names must be unique and start with a letter. Check each variable value.",
    sensitiveVariables:
      "Sensitive declarations must reference distinct variable names with string values.",
    missingSensitiveValue:
      "Re-enter every retained sensitive variable before replacing configuration. Masked placeholders cannot be submitted.",
    options:
      "Timeout and response size must be positive integers, or omitted for platform defaults.",
    incompleteInput:
      "Complete or correct the highlighted graphical inputs before saving or testing this configuration.",
  },
};
