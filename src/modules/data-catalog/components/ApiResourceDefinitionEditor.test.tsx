/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { createApiResourceInput } from "../lib/api-resource";
import type { ApiResourceInput } from "../types/api-resource";
import { ApiResourceDefinitionEditor } from "./ApiResourceDefinitionEditor";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const key = (name: string) => `dataCatalog.apiResource.${name}`;
const editorKey = (name: string) => `dataConnect.apiEditor.${name}`;

function fixture(): ApiResourceInput {
  const input = createApiResourceInput("catalog");
  return {
    ...input,
    schema_definition: [
      {
        name: "amount",
        original_name: "Amount",
        type: "decimal",
        attributes: { precision: 38, scale: 0, untouched: "keep" },
        condition_constraints: {
          operations: ["eq"],
          value: { minimum: parsePrecisionPreservingJSON("1234567890.123456789") },
        },
      },
    ],
    api_definition: {
      ...input.api_definition,
      variables: { amount: { value: "9007199254740993", sensitive: false } },
      request: {
        method: "POST",
        path: "orders",
        body: {
          type: "object",
          properties: {
            payload: {
              type: "string",
              value: {
                type: "array",
                value: [
                  "A",
                  { type: "integer", value: parsePrecisionPreservingJSON("9007199254740993") },
                ],
              },
              serialize: "json",
            },
          },
        },
      },
    },
  };
}

function harness(input = fixture(), disabled = false) {
  const changed = vi.fn();
  const validity = vi.fn();
  function Harness() {
    const [value, setValue] = useState(input);
    return (
      <ApiResourceDefinitionEditor
        value={value}
        disabled={disabled}
        onValidityChange={validity}
        onChange={(next) => {
          setValue(next);
          changed(next);
        }}
      />
    );
  }
  render(<Harness />);
  return {
    changed,
    validity,
    latest: () => (changed.mock.lastCall?.[0] as ApiResourceInput) ?? input,
  };
}

