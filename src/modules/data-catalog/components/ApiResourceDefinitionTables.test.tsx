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
const editor = (name: string) => `dataConnect.apiEditor.${name}`;
const table = (name: string) => `dataCatalog.apiResource.table.${name}`;

describe("API resource definition tables", () => {
  it("groups request metadata, displays Authorization, and gives Query four meaningful columns", () => {
    const { container } = render(
      <ApiResourceDefinitionTables
        name="request"
        value={mockApiResourceFixtures[1].api_definition.request}
      />,
    );
    expect(screen.getByRole("row", { name: "method POST" })).toBeVisible();
    expect(screen.getByRole("row", { name: "Authorization Bearer {{ api_key }}" })).toBeVisible();
    const query = screen.getByRole("table", { name: editor("parameters") });
    expect(
      within(query)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["parameterName", "parameterValue", "defaultValue", "required"].map(editor));
    expect(
      within(query).getByRole("row", { name: `tenant {{ tenant }} demo ${editor("true")}` }),
    ).toBeVisible();
    const body = screen.getByRole("table", { name: editor("body") });
    expect(
      within(body).getByRole("rowheader", { name: "context.locale" }).parentElement,
    ).toHaveTextContent("{{ locale }}");
    expect(container.querySelector("pre")).toBeNull();
  });

  it("masks only flagged variable values and preserves public structured values and precision", () => {
    const exact = parsePrecisionPreservingJSON("9007199254740993.000000001");
    const variables = {
      private: { value: { password: "never-render-this" }, sensitive: true },
      redacted: { sensitive: true },
      Authorization: { value: "literal-header-token", sensitive: false },
      public: { value: [false, 0, "", null, exact, { type: "string" }], sensitive: false },
    };
    const { container } = render(
      <ApiResourceDefinitionTables name="variables" value={variables} />,
    );
    const variablesTable = screen.getByRole("table", { name: "dataCatalog.apiResource.variables" });
    expect(
      within(variablesTable)
        .getAllByRole("columnheader")
        .slice(0, 4)
        .map((cell) => cell.textContent),
    ).toEqual(
      ["name", "type", "sensitive", "value"].map((name) => editor(`variablesTable.${name}`)),
    );
    expect(screen.getAllByLabelText(editor("variablesTable.protected"))).toHaveLength(2);
    expect(container.textContent).not.toContain("never-render-this");
    fireEvent.click(
      within(
        within(variablesTable).getByRole("rowheader", { name: "public" }).closest("tr")!,
      ).getByRole("button"),
    );
    for (const text of [
      "literal-header-token",
      "9007199254740993.000000001",
      "false",
      "0",
      editor("variablesTable.emptyString"),
      "null",
      "string",
    ])
      expect(container.textContent).toContain(text);
    expect(variables.private.value.password).toBe("never-render-this");
    expect(variables.public.value[4]).toBe(exact);
  });

  it("keeps zero, false, null, and empty or absent Query values distinct", () => {
    render(
      <ApiResourceDefinitionTables
        name="request"
        value={{
          parameters: [
            { name: "zero", value: 0, default_value: false, required: false },
            { name: "empty", value: "", default_value: null },
            { name: "missing" },
          ],
        }}
      />,
    );
    expect(
      screen.getByRole("row", { name: `zero 0 ${editor("false")} ${editor("false")}` }),
    ).toBeVisible();
    expect(screen.getByRole("row", { name: `empty ${table("emptyString")} null —` })).toBeVisible();
    expect(screen.getByRole("row", { name: "missing — — —" })).toBeVisible();
  });

  it("switches response status tabs while preserving extraction paths and schema tables", () => {
    render(
      <ApiResourceDefinitionTables
        name="response"
        value={mockApiResourceFixtures[0].api_definition.response}
      />,
    );
    const statuses = screen.getByRole("tablist", { name: editor("responseStatus") });
    expect(
      within(statuses)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["200", "401", "default"]);
    expect(within(statuses).getByRole("tab", { name: "200" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("table", { name: `401 ${table("schema")}` })).toBeNull();
    expect(
      screen.getByRole("table", { name: `${editor("responseStatus")} 200` }),
    ).toHaveTextContent("data.items");
    expect(
      screen.getByRole("table", { name: `${editor("responseStatus")} 200` }),
    ).toHaveTextContent("data.total");
    const schema = screen.getByRole("table", { name: `200 ${table("schema")}` });
    expect(
      within(schema).getByRole("rowheader", {
        name: "data.items[].amount",
      }).parentElement,
    ).toHaveTextContent("number");
    fireEvent.click(within(statuses).getByRole("tab", { name: "401" }));
    expect(screen.getByRole("tabpanel", { name: "401" })).toHaveTextContent("凭据无效");
    expect(schema).not.toBeVisible();
    expect(screen.getByRole("tabpanel", { name: "401" })).toHaveTextContent(editor("acceptNone"));
    expect(screen.queryByRole("table", { name: `401 ${table("schema")}` })).toBeNull();
    fireEvent.click(within(statuses).getByRole("tab", { name: "default" }));
    expect(screen.getByRole("tabpanel", { name: "default" })).toHaveTextContent("不接受其他响应");
    expect(screen.getByRole("tabpanel", { name: "default" })).toHaveTextContent(
      editor("acceptNone"),
    );
  });

  it("omits empty object properties and stale items without changing the saved response schema", () => {
    const schema = Object.freeze({
      type: "object",
      properties: Object.freeze({}),
      items: Object.freeze({ type: "object", properties: Object.freeze({}) }),
    });
    const response = {
      statuses: { "200": { schema }, "204": { schema: true } },
    };
    const { rerender } = render(<ApiResourceDefinitionTables name="response" value={response} />);
    const expectObjectSchema = () => {
      const panel = screen.getByRole("tabpanel", { name: "200" });
      const summary = within(panel).getByText(editor("fieldTable.rootType"), { exact: false });
      expect(summary).toHaveTextContent("object");
      expect(
        within(panel).queryByText(editor("fieldTable.configuration"), { exact: false }),
      ).toBeNull();
    };

    expectObjectSchema();
    fireEvent.click(screen.getByRole("tab", { name: "204" }));
    fireEvent.click(screen.getByRole("tab", { name: "200" }));
    rerender(<ApiResourceDefinitionTables name="response" value={structuredClone(response)} />);
    expectObjectSchema();
    expect(schema).toEqual({
      type: "object",
      properties: {},
      items: { type: "object", properties: {} },
    });
  });

  it.each([
    { type: "object", objectFields: true, arrayItems: false },
    { type: "array", objectFields: false, arrayItems: true },
    { type: "string", objectFields: false, arrayItems: false },
    { type: ["object", "null"], objectFields: true, arrayItems: false },
    { type: ["array", "null"], objectFields: false, arrayItems: true },
    { type: ["object", "array"], objectFields: true, arrayItems: true },
    { type: undefined, objectFields: true, arrayItems: true },
  ])(
    "shows applicable fields, items and constraints for type $type",
    ({ type, objectFields, arrayItems }) => {
      const schema = {
        ...(type === undefined ? {} : { type }),
        properties: { name: { type: "string", minLength: 2 } },
        required: ["name", "otherRequiredName"],
        items: {
          type: "object",
          properties: { id: { type: "integer", minimum: 0 } },
          additionalProperties: false,
        },
        "x-note": "preserved extension",
      };
      render(
        <ApiResourceDefinitionTables name="response" value={{ statuses: { "200": { schema } } }} />,
      );
      const panel = within(screen.getByRole("tabpanel", { name: "200" }));
      const field = panel.queryByRole("rowheader", { name: "name" });
      const item = panel.queryByRole("rowheader", { name: "[].id" });
      const configuration = panel.getByText(editor("fieldTable.configuration"), { exact: false });
      fireEvent.click(configuration);
      const details = within(configuration.closest("details")!);
      const required = details.queryByText("otherRequiredName");
      const itemConfiguration = details.queryByText(editor("fieldTable.itemConfiguration"));

      if (objectFields) {
        expect(field?.parentElement).toHaveTextContent(editor("fieldTable.keywords.minLength"));
        expect(required).toBeVisible();
      } else {
        expect(field).toBeNull();
        expect(required).toBeNull();
      }
      if (arrayItems) {
        expect(item?.parentElement).toHaveTextContent(editor("fieldTable.keywords.minimum"));
        expect(itemConfiguration).toBeVisible();
        expect(details.getByText("additionalProperties")).toBeVisible();
      } else {
        expect(item).toBeNull();
        expect(itemConfiguration).toBeNull();
      }
      expect(details.getByText("preserved extension")).toBeVisible();
    },
  );

  it("keeps a typed array item visible without an empty configuration section", () => {
    render(
      <ApiResourceDefinitionTables
        name="response"
        value={{
          statuses: {
            "200": { schema: { type: "array", items: { type: "object", properties: {} } } },
          },
        }}
      />,
    );
    const panel = within(screen.getByRole("tabpanel", { name: "200" }));
    expect(panel.getByText(editor("fieldTable.rootType"), { exact: false })).toHaveTextContent(
      "array〈object〉",
    );
    expect(panel.queryByText(editor("fieldTable.configuration"), { exact: false })).toBeNull();
  });

  const objectWithStaleItems = Object.freeze({
    type: "object",
    properties: Object.freeze({}),
    items: Object.freeze({ type: "string", const: "stale-item-value" }),
    minProperties: 1,
    default: { type: "object", items: "literal-item-value" },
    "x-example": { type: "object", items: "extension-item-value" },
  });

  it.each([
    {
      name: "nested items",
      schema: { type: "array", items: { type: "array", items: objectWithStaleItems } },
    },
    {
      name: "legacy tuple items",
      schema: { type: "array", items: [objectWithStaleItems] },
    },
    {
      name: "nested prefixItems",
      schema: { type: "array", items: { type: "array", prefixItems: [objectWithStaleItems] } },
    },
    {
      name: "nested additionalProperties",
      schema: {
        type: "array",
        items: { type: "object", additionalProperties: objectWithStaleItems },
      },
    },
    {
      name: "nested dependentSchemas",
      schema: {
        type: "array",
        items: { type: "object", dependentSchemas: { id: objectWithStaleItems } },
      },
    },
    {
      name: "root prefixItems",
      schema: { type: "array", prefixItems: [objectWithStaleItems] },
    },
    {
      name: "root additionalProperties",
      schema: { type: "object", additionalProperties: objectWithStaleItems },
    },
    {
      name: "root dependentSchemas",
      schema: { type: "object", dependentSchemas: { id: objectWithStaleItems } },
    },
  ])("filters object structure in $name while keeping constraints and literals", ({ schema }) => {
    render(
      <ApiResourceDefinitionTables name="response" value={{ statuses: { "200": { schema } } }} />,
    );
    const panel = within(screen.getByRole("tabpanel", { name: "200" }));
    const summary = panel.getByText(editor("fieldTable.root"), { selector: "summary code" });
    fireEvent.click(summary);
    const configuration = within(summary.closest("details")!);

    expect(configuration.getByText("minProperties")).toBeVisible();
    expect(configuration.getByText("literal-item-value")).toBeVisible();
    expect(configuration.getByText("extension-item-value")).toBeVisible();
    expect(configuration.queryByText("properties")).toBeNull();
    expect(configuration.queryByText("stale-item-value")).toBeNull();
  });

  it("supports a default-only response and keeps empty statuses explicit without empty tabs", () => {
    const { rerender } = render(
      <ApiResourceDefinitionTables
        name="response"
        value={{
          content_type: "application/json",
          statuses: { default: { description: "fallback", schema: true } },
        }}
      />,
    );
    expect(screen.getByRole("tab", { name: "default" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "default" })).toHaveTextContent(
      editor("acceptAny"),
    );
    rerender(<ApiResourceDefinitionTables name="response" value={{ statuses: {} }} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("table", { name: editor("responseStatus") })).toHaveTextContent(
      table("emptyObject"),
    );
  });

  it("expands condition groups and keeps future literal fields intact", () => {
    const { rerender } = render(
      <ApiResourceDefinitionTables
        name="success_rule"
        value={{
          http_status: [200, 201],
          body_filter_condition: {
            operation: "and",
            sub_conditions: [{ field: "success", operation: "eq", value: false }],
          },
        }}
      />,
    );
    expect(
      screen.getByRole("table", { name: "dataCatalog.apiResource.success" }),
    ).toHaveTextContent("200201");
    const condition = screen.getByRole("table", { name: editor("condition") });
    expect(
      within(condition).getByRole("rowheader", { name: "sub_conditions[0].operation" })
        .parentElement,
    ).toHaveTextContent(editor("operations.eq"));
    expect(
      within(condition).getByRole("rowheader", { name: "sub_conditions[0].value" }).parentElement,
    ).toHaveTextContent(editor("false"));
    rerender(
      <ApiResourceDefinitionTables
        name="future"
        value={{ value: { type: "string", operation: "eq", constructor: "literal" }, unknown: [] }}
      />,
    );
    expect(screen.getByRole("row", { name: "value.type string" })).toBeVisible();
    expect(screen.getByRole("row", { name: "value.operation eq" })).toBeVisible();
    expect(screen.getByRole("row", { name: "value.constructor literal" })).toBeVisible();
    expect(screen.getByRole("row", { name: `unknown ${table("emptyArray")}` })).toBeVisible();
  });
});
