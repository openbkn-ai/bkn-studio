/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useState } from "react";
vi.mock("@/framework/monaco/MonacoEditor", () => ({
  MonacoEditor: ({ fallback }: { fallback: import("react").ReactNode }) => fallback,
}));

import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EvalCaseArguments } from "./EvalCaseArguments";
vi.mock("./useEvalTranslation", () => ({
  useEvalTranslation: () => ({ t: (key: string) => key.split(".").at(-1) }),
}));
const schema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string", title: "名称", description: "物料名称" },
  },
  additionalProperties: false,
};
function Editor({
  initial = "{}",
  fields = schema,
  systemArguments,
}: {
  initial?: string;
  fields?: Record<string, unknown>;
  systemArguments?: Record<string, unknown>;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <EvalCaseArguments
        value={value}
        schema={fields}
        onChange={setValue}
        systemArguments={systemArguments}
        hiddenFields={Object.keys(systemArguments ?? {})}
      />
      <output data-testid="serialized">{value}</output>
    </>
  );
}
function argumentsJsonInput(): HTMLTextAreaElement {
  const input = screen.getByRole("textbox", { name: "argumentsJson" });
  if (!(input instanceof HTMLTextAreaElement)) throw new Error("Expected a JSON textarea");
  return input;
}
it("preserves large integer identifiers through structured edits", async () => {
  render(<Editor initial='{"id":9007199254740993,"name":"old"}' />);
  expect(screen.getByRole("spinbutton", { name: "id" })).toHaveValue("9007199254740993");
  fireEvent.change(screen.getByRole("textbox", { name: "name" }), { target: { value: "new" } });
  expect(screen.getByTestId("serialized")).toHaveTextContent(
    '{"id":9007199254740993,"name":"new"}',
  );
  expect(screen.queryByText("物料名称")).toBeNull();
  fireEvent.mouseEnter(screen.getByRole("button", { name: "名称 ?" }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("物料名称");
});
it("removes a cleared optional number instead of storing null or an empty string", () => {
  render(<Editor initial='{"id":1}' />);
  fireEvent.change(screen.getByRole("spinbutton", { name: "id" }), { target: { value: "" } });
  expect(screen.getByTestId("serialized")).toHaveTextContent("{}");
});
it.each(['{"extra":1}', '{"id":', "[]", "null"])(
  "keeps unrepresentable input editable as JSON (%s)",
  (initial) => {
    render(<Editor initial={initial} />);
    expect(screen.getByRole("textbox", { name: "argumentsJson" })).toHaveValue(initial);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  },
);
it("switches editors without discarding values", () => {
  render(<Editor initial='{"id":0,"name":""}' />);
  fireEvent.click(screen.getByRole("button", { name: "advancedJson" }));
  fireEvent.change(screen.getByRole("textbox", { name: "argumentsJson" }), {
    target: { value: '{"id":2,"name":"text"}' },
  });
  fireEvent.click(screen.getByRole("button", { name: "structuredInput" }));
  expect(screen.getByRole("textbox", { name: "name" })).toHaveValue("text");
  expect(screen.getByRole("spinbutton", { name: "id" })).toHaveValue("2");
});
it("does not invent a form for nested schemas", () => {
  render(<Editor fields={{ type: "object", properties: { nested: { type: "object" } } }} />);
  expect(screen.getByRole("textbox", { name: "argumentsJson" })).toBeVisible();
});
it("shows a no-arguments hint for an empty schema", () => {
  render(<Editor fields={{ type: "object", properties: {}, additionalProperties: false }} />);
  expect(screen.getByText("noArguments")).toBeVisible();
});

it("preserves incomplete nested JSON during edits and allows correction without throwing", () => {
  render(
    <Editor
      fields={{
        type: "object",
        properties: { body: { type: "object", properties: { count: { type: "integer" } } } },
      }}
    />,
  );
  fireEvent.click(screen.getAllByRole("button", { name: "advancedJson" })[1]);
  fireEvent.change(screen.getByRole("textbox", { name: "argumentsJson" }), {
    target: { value: "{" },
  });
  expect(screen.getByTestId("serialized")).toHaveTextContent('"body":{');
  fireEvent.change(screen.getByRole("textbox", { name: "argumentsJson" }), {
    target: { value: '{"body":{"count":2}}' },
  });
  expect(screen.getByRole("spinbutton", { name: "count" })).toHaveValue("2");
});

it("keeps explicit nested null visible rather than replacing it with an empty object", () => {
  render(
    <Editor
      initial='{"body":null}'
      fields={{ type: "object", properties: { body: { type: "object", properties: {} } } }}
    />,
  );
  expect(screen.getByRole("textbox", { name: "argumentsJson" })).toHaveValue("null");
  expect(screen.getByTestId("serialized")).toHaveTextContent('"body":null');
});

it("restores system-owned parameters when advanced JSON is cleared", () => {
  render(
    <Editor
      initial='{"kn_id":"kn","id":1}'
      fields={{
        type: "object",
        properties: { kn_id: { type: "string" }, id: { type: "integer" } },
        required: ["kn_id"],
      }}
      systemArguments={{ kn_id: "kn" }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "advancedJson" }));
  fireEvent.change(screen.getByRole("textbox", { name: "argumentsJson" }), {
    target: { value: "{}" },
  });
  expect(screen.getByTestId("serialized")).toHaveTextContent('{"kn_id":"kn"}');
});

it("clears an optional parameter without erasing other arguments or conflating an empty string", () => {
  render(<Editor initial='{"name":"","id":0}' />);
  expect(screen.getByTestId("serialized")).toHaveTextContent('"name":""');
  fireEvent.click(screen.getByRole("button", { name: "removeArgument name" }));
  expect(screen.getByTestId("serialized")).toHaveTextContent('{"id":0}');
});
it("removes an optional query group after it was configured", () => {
  render(
    <Editor
      initial='{"query":{"language":"zh-CN"}}'
      fields={{
        type: "object",
        properties: { query: { type: "object", properties: { language: { type: "string" } } } },
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "removeArgument query" }));
  expect(screen.getByTestId("serialized")).toHaveTextContent("{}");
});
it("shows declared numeric bounds and hides clear for required fields", async () => {
  render(
    <Editor
      initial='{"count":2}'
      fields={{
        type: "object",
        required: ["count"],
        properties: { count: { type: "number", minimum: 1, maximum: 50 } },
      }}
    />,
  );
  expect(screen.queryByText(/minimum: 1/)).toBeNull();
  fireEvent.focus(screen.getByRole("button", { name: "count ?" }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("minimum: 1 · maximum: 50");
  expect(screen.queryByRole("button", { name: "removeArgument count" })).toBeNull();
});

it("shows contract-based field guidance without pre-filling source examples or defaults", async () => {
  render(
    <Editor
      fields={{
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "integer",
            title: "订单编号",
            description: "请输入已知订单的编号",
            default: 9,
            examples: [8],
          },
        },
      }}
    />,
  );
  expect(screen.getByText(/订单编号/)).toBeVisible();
  expect(screen.queryByText("请输入已知订单的编号")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "订单编号 ?" }));
  const help = await screen.findByRole("tooltip");
  expect(help).toHaveTextContent("请输入已知订单的编号");
  expect(help).toHaveTextContent("id · integer · parameterRequired");
  expect(screen.getByRole("spinbutton", { name: "id" })).toHaveAttribute(
    "placeholder",
    "argumentInteger",
  );
  expect(screen.getByTestId("serialized")).toHaveTextContent("{}");
});

