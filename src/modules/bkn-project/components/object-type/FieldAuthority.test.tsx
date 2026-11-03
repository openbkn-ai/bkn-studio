/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { fireEvent, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { mapDraft, mockDraft, objectTypeBody } from "@/modules/bkn-project/services/draft.service";
import type { DraftObjectTypeSave } from "@/modules/bkn-project/types/draft";
import { renderWithoutAntdStyles as render } from "@/test/render-without-antd-styles";
import { DocumentFieldsEditor } from "./DocumentFieldsEditor";
import { documentSave } from "./document-values";
vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
function fixture() {
  const draft = mapDraft(mockDraft("p"));
  const object = draft.items.objectTypes[0];
  object.document = {
    role: "entity",
    layer: "entity",
    reason: "Source",
    citations: [],
    timeProperty: "",
    participantRelations: [],
    selectionId: "source",
    selectionRevision: 1,
  };
  object.primaryKeys = ["number"];
  object.properties = [
    {
      ...object.properties[0],
      name: "number",
      displayName: "Number",
      type: "string",
      sourceOfRecord: "document",
      readOnly: false,
    },
    {
      ...object.properties[0],
      name: "amount",
      displayName: "Amount",
      type: "decimal",
      sourceOfRecord: "document",
      readOnly: false,
    },
    {
      ...object.properties[0],
      name: "_id",
      displayName: "Record",
      type: "string",
      sourceOfRecord: "document",
      readOnly: true,
    },
  ];
  draft.items.objectTypes = [object];
  return { draft, object };
}
it("lets the owner explicitly choose authority for a business field, excluding identity and managed fields", async () => {
  const { draft, object } = fixture();
  const onChange = vi.fn<(value: DraftObjectTypeSave) => void>();
  render(
    <DocumentFieldsEditor
      object={object}
      draft={draft}
      projectId="p"
      value={documentSave(object)}
      onChange={onChange}
    />,
  );
  expect(
    screen.queryByRole("combobox", { name: "bknProject.documentEditor.fieldAuthority Number" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("combobox", { name: "bknProject.documentEditor.fieldAuthority Record" }),
  ).not.toBeInTheDocument();
  fireEvent.mouseDown(
    screen.getByRole("combobox", { name: "bknProject.documentEditor.fieldAuthority Amount" }),
  );
  fireEvent.click(await screen.findByText("bknProject.documentEditor.authorityFusion"));
  const value = onChange.mock.calls[0][0];
  expect(value.document?.fieldSources).toEqual([
    { property: "amount", type: "decimal", sourceOfRecord: "fusion", confirm: true },
  ]);
  expect(objectTypeBody(value).document?.field_sources).toEqual([
    { property: "amount", source_of_record: "fusion", confirm: true },
  ]);
});
it("drops stale decisions when fields are renamed, removed or change type", () => {
  const { object } = fixture();
  for (const change of ["rename", "remove", "type"] as const) {
    const value = documentSave(object);
    value.document!.fieldSources = [
      { property: "amount", type: "decimal", sourceOfRecord: "fusion", confirm: true },
    ];
    if (change === "rename") value.properties[1].name = "renamed";
    if (change === "remove") value.properties.splice(1, 1);
    if (change === "type") value.properties[1].type = "string";
    expect(objectTypeBody(value).document?.field_sources).toEqual([]);
  }
});
it("displays a previously confirmed authority without creating a fresh decision", () => {
  const { draft, object } = fixture();
  object.properties[1].sourceOfRecord = "fusion";
  const value = documentSave(object);
  render(
    <DocumentFieldsEditor
      object={object}
      draft={draft}
      projectId="p"
      value={value}
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByText("bknProject.documentEditor.authorityFusion")).toBeVisible();
  expect(value.document?.fieldSources).toBeUndefined();
});
