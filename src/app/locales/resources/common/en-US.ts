/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const commonEnUS = {
  common: {
    search: "Search",
    reset: "Reset",
    refresh: "Refresh",
    create: "Create",
    import: "Import",
    copy: "Copy",
    viewDetails: "View details",
    hideDetails: "Hide details",
    back: "Back",
    backHome: "Back to home",
    previous: "Previous",
    next: "Next",
    save: "Save",
    confirm: "Confirm",
    cancel: "Cancel",
    ok: "OK",
    add: "Add",
    remove: "Remove",
    expand: "Expand",
    collapse: "Collapse",
    id: "ID",
    edit: "Edit",
    detail: "Detail",
    delete: "Delete",
    name: "Name",
    all: "All",
    tag: "Tag",
    total: "Total {{total}}",
    status: "Status",
    actions: "Actions",
    updatedBy: "Updated by",
    updateTime: "Updated at",
    basicInfo: "Basic Information",
    advancedConfig: "Advanced Configuration",
    enabled: "Enabled",
    disabled: "Disabled",
    success: "Action completed",
    required: "This field is required",
    notFound: "The requested data was not found",
    noPermission: "You do not have permission to access this capability",
    pageNotFound: "Page not found",
    notFoundDescription: "The page you visited does not exist or has been moved.",
    unexpectedError: "Something went wrong",
    reload: "Reload",
    requestFailed: "Request failed. Please try again later.",
    routeErrorDescription:
      "The page failed to load or render. Please try again in a moment.",
    retry: "Retry",
    description: "Description",
    category: "Category",
    mode: "Mode",
    healthStatus: "Health Status",
    error: {
      code: "Error code: {{value}}",
      details: "Error details: {{value}}",
      solution: "Solution: {{value}}",
      link: "Error link: {{value}}",
    },
    testConnection: "Test Connection",
    dangerDelete: {
      typeNameToConfirm:
        'This is a high-risk action. Type "{{name}}" to confirm deletion.',
    },
    entitlement: {
      unlockTitle: "Unlock {{edition}}",
      upgradeTo: "Upgrade to {{edition}}",
      upgradeEffect: "Takes effect as soon as the licence is imported — no restart",
      compareEditions: "Compare editions",
      paidHint: "Available from {{edition}}",
      // Edition gating. Kept apart from noPermission on purpose: "you may not"
      // sends the user to an administrator, "this deployment did not buy it"
      // sends them to sales. One sentence covering both helps neither.
      upgradeHint: "A paid capability. This cluster's licence does not cover it.",
      notLicensedTitle: "Not covered by the current licence",
      notLicensedDescription:
        "This deployment ships the capability, but the installed certificate's edition does not cover it. Import a higher edition and it becomes available — no restart needed.",
      unknownTitle: "Licence status unavailable",
      unknownDescription:
        "Could not read the cluster's licence state, so paid capabilities are unavailable for now. Please retry shortly.",
      // Edition names match the public pricing page verbatim; product names are not localised.
      editions: {
        community: "Community",
        professional: "Professional",
        enterprise: "Enterprise Standard",
        industry: "Industry Solution",
      },
      /** Sidebar badge: one short word. "Pro" is the accepted short form on the pricing page. */
      editionsShort: {
        community: "Community",
        professional: "Pro",
        enterprise: "Enterprise",
        industry: "Industry",
      },
      upgrade: "Upgrade",
      banner: {
        unlicensed:
          "No licence is active. Community capabilities keep working; import a licence to unlock paid ones.",
        action: "Resolve",
      },
    },
  },
} as const;
