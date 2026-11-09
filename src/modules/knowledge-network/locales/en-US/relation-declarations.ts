/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const relationDeclarationsPart = {
  relationDeclarations: {
    cardinality: "Cardinality",
    cardinalityOption: {
      manyToMany: "Many to many",
      manyToOne: "Many to one",
      oneToMany: "One to many",
      oneToOne: "One to one",
    },
    characteristic: {
      symmetric: "Symmetric",
      transitive: "Transitive",
    },
    characteristicHint: {
      symmetric: "if A has this relation with B, B has it with A",
      transitive: "if A→B and B→C hold, A→C holds",
    },
    characteristicOption: "{{name}}: {{hint}}",
    characteristics: "Characteristics",
    characteristicsHint:
      "Only for a relation from an object type to itself. The data holds direct edges only; whoever reads the relation expands them.",
    cleared: {
      ends: "The source and target are no longer the same object type, so the characteristics were cleared.",
      symmetric: "A symmetric relation has no direction, so these were cleared: {{names}}.",
    },
    clearedOnSave: {
      content:
        "The source and target are no longer the same object type, so saving also clears this relation's characteristics (symmetric, transitive).",
      ok: "Clear and save",
      title: "Saving clears the characteristics",
    },
    clearedName: {
      cardinality: "the one-to-many or many-to-one cardinality",
      characteristics: "the characteristics",
      requiredEnds: "the required end",
      reverseName: "the reverse name",
    },
    count: {
      atLeastOne: "each {{from}} has at least one {{to}}",
      atMostOne: "each {{from}} has at most one {{to}}",
      exactlyOne: "each {{from}} has exactly one {{to}}",
      oneOrMore: "each {{from}} has at least one {{to}}, possibly more",
      several: "a {{from}} can have more than one {{to}}",
    },
    fallbackFor: "Fallback for",
    fallbackForHint:
      "When a source instance has no counterpart along the chosen primary relation, this relation gives one. The choices are the primary relations with the same source and target.",
    fallbackForMissing: "{{id}} (not among the choices)",
    fallbackForOption: "{{name}} ({{id}})",
    fallbackForNone: "Not a fallback path",
    fallbackPaths: "Fallback paths for this relation",
    importance: "Importance",
    importanceHint:
      "A secondary relation is used only when the primary ones cannot answer, or when a question is about it.",
    importanceOption: {
      primary: "Primary",
      secondary: "Secondary",
    },
    listTag: {
      fallbackFor: "Fallback for {{name}}",
      secondary: "Secondary",
      unconfirmed: "Inferred",
    },
    mappingChange: {
      resourceKept_one:
        "{{count}} relation property reads its column by name. After the change, it reads the column of the same name in “{{resource}}”.",
      resourceKept_other:
        "{{count}} relation properties read columns by name. After the change, they read the columns of the same name in “{{resource}}”.",
      resourceMissing:
        "The columns that relation properties {{names}} read are not in “{{resource}}”, so saving will be refused. Relation properties cannot be edited in Studio yet.",
      resourceOk: "Change",
      resourceTitle: "Change the backing resource?",
      toDirect_one:
        "This relation has {{count}} relation property. It is deleted once the relation is direct.",
      toDirect_other:
        "This relation has {{count}} relation properties. They are deleted once the relation is direct.",
      toDirectOk: "Make it direct",
      toDirectTitle: "Make it a direct relation?",
    },
    notDeclared: "Not declared",
    note: "BKN 3.0 · all optional",
    relationProperties_one: "{{count}} relation property",
    relationProperties_other: "{{count}} relation properties",
    relationPropertiesHint:
      "Relation properties cannot be edited in Studio yet. Saving the relation type keeps them.",
    requiredBoth: "Both ends have at least one counterpart",
    requiredEnd: {
      source: "Every {{source}} has at least one {{target}}",
      target: "Every {{target}} has at least one {{source}}",
    },
    requiredEnds: "Required ends",
    reverseName: "Reverse name",
    reverseNameHint: "The name read from the target to the source. Read forward, it is “{{name}}”.",
    sentence: "{{first}}; {{second}}.",
    sentenceOne: "{{first}}.",
    separator: ", ",
    title: "Relation declarations",
    verification: "Join basis",
    verificationOption: {
      confirmed: "Real identifiers (foreign key or business ID)",
      none: "Not declared",
      unconfirmed: "Inferred rules (results marked to be confirmed)",
    },
    verificationShort: {
      confirmed: "Real identifiers",
      unconfirmed: "Inferred rules",
    },
  },
} as const;
