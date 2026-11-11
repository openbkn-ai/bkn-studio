/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EvalRuleCheckFields } from "./EvalRuleCheckFields";
const capabilities = [
  {
    type: "non_empty",
    name: "非空检查",
    kinds: ["objectType", "objectProperty"],
    bindings: ["primary_keys", "display_key", "property"],
    help: "0 和 false 是有效值",
  },
  {
    type: "numeric_range",
    name: "数值范围检查",
    kinds: ["objectProperty"],
    bindings: ["property"],
    help: "闭区间",
  },
];
it("uses server capability kinds and creates a real executable configuration", () => {
  const onChange = vi.fn();
  render(
    <EvalRuleCheckFields kind="objectProperty" capabilities={capabilities} onChange={onChange} />,
  );
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "检查方式" }));
  fireEvent.click(screen.getByText("数值范围检查"));
  expect(onChange).toHaveBeenLastCalledWith({
    type: "numeric_range",
    binding: "property",
    scope: { mode: "sample", limit: 100 },
  });
});
it("edits range boundaries without conflating zero with an empty value", () => {
  const onChange = vi.fn();
  render(
    <EvalRuleCheckFields
      kind="objectProperty"
      capabilities={capabilities}
      value={{ type: "numeric_range", binding: "property" }}
      onChange={onChange}
    />,
  );
  fireEvent.change(screen.getByRole("spinbutton", { name: "最小值" }), { target: { value: "0" } });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ minimum: "0" }));
  expect(screen.queryByText("全量检查")).toBeNull();
});
