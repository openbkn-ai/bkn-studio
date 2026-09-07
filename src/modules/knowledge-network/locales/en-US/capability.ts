/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const capabilityPart = {
  capabilityFunctionsTitle: "Functions",
  capabilityFunctionsDescription:
    "Mount execution factory tools so agents and SKILLs of this network can call them under governance. A binding points at a tool; the tool box only groups the picker.",
  capabilitySkillsTitle: "SKILLs",
  capabilityApisTitle: "APIs",
  capabilityApisDescription:
    "Mount HTTP interface tools from the execution factory. Same binding as a function; only the owning tool box differs — OpenAPI rather than code.",
  capabilitySkillsDescription:
    "Mount published SKILL packages. Only mounted SKILLs are recalled for this network.",
  capabilityMountFunctions: "Mount function",
  capabilityMountApis: "Mount API",
  capabilityMountSkills: "Mount SKILL",
  capabilityDetach: "Release",
  capabilityDetachSelected: "Release selected",
  capabilityDetachConfirmTitle: "Release this capability?",
  capabilityDetachConfirmContent:
    "The network can no longer call it. The asset itself stays untouched in the execution factory.",
  capabilityDetachSuccess: "Released",
  capabilityMountSuccess: "Mounted {{count}} item(s)",
  capabilityMountNothingNew: "Everything selected is already mounted",
  capabilityColumnName: "Name",
  capabilityColumnBox: "Tool box",
  capabilityColumnStatus: "Status",
  capabilityColumnComment: "Comment",
  capabilityColumnMountTime: "Mounted at",
  capabilityStatusMissing: "Missing",
  capabilityStatusMissingHint:
    "The asset is gone from the execution factory: calls will not hit it. Release it or mount a replacement.",
  capabilityBoundAsBox: "Whole box",
  capabilityMetadataUnavailable:
    "The execution factory is unreachable, so names and statuses are blank. The bindings themselves are intact — refresh later.",
  capabilityBoxTopUpTitle: "{{boxName}}: {{mounted}}/{{total}} tools mounted",
  capabilityBoxTopUpAction: "Mount {{count}} new tool(s)",
  capabilityBoxMissing: "Tool box deleted from the execution factory",
  capabilityEmptyFunctions:
    "No function mounted yet. Use Mount function to pick from a code tool box.",
  capabilityEmptyApis: "No API mounted yet. Use Mount API to pick from an OpenAPI tool box.",
  capabilityEmptySkills: "No SKILL mounted yet. Use Mount SKILL to pick from the platform.",
  capabilitySearchPlaceholder: "Search name or ID",
  capabilityRefresh: "Refresh",
  capabilityPickerSkillTitle: "Mount SKILL",
  capabilityPickerFunctionTitle: "Mount function",
  capabilityPickerApiTitle: "Mount API",
  capabilityPickerSearchPlaceholder: "Search by name",
  capabilityPickerSelected: "{{count}} selected",
  capabilityPickerMounted: "Mounted",
  capabilityPickerSelectWholeBox: "Whole box",
  capabilityPickerBoxToolCount: "{{count}} tool(s)",
  capabilityPickerWholeBoxHint:
    "A whole-box mount is expanded at write time into every tool the box holds now. Tools added later are not inherited.",
  capabilityPickerEmptySkills: "No SKILL available to mount.",
  capabilityPickerEmptyFunctions: "No code tool available to mount.",
  capabilityPickerEmptyApis: "No interface tool available to mount.",
  capabilityPickerConfirm: "Mount",
  capabilityErrorTargetNotFound:
    "The target no longer exists — it may have been deleted in the execution factory.",
  capabilityErrorTargetNotAvailable:
    "The target is not published or is disabled. Publish it in the execution factory first.",
  capabilityErrorEmptyToolBox: "This tool box holds no mountable tool.",
  capabilityErrorFactoryUnavailable:
    "The execution factory is unreachable; nothing was written. Try again later.",
} as const;
