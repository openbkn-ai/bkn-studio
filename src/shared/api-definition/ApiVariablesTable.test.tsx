/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";
import { ApiVariablesTable } from "./ApiVariablesTable";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));
const key = (name: string) => `dataConnect.apiEditor.variablesTable.${name}`;
const type = (name: string) => `dataConnect.apiEditor.types.${name}`;
const row = (name: string) => screen.getByRole("rowheader", { name }).closest("tr")!;
function show(variables: Record<string, unknown>) {
  return render(<ApiVariablesTable variables={variables} title="Variables" />);
}

describe("shared API variable details", () => {
  it("keeps four columns and distinguishes scalar literals, exact numbers, strings, null, empties, and absent values", () => {
    const number = parsePrecisionPreservingJSON("9007199254740993.000000001");
    const variables = {
      exact: { value: number },
      text: { value: "9007199254740993.000000001" },
      disabled: { value: false },
      zero: { value: 0 },
      empty: { value: "" },
      nil: { value: null },
      missing: { sensitive: false },
      raw: "legacy value",
    };
    show(variables);
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(
      ["name", "type", "sensitive", "value"].map(key),
    );
    expect(
      within(row("exact"))
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([type("number"), "dataConnect.apiEditor.false", "9007199254740993.000000001"]);
    expect(within(row("text")).getAllByRole("cell")[0]).toHaveTextContent(type("string"));
    expect(within(row("disabled")).getAllByRole("cell")[2]).toHaveTextContent(/^false$/);
    expect(within(row("zero")).getAllByRole("cell")[2]).toHaveTextContent(/^0$/);
    expect(row("empty")).toHaveTextContent(key("emptyString"));
    expect(within(row("nil")).getAllByRole("cell")[2]).toHaveTextContent(/^null$/);
    expect(within(row("missing")).getAllByRole("cell")[0]).toHaveTextContent("—");
    expect(row("missing")).toHaveTextContent(key("unset"));
    expect(row("raw")).toHaveTextContent("legacy value");
    expect(variables.exact.value).toBe(number);
  });

  it("summarizes structures and expands them below the main row as three-column literal trees", () => {
    const variables = {
      mixed: {
        value: [
          0,
          false,
          { type: "string", value: "literal payload", sensitive: true, nested: [null] },
        ],
      },
      context: { value: { channel: "studio", flags: { audit: true } } },
    };
    const before = JSON.stringify(variables);
    const { container } = show(variables);
    expect(row("mixed")).toHaveTextContent(`${key("elements")}:3`);
    expect(row("context")).toHaveTextContent(`${key("properties")}:2`);
    expect(container).not.toHaveTextContent("literal payload");
    const expand = within(row("mixed")).getByRole("button");
    expect(expand).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "true");
    const table = screen.getByRole("table", { name: `mixed · ${key("value")}` });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["field", "type", "fieldValue"].map(key));
    expect(row("mixed[0]")).toHaveTextContent("0");
    expect(row("mixed[1]")).toHaveTextContent("false");
    expect(row("mixed[2].type")).toHaveTextContent("string");
    expect(row("mixed[2].value")).toHaveTextContent("literal payload");
    expect(row("mixed[2].sensitive")).toHaveTextContent("true");
    expect(row("mixed[2].nested[0]")).toHaveTextContent("null");
    fireEvent.click(within(row("context")).getByRole("button"));
    expect(row("context.flags.audit")).toHaveTextContent("true");
    fireEvent.click(within(table).getByRole("button", { name: "mixed[2]" }));
    expect(screen.queryByRole("rowheader", { name: "mixed[2].value" })).toBeNull();
    expect(row("context.flags.audit")).toBeVisible();
    fireEvent.click(expand);
    expect(screen.queryByRole("table", { name: `mixed · ${key("value")}` })).toBeNull();
    expect(JSON.stringify(variables)).toBe(before);
    expect(container.querySelector("pre")).toBeNull();
  });

  it("never inserts protected strings, structures, or metadata in the DOM and removes an already expanded value when protected", () => {
    const { container, rerender } = show({
      password: { value: "private string", sensitive: true },
      object: {
        value: { password: "nested private string" },
        sensitive: true,
        note: "private metadata",
      },
      array: { value: ["private array string"], sensitive: true },
      stored: { sensitive: true },
      public: { value: "ordinary", sensitive: "true" },
    });
    expect(screen.getAllByLabelText(key("protected"))).toHaveLength(4);
    for (const name of ["password", "object", "array", "stored"])
      expect(within(row(name)).queryByRole("button")).toBeNull();
    expect(container.querySelector("details")).toBeNull();
    for (const value of [
      "private string",
      "nested private string",
      "private metadata",
      "private array string",
    ])
      expect(container.innerHTML).not.toContain(value);
    expect(row("public")).toHaveTextContent("ordinary");
    rerender(
      <ApiVariablesTable
        title="Variables"
        variables={{ changing: { value: { text: "previous public string" } } }}
      />,
    );
    fireEvent.click(within(row("changing")).getByRole("button"));
    expect(container).toHaveTextContent("previous public string");
    rerender(
      <ApiVariablesTable
        title="Variables"
        variables={{ changing: { value: { text: "new private string" }, sensitive: true } }}
      />,
    );
    expect(container.innerHTML).not.toContain("previous public string");
    expect(container.innerHTML).not.toContain("new private string");
    expect(screen.queryByRole("rowheader", { name: "changing.text" })).toBeNull();
    expect(within(row("changing")).queryByRole("button")).toBeNull();
  });

  it("treats special and dotted business keys as data and keeps nested paths distinct", () => {
    const value = Object.freeze(
      Object.fromEntries<unknown>([
        ["a.b", "dotted"],
        ["a", Object.freeze({ b: "nested" })],
        ["", "empty key"],
        ["constructor", "ctor"],
        ["__proto__", "proto"],
      ]),
    );
    show({ context: { value } });
    fireEvent.click(within(row("context")).getByRole("button"));
    expect(row('context["a.b"]')).toHaveTextContent("dotted");
    expect(row("context.a.b")).toHaveTextContent("nested");
    expect(row('context[""]')).toHaveTextContent("empty key");
    expect(row("context.constructor")).toHaveTextContent("ctor");
    expect(row("context.__proto__")).toHaveTextContent("proto");
  });

  it("keeps public variable metadata in its own expandable full-width tree", () => {
    show({ tenant: { value: "demo", description: "Future description", default_value: 0 } });
    expect(within(row("tenant")).queryByRole("button")).toBeNull();
    fireEvent.click(screen.getByText(`${key("additional")} · tenant`));
    const metadata = screen.getByRole("table", { name: `tenant · ${key("additional")}` });
    expect(within(metadata).getAllByRole("columnheader")).toHaveLength(3);
    expect(metadata).toHaveTextContent("Future description");
    expect(metadata).toHaveTextContent("0");
    expect(row("tenant")).toHaveTextContent("demo");
  });

  it("makes empty arrays and objects explicit without offering an empty expansion", () => {
    const { rerender } = show({ list: { value: [] }, object: { value: {} } });
    expect(row("list")).toHaveTextContent(key("emptyArray"));
    expect(row("object")).toHaveTextContent(key("emptyObject"));
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<ApiVariablesTable variables={{}} title="Variables" />);
    expect(screen.getByRole("table")).toHaveTextContent(key("emptyObject"));
  });
});
