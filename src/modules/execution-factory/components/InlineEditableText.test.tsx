/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InlineEditableText } from "@/modules/execution-factory/components/InlineEditableText";

afterEach(cleanup);

// 说明：真正的 bug（Escape 收起后，卸载聚焦中的 Input 触发 onBlur→commit 写回草稿）
// 依赖浏览器在元素移除时派发 focusout，jsdom 不实现，无法在单测里复现。这里覆盖修复
// 里真正有风险的一环——cancelledRef 在重新进入编辑态时必须复位，否则一次 Escape 会
// 永久吞掉后续的正常提交。
describe("InlineEditableText", () => {
  it("commits the edited draft on blur", () => {
    const onChange = vi.fn();
    render(<InlineEditableText emptyLabel="空" onChange={onChange} value="old" />);

    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "new" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith("new");
  });

  it("still commits a later edit after an Escape cancel (cancel flag resets)", () => {
    const onChange = vi.fn();
    render(<InlineEditableText emptyLabel="空" onChange={onChange} value="old" />);

    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "discarded" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();

    // 重新编辑并失焦：cancelledRef 若不复位，这次提交会被上一次 Escape 的标志误吞。
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "kept" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("kept");
  });
});
