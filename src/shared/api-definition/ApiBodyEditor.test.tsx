/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";
import { ApiRequestEditor } from "./ApiRequestEditor";
import { objectValue, type DefinitionObject } from "./model";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const title = (key: string) => `dataConnect.apiEditor.${key}`;
const body = title("body");
const fieldValue = (path: string) => `${path} ${title("fieldValue")}`;

function renderBody(properties?: DefinitionObject, disabled = false) {
  const changed = vi.fn<(value: DefinitionObject) => void>();
  const validity = vi.fn();
  function Editor() {
    const [value, setValue] = useState<DefinitionObject>(
      properties ? { body: { type: "object", properties } } : {},
    );
    return (
      <ApiRequestEditor
        value={value}
        onChange={(next) => {
          changed(next);
          setValue(next);
        }}
        onValidityChange={validity}
        variableNames={["credential"]}
        disabled={disabled}
      />
    );
  }
  render(<Editor />);
  return {
    changed,
    validity,
    properties: () => objectValue(objectValue(changed.mock.calls.at(-1)?.[0].body).properties),
  };
}

async function chooseType(path: string, type: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: `${path} ${title("valueType")}` }));
  const options = await screen.findAllByText(title(`types.${type}`), {
    selector: ".ant-select-item-option-content",
  });
  const option = options.find((node) => !node.closest(".ant-select-dropdown-hidden"));
  expect(option).toBeVisible();
  fireEvent.click(option!);
}

