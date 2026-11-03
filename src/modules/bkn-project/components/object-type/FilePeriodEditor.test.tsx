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
import { documentSave, renameDocumentProperty, removeDocumentProperty } from "./document-values";
import { FilePeriodEditor } from "./FilePeriodEditor";

vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
function fixture() {
  const object = mapDraft(mockDraft("p")).items.objectTypes[0];
  object.document = {
    role: "file",
    layer: "fact",
    reason: "Source",
    citations: [],
    timeProperty: "",
    participantRelations: [],
    selectionId: "source",
    selectionRevision: 1,
  };
  object.properties = [
    {
      ...object.properties[0],
      name: "starts",
      displayName: "Effective date",
      type: "date",
      readOnly: false,
    },
    {
      ...object.properties[0],
      name: "ends",
      displayName: "Expiry date",
      type: "datetime",
      readOnly: false,
    },
    {
      ...object.properties[0],
      name: "title",
      displayName: "Title",
      type: "string",
      readOnly: false,
    },
  ];
  return object;
}
it("keeps date mapping optional and only offers extracted date fields", () => {
  const object = fixture();
  const onChange = vi.fn<(value: DraftObjectTypeSave) => void>();
  render(<FilePeriodEditor object={object} value={documentSave(object)} onChange={onChange} />);
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.mouseDown(
    screen.getByRole("combobox", { name: "bknProject.documentEditor.effectiveDate" }),
  );
  expect(screen.getByText("Effective date")).toBeVisible();
  expect(screen.queryByText("Title")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Effective date"));
  expect(onChange.mock.calls[0]?.[0].document?.filePeriod).toEqual({
    from: "starts",
    confirm: false,
  });
});
it("retains confirmed mappings in the wire contract and invalidates renamed or removed dates", () => {
  const object = fixture();
  object.document!.filePeriod = { from: "starts", until: "ends", confirmedAt: 10 };
  const value = documentSave(object);
  expect(objectTypeBody(value).document?.file_period).toEqual({
    from: "starts",
    until: "ends",
    confirm: true,
  });
  expect(renameDocumentProperty(value, 0, "signed_date").document?.filePeriod).toEqual({
    from: "signed_date",
    until: "ends",
    confirm: false,
  });
  expect(removeDocumentProperty(value, 0).document?.filePeriod).toEqual({
    from: undefined,
    until: "ends",
    confirm: false,
  });
  const onChange = vi.fn<(value: DraftObjectTypeSave) => void>();
  render(<FilePeriodEditor object={object} value={value} onChange={onChange} />);
  expect(screen.getByRole("checkbox")).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(onChange.mock.calls[0]?.[0].document?.filePeriod?.confirm).toBe(false);
});
it("requires reconfirmation after a chosen field stops being a date", () => {
  const object = fixture();
  object.document!.filePeriod = { from: "starts", confirmedAt: 10 };
  const value = documentSave(object);
  value.properties[0].type = "string";
  const onChange = vi.fn<(value: DraftObjectTypeSave) => void>();
  render(<FilePeriodEditor object={object} value={value} onChange={onChange} />);
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("checkbox")).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "bknProject.documentEditor.clearFilePeriod" }),
  );
  expect(onChange.mock.calls[0]?.[0].document?.filePeriod).toEqual({ clear: true, confirm: false });
});
