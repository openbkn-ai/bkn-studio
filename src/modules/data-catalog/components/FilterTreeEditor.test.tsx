/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FilterGroup, FilterRule } from "@/modules/data-catalog/lib/filter-tree";

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
  it("keeps Text presence conditions available without a keyword Feature", () => {
    render(
      <FilterTreeEditor
        fields={[...fields, { name: "notes", displayName: "备注", type: "text" }]}
        onChange={vi.fn()}
        queryPath="local_index"
        value={filter}
      />,
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "dataCatalog.filter.field" }));
    const dropdown = document.querySelector(
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden)",
    )!;
    expect(within(dropdown as HTMLElement).getByText("备注")).toBeTruthy();
  });

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

function EditableFilter({
  rule,
  onChange = () => {},
}: {
  rule: FilterRule;
  onChange?: (group: FilterGroup) => void;
}) {
  const [value, setValue] = useState<FilterGroup>({
    kind: "group",
    operation: "and",
    children: [rule],
  });
  return (
    <FilterTreeEditor
      fields={[
        ...fields,
        { name: "at", type: "datetime" },
        { name: "day", type: "date" },
        { name: "flag", type: "boolean" },
      ]}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}
function chooseFilterOption(label: string, text: string) {
  const picker = screen.getByRole("combobox", { name: label });
  fireEvent.mouseDown(picker);
  if (label === "dataCatalog.filter.operator")
    fireEvent.change(picker, { target: { value: text } });
  const dropdown = document.querySelector(
    ".ant-select-dropdown:not(.ant-select-dropdown-hidden)",
  ) as HTMLElement;
  const option = Array.from(dropdown.querySelectorAll(".ant-select-item-option-content")).find(
    (element) => element.textContent === text,
  );
  expect(option).toBeTruthy();
  fireEvent.click(option!);
}

describe("structured filter inputs", () => {
  it("switches scalar, set and no-value operators without retaining stale values", () => {
    const changed = vi.fn();
    render(
      <EditableFilter
        onChange={changed}
        rule={{ kind: "rule", field: "status", operation: "==", value: "active" }}
      />,
    );
    chooseFilterOption("dataCatalog.filter.operator", "dataCatalog.filter.operations.in");
    expect(screen.getByLabelText("dataCatalog.filter.value 1")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("dataCatalog.filter.value 1"), {
      target: { value: "a,b" },
    });
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.filter.addValue" }));
    fireEvent.change(screen.getByLabelText("dataCatalog.filter.value 2"), {
      target: { value: "c" },
    });
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({ children: [expect.objectContaining({ value: ["a,b", "c"] })] }),
    );
    chooseFilterOption("dataCatalog.filter.operator", "dataCatalog.filter.operations.null");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("dataCatalog.filter.noValue")).toBeTruthy();
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        children: [expect.objectContaining({ operation: "null", value: "" })],
      }),
    );
  });

  it("preserves fractional seconds and explicit offsets and reveals time help on focus", async () => {
    const changed = vi.fn();
    render(
      <EditableFilter
        onChange={changed}
        rule={{
          kind: "rule",
          field: "at",
          operation: "range",
          value: ["2026-10-19T00:00:00.123456789+08:00", "2026-10-22 00:00:00"],
        }}
      />,
    );
    expect(screen.queryByText("dataCatalog.filter.datetimeHint")).toBeNull();
    fireEvent.focus(screen.getAllByRole("button", { name: "dataCatalog.filter.timeHelp" })[0]);
    await waitFor(() =>
      expect(screen.getByRole("tooltip")).toHaveTextContent("dataCatalog.filter.datetimeHint"),
    );
    expect(screen.getByLabelText("dataCatalog.filter.lowerBound")).toHaveValue(
      "2026-10-19T00:00:00.123456789+08:00",
    );
    fireEvent.change(screen.getByLabelText("dataCatalog.filter.upperBound"), {
      target: { value: "2026-10-23 00:00:00.000000001" },
    });
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        children: [
          expect.objectContaining({
            value: ["2026-10-19T00:00:00.123456789+08:00", "2026-10-23 00:00:00.000000001"],
          }),
        ],
      }),
    );
  });

  it("uses a calendar input for dates and a typed selection for booleans", () => {
    const changed = vi.fn();
    const view = render(
      <EditableFilter
        onChange={changed}
        rule={{ kind: "rule", field: "day", operation: "==", value: "2026-10-19" }}
      />,
    );
    expect(screen.getByLabelText("dataCatalog.filter.value")).toHaveAttribute("type", "date");
    view.unmount();
    render(
      <EditableFilter
        onChange={changed}
        rule={{ kind: "rule", field: "flag", operation: "==", value: "true" }}
      />,
    );
    chooseFilterOption("dataCatalog.filter.value", "false");
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({ children: [expect.objectContaining({ value: "false" })] }),
    );
  });

  it("limits right field choices to compatible types and clears the former constant", () => {
    const changed = vi.fn();
    render(
      <EditableFilter
        onChange={changed}
        rule={{ kind: "rule", field: "order_id", operation: ">=", value: "10" }}
      />,
    );
    chooseFilterOption("dataCatalog.filter.valueSource", "dataCatalog.filter.field");
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "dataCatalog.filter.rightField" }));
    const dropdown = document.querySelector(
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden)",
    ) as HTMLElement;
    expect(within(dropdown).queryByText("at")).toBeNull();
    expect(within(dropdown).queryByText("order_id")).toBeNull();
    const amountOption = within(dropdown)
      .getByText("订单金额")
      .closest(".ant-select-item-option") as HTMLElement;
    expect(within(amountOption).getByText("dec").closest("[title]")).toHaveAttribute(
      "title",
      "decimal(18,2)",
    );
    expect(within(amountOption).getByText("amount")).toBeTruthy();
    fireEvent.click(amountOption);
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        children: [expect.objectContaining({ valueFrom: "field", value: "amount" })],
      }),
    );
    const selectedRightField = screen
      .getByRole("combobox", { name: "dataCatalog.filter.rightField" })
      .closest(".ant-select") as HTMLElement;
    expect(within(selectedRightField).getByText("dec").closest("[title]")).toHaveAttribute(
      "title",
      "decimal(18,2)",
    );
    expect(within(selectedRightField).getByText("订单金额")).toBeTruthy();
    expect(within(selectedRightField).getByText("amount").parentElement?.className).toContain(
      "namesInline",
    );
    const rightPicker = screen.getByRole("combobox", { name: "dataCatalog.filter.rightField" });
    fireEvent.mouseDown(rightPicker);
    fireEvent.change(rightPicker, { target: { value: "decimal" } });
    const searchedDropdown = document.querySelector(
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden)",
    ) as HTMLElement;
    expect(within(searchedDropdown).getByText("订单金额")).toBeTruthy();
    expect(within(searchedDropdown).queryByText("order_id")).toBeNull();
    fireEvent.click(within(searchedDropdown).getByText("订单金额"));
    chooseFilterOption("dataCatalog.filter.valueSource", "dataCatalog.filter.constant");
    const constant = screen.getByRole("textbox", { name: "dataCatalog.filter.value" });
    expect(constant).toHaveValue("");
    expect(screen.queryByRole("combobox", { name: "dataCatalog.filter.rightField" })).toBeNull();
    fireEvent.change(constant, { target: { value: "20" } });
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        children: [expect.objectContaining({ valueFrom: "const", value: "20" })],
      }),
    );
  });
});

