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
      editions: {
        community: "Community",
        professional: "Professional",
        enterprise: "Enterprise",
        industry: "Industry",
      },
      lockedTitle: "{{edition}} capability",
      lockedDescription:
        "This workspace runs on {{current}}. Import a new licence to unlock it — data and configuration are preserved.",
      viewLicense: "Go to licence management",
      banner: {
        unlicensed:
          "No licence is active. Community capabilities keep working; import a licence to unlock paid ones.",
        invalid:
          "The licence is invalid or failed verification. Running on community capabilities.",
        grace:
          "The licence has expired and is in its grace period. Capabilities are unaffected for now — please renew.",
        fallbackCommunity:
          "The commercial licence has expired. Running the community capability set; data is preserved.",
        action: "Resolve",
      },
    },
  },
} as const;
