/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { transformNumberLiteralJSONRequest } from "@/framework/request/precision-safe-json";
import { createApiResourceInput } from "../lib/api-resource";
import type { ApiResourceInput, ApiResourceQuery } from "../types/api-resource";
import { ApiResourceInvocationEditor } from "./ApiResourceInvocationEditor";
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
function harness(hasPaging = false, filterable = true) {
  const input = createApiResourceInput("catalog");
  input.schema_definition = [
    { name: "amount", original_name: "amount", type: "decimal", filterable },
  ];
  if (hasPaging)
    input.api_definition.paging_rule = { mode: "offset", default_limit: 10, max_limit: 100 };
  const changed = vi.fn();
  const validity = vi.fn();
  function Harness({ resource = input }: { resource?: ApiResourceInput }) {
    const [value, setValue] = useState<ApiResourceQuery>({});
    return (
      <ApiResourceInvocationEditor
        resource={resource}
        value={value}
        onValidityChange={validity}
        onChange={(next) => {
          setValue(next);
          changed(next);
        }}
      />
    );
  }
  const view = render(<Harness />);
  return {
    changed,
    validity,
    latest: () => changed.mock.lastCall?.[0] as ApiResourceQuery | undefined,
    input,
    setResource: (resource: ApiResourceInput) => view.rerender(<Harness resource={resource} />),
  };
}

const filterLabel = "dataCatalog.apiResource.invocation.filter";
const pagingLabel = "dataCatalog.apiResource.testPaging";
const filterSwitch = () => screen.getByRole("switch", { name: filterLabel });
const pagingSwitch = () => screen.getByRole("switch", { name: pagingLabel });

describe("API caller inputs", () => {
  it("explains why switches are disabled when the resource has no usable fields or paging rule", () => {
    const editor = harness(false, false);
    const filterHint = "dataCatalog.apiResource.invocation.noFilterableFields";
    const pagingHint = "dataCatalog.apiResource.invocation.noPagingRule";
    for (const [control, hint] of [
      [filterSwitch(), filterHint],
      [pagingSwitch(), pagingHint],
    ] as const) {
      expect(control).toBeDisabled();
      expect(control).not.toBeChecked();
      expect(screen.getByText(hint)).toBeVisible();
      expect(control).toHaveAccessibleDescription(hint);
      fireEvent.click(control);
    }
    expect(editor.changed).not.toHaveBeenCalled();

    editor.setResource({
      ...editor.input,
      api_definition: {
        ...editor.input.api_definition,
        paging_rule: { mode: "offset", default_limit: 10, max_limit: 100 },
      },
      schema_definition: editor.input.schema_definition.map((field) => ({
        ...field,
        filterable: true,
      })),
    });
    for (const [control, label, hint] of [
      [filterSwitch(), filterLabel, filterHint],
      [pagingSwitch(), pagingLabel, pagingHint],
    ] as const) {
      expect(control).toBeEnabled();
      fireEvent.click(screen.getByText(label));
      expect(control).not.toBeChecked();
      expect(screen.queryByText(hint)).not.toBeInTheDocument();
    }
  });

  it("keeps omitted inputs absent and uses only explicit single-page paging", () => {
    const editor = harness(true);
    expect(editor.changed).not.toHaveBeenCalled();
    expect(pagingSwitch()).not.toBeChecked();
    fireEvent.click(pagingSwitch());
    expect(editor.latest()).toEqual({ paging: { mode: "single" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "dataCatalog.apiResource.limit" }), {
      target: { value: "30" },
    });
    expect(editor.latest()).toEqual({ paging: { mode: "single", limit: 30 } });
    fireEvent.click(pagingSwitch());
    expect(editor.latest()).toEqual({});
  });
  it.each(["9007199254740993", "1.5", "-1"])(
    "retains unsafe paging draft %s without rounding or reusing a valid input",
    (raw) => {
      const editor = harness(true);
      fireEvent.click(pagingSwitch());
      const input = screen.getByRole("spinbutton", { name: "dataCatalog.apiResource.offset" });
      fireEvent.change(input, { target: { value: "30" } });
      const accepted = editor.latest();
      fireEvent.change(input, { target: { value: raw } });
      expect(editor.validity).toHaveBeenLastCalledWith(false);
      expect(editor.latest()).toBe(accepted);
      expect(input).toHaveValue(raw);
      fireEvent.click(filterSwitch());
      expect(editor.validity).toHaveBeenLastCalledWith(false);
      fireEvent.click(pagingSwitch());
      expect(editor.validity).toHaveBeenLastCalledWith(true);
      expect(editor.latest()).toEqual({});
    },
  );
  it("builds a complete graphical filter with an exact numeric constant and blocks an invalid draft", async () => {
    const editor = harness();
    expect(pagingSwitch()).toBeDisabled();
    fireEvent.click(filterSwitch());
    expect(screen.getByText("dataCatalog.filter.and")).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "dataCatalog.filter.groupLogic" })).toBeNull();
    expect(screen.queryByRole("button", { name: "dataCatalog.filter.addGroup" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.filter.addRule" }));
    expect(editor.validity).toHaveBeenLastCalledWith(false);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "dataCatalog.filter.field" }));
    fireEvent.click(
      await screen.findByText("amount", { selector: ".ant-select-item-option-content span" }),
    );
    const input = screen.getByRole("textbox", { name: "dataCatalog.filter.value" });
    fireEvent.change(input, { target: { value: "1234567890123456.78" } });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    expect(transformNumberLiteralJSONRequest(editor.latest())).toContain(
      '"value":1234567890123456.78',
    );
    expect(editor.latest()?.filter_condition).toMatchObject({
      operation: "and",
      sub_conditions: [{ field: "amount", operation: "==" }],
    });
    const valid = editor.latest();
    fireEvent.change(input, { target: { value: "1e" } });
    expect(editor.validity).toHaveBeenLastCalledWith(false);
    expect(editor.latest()).toBe(valid);
    fireEvent.click(filterSwitch());
    expect(editor.latest()).toEqual({});
  });

  it("clears the active inputs when their resource capabilities are removed", async () => {
    const editor = harness(true);
    fireEvent.click(pagingSwitch());
    fireEvent.change(screen.getByRole("spinbutton", { name: "dataCatalog.apiResource.limit" }), {
      target: { value: "30" },
    });
    fireEvent.click(filterSwitch());
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.filter.addRule" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "dataCatalog.filter.field" }));
    fireEvent.click(
      await screen.findByText("amount", { selector: ".ant-select-item-option-content span" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "dataCatalog.filter.value" }), {
      target: { value: "123" },
    });
    expect(editor.latest()).toMatchObject({
      filter_condition: { operation: "and" },
      paging: { limit: 30 },
    });

    editor.setResource(createApiResourceInput("catalog"));
    expect(filterSwitch()).toBeDisabled();
    expect(filterSwitch()).not.toBeChecked();
    expect(pagingSwitch()).toBeDisabled();
    expect(pagingSwitch()).not.toBeChecked();
    expect(editor.latest()).toEqual({});
    expect(editor.validity).toHaveBeenLastCalledWith(true);

    editor.setResource(editor.input);
    expect(filterSwitch()).toBeEnabled();
    expect(filterSwitch()).not.toBeChecked();
    expect(pagingSwitch()).toBeEnabled();
    expect(pagingSwitch()).not.toBeChecked();
    expect(editor.latest()).toEqual({});
  });
});
