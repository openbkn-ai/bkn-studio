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
