/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EvalResourceArguments } from "./EvalResourceArguments";
import { listCaseActionInstances, type CaseTargetSchema } from "./case-form.service";
vi.mock("./case-form.service", () => ({ listCaseActionInstances: vi.fn() }));
vi.mock("./useEvalTranslation", () => ({
  useEvalTranslation: () => ({ t: (key: string) => key.split(".").at(-1) }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listCaseActionInstances).mockResolvedValue({
    rows: [{ name: "订单一", _instance_identity: { id: "one" } }],
    nextCursor: undefined,
  });
});
function Editor({
  kind = "action",
  contract,
  initial = "{}",
}: {
  kind?: string;
  contract: CaseTargetSchema;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <EvalResourceArguments
        networkId="kn"
        kind={kind}
        contract={contract}
        value={value}
        onChange={setValue}
      />
      <output data-testid="args">{value}</output>
    </>
  );
}
it("selects one authorized action instance and creates its identity without exposing an identity JSON field", async () => {
  render(
    <Editor
      contract={{
        available: true,
        object_type_id: "order",
        input: {
          type: "object",
          properties: {
            dynamic_params: { type: "object", properties: { count: { type: "integer" } } },
            _instance_identities: { type: "array" },
          },
        },
      }}
    />,
  );
  await waitFor(() => expect(listCaseActionInstances).toHaveBeenCalledWith("kn", "order"));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "执行实例" }));
  fireEvent.click(await screen.findByText("订单一"));
  expect(screen.getByTestId("args")).toHaveTextContent('"_instance_identities":[{"id":"one"}]');
  expect(screen.queryByRole("textbox", { name: "_instance_identities" })).toBeNull();
  fireEvent.change(screen.getByRole("spinbutton", { name: "count" }), { target: { value: "2" } });
  expect(screen.getByTestId("args")).toHaveTextContent('"dynamic_params":{"count":2}');
});
it.each(["skill", "relationType"])(
  "does not ask for meaningless empty arguments for %s",
  (kind) => {
    render(
      <Editor
        kind={kind}
        contract={{ available: true, input: { type: "object", properties: {} } }}
      />,
    );
    expect(screen.getByText("本项无需填写调用参数。")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(listCaseActionInstances).not.toHaveBeenCalled();
  },
);

it("only shows metric time selection when declared and preserves malformed existing time", () => {
  const { unmount } = render(
    <Editor kind="metric" contract={{ available: true, metric_time_available: false }} />,
  );
  expect(screen.queryByText("查询时间范围")).toBeNull();
  unmount();
  render(
    <Editor
      kind="metric"
      initial='{"query":{"time":{"start":"bad","end":5}}}'
      contract={{ available: true, metric_time_available: false }}
    />,
  );
  expect(screen.getByText("查询时间范围")).toBeTruthy();
  expect(screen.getByText(/已有时间范围无效/)).toBeTruthy();
  expect(screen.getByTestId("args")).toHaveTextContent('"start":"bad"');
});

it("ignores a stale next-page reply after action authorization is removed and restored", async () => {
  let resolve!: (value: { rows: Record<string, unknown>[]; nextCursor: undefined }) => void;
  vi.mocked(listCaseActionInstances)
    .mockResolvedValueOnce({
      rows: [{ name: "旧实例", _instance_identity: { id: "old" } }],
      nextCursor: "page-2",
    })
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValueOnce({
      rows: [{ name: "新实例", _instance_identity: { id: "fresh" } }],
      nextCursor: undefined,
    });
  const contract = {
    available: true,
    object_type_id: "order",
    input: { type: "object", properties: {} },
  };
  const view = render(<Editor contract={contract} />);
  fireEvent.click(await screen.findByRole("button", { name: "加载更多实例" }));
  view.rerender(<Editor contract={{ ...contract, available: false }} />);
  view.rerender(<Editor contract={contract} />);
  await waitFor(() => expect(listCaseActionInstances).toHaveBeenCalledTimes(3));
  await act(() =>
    Promise.resolve(
      resolve({
        rows: [{ name: "不应回写", _instance_identity: { id: "stale" } }],
        nextCursor: undefined,
      }),
    ),
  );
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "执行实例" }));
  expect(await screen.findByText("新实例")).toBeTruthy();
  expect(screen.queryByText("不应回写")).toBeNull();
});

it("selects declared metric dimensions without changing existing query filters", async () => {
  const ref = { object_type_id: "order", property_name: "status" };
  render(
    <Editor
      kind="metric"
      initial='{"query":{"page_size":20,"filters":{"op":"eq","value":"paid"}}}'
      contract={{ available: true, metric_dimensions: [ref] }}
    />,
  );
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "分析维度" }));
  fireEvent.click(await screen.findByText("order / status"));
  const args = JSON.parse(screen.getByTestId("args").textContent ?? "") as Record<string, unknown>;
  expect(args.query).toEqual({
    page_size: 20,
    filters: { op: "eq", value: "paid" },
    group_by: [ref],
  });
});
it("deduplicates action instances across pages", async () => {
  vi.mocked(listCaseActionInstances)
    .mockResolvedValueOnce({
      rows: [{ name: "订单一", _instance_identity: { id: "one" } }],
      nextCursor: "page2",
    })
    .mockResolvedValueOnce({
      rows: [
        { name: "订单一", _instance_identity: { id: "one" } },
        { name: "订单二", _instance_identity: { id: "two" } },
      ],
      nextCursor: undefined,
    });
  render(<Editor contract={{ available: true, object_type_id: "order" }} />);
  fireEvent.click(await screen.findByRole("button", { name: "加载更多实例" }));
  await waitFor(() => expect(listCaseActionInstances).toHaveBeenCalledTimes(2));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "执行实例" }));
  expect(await screen.findByText("订单二")).toBeTruthy();
  expect(screen.getAllByText("订单一")).toHaveLength(1);
});
