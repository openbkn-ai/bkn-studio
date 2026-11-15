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

import { ConfigProvider } from "antd";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { augmentCaseOutputSchema } from "./case-form-model";
import { EvalCaseCriteria } from "./EvalCaseCriteria";
import type { CaseCriterion } from "./case-form-model";
vi.mock("./useEvalTranslation", () => ({
  useEvalTranslation: () => ({ t: (key: string) => key.split(".").at(-1) }),
}));
const predicates = [
  "equals",
  "exists",
  "observation_only",
  "contains",
  "regex",
  "numeric_range",
  "approx",
  "json_schema",
];
const criterion: CaseCriterion = {
  id: "one",
  type: "equals",
  path: "$",
  value: "",
  valueType: "string",
};
function Editor({
  initial = [criterion],
  schema,
}: {
  initial?: CaseCriterion[];
  schema?: Record<string, unknown>;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <EvalCaseCriteria value={value} onChange={setValue} predicates={predicates} schema={schema} />
      <output data-testid="criteria">{JSON.stringify(value)}</output>
    </>
  );
}
function choose(name: string, text: string) {
  fireEvent.mouseDown(screen.getByLabelText(name, { selector: '[role="combobox"]' }));
  fireEvent.click(screen.getByText(text, { selector: ".ant-select-item-option-content" }));
}
it("infers a numeric expectation from the selected output schema and clears obsolete values", () => {
  render(
    <Editor
      initial={[{ ...criterion, value: "previous", valueProvided: true }]}
      schema={{ type: "object", properties: { count: { type: "integer" } } }}
    />,
  );
  choose("resultField 1", "count");
  const current = (
    JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[]
  )[0];
  expect(current).toMatchObject({
    path: "$.count",
    type: "equals",
    valueType: "number",
    value: "",
    valueProvided: false,
  });
});
it("does not offer string predicates for a numeric result", async () => {
  render(
    <ConfigProvider virtual={false} theme={{ token: { motion: false } }}>
      <Editor
        initial={[{ ...criterion, path: "$.count", valueType: "number" }]}
        schema={{ properties: { count: { type: "integer" } } }}
      />
    </ConfigProvider>,
  );
  const predicate = screen.getByLabelText("predicate 1", { selector: '[role="combobox"]' });
  fireEvent.mouseDown(predicate);
  await waitFor(() => expect(predicate).toHaveAttribute("aria-expanded", "true"));
  expect(
    screen.queryByText("contains", { selector: ".ant-select-item-option-content" }),
  ).not.toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByText("numeric_range", { selector: ".ant-select-item-option-content" }),
    ).toBeVisible(),
  );
});
it("keeps cleared text editable until an empty expectation is explicitly selected", () => {
  render(<Editor initial={[{ ...criterion, value: "text" }]} />);
  fireEvent.change(screen.getByRole("textbox", { name: "expectedValue 1" }), {
    target: { value: "" },
  });
  expect(
    (JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[])[0],
  ).toMatchObject({
    value: "",
    valueProvided: false,
  });
  expect(screen.getByRole("textbox", { name: "expectedValue 1" })).toBeEnabled();
  expect(screen.getByRole("checkbox", { name: "emptyText" })).not.toBeChecked();
});
it("keeps a schema assertion on the whole document and disables path editing", () => {
  render(<Editor initial={[{ ...criterion, path: "$.nested", value: "old" }]} />);
  choose("predicate 1", "json_schema");
  expect(
    (JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[])[0],
  ).toMatchObject({
    path: "$",
    type: "json_schema",
    valueType: "json",
    value: "",
  });
  expect(screen.getByRole("combobox", { name: "resultField 1" })).toBeDisabled();
});
it("preserves precise range bounds when toggling inclusivity", () => {
  render(
    <Editor
      initial={[
        {
          ...criterion,
          type: "numeric_range",
          valueType: "json",
          value: '{"min":9007199254740993,"max":9007199254740995}',
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "include_min" }));
  const current = (
    JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[]
  )[0];
  expect(current.value).toBe('{"min":9007199254740993,"max":9007199254740995,"include_min":false}');
});
it("keeps the only criterion from being removed", () => {
  render(<Editor />);
  expect(screen.getByLabelText("removeCriterion 1", { selector: "button" })).toBeDisabled();
});
it("disables adding a criterion at the twenty-criterion limit", () => {
  render(
    <ConfigProvider virtual={false} theme={{ token: { motion: false } }}>
      <Editor
        initial={Array.from({ length: 20 }, (_, i) => ({
          ...criterion,
          id: String(i),
          type: "exists",
        }))}
      />
    </ConfigProvider>,
  );
  expect(screen.getAllByLabelText(/^removeCriterion /, { selector: "button" })).toHaveLength(20);
  expect(
    screen.getByText("addCriterion", { selector: "button > span" }).closest("button"),
  ).toBeDisabled();
}, 15_000);

it("offers business fields inside the resource wrapper while preserving their actual output paths", () => {
  render(
    <Editor
      schema={{
        type: "object",
        properties: { result: { type: "object", properties: { profit: { type: "number" } } } },
      }}
    />,
  );
  choose("resultField 1", "profit");
  const current = (
    JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[]
  )[0];
  expect(current.path).toBe("$.result.profit");
  expect(current.valueType).toBe("number");
});

it("uses a numeric control for correct values and preserves zero and large integers", () => {
  render(<Editor schema={{ type: "integer" }} />);
  const input = screen.getByRole("spinbutton", { name: "expectedValue 1" });
  fireEvent.change(input, { target: { value: "0" } });
  expect(
    (JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[])[0],
  ).toMatchObject({
    value: "0",
    valueProvided: true,
    valueType: "number",
  });
  fireEvent.change(input, { target: { value: "9007199254740993" } });
  expect(
    (JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[])[0].value,
  ).toBe("9007199254740993");
});
it("uses a boolean choice without treating false as an absent answer", () => {
  render(<Editor schema={{ type: "boolean" }} />);
  choose("expectedValue 1", "noValue");
  expect(
    (JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[])[0],
  ).toMatchObject({
    value: "false",
    valueType: "boolean",
    valueProvided: true,
  });
});
it("keeps the numeric type when switching back from a range to exact equality", () => {
  render(
    <Editor
      initial={[{ ...criterion, type: "numeric_range", valueType: "json", value: '{"min":1}' }]}
      schema={{ type: "number" }}
    />,
  );
  choose("predicate 1", "equals");
  expect(screen.getByRole("spinbutton", { name: "expectedValue 1" })).toBeVisible();
  expect(
    (JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[])[0],
  ).toMatchObject({
    value: "",
    valueType: "number",
    valueProvided: false,
  });
});
it("lets users explicitly choose an empty correct text without inventing a default", () => {
  render(<Editor />);
  expect(
    (JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[])[0]
      .valueProvided,
  ).not.toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "emptyText" }));
  expect(
    (JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[])[0],
  ).toMatchObject({
    value: "",
    valueProvided: true,
  });
});

