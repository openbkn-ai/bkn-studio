/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import {
  originalLocation,
  renameDocumentProperty,
  removeDocumentProperty,
  selectedExample,
} from "./document-values";

describe("native example selection", () => {
  const fragment = {
    text: "😀前缀 合同编号 CT-001",
    fileName: "Contract.pdf",
    citation: {
      knowledgeBaseId: "1",
      fileId: "2",
      contentVersionId: "3",
      blockId: "b",
      start: 10,
      end: 100,
    },
  };
  it("converts browser offsets into native code points without persisting quote text", () => {
    expect(selectedExample(fragment, "CT-001")).toMatchObject({ start: 19, end: 25 });
    expect(selectedExample(fragment, "CT-001")).not.toHaveProperty("quote");
  });
  it("refuses ambiguous, absent and oversized examples", () => {
    expect(selectedExample({ ...fragment, text: "A A" }, "A")).toBeNull();
    expect(selectedExample(fragment, "wrong")).toBeNull();
    expect(selectedExample(fragment, "")).toBeNull();
    expect(selectedExample({ ...fragment, text: "X".repeat(4001) }, "X".repeat(4001))).toBeNull();
  });
});

describe("document editor references", () => {
  it("uses the runtime deployment basename for originals", () => {
    const before = window.__BKN_STUDIO_RUNTIME__;
    try {
      window.__BKN_STUDIO_RUNTIME__ = { router: { basename: "/custom" } };
      expect(
        originalLocation({
          knowledgeBaseId: "1",
          fileId: "2",
          contentVersionId: "3",
          blockId: "b",
          start: 0,
          end: 2,
        }),
      ).toBe("/custom/knowledge-base/original/3?block=b&start=0&end=2");
    } finally {
      window.__BKN_STUDIO_RUNTIME__ = before;
    }
  });
  it("renames all local field references without mutating the previous form", () => {
    const value = {
      name: "Event",
      description: "",
      incrementalKey: "",
      displayKey: "when",
      primaryKeys: ["when"],
      document: { timeProperty: "when", participantRelations: ["participant"] },
      properties: [{ name: "when", displayName: "Time", description: "", type: "datetime" }],
    };
    const next = renameDocumentProperty(value, 0, "occurred_at");
    expect(next).toMatchObject({
      displayKey: "occurred_at",
      primaryKeys: ["occurred_at"],
      document: { timeProperty: "occurred_at", participantRelations: ["participant"] },
      properties: [{ name: "occurred_at" }],
    });
    expect(value.displayKey).toBe("when");
    expect(value.properties[0].name).toBe("when");
  });
});

describe("partially typed document field names", () => {
  it("does not select a new unnamed field as a display or event-time field", () => {
    const value = {
      name: "Event",
      description: "",
      incrementalKey: "",
      displayKey: "",
      primaryKeys: [],
      document: { timeProperty: "", participantRelations: [] },
      properties: [{ name: "", displayName: "New", description: "", type: "string" }],
    };
    const renamed = renameDocumentProperty(value, 0, "n");
    expect(renamed.displayKey).toBe("");
    expect(renamed.document?.timeProperty).toBe("");
  });
  it("does not move another field's references while a duplicate name is typed", () => {
    const value = {
      name: "Event",
      description: "",
      incrementalKey: "",
      displayKey: "title",
      primaryKeys: ["title"],
      document: { timeProperty: "", participantRelations: [] },
      properties: [
        { name: "title", displayName: "Title", description: "", type: "string" },
        { name: "title", displayName: "English title", description: "", type: "string" },
      ],
    };
    const renamed = renameDocumentProperty(value, 1, "title_e");
    expect(renamed.displayKey).toBe("title");
    expect(renamed.primaryKeys).toEqual(["title"]);
  });
});

describe("document field rename editing sessions", () => {
  it("keeps row references through clearing and retyping without capturing another field", () => {
    const value = {
      name: "Event",
      description: "",
      incrementalKey: "",
      displayKey: "title",
      primaryKeys: ["title"],
      document: { timeProperty: "title", participantRelations: [] },
      properties: [
        { name: "title", displayName: "Title", description: "", type: "string" },
        { name: "other", displayName: "Other", description: "", type: "string" },
      ],
    };
    const blank = renameDocumentProperty(value, 0, "", "title");
    expect(blank.displayKey).toBe("title");
    expect(blank.primaryKeys).toEqual(["title"]);
    const renamed = renameDocumentProperty(blank, 0, "headline", "title");
    expect(renamed.displayKey).toBe("headline");
    expect(renamed.primaryKeys).toEqual(["headline"]);
    expect(renamed.document?.timeProperty).toBe("headline");
    const duplicate = renameDocumentProperty(value, 0, "other", "title");
    expect(duplicate.displayKey).toBe("title");
    const unique = renameDocumentProperty(duplicate, 0, "other_title", "title");
    expect(unique.displayKey).toBe("other_title");
    expect(unique.properties[1].name).toBe("other");
  });
});

describe("removing a partially renamed document field", () => {
  it("clears references to the row's retained name, including event time", () => {
    const value = {
      name: "Event",
      description: "",
      incrementalKey: "",
      displayKey: "title",
      primaryKeys: ["title"],
      document: { timeProperty: "title", participantRelations: ["participant"] },
      properties: [
        { name: "", displayName: "Title", description: "", type: "string" },
        { name: "other", displayName: "Other", description: "", type: "string" },
      ],
    };
    const next = removeDocumentProperty(value, 0, "title");
    expect(next.primaryKeys).toEqual([]);
    expect(next.displayKey).toBe("");
    expect(next.document).toEqual({ timeProperty: "", participantRelations: ["participant"] });
    expect(next.properties.map((p) => p.name)).toEqual(["other"]);
  });
  it("preserves references belonging to another row with the same temporarily typed name", () => {
    const value = {
      name: "Object",
      description: "",
      incrementalKey: "",
      displayKey: "title",
      primaryKeys: ["title"],
      properties: [
        { name: "title", displayName: "Title", description: "", type: "string" },
        { name: "title", displayName: "English title", description: "", type: "string" },
      ],
    };
    const next = removeDocumentProperty(value, 1, "title_en");
    expect(next.primaryKeys).toEqual(["title"]);
    expect(next.displayKey).toBe("title");
  });
});
