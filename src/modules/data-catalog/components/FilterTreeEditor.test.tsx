/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FilterGroup } from "@/modules/data-catalog/lib/filter-tree";

import { FilterTreeEditor } from "./FilterTreeEditor";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const fields = [
  { name: "amount", displayName: "订单金额", type: "decimal(18,2)" },
  { name: "status", displayName: "订单状态", type: "string" },
  { name: "order_id", displayName: "order_id", type: "integer" },
];
const filter: FilterGroup = {
  kind: "group",
  operation: "and",
  children: [{ kind: "rule", field: "amount", operation: ">", value: "1000" }],
};

describe("FilterTreeEditor field labels", () => {
  it("shows a type badge, display name, and field name in the view detail", () => {
    render(<FilterTreeEditor fields={fields} readOnly value={filter} />);

    const field = screen.getByText("订单金额").closest('[class*="readOnlyCell"]') as HTMLElement;
    expect(within(field).getByText("dec").closest("[title]")).toHaveAttribute(
      "title",
      "decimal(18,2)",
    );
    expect(within(field).getByText("amount").parentElement?.className).toContain("namesInline");
  });

  it("shows the same field identity when editing and keeps the field searchable", () => {
    render(<FilterTreeEditor fields={fields} onChange={vi.fn()} value={filter} />);

    const picker = screen.getByRole("combobox", { name: "dataCatalog.filter.field" });
    const selected = picker.closest(".ant-select") as HTMLElement;
    expect(within(selected).getByText("dec")).toBeTruthy();
    expect(within(selected).getByText("订单金额")).toBeTruthy();
    expect(within(selected).getByText("amount").parentElement?.className).toContain("namesInline");

    fireEvent.mouseDown(picker);
    fireEvent.change(picker, { target: { value: "amount" } });
    const dropdown = document.querySelector(
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden)",
    )!;
    expect(within(dropdown as HTMLElement).getByText("订单金额")).toBeTruthy();
    expect(within(dropdown as HTMLElement).queryByText("订单状态")).toBeNull();
  });

  it("keeps the display name and field name visible when they are equal", () => {
    const equalNamesFilter: FilterGroup = {
      kind: "group",
      operation: "and",
      children: [{ kind: "rule", field: "order_id", operation: "==", value: "1" }],
    };
    const detail = render(<FilterTreeEditor fields={fields} readOnly value={equalNamesFilter} />);
    const readOnlyField = screen
      .getAllByText("order_id")[0]
      .closest('[class*="readOnlyCell"]') as HTMLElement;
    expect(within(readOnlyField).getByText("int")).toBeTruthy();
    expect(within(readOnlyField).getAllByText("order_id")).toHaveLength(2);

    detail.rerender(
      <FilterTreeEditor fields={fields} onChange={vi.fn()} value={equalNamesFilter} />,
    );
    const picker = screen.getByRole("combobox", { name: "dataCatalog.filter.field" });
    const selected = picker.closest(".ant-select") as HTMLElement;
    expect(within(selected).getByText("int")).toBeTruthy();
    expect(within(selected).getAllByText("order_id")).toHaveLength(2);
    fireEvent.mouseDown(picker);
    const dropdown = document.querySelector(
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden)",
    ) as HTMLElement;
    const option = within(dropdown)
      .getAllByText("order_id")[0]
      .closest("[class*='identity']") as HTMLElement;
    expect(within(option).getAllByText("order_id")).toHaveLength(2);
  });
});