it("edits object-array rows without rounding precise identifiers or changing sibling values", () => {
  render(
    <Editor
      initial='{"items":[{"id":9007199254740993,"name":"old"}],"flag":false}'
      fields={{
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "integer" }, name: { type: "string" } },
            },
          },
          flag: { type: "boolean" },
        },
      }}
    />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "name" }), { target: { value: "new" } });
  expect(screen.getByTestId("serialized")).toHaveTextContent(
    '{"items":[{"id":9007199254740993,"name":"new"}],"flag":false}',
  );
  fireEvent.click(screen.getByRole("button", { name: "addArrayItem" }));
  expect(screen.getByTestId("serialized")).toHaveTextContent('"name":"new"},{}]');
  fireEvent.click(screen.getAllByRole("button", { name: "removeArrayItem" })[1]);
  expect(screen.getByTestId("serialized")).toHaveTextContent(
    '{"items":[{"id":9007199254740993,"name":"new"}],"flag":false}',
  );
});

it("keeps exact decimals, zero, false and null across array editor switches", () => {
  const initial = '{"values":[0,0.1234567890123456789,null],"flag":false}';
  render(
    <Editor
      initial={initial}
      fields={{
        type: "object",
        properties: {
          values: { type: "array", items: { type: "number" } },
          flag: { type: "boolean" },
        },
      }}
    />,
  );
  expect(screen.getByRole("spinbutton", { name: "values[0]" })).toHaveValue("0");
  expect(screen.getByRole("spinbutton", { name: "values[1]" })).toHaveValue(
    "0.1234567890123456789",
  );
  expect(screen.getByRole("textbox", { name: "values[2]" })).toHaveValue("null");
  fireEvent.click(screen.getAllByRole("button", { name: "advancedJson" })[1]);
  expect(screen.getByRole("textbox", { name: "values" })).toHaveValue(
    "[0,0.1234567890123456789,null]",
  );
  fireEvent.click(screen.getByRole("button", { name: "structuredInput" }));
  expect(screen.getByTestId("serialized")).toHaveTextContent(initial);
});