describe("request Body field cards", () => {
  it("enables an object Body and adds a string field without Schema controls", () => {
    const editor = renderBody();
    const caption = screen.getByText(body, { exact: true });
    fireEvent.click(caption);
    expect(editor.changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("switch", { name: body }));
    expect(editor.changed).toHaveBeenLastCalledWith({ body: { type: "object", properties: {} } });
    fireEvent.click(screen.getByRole("button", { name: `${body} ${title("addField")}` }));
    expect(editor.properties()).toEqual({ field: { type: "string", value: "" } });
    expect(screen.getByLabelText(fieldValue(`${body}.field`))).toHaveValue("");
    expect(screen.queryByText(title("schemaType"))).toBeNull();
    expect(screen.queryByText(title("addConstraint"))).toBeNull();
    fireEvent.click(caption);
    expect(screen.getByLabelText(fieldValue(`${body}.field`))).toBeVisible();
    fireEvent.click(screen.getByRole("switch", { name: body }));
    expect(editor.changed).toHaveBeenLastCalledWith({});
  });

  it("accepts variable syntax in the string value input", () => {
    const editor = renderBody({ token: { type: "string", value: "" } });
    const input = screen.getByRole("textbox", { name: fieldValue(`${body}.token`) });
    fireEvent.change(input, { target: { value: "{{ credential }}" } });
    expect(editor.properties()).toEqual({ token: { type: "string", value: "{{ credential }}" } });
  });

  it("keeps exact numbers and invalid numeric drafts when the field is renamed", async () => {
    const editor = renderBody({ count: { type: "number", value: 1 } });
    const input = screen.getByLabelText(fieldValue(`${body}.count`));
    fireEvent.change(input, { target: { value: "9007199254740993.123456789" } });
    expect(transformPrecisionSafeJSONRequest(editor.properties())).toContain(
      '"value":9007199254740993.123456789',
    );
    fireEvent.change(input, { target: { value: "-" } });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    const name = screen.getByLabelText(`${body} ${title("fieldName")} count`);
    fireEvent.change(name, { target: { value: "renamed" } });
    fireEvent.blur(name);
    expect(screen.getByLabelText(fieldValue(`${body}.renamed`))).toHaveValue("-");
    expect(editor.validity).toHaveBeenLastCalledWith(false);
  });

  it("uses a template as a numeric source without converting it to a literal string field", async () => {
    const editor = renderBody({ count: { type: "number", value: 0 } });
    fireEvent.change(screen.getByLabelText(fieldValue(`${body}.count`)), {
      target: { value: "{{ credential }}" },
    });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    expect(editor.properties()).toEqual({ count: { type: "number", value: "{{ credential }}" } });
  });

  it("retains boolean and null types and resets a field only when its type is changed", async () => {
    const editor = renderBody({ flag: { type: "string", value: "old" } });
    await chooseType(`${body}.flag`, "boolean");
    expect(editor.properties()).toEqual({ flag: { type: "boolean", value: false } });
    await chooseType(`${body}.flag`, "null");
    expect(editor.properties()).toEqual({ flag: { type: "null", value: null } });
  });

  it("constructs nested objects and ordered array nodes without Schema items as data", async () => {
    const editor = renderBody({ payload: { type: "string", value: "" } });
    await chooseType(`${body}.payload`, "array");
    fireEvent.click(screen.getByRole("button", { name: `${body}.payload ${title("addItem")}` }));
    fireEvent.change(screen.getByLabelText(fieldValue(`${body}.payload[0]`)), {
      target: { value: "first" },
    });
    fireEvent.click(screen.getByRole("button", { name: `${body}.payload ${title("addItem")}` }));
    await chooseType(`${body}.payload[1]`, "object");
    fireEvent.click(
      screen.getByRole("button", { name: `${body}.payload[1] ${title("addField")}` }),
    );
    fireEvent.change(screen.getByLabelText(fieldValue(`${body}.payload[1].field`)), {
      target: { value: "second" },
    });
    expect(editor.properties()).toEqual({
      payload: {
        type: "array",
        value: [
          { type: "string", value: "first" },
          { type: "object", properties: { field: { type: "string", value: "second" } } },
        ],
      },
    });
  });

  it("keeps duplicate name drafts local and never overwrites a sibling", async () => {
    const editor = renderBody({
      first: { type: "string", value: "a" },
      second: { type: "string", value: "b" },
    });
    const input = screen.getByLabelText(`${body} ${title("fieldName")} first`);
    fireEvent.change(input, { target: { value: "second" } });
    fireEvent.blur(input);
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    expect(editor.changed).not.toHaveBeenCalled();
  });

  it("keeps an invalid array element draft when an earlier element is removed", async () => {
    const editor = renderBody({
      payload: {
        type: "array",
        value: [
          { type: "number", value: 1 },
          { type: "number", value: 1 },
        ],
      },
    });
    fireEvent.change(screen.getByLabelText(fieldValue(`${body}.payload[1]`)), {
      target: { value: "-" },
    });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole("button", { name: `${title("remove")} ${body}.payload[0]` }));
    expect(screen.getByLabelText(fieldValue(`${body}.payload[0]`))).toHaveValue("-");
    expect(editor.validity).toHaveBeenLastCalledWith(false);
  });

  it("keeps invalid nested drafts when their object is collapsed", async () => {
    const editor = renderBody({
      nested: { type: "object", properties: { count: { type: "number", value: 1 } } },
    });
    const input = screen.getByLabelText(fieldValue(`${body}.nested.count`));
    fireEvent.change(input, { target: { value: "-" } });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByText(`${title("childFields")} (1)`));
    expect(input).not.toBeVisible();
    expect(input).toHaveValue("-");
    expect(editor.validity).toHaveBeenLastCalledWith(false);
  });

  it("disables the switch, fields, type control and removal together", () => {
    renderBody({ token: { type: "string", value: "fixed" } }, true);
    expect(screen.getByRole("switch", { name: body })).toBeDisabled();
    expect(screen.getByLabelText(`${body} ${title("fieldName")} token`)).toBeDisabled();
    expect(screen.getByLabelText(fieldValue(`${body}.token`))).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: `${body}.token ${title("valueType")}` }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: `${title("remove")} ${body}.token` })).toBeDisabled();
  });
});
