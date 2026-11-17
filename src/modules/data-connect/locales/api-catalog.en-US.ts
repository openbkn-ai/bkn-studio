/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const apiCatalogEnUS = {
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
  newConfig: "Saving configuration does not verify authentication or business access.",
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
  testTarget: "Validation scope",
  transport: "TCP / TLS reachability",
  local: "Local form validation",
  loginTest: "Login validation — unavailable",
  resourceTest: "Selected Resource validation — unavailable",
  unavailableTests:
    "This backend contract provides TCP/TLS tests only. Explicit login and Resource validation require the corresponding backend capability.",
  testHint: "A reachable service does not prove successful authentication or business access.",
  startTest: "Run test",
  transportSuccess:
    "Service entry is reachable. Authentication and business access have not been verified.",
  localSuccess:
    "Local form validation passed. No connectivity, authentication or business request was made.",
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
  testUnsupported:
    "This service does not support the requested validation scope. No authentication or business validation has been confirmed.",
  resourceRequired: "Select a callable read Resource from this Catalog.",
  loginSuccess: "Login validation passed. Business Resource access has not been verified.",
  resourceSuccess: "The selected read Resource passed business validation.",
  resultEntries: "Mapped result preview (read-only)",
  resource: "Read Resource",
  resourceSearch: "Search Resources in this Catalog",
  noResources:
    "No callable read API Resources were found. Resource management is provided by the Resource workflow.",
  resourceDenied: "Unavailable or missing query permission",
  resourceHint:
    "Uses only saved Catalog and Resource definitions. Draft connection changes are not included.",
  resourceScope: "Selected Resource business validation",
  loginScope: "Explicit login validation",
  noLoginConfigured: "The selected configuration does not define a login request.",
  catalogDisabled:
    "Enable this Catalog before testing login or business access with its saved configuration.",
  paging: "Override this test's paging",
  pagingHint:
    "Leave values empty to use the Resource's saved paging defaults. Only one page is requested.",
  offset: "Offset",
  page: "Page",
  limit: "Page size",
  invalidPaging: "Check paging values against the saved Resource's mode, page base and limit.",
  noFilters:
    "Caller filters are not supported by this validation contract. A definition requiring filter values can fail explicitly.",
  backendScopeHint:
    "Login and Resource tests require a backend that returns the matching validation scope. Older services are reported as unsupported.",
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