it("lets a business user choose the first metric result value as a numeric field", () => {
  render(
    <Editor
      schema={augmentCaseOutputSchema(undefined, { result: { entries: [{ value: 12 }] } })}
    />,
  );
  choose("resultField 1", "entries · 第1项 · value");
  expect(
    (JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[])[0],
  ).toMatchObject({
    path: "$.result.entries[0].value",
    valueType: "number",
    value: "",
    valueProvided: false,
  });
});

it("keeps a saved metric field readable when the source has no output schema", () => {
  render(
    <Editor
      initial={[
        {
          ...criterion,
          path: "$.result.entries[0].value",
          value: "12",
          valueType: "number",
          valueProvided: true,
        },
      ]}
    />,
  );
  expect(screen.getByRole("combobox", { name: "resultField 1" })).toBeInTheDocument();
  expect(screen.getByText("entries · 第1项 · value")).toBeInTheDocument();
  expect(screen.getByRole("spinbutton", { name: "expectedValue 1" })).toHaveValue("12");
});

it("allows choosing a numeric expectation when the source has not declared the field type", () => {
  render(<Editor initial={[{ ...criterion, path: "$.result.id" }]} />);
  choose("valueType 1", "number");
  fireEvent.change(screen.getByRole("spinbutton", { name: "expectedValue 1" }), {
    target: { value: "1" },
  });
  const current = (
    JSON.parse(screen.getByTestId("criteria").textContent ?? "") as CaseCriterion[]
  )[0];
  expect(current).toMatchObject({ path: "$.result.id", valueType: "number", value: "1" });
});

