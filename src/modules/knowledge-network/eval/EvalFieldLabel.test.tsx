/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { ConfigProvider, Form, Input } from "antd";
import { expect, it, vi } from "vitest";
import { EvalFieldLabel, EvalHelpTooltip } from "./EvalFieldLabel";

it("keeps field help out of the layout until requested", async () => {
  render(
    <EvalFieldLabel required hint="填写独立确认的业务标准">
      检查标准
    </EvalFieldLabel>,
  );
  expect(screen.getByText("检查标准")).toBeVisible();
  expect(screen.queryByText("填写独立确认的业务标准")).toBeNull();
  fireEvent.focus(screen.getByRole("button", { name: "检查标准 ?" }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("填写独立确认的业务标准");
});

it("allows reading help in a disabled form without enabling editing", async () => {
  render(
    <ConfigProvider componentDisabled>
      <Form>
        <EvalFieldLabel hint="参数说明">参数</EvalFieldLabel>
        <Input aria-label="参数值" />
      </Form>
    </ConfigProvider>,
  );
  expect(screen.getByRole("textbox", { name: "参数值" })).toBeDisabled();
  const help = screen.getByRole("button", { name: "参数 ?" });
  expect(help).toBeEnabled();
  fireEvent.click(help);
  expect(await screen.findByRole("tooltip")).toHaveTextContent("参数说明");
});

it("does not toggle a parent section when opening help", async () => {
  const onToggle = vi.fn();
  render(
    <div onClick={onToggle}>
      <EvalHelpTooltip label="检查范围" title="只检查当前可见数据" />
    </div>,
  );
  fireEvent.click(screen.getByRole("button", { name: "检查范围 ?" }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("只检查当前可见数据");
  expect(onToggle).not.toHaveBeenCalled();
});

it("does not show an empty help control", () => {
  render(<EvalHelpTooltip title={undefined}>普通标题</EvalHelpTooltip>);
  expect(screen.getByText("普通标题")).toBeVisible();
  expect(screen.queryByRole("button")).toBeNull();
});

it("does not steal the label of an input when help is inside a native label", () => {
  render(
    <label>
      <EvalFieldLabel hint="说明">数量</EvalFieldLabel>
      <Input />
    </label>,
  );
  expect(screen.getByRole("textbox", { name: "数量" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "数量 ?" })).toBeInTheDocument();
});
