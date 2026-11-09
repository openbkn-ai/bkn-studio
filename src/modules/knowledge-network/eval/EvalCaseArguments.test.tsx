/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useState } from "react";
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
it("preserves large integer identifiers through structured edits", () => {
  render(<Editor initial='{"id":9007199254740993,"name":"old"}' />);
  expect(screen.getByRole("spinbutton", { name: "id" })).toHaveValue("9007199254740993");
  fireEvent.change(screen.getByRole("textbox", { name: "name" }), { target: { value: "new" } });
  expect(screen.getByTestId("serialized")).toHaveTextContent(
    '{"id":9007199254740993,"name":"new"}',
  );
  expect(screen.getByText("物料名称")).toBeVisible();
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
it("shows declared numeric bounds and hides clear for required fields", () => {
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
  expect(screen.getByText("minimum: 1 · maximum: 50")).toBeVisible();
  expect(screen.queryByRole("button", { name: "removeArgument count" })).toBeNull();
});

it("shows contract-based field guidance without pre-filling source examples or defaults", () => {
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
  expect(screen.getByText("请输入已知订单的编号")).toBeVisible();
  expect(screen.getByText("id · integer · parameterRequired")).toBeVisible();
  expect(screen.getByRole("spinbutton", { name: "id" })).toHaveAttribute(
    "placeholder",
    "argumentInteger",
  );
  expect(screen.getByTestId("serialized")).toHaveTextContent("{}");
});
