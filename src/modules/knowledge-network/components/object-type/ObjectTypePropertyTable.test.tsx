/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";
import type { ValueType } from "@/modules/knowledge-network/types/value-type";

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
    const longDescription =
      "A long property description that should stay inside the fixed table column.";

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
    expect(
      within(emptyDescriptionRow as HTMLTableRowElement).getAllByText("—").length,
    ).toBeGreaterThan(0);
  });

  it("shows configured index features and keeps unavailable features visible", () => {
    render(
      <ObjectTypePropertyTable
        properties={[
          createProperty({
            indexFeatures: [
              { type: "keyword", configured: true, available: true },
              { type: "vector", configured: true, available: false },
              { type: "fulltext", configured: false, available: true },
            ],
          }),
        ]}
        showToolbar={false}
      />,
    );

    expect(
      screen.getAllByText("knowledgeNetwork.objectTypePropertyIndexFeatures").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("keyword")).toBeVisible();
    expect(screen.getByText("vector")).toBeVisible();
    expect(screen.queryByText("fulltext")).not.toBeInTheDocument();
  });

  describe("declarations", () => {
    const DECLARATIONS = "knowledgeNetwork.propertyDeclarations";
    const status: ValueType = {
      baseType: "keyword",
      description: "",
      enum: [
        { display: "Applied", value: "applied" },
        { deprecated: true, display: "Paid", value: "paid" },
      ],
      id: "lis_apply_status",
      name: "Lab order status",
      tags: [],
      updateTime: "-",
      updaterName: "-",
    };

    it("leaves the column out unless asked for it", () => {
      render(
        <ObjectTypePropertyTable
          properties={[createProperty({ declarations: { required: true } })]}
          showToolbar={false}
        />,
      );

      expect(screen.queryByText(`${DECLARATIONS}.column`)).toBeNull();
      expect(document.querySelector(".ant-table-row-expand-icon")).toBeNull();
    });

    it("shows each declaration as a tag and a value type by its name", () => {
      render(
        <ObjectTypePropertyTable
          declarationsShown
          properties={[
            createProperty({
              declarations: {
                aliases: ["Barcode", "Order number", "Slip"],
                constraints: { passthrough: { future: 1 }, pattern: "^LO", unique: true },
              },
            }),
            createProperty({
              declarations: {
                constraints: { valueType: "lis_apply_status" },
                required: true,
                semantic: "status",
              },
              name: "status",
              primaryKey: false,
              type: "keyword",
            }),
            createProperty({ name: "updated_at", primaryKey: false, type: "datetime" }),
          ]}
          showToolbar={false}
          valueTypes={[status]}
        />,
      );

      const orderRow = screen.getByText("order_id").closest("tr") as HTMLTableRowElement;
      // The first two aliases, then how many there are in all.
      expect(within(orderRow).getByText(/tag\.aliases .*tag\.moreAliases/)).toBeInTheDocument();
      expect(within(orderRow).getByText(`${DECLARATIONS}.tag.pattern`)).toBeInTheDocument();
      expect(within(orderRow).getByText(`${DECLARATIONS}.tag.unique`)).toBeInTheDocument();
      expect(within(orderRow).getByText(`${DECLARATIONS}.tag.other`)).toBeInTheDocument();

      const statusRow = screen.getByText("status").closest("tr") as HTMLTableRowElement;
      expect(
        within(statusRow).getByText(`${DECLARATIONS}.semanticValue.status`),
      ).toBeInTheDocument();
      expect(within(statusRow).getByText(`${DECLARATIONS}.tag.required`)).toBeInTheDocument();
      expect(within(statusRow).getByText(`${DECLARATIONS}.tag.valueType`)).toBeInTheDocument();

      const plainRow = screen.getByText("updated_at").closest("tr") as HTMLTableRowElement;
      expect(within(plainRow).getAllByText("—").length).toBeGreaterThan(0);
    });

    it("lists the enum items of a property whose value type is an enum", () => {
      render(
        <ObjectTypePropertyTable
          declarationsShown
          properties={[
            createProperty({}),
            createProperty({
              declarations: { constraints: { valueType: "lis_apply_status" } },
              name: "status",
              primaryKey: false,
              type: "keyword",
            }),
          ]}
          showToolbar={false}
          valueTypes={[status]}
        />,
      );

      // A row with nothing to expand keeps a hidden, spaced icon.
      const expandIcons = document.querySelectorAll(
        "button.ant-table-row-expand-icon:not(.ant-table-row-expand-icon-spaced)",
      );
      expect(expandIcons).toHaveLength(1);
      fireEvent.click(expandIcons[0]);

      const tags = [...document.querySelectorAll(".ant-table-expanded-row .ant-tag")];
      expect(tags.map((tag) => tag.textContent)).toEqual([
        "applied Applied",
        "paid Paid · knowledgeNetwork.valueTypes.enumColumn.deprecated",
      ]);
      expect(tags[1]).toHaveClass("ant-tag-gold");
    });
  });
});
