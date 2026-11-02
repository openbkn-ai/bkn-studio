/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { fireEvent, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { DraftObjectTypeSave } from "@/modules/bkn-project/types/draft";
import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import { renderWithoutAntdStyles as render } from "@/test/render-without-antd-styles";
import { FileIdentityEditor } from "./FileIdentityEditor";
import { documentSave, renameDocumentProperty, removeDocumentProperty } from "./document-values";

vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
function fixture() {
  const draft = mapDraft(mockDraft("p"));
  const object = draft.items.objectTypes[0];
  object.document = {
    role: "file",
    layer: "fact",
    reason: "Source",
    citations: [],
    selectionId: "lock",
    selectionRevision: 1,
    timeProperty: "",
    participantRelations: [],
    fileIdentity: { property: "number", confirmedAt: 1 },
  };
  object.properties = [
    {
      ...object.properties[0],
      name: "number",
      displayName: "Agreement number",
      type: "string",
      readOnly: false,
    },
    {
      ...object.properties[0],
      name: "_id",
      displayName: "Record identity",
      type: "string",
      readOnly: true,
    },
  ];
  object.primaryKeys = ["_id"];
  return { draft, object, value: documentSave(object) };
}
it("shows a confirmed business number without changing the managed primary key", () => {
  const f = fixture(),
    change = vi.fn<(value: DraftObjectTypeSave) => void>();
  render(<FileIdentityEditor {...f} onChange={change} />);
  expect(screen.getByText("Agreement number")).toBeVisible();
  expect(screen.getByRole("checkbox")).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(change.mock.calls[0]?.[0]).toMatchObject({
    primaryKeys: ["_id"],
    document: { fileIdentity: { property: "number", confirm: false } },
  });
});
it("renaming or removing the selected field cannot silently carry its confirmation", () => {
  const { value } = fixture();
  expect(renameDocumentProperty(value, 0, "new_number").document?.fileIdentity).toEqual({
    property: "new_number",
    confirm: false,
  });
  expect(removeDocumentProperty(value, 0).document?.fileIdentity).toEqual({
    property: "",
    confirm: false,
    clear: true,
  });
});
it("reuses an already confirmed dual-source entity number", () => {
  const f = fixture();
  const entity = {
    ...f.object,
    id: "current_doc",
    adopted: true,
    primaryKeys: ["number"],
    document: {
      ...f.object.document!,
      role: "entity",
      dualSource: {
        systemObjectTypeId: "system",
        fileObjectTypeId: f.object.id,
        relationTypeId: "same",
        fields: [],
        confirmedAt: 1,
        state: "confirmed" as const,
      },
    },
  };
  f.draft.items.objectTypes.push(entity);
  render(<FileIdentityEditor {...f} onChange={vi.fn()} />);
  expect(screen.getByText("bknProject.documentEditor.fileNumberInherited")).toBeVisible();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getByRole("combobox")).toBeDisabled();
});
