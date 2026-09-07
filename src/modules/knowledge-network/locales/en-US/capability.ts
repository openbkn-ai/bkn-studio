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
  capabilityManageInFactory: "Manage in execution factory",
  capabilityUsageTipFunctions:
    "Once mounted, agents and SKILLs of this network call these functions by capability name — no URL or token in the calling code. Creating, editing and publishing a function stays in the execution factory.",
  capabilityUsageTipApis:
    "Once mounted, agents and SKILLs of this network call these interfaces by capability name, with identity and trace attached automatically. Registering and publishing them stays in the execution factory.",
  capabilityUsageTipSkills:
    "Only mounted SKILLs are recalled for this network; an unmounted one is neither discoverable nor callable. Importing, updating and publishing a SKILL stays in the execution factory.",
  capabilityMountFunctions: "Mount function",
  capabilityMountApis: "Mount API",
  capabilityMountSkills: "Mount SKILL",
  capabilityDetach: "Release",
  capabilityDetachSelected: "Release selected",
  capabilityDetachConfirmTitle: "Release this capability?",
  capabilityDetachConfirmContent:
    "The network can no longer call it. The asset itself stays untouched in the execution factory.",
  capabilityDetachSuccess: "Released",
  capabilityMountSuccess: "Mounted {{count}} capabilities",
  capabilityMountSuccess_one: "Mounted {{count}} capability",
  capabilityMountSuccess_other: "Mounted {{count}} capabilities",
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
  capabilityBoxTopUpAction: "Mount {{count}} new tools",
  capabilityBoxTopUpAction_one: "Mount {{count}} new tool",
  capabilityBoxTopUpAction_other: "Mount {{count}} new tools",
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
  capabilityPickerSelectAll: "Select all",
  capabilityPickerBoxToolCount: "{{count}} tools",
  capabilityPickerBoxToolCount_one: "{{count}} tool",
  capabilityPickerBoxToolCount_other: "{{count}} tools",
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
