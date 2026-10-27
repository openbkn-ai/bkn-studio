/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const sampleExperiencePart = {
  sampleExperience: {
    title: "Try the sample",
    expand: "Show sample questions",
    collapse: "Hide sample questions",
    progress: "{{done}}/{{total}} done",
    position: "Question {{current}} of {{total}}",
    businessDate: "Reference answers use the sample's frozen data, business date {{date}}.",
    previous: "Previous question",
    next: "Next question",
    try: "Try it",
    skip: "Skip",
    showAnswer: "Show reference answer",
    referenceAnswer: "Reference answer",
    referenceQuery: "Reference query",
    runReference: "Run reference query",
    drawReference: "Draw reference on canvas",
    compareHint: "Does the page's output reach the same conclusion as the reference answer?",
    match: "Same",
    mismatch: "Different",
    judgedMatch: "Marked: same",
    judgedMismatch: "Marked: different",
    summary:
      "All {{total}} questions on this page tried: {{matched}} same, {{mismatched}} different.",
    restart: "Start over",
  },
} as const;
