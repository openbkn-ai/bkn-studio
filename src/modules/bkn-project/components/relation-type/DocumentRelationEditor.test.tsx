/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { fireEvent, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { DraftRelationTypeSave } from "@/modules/bkn-project/types/draft";
import { renderWithoutAntdStyles as render } from "@/test/render-without-antd-styles";
import { DocumentRelationEditor } from "./DocumentRelationEditor";
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
it.each(["entity", "file"])(
  "offers same-document joins only for file-scoped %s endpoints",
  async (role) => {
    const draft = mapDraft(mockDraft("p"));
    for (const object of draft.items.objectTypes)
      object.document = {
        role: "file",
        layer: "fact",
        reason: "Confirmed source",
        citations: [],
        selectionId: "lock",
        selectionRevision: 1,
        timeProperty: "",
        participantRelations: [],
      };
    draft.items.objectTypes[0].document!.role = role;
    const value: DraftRelationTypeSave = {
      name: "Related source",
      description: "",
      mapping: [],
      source: draft.items.objectTypes[0].id,
      target: draft.items.objectTypes[1].id,
      documentMapping: { mode: "linking" },
    };
    const onChange = vi.fn();
    render(<DocumentRelationEditor draft={draft} value={value} onChange={onChange} />);
    fireEvent.mouseDown(screen.getAllByRole("combobox")[2]);
    const option = (await screen.findByText("bknProject.documentEditor.same_document")).closest(
      ".ant-select-item-option",
    );
    expect(option).not.toBeNull();
    if (role === "entity") {
      expect(option).toHaveClass("ant-select-item-option-disabled");
      fireEvent.click(option!);
      expect(onChange).not.toHaveBeenCalled();
    } else {
      expect(option).not.toHaveClass("ant-select-item-option-disabled");
      fireEvent.click(option!);
      expect(onChange).toHaveBeenCalledWith({
        ...value,
        documentMapping: { mode: "same_document" },
      });
    }
  },
);
