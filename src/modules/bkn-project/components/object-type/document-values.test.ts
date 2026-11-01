/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import { originalLocation, renameDocumentProperty, selectedExample } from "./document-values";

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