it("keeps unsupported array contracts editable without inventing rows or filling source defaults", () => {
  render(
    <Editor
      initial='{"items":[{"x":false}]}'
      fields={{
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { oneOf: [{ type: "string" }, { type: "object" }] },
            default: ["example"],
          },
        },
      }}
    />,
  );
  expect(screen.getByRole("textbox", { name: "items" })).toHaveValue('[{"x":false}]');
  expect(screen.queryByRole("button", { name: "addArrayItem" })).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "items" }), { target: { value: "[" } });
  expect(screen.getByRole("textbox", { name: "argumentsJson" })).toHaveValue('{"items":[}');
});

it("keeps large arrays editable without mounting hundreds of row controls or truncating data", () => {
  const values = Array.from({ length: 100 }, (_, i) => i);
  render(
    <Editor
      initial={JSON.stringify({ items: values })}
      fields={{
        type: "object",
        properties: {
          items: { type: "array", items: { type: "integer" } },
        },
      }}
    />,
  );
  expect(screen.getByRole("textbox", { name: "items" })).toHaveValue(JSON.stringify(values));
  expect(screen.queryByRole("spinbutton")).toBeNull();
  expect(screen.getByTestId("serialized")).toHaveTextContent(JSON.stringify({ items: values }));
});

it("quotes string-array values and keeps sibling strings when editing a row", () => {
  render(
    <Editor
      initial='{"items":["A","B"]}'
      fields={{
        type: "object",
        properties: {
          items: { type: "array", items: { type: "string" } },
        },
      }}
    />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "items[0]" }), {
    target: { value: 'new "value"' },
  });
  expect(screen.getByTestId("serialized").textContent).toBe(
    JSON.stringify({ items: ['new "value"', "B"] }),
  );
  expect(screen.getByRole("textbox", { name: "items[1]" })).toHaveValue("B");
});

it("shows a type-mismatched string as a JSON string without coercing it into a boolean", () => {
  render(
    <Editor
      initial='{"flag":"false"}'
      fields={{ type: "object", properties: { flag: { type: "boolean" } } }}
    />,
  );
  expect(screen.getByRole("textbox", { name: "flag" })).toHaveValue('"false"');
  expect(screen.getByTestId("serialized")).toHaveTextContent('{"flag":"false"}');
});

it("outlines required function parameters in JSON without submitting placeholders or source defaults", () => {
  render(
    <Editor
      fields={{
        type: "object",
        properties: {
          actual_date: {
            type: "string",
            format: "date",
            default: "2026-01-01",
            examples: ["2026-02-01"],
          },
          count: { type: "integer" },
          flag: { type: "boolean" },
          optional: { type: "string" },
        },
        required: ["actual_date", "count", "flag"],
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "advancedJson" }));
  expect(JSON.parse(argumentsJsonInput().value)).toEqual({
    actual_date: null,
    count: null,
    flag: null,
  });
  expect(screen.queryByText("argumentTemplateHelp")).toBeNull();
  expect(screen.getByRole("button", { name: "argumentsJson ?" })).toBeInTheDocument();
  expect(screen.getByTestId("serialized")).toHaveTextContent("{}");
  fireEvent.click(screen.getByRole("button", { name: "structuredInput" }));
  expect(screen.getByRole("textbox", { name: "actual_date" })).toHaveValue("");
  expect(screen.getByRole("spinbutton", { name: "count" })).toHaveValue("");
  expect(screen.getByTestId("serialized")).toHaveTextContent("{}");
});

