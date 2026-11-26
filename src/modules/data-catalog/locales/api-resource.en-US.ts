/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const apiResourceEnUS = {
  invocation: {
    filter: "Specify filter conditions",
    noFilterableFields:
      "In Output fields, turn on Allow filtering for at least one supported field.",
    noPagingRule: "Configure a paging rule in API information first.",
    validation: "Save-time validation inputs",
    validationHint:
      "Used only for this validation when creating a resource or changing its API definition or field mapping. These inputs are never saved.",
  },
  table: {
    field: "Field",
    variable: "Variable",
    sensitive: "Sensitive",
    protected: "Sensitive value hidden",
    emptyArray: "Empty array",
    emptyObject: "Empty object",
    emptyString: "Empty string",
    additional: "Additional configuration",
    responseHeaders: "Response headers",
    schema: "Response schema",
    conditions: "Conditions",
  },
  notConfigured: "Not configured",
  pageSize: "Rows per page",

  mockTestHint:
    "Simulates sample data for the saved definition only. Unsaved drafts, login and real upstream responses are not validated.",
  mockHint:
    "Mock demo: configuration is kept in this page session and resets on reload. Saves and test results are simulated; no upstream service is called.",
  mockSaved: "Mock configuration saved. No real upstream validation was performed.",
  emptyCatalog:
    "No API resources yet. Create a read-only API resource to define its request and output mapping.",
  create: "Create API resource",
  edit: "Edit API resource",
  configuration: "API resource configuration",
  definition: "API information",
  name: "Resource name",
  mappingHint: "Object rows use source field names. Array rows use field order.",
  outputFields: "Output fields",
  fieldName: "Public field name",
  originalName: "Source field name",
  displayName: "Display name",
  fieldType: "Field type",
  filterable: "Filterable",
  decimalSettings: "Decimal settings",
  decimalSettingsClose: "Close decimal settings",
  precision: "Precision",
  scale: "Scale",
  addField: "Add output field",
  variables: "Resource variables",
  variablesHint:
    "Resource variables are used in business templates. The catalog owns the destination, credentials and login configuration.",
  sensitive: "Sensitive value",
  storedVariable:
    "Stored sensitive values cannot be read. Replace them when required by definition validation; metadata edits preserve the stored definition.",
  request: "Business request",
  requestHint:
    "The effect is explicitly read, including POST operations. Templates may reference catalog/resource variables and declared filter/paging context.",
  response: "Response contract",
  success: "Success rule",
  paging: "Paging rule",
  pagingMode: "Paging mode",
  default_limit: "Default limit",
  max_limit: "Maximum limit",
  page_base: "Page base",
  pagingHint:
    "Request query or body must bind the applicable __paging.offset / __paging.page and __paging.limit. Each invocation retrieves one page.",
  result_rows: "Result rows path",
  result_total: "Result total path",
  extractionHint:
    "Paths are relative to the body without a $. prefix. An empty rows path selects the root; the total path must be non-empty.",
  saveValidate: "Save and validate",
  saveHint:
    "Creating a resource or changing its definition/mapping validates the candidate through one default-page backend call before saving. Metadata-only edits make no business call.",
  savedValidated: "Saved: the backend validated this candidate and its default-page response.",
  savedFields: "Output fields saved.",
  savedReadbackFailed: "The resource was saved. Its latest details could not be loaded.",
  retryReadback: "Retry loading resource",
  savedMetadata: "Metadata saved; no new business validation was performed.",
  testPaging: "Specify single-page inputs",
  offset: "Offset (blank uses default)",
  limit: "Limit (blank uses default)",
  total: "Total count",
  unknown: "Unknown",
  currentPage: "Page {{page}}",
  previousPage: "Previous page",
  nextPage: "Next page",
  endOfResults: "End of results",
  warnings: "The backend returned query warnings. Check the definition and invocation scope.",
  unavailable:
    "The API connector is unavailable, disabled or unlicensed for this edition. Server connector availability controls these operations.",
  readOnly: "This account cannot edit this API resource configuration.",
  disabledCatalogHint:
    "The catalog is disabled. Validation and preview are unavailable. You can still edit metadata.",
  disabledHint: "The resource is disabled. Preview and test runs are unavailable.",
  conflict: "The resource version changed. Reload and review the latest version before continuing.",
  reloadTitle: "Reload resource?",
  reloadHint: "Unsaved edits will be discarded and the latest definition loaded.",
  stateHint: "This changes the enabled state of the resource.",
  deleteTitle: "Delete API resource {{name}}?",
  deleteHint: "Deletes this resource definition. The backend checks dependencies and permissions.",
  errors: {
    variables:
      "Resource variable names must begin with a letter, and each variable requires a non-null value. Sensitive values must be strings. Re-enter protected values before replacing a definition.",
    metadata: "Enter a resource name.",
    mapping:
      "Add at least one output field with a source field name, unique public name, and display name.",
    decimal:
      "Decimal fields require positive integer precision and integer scale; zero, negative scale and scale greater than precision are supported.",
    resource: "Resource is missing or is not a read-only API resource.",
    catalog: "Choose a compatible non-built-in API catalog.",
    incomplete: "Correct invalid inputs in the graphical editor.",
    paging: "Explicit paging values must be non-negative safe integers.",
    queryUnavailable: "Resource state or query permission changed. Reload before testing.",
  },
};
