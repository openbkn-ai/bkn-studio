/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";
import { mockApiResourceFixtures } from "../services/api-resource-mock-data";
import { ApiResourceDefinitionTables } from "./ApiResourceDefinitionTables";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const editor = (key: string) => `dataConnect.apiEditor.${key}`;
const field = (key: string) => `dataConnect.apiEditor.fieldTable.${key}`;
const schemaTitle = "200 dataCatalog.apiResource.table.schema";
function schema(value: unknown) {
  return render(
    <ApiResourceDefinitionTables
      name="response"
      value={{ statuses: { "200": { description: "OK", schema: value } } }}
    />,
  );
}
function body(value: unknown) {
  return render(<ApiResourceDefinitionTables name="request" value={{ body: value }} />);
}
function row(table: HTMLElement, name: string) {
  return within(table).getByRole("rowheader", { name }).parentElement!;
}

describe("API resource field tables", () => {
  it("keeps each Body field's type, required flag, and construction together and collapses object fields", () => {
    const value = mockApiResourceFixtures[1].api_definition.request;
    const before = JSON.stringify(value);
    render(<ApiResourceDefinitionTables name="request" value={value} />);
    const table = screen.getByRole("table", { name: editor("body") });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      editor("fieldName"),
      editor("schemaType"),
      editor("required"),
      field("construction"),
      editor("description"),
    ]);
    expect(
      within(row(table, "order_no"))
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["string", editor("true"), "{{ order_number }}", "—"]);
    expect(
      within(row(table, "include_items"))
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["boolean", editor("false"), "true", "—"]);
    expect(row(table, "context.locale")).toHaveTextContent("integer");
    expect(row(table, "context.locale")).toHaveTextContent("{{ locale }}");
    for (const name of ["properties", "required", "type", "value"])
      expect(within(table).queryByRole("rowheader", { name })).toBeNull();
    const toggle = within(table).getByRole("button", { name: "context" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(table).queryByRole("rowheader", { name: "context.locale" })).toBeNull();
    expect(row(table, "order_no")).toBeVisible();
    fireEvent.click(toggle);
    expect(row(table, "context.locale")).toBeVisible();
    expect(JSON.stringify(value)).toBe(before);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("flattens array object schemas into business fields with item-local required flags and constraints", () => {
    render(
      <ApiResourceDefinitionTables
        name="response"
        value={mockApiResourceFixtures[0].api_definition.response}
      />,
    );
    const table = screen.getByRole("table", { name: schemaTitle });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      editor("fieldName"),
      editor("schemaType"),
      editor("required"),
      editor("description"),
      field("constraints"),
    ]);
    expect(row(table, "data.items")).toHaveTextContent("array〈object〉");
    expect(within(row(table, "data.items[].amount")).getAllByRole("cell")[1]).toHaveTextContent(
      editor("true"),
    );
    expect(row(table, "data.total")).toHaveTextContent(`${field("keywords.minimum")}：0`);
    expect(row(table, "success")).toHaveTextContent(`${field("keywords.const")}：true`);
    fireEvent.click(within(table).getByRole("button", { name: "data.items" }));
    expect(within(table).queryByRole("rowheader", { name: "data.items[].amount" })).toBeNull();
    expect(row(table, "data.total")).toBeVisible();
    fireEvent.click(within(table).getByRole("button", { name: "data" }));
    expect(within(table).queryByRole("rowheader", { name: "data.total" })).toBeNull();
    expect(row(table, "success")).toBeVisible();
  });

  it("retains array literals, typed construction sources, serialization, and exact numeric values", () => {
    const exact = parsePrecisionPreservingJSON("9007199254740993.000000001");
    const definition = {
      type: "object",
      properties: {
        entries: {
          type: "array",
          value: [false, 0, "", null, exact, { type: "string", value: "{{ tenant }}" }],
        },
        payload: {
          type: "string",
          serialize: "json",
          value: { type: "object", properties: { text: { type: "string", value: "hello" } } },
        },
        query: {
          type: "string",
          serialize: "sql",
          value: "{{ query }}",
          fields: { amount: "amount_column" },
          maxLength: 200,
        },
      },
    };
    const before = JSON.stringify(definition);
    const { container } = body(definition);
    const table = screen.getByRole("table", { name: editor("body") });
    for (const [name, expected] of [
      ["entries[0]", "false"],
      ["entries[1]", "0"],
      ["entries[2]", "dataCatalog.apiResource.table.emptyString"],
      ["entries[3]", "null"],
      ["entries[4]", "9007199254740993.000000001"],
      ["entries[5]", "{{ tenant }}"],
    ])
      expect(row(table, name)).toHaveTextContent(expected);
    expect(row(table, "payload")).toHaveTextContent(field("nodeConstruction"));
    expect(row(table, "payload")).toHaveTextContent("json");
    expect(row(table, "payload → value.text")).toHaveTextContent("hello");
    const details = [...container.querySelectorAll("details")].find((item) =>
      item.querySelector("summary")?.textContent?.includes("query"),
    )!;
    fireEvent.click(details.querySelector("summary")!);
    expect(details).toHaveAttribute("open");
    expect(details).toHaveTextContent("amount_column");
    expect(details).toHaveTextContent("200");
    expect(JSON.stringify(definition)).toBe(before);
    expect(container.querySelector("pre")).toBeNull();
  });

  it("keeps uncommon and complex constraints in expandable row details, including item annotations", () => {
    const value = {
      type: "object",
      properties: {
        tags: {
          type: ["array", "null"],
          minItems: 0,
          items: { type: "string", minLength: 1, description: "tag description" },
        },
        amount: {
          type: "number",
          minimum: parsePrecisionPreservingJSON("9007199254740993.000000001"),
          oneOf: [{ maximum: 1 }, { minimum: 10 }],
          "x-future": { enabled: false, count: 0 },
        },
        choice: { enum: [{ code: 1 }, { code: 2 }] },
      },
    };
    const before = JSON.stringify(value);
    const { container } = schema(value);
    const table = screen.getByRole("table", { name: schemaTitle });
    expect(row(table, "tags")).toHaveTextContent("array〈string〉 | null");
    expect(row(table, "tags")).toHaveTextContent(`${field("keywords.minItems")}：0`);
    expect(row(table, "amount")).toHaveTextContent("9007199254740993.000000001");
    for (const details of container.querySelectorAll("details"))
      fireEvent.click(details.querySelector("summary")!);
    expect(container).toHaveTextContent("tag description");
    expect(container).toHaveTextContent("minLength");
    expect(container).toHaveTextContent("oneOf");
    expect(container).toHaveTextContent("x-future");
    expect(container).toHaveTextContent(editor("false"));
    expect(container).toHaveTextContent("code");
    expect(JSON.stringify(value)).toBe(before);
  });

  it("renders composition-only roots as readable branch field tables without a fake root field", () => {
    schema({
      oneOf: [
        {
          type: "object",
          required: ["success"],
          properties: { success: { type: "boolean", const: true } },
        },
        { type: "object", properties: { error: { type: "string" } } },
      ],
    });
    expect(screen.queryByRole("table", { name: schemaTitle })).toBeNull();
    const first = screen.getByRole("table", { name: `oneOf · ${field("branch")} 1` });
    const second = screen.getByRole("table", { name: `oneOf · ${field("branch")} 2` });
    expect(row(first, "success")).toHaveTextContent("true");
    expect(row(second, "error")).toHaveTextContent("string");
    expect(within(first).getAllByRole("columnheader")).toHaveLength(5);
    expect(screen.queryByRole("rowheader", { name: field("root") })).toBeNull();
  });

  it.each([
    [true, "acceptAny"],
    [false, "acceptNone"],
    [{}, "acceptAny"],
  ])(
    "shows boolean or empty schema %j as an explicit rule instead of a fake field table",
    (value, message) => {
      schema(value);
      expect(screen.getByRole("tabpanel", { name: "200" })).toHaveTextContent(
        editor(String(message)),
      );
      expect(screen.queryByRole("table", { name: schemaTitle })).toBeNull();
    },
  );

  it("shows scalar roots and root array types without implying array elements are required", () => {
    const { rerender } = body({ type: "boolean", value: false });
    expect(
      row(screen.getByRole("table", { name: editor("body") }), field("root")),
    ).toHaveTextContent("false");
    rerender(
      <ApiResourceDefinitionTables
        name="response"
        value={{
          statuses: {
            "200": {
              schema: {
                type: "array",
                items: { type: "object", properties: { id: { type: "integer" } } },
              },
            },
          },
        }}
      />,
    );
    expect(screen.getByText("array〈object〉", { exact: true })).toBeVisible();
    const id = row(screen.getByRole("table", { name: schemaTitle }), "[].id");
    expect(within(id).getAllByRole("cell")[1]).toHaveTextContent(editor("false"));
  });

  it("distinguishes literal dotted field names from nested paths and preserves reserved business names", () => {
    schema({
      type: "object",
      properties: {
        "": { type: "string" },
        "a.b": { type: "string" },
        a: { type: "object", properties: { b: { type: "number" } } },
        constructor: { type: "string" },
        type: { type: "boolean" },
      },
    });
    const table = screen.getByRole("table", { name: schemaTitle });
    expect(row(table, '[""]')).toHaveTextContent('""');
    expect(row(table, '["a.b"]')).toHaveTextContent("string");
    expect(row(table, "a.b")).toHaveTextContent("number");
    expect(row(table, "constructor")).toHaveTextContent("string");
    expect(row(table, "type")).toHaveTextContent("boolean");
  });
});
