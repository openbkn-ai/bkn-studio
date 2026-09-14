/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";

import { ObjectTypePropertyTable } from "./ObjectTypePropertyTable";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

function createProperty(overrides: Partial<ObjectTypeDataProperty>): ObjectTypeDataProperty {
  return {
    displayKey: false,
    displayName: "Order ID",
    incrementalKey: false,
    name: "order_id",
    primaryKey: true,
    type: "string",
    ...overrides,
  };
}

const nativeGetComputedStyle = window.getComputedStyle;

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

describe("ObjectTypePropertyTable", () => {
  it("shows property descriptions with a consistent empty value and ellipsis styling", () => {
    const longDescription = "A long property description that should stay inside the fixed table column.";

    render(
      <ObjectTypePropertyTable
        properties={[
          createProperty({ comment: longDescription }),
          createProperty({ comment: "   ", displayName: "Customer ID", name: "customer_id" }),
        ]}
        showToolbar={false}
      />,
    );

    expect(
      screen.getAllByText("knowledgeNetwork.objectTypePropertyDescription").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(longDescription).className).toContain("cellEllipsis");

    const emptyDescriptionRow = screen.getByText("customer_id").closest("tr");
    expect(emptyDescriptionRow).not.toBeNull();
    expect(within(emptyDescriptionRow as HTMLTableRowElement).getAllByText("—").length).toBeGreaterThan(0);
  });
});
