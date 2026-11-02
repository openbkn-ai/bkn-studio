/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { DraftObjectTypeSave } from "@/modules/bkn-project/types/draft";
import { renderWithoutAntdStyles as render } from "@/test/render-without-antd-styles";
import { DualSourceFieldsEditor } from "./DualSourceFieldsEditor";
vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
const originalMatchMedia = window.matchMedia;
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});
afterAll(() => {
  window.matchMedia = originalMatchMedia;
});
function fixture() {
  const draft = mapDraft(mockDraft("p"));
  const [object, system, file] = draft.items.objectTypes;
  const property = {
    ...object.properties[0],
    name: "number",
    displayName: "Agreement number",
    type: "string",
    readOnly: false,
  };
  object.document = {
    role: "entity",
    layer: "entity",
    reason: "Confirmed",
    citations: [],
    selectionId: "lock",
    selectionRevision: 1,
    timeProperty: "",
    participantRelations: [],
  };
  object.primaryKeys = ["number"];
  object.properties = [property];
  system.primaryKeys = ["number"];
  system.properties = [property];
  delete system.document;
  file.document = { ...object.document, role: "file" };
  file.name = "Agreement files";
  file.properties = [property];
  const relation = draft.items.relationTypes[0];
  relation.source = object.id;
  relation.target = system.id;
  relation.cardinality = "one_to_one";
  relation.documentMapping = {
    mode: "linking",
    mentionProperty: "number",
    identityProperty: "number",
  };
  draft.items.relationTypes = [relation];
  const value: DraftObjectTypeSave = {
    name: object.name,
    description: "",
    properties: [property],
    primaryKeys: ["number"],
    displayKey: "number",
    incrementalKey: "",
    document: { timeProperty: "", participantRelations: [] },
  };
  return { draft, object, system, file, relation, value };
}
it("requires a person to select the main file and confirms only on save", async () => {
  const { draft, object, file, system, relation, value } = fixture();
  const changed = vi.fn<(next: DraftObjectTypeSave) => void>();
  function Editor() {
    const [current, update] = useState(value);
    return (
      <DualSourceFieldsEditor
        draft={draft}
        object={object}
        value={current}
        onChange={(next) => {
          changed(next);
          update(next);
        }}
      />
    );
  }
  render(<Editor />);
  const confirm = screen.getByRole("checkbox", { name: "bknProject.sourceFields.confirm" });
  expect(confirm).toBeDisabled();
  expect(changed).not.toHaveBeenCalled();
  fireEvent.mouseDown(screen.getAllByRole("combobox")[1]);
  fireEvent.click(
    (await screen.findAllByText(file.name)).find((node) =>
      node.closest(".ant-select-item-option"),
    )!,
  );
  expect(confirm).not.toBeDisabled();
  fireEvent.click(confirm);
  expect(changed.mock.lastCall?.[0].document?.dualSource).toEqual({
    systemObjectTypeId: system.id,
    fileObjectTypeId: file.id,
    relationTypeId: relation.id,
    fields: [
      {
        name: "number",
        category: "both",
        sourceOfRecord: "table",
        destinationObjectTypeId: system.id,
      },
    ],
    confirm: true,
  });
  expect(screen.getByText("bknProject.sourceFields.pendingSave")).toBeInTheDocument();
  expect(screen.queryByText("bknProject.sourceFields.state.confirmed")).not.toBeInTheDocument();
});
it("blocks confirmation until an alternative business key has been verified", () => {
  const { draft, object, system, file, relation, value } = fixture();
  system.primaryKeys = ["internal_id"];
  value.document!.dualSource = {
    systemObjectTypeId: system.id,
    fileObjectTypeId: file.id,
    relationTypeId: relation.id,
    fields: [],
    confirm: false,
  };
  render(<DualSourceFieldsEditor draft={draft} object={object} value={value} onChange={vi.fn()} />);
  expect(screen.getByRole("checkbox", { name: "bknProject.sourceFields.confirm" })).toBeDisabled();
  expect(screen.getByText("bknProject.sourceFields.verifyFirst")).toBeInTheDocument();
});
it("uses business placeholders instead of exposing stale internal identities", () => {
  const { draft, object, value } = fixture();
  object.document!.dualSource = {
    systemObjectTypeId: "private-system",
    relationTypeId: "private-relation",
    fileObjectTypeId: "private-file",
    fields: [
      {
        name: "private-field",
        category: "text_only",
        sourceOfRecord: "document",
        destinationObjectTypeId: "private-destination",
      },
    ],
    state: "stale",
    confirmedAt: 1,
  };
  render(<DualSourceFieldsEditor draft={draft} object={object} value={value} onChange={vi.fn()} />);
  expect(screen.getByText("bknProject.sourceFields.state.stale")).toBeInTheDocument();
  expect(screen.getByText("bknProject.sourceFields.changedField")).toBeInTheDocument();
  expect(screen.getByText("bknProject.sourceFields.changedDestination")).toBeInTheDocument();
  expect(document.body.textContent).not.toContain("private-");
});