describe("API Resource graphical definition", () => {
  it("edits variables in Catalog-style cards and preserves protected entries", () => {
    const input = fixture();
    input.api_definition.variables = {
      amount: { value: "9007199254740993" },
      credential: { sensitive: true, extra: "keep" },
    };
    const editor = harness(input);
    const catalogKey = (name: string) => `dataConnect.apiCatalog.${name}`;
    const credential = screen.getByRole("group", {
      name: `${catalogKey("variableName")}: credential`,
    });
    expect(within(credential).getByText(editorKey("types.string"))).toBeVisible();
    expect(within(credential).getByRole("combobox")).toBeDisabled();
    expect(within(credential).getByText(key("storedVariable"))).toBeVisible();
    expect(
      within(credential).getByLabelText(`${catalogKey("sensitiveValue")} credential`),
    ).toHaveValue("");
    expect(editor.changed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: catalogKey("addVariable") }));
    const name = screen.getByRole("textbox", { name: `${catalogKey("variableName")} 3` });
    fireEvent.change(name, { target: { value: "order_code" } });
    const row = screen.getByRole("group", { name: `${catalogKey("variableName")}: order_code` });
    fireEvent.change(within(row).getByLabelText(`${catalogKey("variableValue")} order_code`), {
      target: { value: "001" },
    });
    fireEvent.click(within(row).getByRole("checkbox", { name: catalogKey("sensitive") }));
    expect(
      within(row).getByLabelText(`${catalogKey("sensitiveValue")} order_code`),
    ).toHaveAttribute("type", "password");
    expect(editor.latest().api_definition.variables).toEqual({
      amount: { value: "9007199254740993" },
      credential: { sensitive: true, extra: "keep" },
      order_code: { sensitive: true, value: "001" },
    });

    fireEvent.change(name, { target: { value: "amount" } });
    expect(editor.validity).toHaveBeenLastCalledWith(false);
    expect(editor.latest().api_definition.variables).toHaveProperty("order_code");
    fireEvent.click(
      within(row).getByRole("button", { name: `${catalogKey("removeVariable")} amount` }),
    );
    expect(editor.validity).toHaveBeenLastCalledWith(true);
    expect(editor.latest().api_definition.variables).not.toHaveProperty("order_code");
  });

  it("edits ordinary variable types with lossless numeric input and keeps sensitive values as strings", async () => {
    const editor = harness();
    const variable = screen.getByRole("group", {
      name: "dataConnect.apiCatalog.variableName: amount",
    });
    const type = within(variable).getByRole("combobox", {
      name: "dataConnect.apiCatalog.variableValue amount dataConnect.apiEditor.valueType",
    });
    async function selectType(name: string) {
      fireEvent.mouseDown(type);
      fireEvent.click(
        await screen.findByText(editorKey(`types.${name}`), {
          selector: ".ant-select-item-option-content",
        }),
      );
    }
    for (const [type, expected] of [
      ["object", {}],
      ["array", []],
      ["boolean", false],
    ] as const) {
      await selectType(type);
      expect(editor.latest().api_definition.variables).toMatchObject({
        amount: { value: expected },
      });
    }
    await selectType("number");
    fireEvent.change(
      within(variable).getByLabelText("dataConnect.apiCatalog.variableValue amount"),
      {
        target: { value: "9007199254740993.12345" },
      },
    );
    expect(transformPrecisionSafeJSONRequest(editor.latest().api_definition.variables)).toContain(
      '"value":9007199254740993.12345',
    );
    fireEvent.click(
      within(variable).getByRole("checkbox", { name: "dataConnect.apiCatalog.sensitive" }),
    );
    expect(type).toBeDisabled();
    expect(
      within(variable).getByLabelText("dataConnect.apiCatalog.sensitiveValue amount"),
    ).toHaveValue("");
    expect(editor.latest().api_definition.variables).toEqual({
      amount: { sensitive: true, value: "" },
    });
  });

  it("shows the API configuration tabs and a separate, reorderable output table", () => {
    const input = fixture();
    input.schema_definition.push({ name: "id", original_name: "ID", type: "integer" });
    const editor = harness(input);
    const tabs = screen.getByRole("tablist", { name: key("definition") });
    expect(
      within(tabs)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["variables", "request", "response", "success", "paging"].map(key));
    const table = screen.getByRole("table", { name: key("outputFields") });
    const [, first, last] = within(table).getAllByRole("row");
    const up = "dataCatalog.viewEditor.moveUp";
    const down = "dataCatalog.viewEditor.moveDown";
    expect(within(first).getByRole("button", { name: up })).toBeDisabled();
    expect(within(last).getByRole("button", { name: down })).toBeDisabled();
    fireEvent.click(within(first).getByRole("button", { name: down }));
    expect(editor.latest().schema_definition.map((field) => field.name)).toEqual(["id", "amount"]);
    fireEvent.click(
      within(first).getByRole("button", { name: "dataCatalog.viewEditor.removeField" }),
    );
    expect(editor.latest().schema_definition.map((field) => field.name)).toEqual(["amount"]);
    fireEvent.click(screen.getByRole("tab", { name: key("paging") }));
    expect(table).toBeVisible();
  });

  it("toggles filtering for the selected output field", () => {
    const input = fixture();
    input.schema_definition.push({
      name: "id",
      original_name: "ID",
      type: "integer",
      filterable: true,
    });
    const editor = harness(input);
    const table = screen.getByRole("table", { name: key("outputFields") });
    const [amount, id] = within(table).getAllByRole("switch");
    expect(amount).not.toBeChecked();
    expect(id).toBeChecked();

    fireEvent.click(amount);
    expect(amount).toBeChecked();
    expect(editor.latest().schema_definition.map((field) => field.filterable)).toEqual([
      true,
      true,
    ]);

    fireEvent.click(id);
    expect(id).not.toBeChecked();
    expect(editor.latest().schema_definition.map((field) => field.filterable)).toEqual([
      true,
      false,
    ]);
  });

  it("opens the paging card from the switch outside it", () => {
    const editor = harness();
    fireEvent.click(screen.getByRole("tab", { name: key("paging") }));
    const panel = within(screen.getByRole("tabpanel", { name: key("paging") }));
    const enabled = panel.getByRole("switch", { name: key("paging") });
    expect(panel.queryByRole("group", { name: key("paging") })).toBeNull();

    fireEvent.click(enabled);

    const cardNode = panel.getByRole("group", { name: key("paging") });
    const card = within(cardNode);
    expect(cardNode).not.toContainElement(enabled);
    expect(enabled).toHaveAttribute("aria-controls", cardNode.id);
    expect(card.getByText(key("pagingHint"))).toBeVisible();
    expect(card.getByRole("combobox", { name: key("pagingMode") })).toBeEnabled();
    expect(card.getByRole("spinbutton", { name: key("default_limit") })).toHaveValue("20");
    expect(card.getByRole("spinbutton", { name: key("max_limit") })).toHaveValue("100");
    expect(editor.latest().api_definition.paging_rule).toEqual({
      mode: "offset",
      default_limit: 20,
      max_limit: 100,
    });

    fireEvent.click(enabled);
    expect(panel.queryByRole("group", { name: key("paging") })).toBeNull();
    expect(enabled).not.toBeChecked();
    expect(editor.latest().api_definition).not.toHaveProperty("paging_rule");
  });

  it("edits signed scales and large precision only when the decimal popover is opened", async () => {
    const input = fixture();
    input.schema_definition[0].attributes = {
      precision: parsePrecisionPreservingJSON("9007199254740993"),
      scale: -3,
    };
    const editor = harness(input);
    expect(screen.queryByRole("spinbutton", { name: key("precision") })).toBeNull();
    const settings = screen.getByRole("button", { name: key("decimalSettings") });
    fireEvent.click(settings);
    const panel = await screen.findByRole("dialog", { name: key("decimalSettings") });
    const precision = within(panel).getByRole("spinbutton", { name: key("precision") });
    const scale = within(panel).getByRole("spinbutton", { name: key("scale") });
    expect(precision).toHaveValue("9007199254740993");
    expect(scale).toHaveValue("-3");
    fireEvent.change(precision, {
      target: { value: "9007199254740995" },
    });
    fireEvent.change(scale, { target: { value: "5" } });
    expect(transformPrecisionSafeJSONRequest(editor.latest().schema_definition)).toContain(
      '"precision":9007199254740995',
    );
    expect(editor.latest().schema_definition[0].attributes?.scale).toBe(5);
    fireEvent.keyDown(scale, { key: "Escape" });
    expect(settings).toHaveAttribute("aria-expanded", "false");
    expect(settings).toHaveFocus();
  });

  it("prefills precision and scale when selecting decimal without opening its popover", async () => {
    const input = fixture();
    input.schema_definition[0] = { name: "id", original_name: "ID", type: "string" };
    const editor = harness(input);
    expect(screen.queryByRole("button", { name: key("decimalSettings") })).toBeNull();
    const type = screen.getByRole("combobox", { name: key("fieldType") });
    fireEvent.mouseDown(type);
    fireEvent.click(
      await screen.findByText("decimal", { selector: ".ant-select-item-option-content" }),
    );
    expect(editor.latest().schema_definition[0]).toMatchObject({
      type: "decimal",
      attributes: { precision: 18, scale: 2 },
    });
    expect(screen.getByRole("button", { name: key("decimalSettings") })).toBeEnabled();
    expect(screen.queryByRole("spinbutton", { name: key("precision") })).toBeNull();
  });
  it("does not normalize on mount and preserves metadata/scale=0/precise literals when mapping names change", () => {
    const editor = harness();
    expect(editor.changed).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(key("fieldName")), { target: { value: "total" } });
    const result = editor.latest();
    expect(result.schema_definition[0]).toMatchObject({
      name: "total",
      original_name: "Amount",
      attributes: { precision: 38, scale: 0, untouched: "keep" },
    });
    const json = transformPrecisionSafeJSONRequest(result);
    expect(json).toContain('"minimum":1234567890.123456789');
    expect(json).toContain('"value":9007199254740993');
    expect(json).toContain('"serialize":"json"');
  });

  it("edits nested request values without losing mixed array order or exact numeric literals", async () => {
    const editor = harness();
    fireEvent.click(screen.getByRole("tab", { name: key("request") }));
    const number = await screen.findByLabelText(
      `${editorKey("body")}.payload.value[1] ${editorKey("fieldValue")}`,
    );
    fireEvent.change(number, { target: { value: "9007199254740995" } });
    const json = transformPrecisionSafeJSONRequest(editor.latest().api_definition);
    expect(json).toContain('"value":["A",{"type":"integer","value":9007199254740995}]');
    expect(json).toContain('"serialize":"json"');
  });

  it("edits the business Body with Catalog field cards and typed templates", () => {
    const input = fixture();
    input.api_definition.request = {
      method: "POST",
      path: "orders",
      body: {
        type: "object",
        required: ["count"],
        properties: {
          count: { type: "integer", minimum: 0, value: 1 },
          flag: { type: "boolean", value: false },
          items: { type: "array", value: [] },
          optionalCount: { type: "integer", minimum: 0 },
        },
      },
    };
    const editor = harness(input);
    fireEvent.click(screen.getByRole("tab", { name: key("request") }));
    expect(editor.validity).toHaveBeenLastCalledWith(true);
    const pane = within(screen.getByRole("tabpanel", { name: key("request") }));
    const body = editorKey("body");
    const count = pane.getByRole("textbox", { name: `${body}.count ${editorKey("fieldValue")}` });
    fireEvent.change(count, { target: { value: '{{ __variables.options["max.count"] }}' } });
    fireEvent.change(
      pane.getByRole("textbox", { name: `${body}.flag ${editorKey("fieldValue")}` }),
      {
        target: { value: "{{ options.flag }}" },
      },
    );
    fireEvent.change(
      pane.getByRole("textbox", { name: `${body}.items ${editorKey("bodyReference")}` }),
      {
        target: { value: "{{ options.items }}" },
      },
    );
    expect(pane.queryByText(editorKey("insertVariable"))).toBeNull();
    expect(pane.queryByText(editorKey("construction"))).toBeNull();
    const name = pane.getByLabelText(`${body} ${editorKey("fieldName")} count`);
    fireEvent.change(name, { target: { value: "limit" } });
    fireEvent.blur(name);
    expect(editor.latest().api_definition.request).toMatchObject({
      body: {
        required: ["limit"],
        properties: {
          limit: { type: "integer", minimum: 0, value: '{{ __variables.options["max.count"] }}' },
          flag: { type: "boolean", value: "{{ options.flag }}" },
          items: { type: "array", value: "{{ options.items }}" },
          optionalCount: { type: "integer", minimum: 0 },
        },
      },
    });
  });

  it("uses the Catalog Query fields and preserves saved options when changing the parameter", async () => {
    const input = fixture();
    input.schema_definition[0].filterable = true;
    input.api_definition.paging_rule = { mode: "offset", default_limit: 10, max_limit: 100 };
    const amount = parsePrecisionPreservingJSON("9007199254740993.12345");
    input.api_definition.request = {
      method: "GET",
      path: "orders",
      parameters: [{ name: "limit", value: amount, default_value: 0, required: true }],
    };
    const editor = harness(input);
    fireEvent.click(screen.getByRole("tab", { name: key("request") }));
    const label = `${editorKey("parameters")} 1`;
    const query = screen.getByRole("group", { name: label });
    const controls = within(query);
    const value = controls.getByRole("combobox", { name: `${label} ${editorKey("value")}` });
    expect(query.querySelectorAll("input")).toHaveLength(2);
    expect(controls.queryByRole("switch")).toBeNull();
    expect(value).toHaveValue("9007199254740993.12345");

    fireEvent.change(controls.getByRole("textbox", { name: `${label} ${editorKey("name")}` }), {
      target: { value: "page_size" },
    });
    expect(editor.latest().api_definition.request).toMatchObject({
      parameters: [{ name: "page_size", value: amount, default_value: 0, required: true }],
    });

    fireEvent.focus(value);
    fireEvent.change(value, { target: { value: "__paging.limit" } });
    await screen.findByRole("option", { name: "{{ __paging.limit }}" });
    fireEvent.keyDown(value, { key: "ArrowDown", code: "ArrowDown", keyCode: 40 });
    fireEvent.keyDown(value, { key: "Enter", code: "Enter", keyCode: 13 });
    expect(value).toHaveValue("{{ __paging.limit }}");
    expect(editor.latest().api_definition.request).toMatchObject({
      parameters: [
        { name: "page_size", value: "{{ __paging.limit }}", default_value: 0, required: true },
      ],
    });

    fireEvent.change(value, { target: { value: "__filter" } });
    expect(screen.queryByRole("option", { name: "{{ __filter_condition }}" })).toBeNull();
    expect(screen.queryByRole("option", { name: '{{ __filter_values["amount"] }}' })).toBeNull();
  });

  it.each([
    { mode: undefined, expected: [], excluded: ["limit", "offset", "page"] },
    { mode: "offset", expected: ["limit", "offset"], excluded: ["page"] },
    { mode: "page", expected: ["limit", "page"], excluded: ["offset"] },
  ])("suggests only pagination variables for mode $mode", async ({ mode, expected, excluded }) => {
    const input = fixture();
    if (mode) input.api_definition.paging_rule = { mode, default_limit: 10, max_limit: 100 };
    input.api_definition.request = {
      method: "GET",
      path: "orders",
      parameters: [{ name: "limit", value: "" }],
    };
    harness(input);
    fireEvent.click(screen.getByRole("tab", { name: key("request") }));
    const field = screen.getByRole("combobox", {
      name: `${editorKey("parameters")} 1 ${editorKey("value")}`,
    });
    fireEvent.focus(field);
    for (const name of expected) {
      fireEvent.change(field, { target: { value: `__paging.${name}` } });
      expect(await screen.findByRole("option", { name: `{{ __paging.${name} }}` })).toBeVisible();
    }
    for (const name of excluded) {
      fireEvent.change(field, { target: { value: `__paging.${name}` } });
      expect(screen.queryByRole("option", { name: `{{ __paging.${name} }}` })).toBeNull();
    }
  });

  it("adds or removes JSON serialization for a Body field without rewriting its source", () => {
    const input = fixture();
    input.api_definition.request = {
      method: "POST",
      path: "orders",
      body: {
        type: "object",
        properties: {
          payload: { type: "string", value: "{{ options }}", description: "Payload" },
          items: { type: "array", value: ["{{ options }}"] },
        },
      },
    };
    const editor = harness(input);
    fireEvent.click(screen.getByRole("tab", { name: key("request") }));
    const field = within(screen.getByRole("group", { name: `${editorKey("body")}.payload` }));
    const disclosure = field.getByText(editorKey("serialization"));
    expect(disclosure.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(disclosure);
    const serialize = field.getByRole("checkbox", { name: editorKey("bodySerializeJson") });
    fireEvent.click(serialize);
    expect(editor.latest().api_definition.request).toMatchObject({
      body: {
        properties: { payload: { type: "string", value: "{{ options }}", serialize: "json" } },
      },
    });
    fireEvent.click(serialize);
    expect(editor.latest().api_definition.request).toEqual(input.api_definition.request);

    const item = within(screen.getByRole("group", { name: `${editorKey("body")}.items[0]` }));
    fireEvent.click(item.getByText(editorKey("serialization")));
    fireEvent.click(item.getByRole("checkbox", { name: editorKey("bodySerializeJson") }));
    expect(editor.latest().api_definition.request).toMatchObject({
      body: {
        properties: {
          items: {
            type: "array",
            value: [{ type: "string", value: "{{ options }}", serialize: "json" }],
          },
        },
      },
    });
    fireEvent.click(item.getByRole("checkbox", { name: editorKey("bodySerializeJson") }));
    expect(editor.latest().api_definition.request).toEqual(input.api_definition.request);
  });

  it("keeps unset Body sources omitted when serialization is enabled and then disabled", () => {
    const input = fixture();
    input.api_definition.request = {
      method: "POST",
      path: "orders",
      body: {
        type: "object",
        properties: {
          optional: { type: "string", description: "Leave unset" },
          inferred: { value: "{{ options }}" },
        },
      },
    };
    const editor = harness(input);
    fireEvent.click(screen.getByRole("tab", { name: key("request") }));
    for (const name of ["optional", "inferred"]) {
      const field = within(screen.getByRole("group", { name: `${editorKey("body")}.${name}` }));
      fireEvent.click(field.getByText(editorKey("serialization")));
      const serialize = field.getByRole("checkbox", { name: editorKey("bodySerializeJson") });
      fireEvent.click(serialize);
      if (name === "optional") expect(editor.validity).toHaveBeenLastCalledWith(false);
      fireEvent.click(serialize);
      expect(editor.latest().api_definition.request).toEqual(input.api_definition.request);
      expect(editor.validity).toHaveBeenLastCalledWith(true);
    }
  });

  it("uses the Catalog response card and preserves Schema extensions and per-status paths", async () => {
    const input = fixture();
    input.api_definition.response = {
      content_type: "application/json",
      statuses: {
        "200": {
          description: "OK",
          schema: { type: "object", properties: {}, minProperties: 0, oneOf: [{ const: {} }] },
          result_rows: "",
          result_total: "Total",
        },
        "400": { description: "Bad request", schema: false },
      },
    };
    const editor = harness(input);
    fireEvent.click(screen.getByRole("tab", { name: key("response") }));
    const card = within(screen.getByRole("group", { name: editorKey("response") }));
    const extraction = await within(
      card.getByRole("group", { name: `${editorKey("responseStatus")} 200` }),
    ).findByRole("textbox", { name: key("result_rows") });
    expect(extraction).toHaveAccessibleDescription(key("extractionHint"));
    fireEvent.change(extraction, {
      target: { value: "Result.Rows" },
    });
    fireEvent.change(
      card.getByLabelText(`200 ${editorKey("response")} ${editorKey("description")}`),
      {
        target: { value: "Rows envelope" },
      },
    );
    expect(card.getByRole("button", { name: editorKey("advancedSchema") })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(card.queryByText(editorKey("oneOf"))).toBeNull();
    expect(card.queryByRole("button", { name: editorKey("addAlternative") })).toBeNull();
    expect(card.queryByText(editorKey("constraints"))).toBeNull();
    fireEvent.click(card.getByRole("tab", { name: "400" }));
    expect(card.getByRole("textbox", { name: `400 ${editorKey("description")}` })).toHaveValue(
      "Bad request",
    );
    expect(editor.latest().api_definition.response).toMatchObject({
      statuses: {
        "200": {
          result_rows: "Result.Rows",
          result_total: "Total",
          schema: { description: "Rows envelope", minProperties: 0, oneOf: [{ const: {} }] },
        },
        "400": { schema: false },
      },
    });
    expect(document.querySelector(".monaco-editor,textarea")).toBeNull();
  });

  it("edits oneOf branches graphically and removes the keyword with its last branch", async () => {
    const input = fixture();
    input.api_definition.response = {
      content_type: "application/json",
      statuses: {
        "200": {
          schema: {
            minProperties: 0,
            oneOf: [{ type: "array", items: { oneOf: [{ const: "old" }, false] } }, true],
          },
        },
      },
    };
    const editor = harness(input);
    fireEvent.click(screen.getByRole("tab", { name: key("response") }));
    const heading = `200 ${editorKey("response")}`;
    const advanced = editorKey("advancedSchema");
    const branch = editorKey("fieldTable.branch");
    const outer = within(screen.getByRole("group", { name: `${heading} ${advanced}` }));
    fireEvent.click(outer.getByRole("button", { name: advanced }));
    expect(editor.changed).not.toHaveBeenCalled();

    const child = `${heading}.oneOf[0].items`;
    const childAdvanced = within(outer.getByRole("group", { name: `${child} ${advanced}` }));
    const childToggle = childAdvanced.getByRole("button", { name: advanced });
    fireEvent.click(childToggle);
    const nested = await childAdvanced.findByRole("textbox", {
      name: `${child}.oneOf[0] ${editorKey("description")}`,
    });
    fireEvent.change(nested, { target: { value: "Nested description" } });
    const schema = () =>
      (
        editor.latest().api_definition.response as {
          statuses: Record<string, { schema: Record<string, unknown> }>;
        }
      ).statuses["200"].schema;
    expect(schema()).toEqual({
      minProperties: 0,
      oneOf: [
        {
          type: "array",
          items: { oneOf: [{ const: "old", description: "Nested description" }, false] },
        },
        true,
      ],
    });

    fireEvent.click(childToggle);
    fireEvent.click(outer.getByRole("button", { name: `${editorKey("remove")} ${branch} 1` }));
    expect(schema()).toEqual({ minProperties: 0, oneOf: [true] });
    fireEvent.click(outer.getByRole("button", { name: editorKey("addAlternative") }));
    expect(schema()).toEqual({ minProperties: 0, oneOf: [true, { type: "string" }] });

    const type = outer.getByRole("combobox", {
      name: `${heading}.oneOf[1] ${editorKey("schemaType")}`,
    });
    fireEvent.mouseDown(type);
    fireEvent.click(
      await screen.findByText(editorKey("types.boolean"), {
        selector: ".ant-select-item-option-content",
      }),
    );
    const added = within(outer.getByRole("group", { name: `${heading}.oneOf[1] ${advanced}` }));
    const constant = editorKey("fieldTable.keywords.const");
    const valueLabel = `${heading}.oneOf[1] ${constant}`;
    const addedToggle = added.getByRole("button", { name: advanced });
    fireEvent.click(addedToggle);
    fireEvent.click(added.getByRole("checkbox", { name: constant }));
    expect(schema()).toEqual({
      minProperties: 0,
      oneOf: [true, { type: "boolean", const: false }],
    });
    fireEvent.mouseDown(added.getByRole("combobox", { name: valueLabel }));
    fireEvent.click(
      await screen.findByText(editorKey("true"), { selector: ".ant-select-item-option-content" }),
    );
    expect(schema()).toEqual({ minProperties: 0, oneOf: [true, { type: "boolean", const: true }] });
    fireEvent.click(addedToggle);

    const remove = (branch: number) =>
      fireEvent.click(
        outer.getByRole("button", {
          name: `${editorKey("remove")} ${editorKey("fieldTable.branch")} ${branch}`,
        }),
      );
    remove(2);
    remove(1);
    expect(schema()).toEqual({ minProperties: 0 });
  });

  it("keeps invalid oneOf branch drafts registered while the advanced editor is closed", async () => {
    const input = fixture();
    input.api_definition.response = {
      content_type: "application/json",
      statuses: {
        "200": {
          schema: {
            oneOf: [
              {
                type: "object",
                properties: { first: { type: "string" }, second: { type: "number" } },
              },
            ],
          },
        },
      },
    };
    const editor = harness(input);
    fireEvent.click(screen.getByRole("tab", { name: key("response") }));
    const advanced = editorKey("advancedSchema");
    const heading = `200 ${editorKey("response")}`;
    const outer = within(screen.getByRole("group", { name: `${heading} ${advanced}` }));
    const toggle = outer.getByRole("button", { name: advanced });
    fireEvent.click(toggle);
    const name = `${heading}.oneOf[0].properties ${editorKey("propertyName")} first`;
    const field = outer.getByRole("textbox", { name });
    fireEvent.change(field, { target: { value: "second" } });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));

    fireEvent.click(toggle);
    expect(editor.validity).toHaveBeenLastCalledWith(false);
    expect(editor.changed).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(outer.getByRole("textbox", { name })).toHaveValue("second");
    fireEvent.change(field, { target: { value: "renamed" } });
    fireEvent.blur(field);
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    expect(editor.latest().api_definition.response).toMatchObject({
      statuses: {
        "200": {
          schema: {
            oneOf: [{ properties: { renamed: { type: "string" }, second: { type: "number" } } }],
          },
        },
      },
    });
  });

  it("uses independent switches for the two extraction paths", () => {
    const editor = harness();
    fireEvent.click(screen.getByRole("tab", { name: key("response") }));
    const status = within(
      screen.getByRole("group", { name: `${editorKey("responseStatus")} 200` }),
    );
    const rows = status.getByRole("switch", { name: key("result_rows") });
    const total = status.getByRole("switch", { name: key("result_total") });
    expect(rows).toBeChecked();
    expect(total).not.toBeChecked();
    expect(status.queryByRole("textbox", { name: key("result_total") })).toBeNull();

    fireEvent.click(total);
    const totalPath = status.getByRole("textbox", { name: key("result_total") });
    expect(totalPath).toHaveValue("");
    fireEvent.change(totalPath, { target: { value: "Result.Total" } });

    fireEvent.click(rows);
    expect(rows).not.toBeChecked();
    expect(total).toBeChecked();
    expect(status.queryByRole("textbox", { name: key("result_rows") })).toBeNull();
    const json = transformPrecisionSafeJSONRequest(editor.latest().api_definition.response);
    expect(json).not.toContain('"result_rows"');
    expect(json).toContain('"result_total":"Result.Total"');
  });

  it("uses the Catalog success card with an editable response condition", () => {
    const input = fixture();
    input.api_definition.success_rule = {
      http_status: [200],
      body_filter_condition: { field: "ok", operation: "eq", value: true },
    };
    const editor = harness(input);
    fireEvent.click(screen.getByRole("tab", { name: key("success") }));
    const card = within(screen.getByRole("group", { name: editorKey("success") }));
    expect(
      card.getByRole("combobox", { name: new RegExp(editorKey("allowedStatuses")) }),
    ).toBeVisible();
    fireEvent.change(
      card.getByRole("textbox", {
        name: `${editorKey("condition")} ${editorKey("relativeField")}`,
      }),
      {
        target: { value: "result.ok" },
      },
    );
    expect(editor.latest().api_definition.success_rule).toEqual({
      http_status: [200],
      body_filter_condition: { field: "result.ok", operation: "eq", value: true },
    });
  });

  it("keeps all controls read-only when management is denied", () => {
    const editor = harness(fixture(), true);
    expect(screen.getByLabelText(key("fieldName"))).toBeDisabled();
    expect(screen.getByRole("button", { name: key("addField") })).toBeDisabled();
    expect(
      within(screen.getByRole("table", { name: key("outputFields") })).getByRole("switch"),
    ).toBeDisabled();
    expect(editor.changed).not.toHaveBeenCalled();
  });
});