it("fills only missing required keys and preserves precise numbers, false, zero and explicit null", () => {
  const initial = '{"id":9007199254740993,"count":0,"flag":false,"label":"","nullable":null}';
  render(
    <Editor
      initial={initial}
      fields={{
        type: "object",
        properties: {
          id: { type: "integer" },
          count: { type: "integer" },
          flag: { type: "boolean" },
          label: { type: "string" },
          nullable: { type: "string" },
          actual_date: { type: "string" },
        },
        required: ["id", "actual_date", "nullable"],
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "advancedJson" }));
  const json = argumentsJsonInput();
  expect(json.value).toContain("9007199254740993");
  expect(json.value).toContain('"actual_date": null');
  expect(json.value).toContain('"flag": false');
  expect(json.value).toContain('"count": 0');
  expect(json.value).toContain('"label": ""');
  expect(screen.getByTestId("serialized")).toHaveTextContent(initial);
  fireEvent.change(json, {
    target: { value: '{"id":9007199254740993,"actual_date":"2026-11-13","flag":false}' },
  });
  expect(screen.getByTestId("serialized")).toHaveTextContent('"actual_date":"2026-11-13"');
  expect(screen.queryByText("argumentTemplateHelp")).toBeNull();
  fireEvent.change(json, { target: { value: "{}" } });
  expect(json).toHaveValue("{}");
});

it("outlines nested required keys without creating optional groups or array rows", () => {
  render(
    <Editor
      fields={{
        type: "object",
        properties: {
          body: {
            type: "object",
            properties: { id: { type: "integer" }, optional: { type: "string" } },
            required: ["id"],
          },
          optional: {
            type: "object",
            properties: { nested: { type: "string" } },
            required: ["nested"],
          },
          items: { type: "array", items: { type: "string" } },
        },
        required: ["body", "items"],
      }}
    />,
  );
  fireEvent.click(screen.getAllByRole("button", { name: "advancedJson" })[0]);
  expect(JSON.parse(argumentsJsonInput().value)).toEqual({ body: { id: null }, items: null });
  expect(screen.getByTestId("serialized")).toHaveTextContent("{}");
});

it("keeps system arguments fixed and excludes them from the user template", () => {
  render(
    <Editor
      fields={{
        type: "object",
        properties: { kn_id: { type: "string" }, actual_date: { type: "string" } },
        required: ["kn_id", "actual_date"],
      }}
      systemArguments={{ kn_id: "kn-current" }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "advancedJson" }));
  const json = argumentsJsonInput();
  expect(json).toHaveValue('{\n  "actual_date": null\n}');
  fireEvent.change(json, { target: { value: '{"actual_date":"2026-11-13"}' } });
  expect(screen.getByTestId("serialized")).toHaveTextContent(
    '{"actual_date":"2026-11-13","kn_id":"kn-current"}',
  );
});

it("updates the JSON outline when a different parameter contract arrives without erasing input", () => {
  const onChange = vi.fn();
  const view = render(
    <EvalCaseArguments
      value="{}"
      onChange={onChange}
      schema={{
        type: "object",
        properties: { actual_date: { type: "string" } },
        required: ["actual_date"],
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "advancedJson" }));
  expect(screen.getByRole("textbox", { name: "argumentsJson" })).toHaveValue(
    '{\n  "actual_date": null\n}',
  );
  view.rerender(
    <EvalCaseArguments
      value="{}"
      onChange={onChange}
      schema={{
        type: "object",
        properties: { order_id: { type: "integer" } },
        required: ["order_id"],
      }}
    />,
  );
  expect(screen.getByRole("textbox", { name: "argumentsJson" })).toHaveValue(
    '{\n  "order_id": null\n}',
  );
  expect(onChange).not.toHaveBeenCalled();
});

it("does not choose an ambiguous schema branch or overwrite invalid JSON", () => {
  const view = render(
    <EvalCaseArguments
      value="{}"
      schema={{
        type: "object",
        oneOf: [
          { properties: { a: { type: "string" } }, required: ["a"] },
          { properties: { b: { type: "string" } }, required: ["b"] },
        ],
      }}
    />,
  );
  expect(screen.getByRole("textbox", { name: "argumentsJson" })).toHaveValue("{}");
  view.rerender(
    <EvalCaseArguments
      value={'{"actual_date":'}
      schema={{
        type: "object",
        properties: { actual_date: { type: "string" } },
        required: ["actual_date"],
      }}
    />,
  );
  expect(screen.getByRole("textbox", { name: "argumentsJson" })).toHaveValue('{"actual_date":');
});
