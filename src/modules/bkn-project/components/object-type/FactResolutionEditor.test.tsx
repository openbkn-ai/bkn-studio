/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { mapDraft, mockDraft, objectTypeBody } from "@/modules/bkn-project/services/draft.service";
import { renderWithoutAntdStyles as render } from "@/test/render-without-antd-styles";
import { documentSave, renameDocumentProperty, removeDocumentProperty } from "./document-values";
import { FactResolutionEditor } from "./FactResolutionEditor";

vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
function fixture() {
  const draft = mapDraft(mockDraft("p"));
  const object = draft.items.objectTypes[0];
  const target = structuredClone(object);
  target.id = "order-target";
  target.name = "Sales order";
  target.adopted = true;
  target.primaryKeys = ["order_no"];
  target.properties = [
    {
      ...object.properties[0],
      name: "order_no",
      displayName: "Order number",
      type: "string",
      readOnly: false,
    },
  ];
  object.id = "promise-fact";
  object.name = "Delivery promise";
  object.document = {
    role: "fact",
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
      name: "order_no",
      displayName: "Order number",
      type: "string",
      readOnly: false,
    },
    {
      ...object.properties[0],
      name: "delivery",
      displayName: "Promised delivery",
      type: "date",
      readOnly: false,
    },
  ];
  const relation = {
    ...draft.items.relationTypes[0],
    id: "applies-to",
    name: "Applies to",
    source: object.id,
    target: target.id,
    adopted: true,
    document: { ...object.document, role: "relation" },
    documentMapping: {
      mode: "linking" as const,
      mentionProperty: "order_no",
      identityProperty: "order_no",
    },
  };
  draft.items.objectTypes = [object, target];
  draft.items.relationTypes = [relation];
  return { draft, object };
}
it("prefills unique choices without granting authority and submits only a human decision", () => {
  const { draft, object } = fixture();
  const changed = vi.fn<(body: ReturnType<typeof objectTypeBody>) => void>();
  function View() {
    const [value, setValue] = useState(documentSave(object));
    return (
      <FactResolutionEditor
        object={object}
        draft={draft}
        value={value}
        onChange={(next) => {
          setValue(next);
          changed(objectTypeBody(next));
        }}
      />
    );
  }
  render(<View />);
  const confirm = screen.getByRole("checkbox");
  expect(confirm).not.toBeChecked();
  expect(confirm).not.toBeDisabled();
  expect(changed).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  expect(changed.mock.lastCall?.[0].document?.fact_resolution).toEqual({
    value_property: "delivery",
    subject_relation_id: "applies-to",
    confirm: true,
  });
  fireEvent.click(confirm);
  expect(changed.mock.lastCall?.[0].document?.fact_resolution).toEqual({
    value_property: "delivery",
    subject_relation_id: "applies-to",
    confirm: false,
  });
});
it("does not assign one status to a fact with multiple business values", () => {
  const { draft, object } = fixture();
  object.properties.push({
    ...object.properties[1],
    name: "quantity",
    displayName: "Quantity",
    type: "integer",
  });
  render(
    <FactResolutionEditor
      object={object}
      draft={draft}
      value={documentSave(object)}
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(screen.getByText("bknProject.documentEditor.factSingleValueRequired")).toBeInTheDocument();
});
it("keeps stale confirmation pending when reopening the existing editor", () => {
  const { object } = fixture();
  object.document!.factResolution = {
    valueProperty: "delivery",
    subjectRelationId: "applies-to",
    confirmedAt: 100,
    state: "stale",
  };
  const value = documentSave(object);
  expect(value.document?.factResolution?.confirm).toBe(false);
  expect(objectTypeBody(value).document?.fact_resolution).toEqual({
    value_property: "delivery",
    subject_relation_id: "applies-to",
    confirm: false,
  });
});

it("requires reconfirmation when the chosen value is renamed or removed", () => {
  const { object } = fixture();
  object.document!.factResolution = {
    valueProperty: "delivery",
    subjectRelationId: "applies-to",
    confirmedAt: 100,
    state: "confirmed",
  };
  const saved = documentSave(object);
  const renamed = renameDocumentProperty(saved, 1, "new_delivery");
  expect(renamed.document?.factResolution).toMatchObject({
    valueProperty: "new_delivery",
    subjectRelationId: "applies-to",
    confirm: false,
  });
  const removed = removeDocumentProperty(saved, 1);
  expect(removed.document?.factResolution?.valueProperty).toBeUndefined();
  expect(removed.document?.factResolution?.confirm).toBe(false);
});
