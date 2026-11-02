/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { DraftObjectTypeSave } from "@/modules/bkn-project/types/draft";
import { renderWithoutAntdStyles as render } from "@/test/render-without-antd-styles";
import { documentSave, renameDocumentProperty, removeDocumentProperty } from "./document-values";
import { SentenceIdentityEditor } from "./SentenceIdentityEditor";
vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
function fixture() {
  const object = mapDraft(mockDraft("p")).items.objectTypes[0];
  object.document = {
    role: "in_document",
    layer: "fact",
    reason: "Source",
    citations: [],
    timeProperty: "",
    participantRelations: [],
    selectionId: "source",
    selectionRevision: 1,
  };
  object.primaryKeys = ["_id"];
  object.properties = [
    {
      ...object.properties[0],
      name: "number",
      displayName: "Business number",
      type: "string",
      readOnly: false,
    },
    {
      ...object.properties[0],
      name: "line",
      displayName: "Line number",
      type: "integer",
      readOnly: false,
    },
    {
      ...object.properties[0],
      name: "_id",
      displayName: "Record identifier",
      type: "string",
      readOnly: true,
    },
  ];
  return object;
}
it("adds no mandatory configuration to the single-record path", () => {
  const object = fixture();
  const onChange = vi.fn();
  render(
    <SentenceIdentityEditor object={object} value={documentSave(object)} onChange={onChange} />,
  );
  expect(screen.getByText("bknProject.documentEditor.sentenceKeyHelp")).toBeVisible();
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(onChange).not.toHaveBeenCalled();
});
it("keeps generated identity while requiring explicit human key confirmation", () => {
  const object = fixture();
  object.document!.sentenceIdentity = { properties: ["number", "line"], confirmedAt: 10 };
  const onChange = vi.fn<(value: DraftObjectTypeSave) => void>();
  render(
    <SentenceIdentityEditor object={object} value={documentSave(object)} onChange={onChange} />,
  );
  expect(screen.getByRole("checkbox")).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(onChange.mock.calls[0]?.[0]).toMatchObject({
    primaryKeys: ["_id"],
    document: { sentenceIdentity: { properties: ["number", "line"], confirm: false } },
  });
});
it("invalidates the confirmation when a key field is renamed or removed", () => {
  const object = fixture();
  object.document!.sentenceIdentity = { properties: ["number", "line"], confirmedAt: 10 };
  const value = documentSave(object);
  expect(renameDocumentProperty(value, 0, "reference").document?.sentenceIdentity).toEqual({
    properties: ["reference", "line"],
    confirm: false,
  });
  const removed = removeDocumentProperty(value, 0);
  expect(removed.document?.sentenceIdentity).toEqual({ properties: ["line"], confirm: false });
  expect(removeDocumentProperty(removed, 0).document?.sentenceIdentity).toEqual({
    properties: [],
    confirm: false,
    clear: true,
  });
});
