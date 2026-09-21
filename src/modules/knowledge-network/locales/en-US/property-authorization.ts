/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const propertyAuthorizationPart = {
  objectTypeMaskRuleTitle: "Column Masking Rule",
  objectTypeMaskRuleDrawerTitle: "{{name}} / Column Masking Rule",
  objectTypeMaskRuleDescription:
    "This defines a Column Masking rule only; it does not enable Column Masking by itself. The rule applies only when a user's or role's effective access to this property is Column Masking. Source data is not modified.",
  objectTypeMaskRuleType: "Rule type",
  objectTypeMaskRuleNone: "Not configured",
  objectTypeMaskRuleKind: {
    fixed: "Fixed replacement",
    partial: "Partial reveal",
    email: "Email Column Masking",
    round: "Round by step",
    date_granularity: "Date granularity",
  },
  objectTypeMaskRuleReplacement: "Replacement",
  objectTypeMaskRuleReplacementRequired: "Enter a replacement.",
  objectTypeMaskRuleReplacementInvalid: "Use 1–8 printable characters.",
  objectTypeMaskRuleKeepStart: "Leading characters",
  objectTypeMaskRuleKeepEnd: "Trailing characters",
  objectTypeMaskRuleLocalKeepStart: "Email prefix characters",
  objectTypeMaskRulePreserveDomain: "Preserve email domain",
  objectTypeMaskRuleStep: "Rounding step",
  objectTypeMaskRuleStepInvalid: "Step must be a finite number greater than zero.",
  objectTypeMaskRuleGranularity: "Granularity",
  objectTypeMaskRuleGranularityValue: { year: "Year", month: "Month", day: "Day", hour: "Hour" },
  objectTypeMaskRuleUnsupported: "This property type does not support Column Masking.",
  objectTypeMaskRuleTypeChanged:
    "The current Column Masking rule is incompatible with the new property type. Change it or select Not configured.",
  objectTypeMaskRulePreview: "Preview",
  objectTypeMaskRuleValid: "Valid rule",
  objectTypeMaskRuleIncomplete: "Incomplete",
  objectTypeMaskRuleExampleInput: "Example value",
  objectTypeMaskRuleExampleOutput: "Column Masking result",
  objectTypeMaskRulePreviewSafety:
    "Do not enter real sensitive data. Previewing happens only on this page.",

  propertyAuthorizationAction: "Permission settings",
  propertyAuthorizationTitle: "{{name}} / Permission settings",
  propertyAuthorizationDescription:
    "Configure object access, property visibility, and Column Masking policies.",
  propertyAuthorizationTabBase: "Base permissions",
  propertyAuthorizationTabProperty: "Property permissions",
  propertyAuthorizationBaseDescription:
    "Base permissions determine whether a user can view or operate this object type. Property permissions can only further restrict accessible data; they cannot bypass base permissions.",
  propertyAuthorizationAddUser: "Add user",
  propertyAuthorizationGrantUserLabel: "User",
  propertyAuthorizationGrantOperationLabel: "Allowed operations",
  propertyAuthorizationAddGrant: "Add grant",
  propertyAuthorizationGrantDetails: "Grant details",
  propertyAuthorizationGrantUserCount: "{{count}} authorized users",
  propertyAuthorizationDeleteGrant: "Delete grant",
  propertyAuthorizationDeleteGrantTitle: "Delete user grant",
  propertyAuthorizationDeleteGrantConfirm:
    "This revokes {{count}} directly revocable sources for {{name}}. Read-only access inherited from roles or derived by the system will remain. Continue?",
  propertyAuthorizationDeleteGrantConfirm_one:
    "This revokes {{count}} directly revocable source for {{name}}. Read-only access inherited from roles or derived by the system will remain. Continue?",
  propertyAuthorizationDeleteGrantConfirm_other:
    "This revokes {{count}} directly revocable sources for {{name}}. Read-only access inherited from roles or derived by the system will remain. Continue?",
  propertyAuthorizationDeleteGrantSuccess: "Grant deleted",
  propertyAuthorizationDeleteGrantUnavailable: "No directly revocable grant source is available",
  propertyAuthorizationDeleteSourceTitle: "Delete grant source",
  propertyAuthorizationDeleteSourceConfirm:
    "This deletes {{name}}'s {{effect}} / {{operation}} grant from {{source}} (grant ID: {{grantId}}). Other grant sources on this object remain unchanged.",
  propertyAuthorizationDeleteRequiredSourceBlocked:
    "{{requirement}} is still required by {{dependents}}. Delete the dependent grants first.",
  propertyAuthorizationManageBase: "Manage base permissions",
  propertyAuthorizationUser: "User",
  propertyAuthorizationRole: "Role",
  propertyAuthorizationAccount: "Account",
  propertyAuthorizationBasePermission: "Base permissions",
  propertyAuthorizationNoBasePermission: "No base permission",
  propertyAuthorizationPermissionAllowed: "Allowed",
  propertyAuthorizationPermissionDenied: "Denied",
  propertyAuthorizationPermissionNotGranted: "Not granted",
  propertyAuthorizationEffectiveSource: "Grant source",
  propertyAuthorizationSourceCount_one: "{{count}} source",
  propertyAuthorizationSourceCount_other: "{{count}} sources",
  propertyAuthorizationSourceDrawerTitle: "{{name}} / Grant sources",
  propertyAuthorizationSourceDrawerDescription:
    "These source records participate in the effective permission decision. Revoking one source does not remove other direct grants or inherited permissions.",
  propertyAuthorizationGrantId: "Grant ID",
  propertyAuthorizationSourceEmpty: "No grant sources to display.",
  propertyAuthorizationGranteeEmpty: "No other users are authorized for this object type.",
  propertyAuthorizationSubjectTitle: "Subject",
  propertyAuthorizationSubjectDescription:
    "Property grants support users and roles only, never departments or everyone.",
  propertyAuthorizationSelectUser: "Select a user for property permissions",
  propertyAuthorizationSearchRole: "Search roles",
  propertyAuthorizationRoleEmpty: "No matching roles",
  propertyAuthorizationSelectSubject: "Select a user or role",
  propertyAuthorizationSelectSubjectDescription:
    "Select a subject to inspect and batch-edit its property permissions.",
  propertyAuthorizationMemberCount_one: "{{count}} member",
  propertyAuthorizationMemberCount_other: "{{count}} members",
  propertyAuthorizationExplicitCount: "{{count}} explicit settings",
  propertyAuthorizationPropertyCount_one: "{{count}} property",
  propertyAuthorizationPropertyCount_other: "{{count}} properties",
  propertyAuthorizationBoundaryHint:
    "Property permissions can only narrow base permissions; they cannot grant object access by themselves.",
  propertyAuthorizationRoleImpactCompact_one: "Affects {{count}} member",
  propertyAuthorizationRoleImpactCompact_other: "Affects {{count}} members",
  propertyAuthorizationRoleImpact_one:
    "Changing this role may affect {{count}} member. Direct user grants, other roles, and base permissions still participate in the final decision.",
  propertyAuthorizationRoleImpact_other:
    "Changing this role may affect {{count}} members. Direct user grants, other roles, and base permissions still participate in the final decision.",
  propertyAuthorizationSearchProperty: "Search properties",
  propertyAuthorizationFilterAll: "All states",
  propertyAuthorizationFilterExplicit: "Configured",
  propertyAuthorizationFilterInherit: "Inherited",
  propertyAuthorizationFilterInvalid: "Rule issue",
  propertyAuthorizationSelected: "{{count}} selected",
  propertyAuthorizationBatchSet: "Batch set",
  propertyAuthorizationRestoreInheritance: "Restore inheritance",
  propertyAuthorizationColumnProperty: "Property",
  propertyAuthorizationColumnType: "Type",
  propertyAuthorizationColumnExplicit: "Explicit setting",
  propertyAuthorizationColumnEffective: "Effective access",
  propertyAuthorizationColumnSource: "Effective source",
  propertyAuthorizationColumnMaskRule: "Column Masking Rule",
  propertyAuthorizationLevel: {
    inherit: "Inherit",
    none: "Hidden",
    schema: "Schema only",
    masked: "Column Masking",
    full: "Original",
  },
  propertyAuthorizationSource: {
    manual: "Subject setting",
    object_type: "Base permission",
    property: "Subject setting",
    role: "Inherited from role",
    user: "Direct user grant",
    unresolved: "Estimated",
  },
  propertyAuthorizationMaskState: {
    configured: "Configured",
    missing: "Missing",
    invalid: "Invalid rule",
    unsupported: "Not applicable",
  },
  propertyAuthorizationConfigureMask: "Configure rule",
  propertyAuthorizationMaskedMissing:
    "Configure a valid Column Masking rule before selecting Column Masking.",
  propertyAuthorizationMaskedInvalid:
    "The Column Masking rule is invalid. Runtime safely downgrades this property to Schema only.",
  propertyAuthorizationBatchLimit_one: "Save no more than {{count}} property at a time.",
  propertyAuthorizationBatchLimit_other: "Save no more than {{count}} properties at a time.",
  propertyAuthorizationNoProperty: "No properties match these filters.",
  propertyAuthorizationUnsaved: "{{count}} unsaved changes",
  propertyAuthorizationSave: "Save changes ({{count}})",
  propertyAuthorizationConfirmTitle: "Confirm property permission changes",
  propertyAuthorizationConfirmSummary:
    "This changes {{total}} properties: {{raised}} raised, {{lowered}} lowered, and {{inherited}} restored to inheritance.",
  propertyAuthorizationFullRisk_one:
    "{{count}} property will expose its original value, which may broaden sensitive-data access.",
  propertyAuthorizationFullRisk_other:
    "{{count}} properties will expose original values, which may broaden sensitive-data access.",
  propertyAuthorizationSaveSuccess: "Updated {{count}} property permissions.",
  propertyAuthorizationDiscardTitle: "Discard unsaved changes?",
  propertyAuthorizationDiscardDescription:
    "{{count}} property permission changes have not been saved and cannot be recovered after discarding.",
  propertyAuthorizationDiscard: "Discard changes",
  propertyAuthorizationLoadFailed: "Could not load permission settings. Try again later.",
  propertyAuthorizationServicePending:
    "The property-grant management route is not open yet. The page and data contract are ready and will use real writes once the server route is enabled.",

  rowFilterTab: "Row filter",
  rowFilterSubjectTitle: "Subject",
  rowFilterSubjectDescription: "Set the queryable instance scope for a user or role.",
  rowFilterSelectUser: "Select a user for row filtering",
  rowFilterSelectSubject: "Select a user or role",
  rowFilterSelectSubjectDescription:
    "Select a subject to inspect and configure its row-filter policy for this object type.",
  rowFilterBoundary:
    "Row filtering narrows instance results only after base query permission succeeds; it cannot grant object-type query access by itself.",
  rowFilterPolicyTitle: "Row-filter policy",
  rowFilterPolicyDescription: "Each user or role has at most one explicit policy per object type.",
  rowFilterTemplateLabel: "Filter scope",
  rowFilterInherit: "Inherit (no explicit policy)",
  rowFilterTemplate: {
    all_rows: "All rows",
    self: "My rows",
    department: "My department rows",
    department_tree: "My department and descendant rows",
    value_set: "Filter by field values",
    no_rows: "No rows",
  },
  rowFilterFieldLabel: "Matching field",
  rowFilterFieldPlaceholder: "Select a published property that supports exact matching",
  rowFilterValuesLabel: "Allowed field values",
  rowFilterValuesPlaceholder: "Separate values with commas or new lines",
  rowFilterValueSetInvalid:
    "Enter 1–100 distinct values matching the field type; boolean values must be true or false.",
  rowFilterRiskHint:
    "This change may broaden or significantly narrow visible data and requires confirmation before saving.",
  rowFilterRiskConfirm:
    "Change the policy from “{{previous}}” to “{{next}}”? This may broaden or significantly narrow visible data.",
  rowFilterSave: "Save policy",
  rowFilterDiscardTitle: "Discard unsaved row-filter policy?",
  rowFilterDiscardDescription:
    "The row-filter policy has not been saved and cannot be recovered after discarding.",
  rowFilterDiscard: "Discard changes",
  rowFilterRevisionConflict:
    "The policy was updated by someone else. The latest version has been loaded; review and edit again.",
  rowFilterLoadFailed: "Could not load the row-filter policy",
  rowFilterExplainTitle: "Effective policy",
  rowFilterExplainDescription:
    "Explain shows only policy sources and a safe rule summary; it never returns filtered instances.",
  rowFilterExplainDigestHelp: "The rule digest detects whether a policy changed during pagination.",
  rowFilterRoleExplain:
    "A role policy affects direct and indirect members. The final result also depends on each member's other roles and direct user policies.",
  rowFilterDirectPolicy: "Direct policy",
  rowFilterEffectiveRule: "Effective rule",
  rowFilterDigest: "Rule digest",
} as const;
