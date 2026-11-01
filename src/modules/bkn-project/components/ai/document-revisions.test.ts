/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import {
  applyDocumentObjectRevisions,
  applyDocumentRelationRevisions,
  documentObjectPreview,
} from "./document-revisions";
import { endsText, type EndNames } from "./revisions";
import type { TFunction } from "i18next";
import type {
  AskRevision,
  DraftObjectTypeSave,
  DraftRelationTypeSave,
} from "@/modules/bkn-project/types/draft";
const t = ((key: string, args?: Record<string, unknown>) =>
  args ? `${key}:${JSON.stringify(args)}` : key) as unknown as TFunction;
const object: DraftObjectTypeSave = {
  name: "Contract",
  description: "",
  primaryKeys: ["number"],
  displayKey: "number",
  incrementalKey: "",
  document: { timeProperty: "", participantRelations: [] },
  properties: [
    {
      name: "number",
      displayName: "Contract number",
      description: "",
      type: "string",
      extraction: { instruction: "Old rule", examples: [] },
    },
    { name: "document_id", displayName: "Source", description: "", type: "string" },
  ],
};
describe("document assistant revisions", () => {
  it("changes only an existing extraction instruction, preserving examples and source identity", () => {
    const changes: AskRevision[] = [
      {
        field: "data_property",
        reason: "Explicit only",
        value: { name: "number", extractionInstruction: "Read the printed number" },
      },
      {
        field: "data_property",
        reason: "",
        value: { name: "document_id", extractionInstruction: "forged" },
      },
    ];
    const next = applyDocumentObjectRevisions(object, changes, ["document_id"], "entity");
    expect(next.properties[0].extraction).toEqual({
      instruction: "Read the printed number",
      examples: [],
    });
    expect(next.properties[1]).toEqual(object.properties[1]);
    expect(object.properties[0].extraction?.instruction).toBe("Old rule");
    expect(next.document).toEqual(object.document);
    const preview = documentObjectPreview(t, object, changes[0]);
    expect(preview.before).toContain("Old rule");
    expect(preview.after).toContain("Read the printed number");
  });
  it("protects non-entity identities and previews the current unsaved document fields", () => {
    const next = applyDocumentObjectRevisions(
      object,
      [{ field: "primary_keys", reason: "", value: ["document_id"] }],
      [],
      "event",
    );
    expect(next.primaryKeys).toEqual(["number"]);
    expect(
      documentObjectPreview(
        t,
        { ...object, displayKey: "" },
        { field: "display_key", reason: "", value: "number" },
      ),
    ).toMatchObject({ before: "", after: "Contract number" });
  });
  it("keeps document rules, cardinality and endpoints without table mappings", () => {
    const current: DraftRelationTypeSave = {
      name: "Refers to",
      description: "",
      source: "contract_doc",
      target: "order",
      mapping: [],
      documentMapping: {
        mode: "same_document",
        sourceNameProperty: "number",
        targetNameProperty: "number",
      },
      cardinality: "many_to_many",
    };
    const changes: AskRevision[] = [
      {
        field: "ends",
        reason: "",
        value: {
          source: "contract_doc",
          target: "order",
          mapping: [],
          documentMapping: { mode: "linking", mentionProperty: "number", identityProperty: "id" },
          cardinality: "many_to_one",
        },
      },
    ];
    const next = applyDocumentRelationRevisions(current, changes);
    expect(next.documentMapping).toEqual({
      mode: "linking",
      mentionProperty: "number",
      identityProperty: "id",
    });
    expect(next.cardinality).toBe("many_to_one");
    expect(next.mapping).toEqual([]);
    expect(current.documentMapping?.mode).toBe("same_document");
    const names: EndNames = {
      object: (id) => id,
      property: (_id, name) => (name === "number" ? "Contract number" : "Order number"),
      table: (id) => id,
    };
    const line = endsText(t, names, next);
    expect(line).toContain("Contract number");
    expect(line).toContain("Order number");
    expect(line).toContain("linking");
    expect(endsText(t, names, current)).toContain("sameDocument");
  });
});
