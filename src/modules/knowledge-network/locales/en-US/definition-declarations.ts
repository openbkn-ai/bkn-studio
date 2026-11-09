/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const definitionDeclarationsPart = {
  definitionDeclarations: {
    aliasProblem: {
      comma: "Alias “{{alias}}” cannot contain a comma",
      duplicate: "Alias “{{alias}}” is repeated",
      empty: "An alias cannot be empty",
      otherProperty: "Alias “{{alias}}” is the name of {{property}}",
      ownName: "Alias “{{alias}}” is the same as the name",
      tooLong: "Alias “{{alias}}” is longer than {{max}} characters",
      tooMany: "At most {{max}} aliases",
    },
    aliases: "Aliases",
    aliasesHint:
      "Other names, such as abbreviations, former names or names in another language, used to recall concepts and understand questions. At most {{max}}, each at most {{length}} characters; separate them with Enter or a comma.",
    aliasesPlaceholder: "Type and press Enter",
    banner: {
      action_type: "This action type is deprecated: {{reason}}",
      object_type: "This object type is deprecated: {{reason}}",
      relation_type: "This relation type is deprecated: {{reason}}",
    },
    bannerReplacedBy: "Use instead",
    deleteRefused: {
      references: "Definitions that reference it",
      title: "“{{name}}” cannot be deleted",
    },
    deprecatedTag: "Deprecated",
    kind: {
      action_type: "action type",
      object_type: "object type",
      relation_type: "relation type",
    },
    noAliases: "No aliases",
    lifecycle: "Status",
    lifecycleHint:
      "A deprecated definition can still be viewed, edited and queried; only concept recall leaves it out.",
    lifecycleOption: {
      active: "In use",
      deprecated: "Deprecated",
    },
    reason: "Reason",
    reasonPlaceholder: "Why it is no longer used, and what to do instead",
    reasonRequired: "Enter the reason",
    refusalOpen: "Open {{kind}} {{id}}",
    refusalTitle: "The backend did not accept the aliases or status: {{description}}",
    replacedBy: "Replaced by",
    replacedByHint: "Optional. Only definitions of the same kind still in use.",
    replacedByMissing: "{{id}} (missing or not visible to you)",
    replacedByPlaceholder: "Search by name",
  },
} as const;