describe("relative time units", () => {
  it.each(["before", "current"] as const)("offers the supported units for %s", (operation) => {
    const changed = vi.fn();
    render(
      <EditableFilter
        onChange={changed}
        rule={{
          kind: "rule",
          field: "at",
          operation,
          value: operation === "before" ? ["3", "day"] : "day",
        }}
      />,
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "dataCatalog.filter.timeUnit" }));
    const dropdown = document.querySelector(
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden)",
    ) as HTMLElement;
    expect(within(dropdown).getByText("dataCatalog.filter.units.day")).toBeInTheDocument();
    fireEvent.click(within(dropdown).getByText("dataCatalog.filter.units.week"));
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        children: [
          expect.objectContaining({
            operation,
            value: operation === "before" ? ["3", "week"] : "week",
          }),
        ],
      }),
    );
  });
});

describe("explicit empty string input", () => {
  it("distinguishes a new draft entry from an explicitly selected empty string", () => {
    const changed = vi.fn();
    render(
      <EditableFilter
        onChange={changed}
        rule={{ kind: "rule", field: "status", operation: "in", value: [undefined, "active"] }}
      />,
    );
    expect(screen.getByLabelText("dataCatalog.filter.value 1")).toHaveAttribute(
      "placeholder",
      "dataCatalog.filter.value 1",
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "dataCatalog.filter.useEmptyString" })[0],
    );
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({ children: [expect.objectContaining({ value: ["", "active"] })] }),
    );
    expect(screen.getByLabelText("dataCatalog.filter.value 1")).toHaveAttribute(
      "placeholder",
      "dataCatalog.filter.emptyString",
    );
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.filter.addValue" }));
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        children: [expect.objectContaining({ value: ["", "active", undefined] })],
      }),
    );
  });
});
