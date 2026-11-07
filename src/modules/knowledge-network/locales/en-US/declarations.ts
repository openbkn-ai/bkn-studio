/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const declarationsPart = {
  declarations: {
    field: {
      aliases: "Aliases",
      cardinality: "Cardinality",
      constraints: "Value constraints",
      fallback_for: "Fallback for",
      importance: "Importance",
      lifecycle: "Lifecycle",
      properties: "Relation properties",
      required: "Required",
      reverse_name: "Reverse name",
      semantic: "Semantic",
      verification: "Verification",
    },
    kind: {
      action_type: "Action type",
      object_type: "Object type",
      relation_type: "Relation type",
    },
    listSeparator: ", ",
    cleared: {
      confirm: "Clear declarations and import",
      definition: "{{kind}} · {{name}}",
      description:
        "The file does not carry the declarations below, as a 2.x package or an older JSON export never does. Importing it clears them, and this cannot be undone. To keep them, cancel and import a 3.0 package instead.",
      empty: "The backend did not list which declarations would be cleared.",
      moreProperties: "Show {{count}} more properties",
      moreProperties_one: "Show {{count}} more property",
      moreProperties_other: "Show {{count}} more properties",
      ownFields: "{{kind}} itself: {{fields}}",
      propertyFields: "{{property}}: {{fields}}",
      title: "Overwriting clears existing declarations",
    },
    exportRefused: {
      checkDescription:
        "These parameters keep their value source in the legacy place, which a 3.0 package does not accept. Fix them in their definitions and export again, or export as 2.x; a 2.x package leaves 3.0 declarations out.",
      checkTitle: "Fix these parameters to export as 3.0",
      exportV2: "Export as 2.x",
      notReadableDescription:
        "The 3.0 package did not read back under the 3.0 rules, for the reason below. You can export as 2.x; a 2.x package leaves 3.0 declarations out.",
      notReadableTitle: "Cannot export as 3.0",
    },
    networkCheck: {
      action: "Network check",
      clean: "No problems found",
      cleanDescription: "Every action type and logic property parameter is written correctly.",
      close: "Close",
      columnCurrent: "Current",
      columnOwner: "Definition",
      columnParameter: "Parameter",
      columnSuggested: "Suggested",
      conflict: "Replaces an existing value",
      description:
        "These parameters give their value source the wrong way: execution ignores them, and a 3.0 export is refused. Fix them in their definitions.",
      invalidHint:
        "Invalid parameters have no suggested rewrite. A value source can only be a property, an input or a constant, so fix them by hand.",
      invalidTitle: "Invalid parameters ({{total}})",
      loadFailed: "The check did not finish",
      logicProperty: "logic property {{name}}",
      misplacedTitle: "Misplaced parameters ({{total}})",
      recheck: "Check again",
      title: "Network check · {{name}}",
    },
  },
} as const;
