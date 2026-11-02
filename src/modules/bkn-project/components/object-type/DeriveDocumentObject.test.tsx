/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  mapDraft,
  mockDraft,
  deriveDocumentObject,
} from "@/modules/bkn-project/services/draft.service";
import { renderWithoutAntdStyles as render } from "@/test/render-without-antd-styles";
import { DeriveDocumentObject } from "./DeriveDocumentObject";
vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/modules/bkn-project/services/draft.service", async (original) => ({
  ...(await original<typeof import("@/modules/bkn-project/services/draft.service")>()),
  deriveDocumentObject: vi.fn(),
}));
beforeEach(() => vi.mocked(deriveDocumentObject).mockReset());
function fixture() {
  const draft = mapDraft(mockDraft("p"));
  const object = draft.items.objectTypes[0];
  object.id = "source_doc";
  object.document = {
    role: "in_document",
    layer: "fact",
    reason: "Verified",
    citations: [],
    selectionId: "lock",
    selectionRevision: 1,
    timeProperty: "",
    participantRelations: [],
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
      name: "document_id",
      displayName: "Managed document",
      type: "string",
      readOnly: true,
    },
  ];
  return { draft, object };
}
it("disables derivation while unsaved edits exist", () => {
  const { draft, object } = fixture();
  render(
    <DeriveDocumentObject
      draft={draft}
      object={object}
      projectId="p"
      disabled
      onDerived={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "bknProject.documentDerivation.open" })).toBeDisabled();
});
it("requires explicit field and identifier confirmation and returns a pending draft", async () => {
  const { draft, object } = fixture();
  const onDerived = vi.fn();
  vi.mocked(deriveDocumentObject).mockResolvedValue(draft);
  render(
    <DeriveDocumentObject
      draft={draft}
      object={object}
      projectId="p"
      disabled={false}
      onDerived={onDerived}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "bknProject.documentDerivation.open" }));
  const create = screen.getByRole("button", { name: "bknProject.documentDerivation.create" });
  expect(create).toBeDisabled();
  fireEvent.change(screen.getByLabelText("bknProject.documentDerivation.name"), {
    target: { value: "Current agreements" },
  });
  fireEvent.mouseDown(screen.getAllByRole("combobox")[1]);
  fireEvent.click(
    (await screen.findByText("Agreement number")).closest(".ant-select-item-option")!,
  );
  expect(screen.queryByText("Managed document")).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getAllByRole("combobox")[2]);
  const options = await screen.findAllByText("Agreement number");
  fireEvent.click(
    options.find((node) =>
      node.closest(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option"),
    )!,
  );
  expect(create).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  await waitFor(() => expect(onDerived).toHaveBeenCalledWith(draft));
  expect(deriveDocumentObject).toHaveBeenCalledWith("p", draft, object, {
    id: "source_doc_current_1_doc",
    name: "Current agreements",
    role: "entity",
    fields: ["number"],
    identity: "number",
    confirm: true,
  });
});
