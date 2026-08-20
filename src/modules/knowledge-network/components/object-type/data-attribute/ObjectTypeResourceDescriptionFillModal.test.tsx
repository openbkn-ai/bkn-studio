/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { ObjectTypeDescriptionFillCandidate } from "./object-type-data-attribute-editor.utils";
import { ObjectTypeResourceDescriptionFillModal } from "./ObjectTypeResourceDescriptionFillModal";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const nativeGetComputedStyle = window.getComputedStyle;

function createCandidate(
  overrides: Partial<ObjectTypeDescriptionFillCandidate> &
    Pick<ObjectTypeDescriptionFillCandidate, "propertyName" | "status">,
): ObjectTypeDescriptionFillCandidate {
  return {
    currentComment: "",
    propertyDisplayName: overrides.propertyName,
    sourceComment: "Source description",
    sourceFieldDisplayName: overrides.propertyName,
    sourceFieldName: `${overrides.propertyName}_source`,
    ...overrides,
  };
}

beforeAll(() => {
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    nativeGetComputedStyle.call(window, element),
  );
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterAll(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("ObjectTypeResourceDescriptionFillModal", () => {
  it("selects empty descriptions by default and lets users choose existing descriptions", () => {
    const onConfirm = vi.fn();
    render(
      <ObjectTypeResourceDescriptionFillModal
        candidates={[
          createCandidate({ propertyDisplayName: "Empty property", propertyName: "empty", status: "fillable" }),
          createCandidate({
            currentComment: "Manual description",
            propertyDisplayName: "Updatable property",
            propertyName: "updatable",
            status: "updatable",
          }),
        ]}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        open
      />,
    );

    const emptyRow = screen.getByText("Empty property").closest("tr");
    const updatableRow = screen.getByText("Updatable property").closest("tr");
    expect(emptyRow).not.toBeNull();
    expect(updatableRow).not.toBeNull();

    const emptyCheckbox = within(emptyRow as HTMLTableRowElement).getByRole("checkbox");
    const updatableCheckbox = within(updatableRow as HTMLTableRowElement).getByRole("checkbox");
    expect((emptyCheckbox as HTMLInputElement).checked).toBe(true);
    expect((updatableCheckbox as HTMLInputElement).checked).toBe(false);
    expect((updatableCheckbox as HTMLInputElement).disabled).toBe(false);

    fireEvent.click(updatableCheckbox);
    fireEvent.click(screen.getByText("knowledgeNetwork.objectTypeDescriptionFillConfirm"));

    expect(onConfirm).toHaveBeenCalledWith(["empty", "updatable"]);
  });

  it("shows guidance when no mapped properties are available", () => {
    render(
      <ObjectTypeResourceDescriptionFillModal
        candidates={[]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open
      />,
    );

    expect(
      screen.getByText("knowledgeNetwork.objectTypeDescriptionFillEmpty"),
    ).toBeTruthy();
  });
});
