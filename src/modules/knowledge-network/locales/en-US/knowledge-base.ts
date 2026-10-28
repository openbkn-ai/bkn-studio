/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const knowledgeBasePart = {
  workspaceKnowledgeBases: "Knowledge bases",
  knowledgeBasesDescription:
    "Mount knowledge bases so this knowledge network can search their documents.",
  knowledgeBasesTitle: "Knowledge bases",
  knowledgeBasesUsageTip:
    "Once mounted, the knowledge network can search the documents of these knowledge bases when it answers. You can mount only knowledge bases you may query; they are still managed in the knowledge base.",
  knowledgeBasesMount: "Mount knowledge base",
  knowledgeBasesRefresh: "Refresh",
  knowledgeBasesEmpty: "No knowledge bases mounted yet",
  knowledgeBasesEmptyDescription:
    "Once mounted, this knowledge network can search the documents of a knowledge base.",
  knowledgeBasesNoVisible: "This knowledge network has no knowledge bases mounted yet.",
  knowledgeBasesColumnName: "Knowledge base",
  knowledgeBasesColumnStatus: "Status",
  knowledgeBasesColumnMountTime: "Mounted",
  knowledgeBasesColumnMountedBy: "Mounted by",
  knowledgeBasesColumnActions: "Actions",
  knowledgeBasesStatusReady: "Searchable",
  knowledgeBasesStatusMissing: "Unavailable",
  knowledgeBasesStatusMissingHint:
    "This knowledge base was deleted, or this deployment has no knowledge-base service. Searches skip it; you can unmount it.",
  knowledgeBasesMissingName: "Knowledge base no longer exists",
  knowledgeBasesDetach: "Unmount",
  knowledgeBasesDetachAction: "Unmount {{name}}",
  knowledgeBasesDetachConfirmTitle: "Unmount this knowledge base?",
  knowledgeBasesDetachConfirmContent:
    "This knowledge network will no longer search it. The knowledge base and its documents are not affected.",
  knowledgeBasesDetachSuccess: "Unmounted.",
  knowledgeBasesLoadFailed: "The mounted knowledge bases cannot be read right now",
  knowledgeBasesNotSupportedTitle: "This deployment has no knowledge-base service",
  knowledgeBasesNotSupportedDescription:
    "Knowledge bases can be mounted once the knowledge-base service is installed and enabled.",
  knowledgeBasesFailure: {
    gone: "A selected knowledge base no longer exists. Refresh and choose again.",
    noPermission:
      "You may not query a selected knowledge base. Mount it once your request is approved.",
    notSupported:
      "This deployment has no knowledge-base service, so knowledge bases cannot be mounted.",
    unavailable: "The knowledge-base service is not responding. Try again later.",
    other: "This did not finish. Try again later.",
  },
  knowledgeBasesPicker: {
    title: "Mount knowledge base",
    search: "Search knowledge bases by name",
    hint: "Only knowledge bases you may query are listed.",
    mounted: "Mounted",
    documents: "{{count}} documents",
    documents_one: "{{count}} document",
    documents_other: "{{count}} documents",
    none: "There are no knowledge bases you may query. Ask for query access to a knowledge base first.",
    noMatch: "No knowledge base name contains “{{keyword}}”.",
    loadFailed: "The list of knowledge bases cannot be read right now",
    confirm: "Mount",
    success: "Mounted {{count}} knowledge bases.",
    success_one: "Mounted {{count}} knowledge base.",
    success_other: "Mounted {{count}} knowledge bases.",
    nothingNew: "The selected knowledge bases are already mounted.",
    requestFor: "Request query access to {{name}}:",
  },
  knowledgeBasesPreview: {
    contracts: "Supplier contracts",
    incidents: "Delivery incident reports",
    manuals: "Product manuals",
  },
} as const;
