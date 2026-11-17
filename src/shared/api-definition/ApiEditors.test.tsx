/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import {
  ApiLoginEditor,
  ApiRequestEditor,
  ApiSchemaEditor,
  ApiSuccessRuleEditor,
  ApiValueEditor,
  createApiLoginDefinition,
} from "./index";
import { objectValue, type DefinitionObject } from "./model";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const title = (key: string) => `dataConnect.apiEditor.${key}`;

function renderRequestEditor(initial: DefinitionObject, variableNames: string[] = []) {
  const changed = vi.fn<(value: DefinitionObject) => void>();
  const validity = vi.fn<(valid: boolean) => void>();
  function Editor() {
    const [value, setValue] = useState(initial);
    return (
      <ApiRequestEditor
        value={value}
        onChange={(next) => {
          changed(next);
          setValue(next);
        }}
        onValidityChange={validity}
        variableNames={variableNames}
      />
    );
  }
  render(<Editor />);
  return { changed, validity };
}

describe("graphical API definition editors", () => {
  it("labels the condition path and keeps only a type choice for a null comparison", () => {
    const changed = vi.fn();
    render(
      <ApiSuccessRuleEditor
        value={{
          http_status: [200],
          body_filter_condition: { field: "code", operation: "eq", value: null },
        }}
        onChange={changed}
      />,
    );
    const path = screen.getByRole("textbox", {
      name: `${title("condition")} ${title("relativeField")}`,
    });
    expect(document.querySelector(`label[for="${path.id}"]`)).toHaveTextContent(
      title("relativeField"),
    );
    const type = screen.getByRole("combobox", {
      name: `${title("condition")} ${title("comparison")} ${title("valueType")}`,
    });
    expect(document.querySelector(`label[for="${type.id}"]`)).toHaveTextContent(
      title("comparison"),
    );
    expect(
      screen.queryByRole("textbox", { name: `${title("condition")} ${title("comparison")}` }),
    ).toBeNull();
    expect(screen.queryByText("null")).toBeNull();
    expect(changed).not.toHaveBeenCalled();
  });

  it("creates Query parameters with only a name and a directly editable string value", () => {
    const { changed } = renderRequestEditor({});
    fireEvent.click(screen.getByRole("button", { name: title("addParameter") }));
    expect(changed).toHaveBeenLastCalledWith({ parameters: [{ name: "", value: "" }] });
    const card = screen.getByRole("group", { name: `${title("parameters")} 1` });
    expect(card.querySelectorAll("input")).toHaveLength(2);
    expect(card.querySelector("details")).toBeNull();
    expect(card.querySelector('input[type="checkbox"]')).toBeNull();
    expect(screen.queryByText(title("valueType"))).toBeNull();
    const input = screen.getByLabelText(`${title("parameters")} 1 ${title("value")}`);
    fireEvent.change(input, { target: { value: "{{ token }}" } });
    expect(changed).toHaveBeenLastCalledWith({ parameters: [{ name: "", value: "{{ token }}" }] });
  });

  it.each(["", "0", "false", "null"])(
    "keeps Query string %s unchanged when its name is edited",
    (value) => {
      const { changed } = renderRequestEditor({ parameters: [{ name: "flag", value }] });
      expect(changed).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText(`${title("parameters")} 1 ${title("name")}`), {
        target: { value: "renamed" },
      });
      expect(changed).toHaveBeenLastCalledWith({ parameters: [{ name: "renamed", value }] });
    },
  );

  it("offers Catalog variables in the Query value input without an extra configuration step", async () => {
    const { changed } = renderRequestEditor({ parameters: [{ name: "token", value: "" }] }, [
      "credential",
    ]);
    const input = screen.getByLabelText(`${title("parameters")} 1 ${title("value")}`);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "cred" } });
    await screen.findByRole("option", { name: "{{ credential }}" });
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown", keyCode: 40 });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", keyCode: 13 });
    expect(input).toHaveValue("{{ credential }}");
    expect(changed).toHaveBeenLastCalledWith({
      parameters: [{ name: "token", value: "{{ credential }}" }],
    });
    fireEvent.change(input, { target: { value: "" } });
    expect(changed).toHaveBeenLastCalledWith({ parameters: [{ name: "token", value: "" }] });
  });

  it("disables both Query fields and removal together", () => {
    const changed = vi.fn();
    render(
      <ApiRequestEditor
        value={{ parameters: [{ name: "token", value: "fixed" }] }}
        onChange={changed}
        disabled
        variableNames={["credential"]}
      />,
    );
    expect(screen.getByLabelText(`${title("parameters")} 1 ${title("name")}`)).toBeDisabled();
    expect(screen.getByLabelText(`${title("parameters")} 1 ${title("value")}`)).toBeDisabled();
    expect(screen.getByRole("button", { name: title("remove") })).toBeDisabled();
    expect(changed).not.toHaveBeenCalled();
  });

  it("labels Header names and values while preserving values through rename and removal", () => {
    let result: DefinitionObject = {};
    function Editor() {
      const [value, setValue] = useState<DefinitionObject>({
        headers: { Accept: "application/json" },
      });
      return (
        <ApiRequestEditor
          value={value}
          onChange={(next) => {
            result = next;
            setValue(next);
          }}
        />
      );
    }
    render(<Editor />);
    const name = screen.getByRole("textbox", {
      name: `${title("headers")} ${title("headerName")} Accept`,
    });
    const value = screen.getByRole("textbox", { name: `${title("headerValue")} Accept` });
    expect(name.closest("label")).toHaveTextContent(title("headerName"));
    expect(value.closest("label")).toHaveTextContent(title("headerValue"));
    expect(value).toHaveValue("application/json");
    fireEvent.change(name, { target: { value: "X-Accept" } });
    fireEvent.blur(name);
    expect(result.headers).toEqual({ "X-Accept": "application/json" });
    fireEvent.change(screen.getByRole("textbox", { name: `${title("headerValue")} X-Accept` }), {
      target: { value: "text/plain" },
    });
    expect(result.headers).toEqual({ "X-Accept": "text/plain" });
    fireEvent.click(screen.getByRole("button", { name: title("addProperty") }));
    expect(screen.getAllByText(title("headerName"))).toHaveLength(2);
    expect(screen.getAllByText(title("headerValue"))).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: title("remove") })[0]);
    expect(result.headers).toEqual({ field: "" });
  });

  it.each(["request", "response", "success"])(
    "groups the %s login tab contents in its own card",
    (section) => {
      render(<ApiLoginEditor value={createApiLoginDefinition()} onChange={vi.fn()} />);
      fireEvent.click(screen.getByRole("tab", { name: title(section) }));
      expect(screen.getByRole("group", { name: title(section) })).toBeVisible();
    },
  );

  it("allows a separate root type control while retaining nested selectors and numeric draft validation", async () => {
    const validity = vi.fn();
    render(
      <ApiValueEditor
        value={{ nested: 42 }}
        onChange={vi.fn()}
        label="Value"
        showTypeSelector={false}
        onValidityChange={validity}
      />,
    );
    expect(screen.queryByRole("combobox", { name: `Value ${title("valueType")}` })).toBeNull();
    expect(
      screen.getByRole("combobox", { name: `Value.nested ${title("valueType")}` }),
    ).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Value.nested"), { target: { value: "1e" } });
    await waitFor(() => expect(validity).toHaveBeenLastCalledWith(false));
  });

  it("preserves precise numbers and reports invalid numeric drafts without submitting a stale value", async () => {
    const changed = vi.fn<(value: unknown) => void>(),
      validity = vi.fn();
    render(
      <ApiValueEditor
        value={parsePrecisionPreservingJSON("9007199254740993")}
        onChange={changed}
        onValidityChange={validity}
        label="Exact value"
      />,
    );
    const input = screen.getByLabelText("Exact value");
    expect(input).toHaveValue("9007199254740993");
    fireEvent.change(input, { target: { value: "1.234567890123456789" } });
    expect(transformPrecisionSafeJSONRequest({ value: changed.mock.calls.at(-1)?.[0] })).toBe(
      '{"value":1.234567890123456789}',
    );
    changed.mockClear();
    fireEvent.change(input, { target: { value: "-" } });
    await waitFor(() => expect(validity).toHaveBeenLastCalledWith(false));
    expect(changed).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "42" } });
    await waitFor(() => expect(validity).toHaveBeenLastCalledWith(true));
    expect(changed).toHaveBeenLastCalledWith(42);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("keeps Schema metadata and business const members through an unrelated graphical edit", () => {
    const exact = parsePrecisionPreservingJSON("999999999999999999.0000000001");
    let result: unknown;
    const schema = {
      type: "number",
      description: "Old description",
      minimum: exact,
      const: { $ref: "business value", value: null },
      "x-vendor": { precision: 40 },
    };
    render(
      <ApiSchemaEditor
        value={schema}
        label="Schema"
        onChange={(next) => {
          result = next;
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText(`Schema ${title("description")}`), {
      target: { value: "New description" },
    });
    expect(result).toEqual({ ...schema, description: "New description" });
    expect(objectValue(result).minimum).toBe(exact);
    expect(transformPrecisionSafeJSONRequest(result)).toContain("999999999999999999.0000000001");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("does not change a mounted login definition and retains Query strings when renamed", () => {
    const changed = vi.fn<(value: unknown) => void>();
    const value: DefinitionObject = {
      request: {
        method: "POST",
        path: "login",
        parameters: [{ name: "flag", value: "false" }],
      },
      response: {
        content_type: "application/json",
        statuses: { "200": { description: "Login", schema: { type: "object" } } },
      },
      success_rule: { http_status: [200] },
    };
    render(<ApiLoginEditor value={value} onChange={changed} />);
    expect(changed).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(`${title("parameters")} 1 ${title("name")}`), {
      target: { value: "renamed" },
    });
    const next = changed.mock.calls.at(-1)?.[0] as DefinitionObject;
    const parameter = objectValue((objectValue(next.request).parameters as unknown[])[0]);
    expect(parameter).toEqual({ name: "renamed", value: "false" });
  });

  it("renames response status keys graphically and preserves Schema oneOf", () => {
    let result: DefinitionObject = {};
    function Editor() {
      const [value, setValue] = useState<DefinitionObject>({
        request: { method: "POST", path: "login" },
        response: {
          content_type: "application/json",
          statuses: {
            "200": { description: "Login", schema: { oneOf: [{ const: 0 }, { const: false }] } },
          },
        },
        success_rule: { http_status: [200] },
      });
      return (
        <ApiLoginEditor
          value={value}
          onChange={(next) => {
            result = next;
            setValue(next);
          }}
        />
      );
    }
    render(<Editor />);
    fireEvent.click(screen.getByRole("tab", { name: title("response") }));
    const input = screen.getByLabelText(`${title("responseStatus")} ${title("name")} 200`);
    fireEvent.change(input, { target: { value: "2XX" } });
    fireEvent.blur(input);
    expect(Object.hasOwn(objectValue(objectValue(result.response).statuses), "200")).toBe(false);
    const response = objectValue(objectValue(objectValue(result.response).statuses)["2XX"]);
    const schema = objectValue(response.schema);
    expect(schema.oneOf).toEqual([{ const: 0 }, { const: false }]);
  });

  it("reports duplicate property drafts without overwriting either existing member", async () => {
    const onChange = vi.fn(),
      validity = vi.fn();
    render(
      <ApiValueEditor
        value={{ first: 0, second: false }}
        onChange={onChange}
        onValidityChange={validity}
        label="Object"
      />,
    );
    const input = screen.getByLabelText(`Object ${title("name")} first`);
    fireEvent.change(input, { target: { value: "second" } });
    fireEvent.blur(input);
    await waitFor(() => expect(validity).toHaveBeenLastCalledWith(false));
    expect(onChange).not.toHaveBeenCalled();
  });
  it("keeps an invalid surviving array draft when deleting an earlier equal-valued item", async () => {
    const validity = vi.fn();
    function Editor() {
      const [value, setValue] = useState<unknown>([1, 1]);
      return (
        <ApiValueEditor
          value={value}
          onChange={setValue}
          onValidityChange={validity}
          label="Array"
        />
      );
    }
    render(<Editor />);
    fireEvent.change(screen.getByLabelText("Array[1]"), { target: { value: "-" } });
    await waitFor(() => expect(validity).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getAllByRole("button", { name: title("remove") })[0]);
    expect(screen.getByLabelText("Array[0]")).toHaveValue("-");
    expect(validity).toHaveBeenLastCalledWith(false);
  });

  it("moves invalid array drafts together with their items", async () => {
    const validity = vi.fn();
    function Editor() {
      const [value, setValue] = useState<unknown>([1, 1]);
      return (
        <ApiValueEditor
          value={value}
          onChange={setValue}
          onValidityChange={validity}
          label="Array"
        />
      );
    }
    render(<Editor />);
    fireEvent.change(screen.getByLabelText("Array[1]"), { target: { value: "-" } });
    await waitFor(() => expect(validity).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getAllByRole("button", { name: title("moveUp") })[1]);
    expect(screen.getByLabelText("Array[0]")).toHaveValue("-");
    expect(validity).toHaveBeenLastCalledWith(false);
  });

  it("keeps Query values with their parameters when an earlier parameter is removed", () => {
    renderRequestEditor({
      parameters: [
        { name: "first", value: "first" },
        { name: "second", value: "second" },
      ],
    });
    fireEvent.change(screen.getByLabelText(`${title("parameters")} 2 ${title("value")}`), {
      target: { value: "{{ token }}" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: title("remove") })[0]);
    expect(screen.getByLabelText(`${title("parameters")} 1 ${title("name")}`)).toHaveValue(
      "second",
    );
    expect(screen.getByLabelText(`${title("parameters")} 1 ${title("value")}`)).toHaveValue(
      "{{ token }}",
    );
  });

  it("keeps an invalid condition draft when an earlier sibling is deleted", async () => {
    const validity = vi.fn();
    function Editor() {
      const [value, setValue] = useState<DefinitionObject>({
        http_status: [200],
        body_filter_condition: {
          operation: "and",
          sub_conditions: [
            { field: "first", operation: "eq", value: 1 },
            { field: "second", operation: "eq", value: 1 },
          ],
        },
      });
      return <ApiSuccessRuleEditor value={value} onChange={setValue} onValidityChange={validity} />;
    }
    render(<Editor />);
    fireEvent.change(screen.getByLabelText(`${title("condition")}[1] ${title("comparison")}`), {
      target: { value: "-" },
    });
    await waitFor(() => expect(validity).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getAllByRole("button", { name: title("remove") })[0]);
    expect(screen.getByLabelText(`${title("condition")}[0] ${title("comparison")}`)).toHaveValue(
      "-",
    );
    expect(validity).toHaveBeenLastCalledWith(false);
  });

  it("keeps invalid nested values when their parent property is renamed", async () => {
    const validity = vi.fn();
    function Editor() {
      const [value, setValue] = useState<unknown>({ before: 1 });
      return (
        <ApiValueEditor
          value={value}
          onChange={setValue}
          onValidityChange={validity}
          label="Object"
        />
      );
    }
    render(<Editor />);
    fireEvent.change(screen.getByLabelText("Object.before"), { target: { value: "-" } });
    await waitFor(() => expect(validity).toHaveBeenLastCalledWith(false));
    const name = screen.getByLabelText(`Object ${title("name")} before`);
    fireEvent.change(name, { target: { value: "after" } });
    fireEvent.blur(name);
    expect(screen.getByLabelText("Object.after")).toHaveValue("-");
    expect(validity).toHaveBeenLastCalledWith(false);
  });

  it("retains invalid Login drafts across inactive tabs", async () => {
    const validity = vi.fn();
    function Editor() {
      const [value, setValue] = useState<DefinitionObject>({
        request: {
          method: "POST",
          path: "login",
          body: { type: "object", properties: { count: { type: "number", value: 1 } } },
        },
        response: {
          content_type: "application/json",
          statuses: { "200": { description: "Login", schema: { type: "object" } } },
        },
        success_rule: { http_status: [200] },
      });
      return <ApiLoginEditor value={value} onChange={setValue} onValidityChange={validity} />;
    }
    render(<Editor />);
    fireEvent.change(screen.getByLabelText(`${title("body")}.count ${title("fieldValue")}`), {
      target: { value: "-" },
    });
    await waitFor(() => expect(validity).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole("tab", { name: title("response") }));
    expect(screen.getByLabelText(`${title("body")}.count ${title("fieldValue")}`)).toHaveValue("-");
    expect(validity).toHaveBeenLastCalledWith(false);
  });
});