it("makes an explicitly empty text expectation exclusive with entering text", () => {
  render(<Editor initial={[{ ...criterion, value: "completed", valueProvided: true }]} />);
  const input = screen.getByRole("textbox", { name: "expectedValue 1" });
  const empty = screen.getByRole("checkbox", { name: "emptyText" });
  fireEvent.click(empty);
  expect(empty).toBeChecked();
  expect(input).toHaveValue("");
  expect(input).toBeDisabled();
  expect(
    (JSON.parse(screen.getByTestId("criteria").textContent ?? "") as unknown[])[0],
  ).toMatchObject({
    value: "",
    valueProvided: true,
  });
  fireEvent.click(empty);
  expect(input).toBeEnabled();
  expect(empty).not.toBeChecked();
  expect(
    (JSON.parse(screen.getByTestId("criteria").textContent ?? "") as unknown[])[0],
  ).toMatchObject({
    value: "",
    valueProvided: false,
  });
  fireEvent.change(input, { target: { value: "new text" } });
  expect(input).toHaveValue("new text");
  expect(empty).not.toBeChecked();
});

it("restores a saved empty-text expectation with its input disabled", () => {
  render(<Editor initial={[{ ...criterion, value: "", valueProvided: true }]} />);
  expect(screen.getByRole("checkbox", { name: "emptyText" })).toBeChecked();
  expect(screen.getByRole("textbox", { name: "expectedValue 1" })).toBeDisabled();
});

it("applies empty-text mode to its own criterion only and resets it when switching types", () => {
  render(
    <Editor
      initial={[
        { ...criterion, id: "one" },
        { ...criterion, id: "two", value: "other", valueProvided: true },
      ]}
    />,
  );
  fireEvent.click(screen.getAllByRole("checkbox", { name: "emptyText" })[0]);
  expect(screen.getByRole("textbox", { name: "expectedValue 1" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "expectedValue 2" })).toBeEnabled();
  expect(screen.getByRole("textbox", { name: "expectedValue 2" })).toHaveValue("other");
  choose("valueType 1", "number");
  expect(screen.getByRole("spinbutton", { name: "expectedValue 1" })).toBeEnabled();
  expect(
    (JSON.parse(screen.getByTestId("criteria").textContent ?? "") as unknown[])[0],
  ).toMatchObject({
    valueType: "number",
    value: "",
    valueProvided: false,
  });
});

it("retains the parent form's disabled state when empty-text mode is off", () => {
  render(
    <ConfigProvider componentDisabled>
      <Editor initial={[{ ...criterion, value: "text", valueProvided: true }]} />
    </ConfigProvider>,
  );
  expect(screen.getByRole("textbox", { name: "expectedValue 1" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "emptyText" })).toBeDisabled();
});

it.each([
  ["equals", "equals"],
  ["exists", "existsHint"],
  ["observation_only", "observeHint"],
])("shows %s guidance on demand beside the predicate label", async (type, description) => {
  render(<Editor initial={[{ ...criterion, type }]} />);
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.mouseEnter(screen.getByRole("button", { name: "predicate 1 ?" }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent(description);
});

it("keeps type guidance behind a keyboard-accessible question mark", async () => {
  render(<Editor />);
  expect(screen.queryByText("unknownTypeHelp")).toBeNull();
  const help = screen.getByRole("button", { name: "valueType 1 ?" });
  fireEvent.focus(help);
  expect(await screen.findByRole("tooltip")).toHaveTextContent("unknownTypeHelp");
});
