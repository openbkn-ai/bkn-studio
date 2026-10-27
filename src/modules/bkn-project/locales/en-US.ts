/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const bknProjectEnUS = {
  bknProject: {
    title: "Projects",
    description:
      "Each project brings requirements, ontology and releases together for one business knowledge network.",
    list: {
      cardTitle: "Projects",
      cardTip:
        "Several projects may change one knowledge network; publishing checks whether another project has changed its live version.",
      searchPlaceholder: "Search project names",
      showArchived: "Show archived",
      create: "New project",
      refresh: "Refresh",
      total: "{{count}} in total",
      total_one: "{{count}} in total",
      total_other: "{{count}} in total",
      prevPage: "Previous",
      nextPage: "Next",
      loadFailed: "Failed to load projects",
      emptyTitle: "No projects yet",
      emptyDescription:
        "Create a project to build a business knowledge network from structured data.",
      emptyFiltered: "No matching projects",
      columns: {
        project: "Project",
        network: "Target knowledge network",
        catalogs: "Data catalogs",
        owner: "Owner",
        updated: "Updated",
        actions: "Actions",
      },
      sameNetwork: "Same network · {{count}} other projects",
      sameNetwork_one: "Same network · {{count}} other project",
      sameNetwork_other: "Same network · {{count}} other projects",
      archivedTag: "Archived",
      ownerYou: "You",
      archive: "Archive",
      unarchive: "Restore",
      archiveConfirm: {
        title: 'Archive project "{{name}}"?',
        content:
          "Archived projects are hidden from the default list. Published versions are not affected, and you can restore the project at any time.",
        ok: "Archive",
      },
      archiveSuccess: "Archived",
      unarchiveSuccess: "Restored",
      archiveFailed: "Operation failed",
    },
    create: {
      title: "New project",
      submit: "Create",
      success: "Project created",
      failed: "Failed to create the project",
      name: "Project name",
      namePlaceholder: "For example: Delivery delay warning",
      nameRequired: "Enter a project name",
      nameTooLong: "The project name must be at most {{max}} characters",
      target: "Target knowledge network",
      existing: "Use an existing network",
      existingDescription: "Revise an existing network; the baseline is its live version",
      networkPlaceholder: "Select a knowledge network",
      networkRequired: "Select a knowledge network",
      networksLoadFailed: "Failed to load knowledge networks",
      newNetwork: "New knowledge network",
      newNetworkDescription: "Start from an empty network; the first release is v1.0.0",
      newNetworkName: "Network name",
      newNetworkNamePlaceholder: "For example: Delivery management",
      newNetworkNameRequired: "Enter a network name",
      catalogs: "Data sources",
      catalogsHint:
        "Select the data catalogs that hold the structured data; the project references them and copies nothing.",
      catalogsPlaceholder: "Select data catalogs",
      catalogsLoadFailed: "Failed to load data catalogs",
    },
  },
};
