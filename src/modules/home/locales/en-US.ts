/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const homeEnUS = {
  home: {
    description:
      "The OpenBKN workspace: start knowledge modelling, data governance, and capability orchestration here.",
    greeting: {
      afternoon: "Good afternoon, {{name}}",
      evening: "Good evening, {{name}}",
      morning: "Good morning, {{name}}",
    },
    quickActions: {
      empty: "No module is available for this account. Ask an administrator to grant access.",
      title: "Quick access",
    },
    recent: {
      empty: "Nothing visited yet. Items you open will show up here.",
      forget: "Remove from recent",
      kind: {
        "data-resource": "Data resource",
        "execution-unit": "Execution unit",
        "knowledge-network": "Knowledge network",
      },
      title: "Recently visited",
    },
    tagline: "Workspace",
    title: "Workspace",
  },
} as const;
