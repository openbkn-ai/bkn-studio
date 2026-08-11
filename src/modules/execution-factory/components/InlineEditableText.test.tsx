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

// The actual bug, where Escape unmounts a focused Input and onBlur -> commit restores the draft,
// relies on browsers dispatching focusout on element removal. jsdom does not implement that behavior,
// so the unit test covers the risky part of the fix: cancelledRef must reset on re-entry or one Escape
// permanently suppresses later valid commits.
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

    // Edit again and blur: without resetting cancelledRef, this commit is wrongly swallowed by the prior Escape flag.
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "kept" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("kept");
  });
});
