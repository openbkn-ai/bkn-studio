/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RecordMissingDetails } from "./RecordMissingDetails";

describe("record missing details", () => {
  it("shows actual missing records without exposing internal state names", () => {
    render(
      <RecordMissingDetails
        items={[
          {
            operation_id: "op-outcome",
            attempt: 2,
            reason: "call_outcome_missing",
            field: "outcome",
          },
          {
            operation_id: "op-content",
            attempt: 1,
            reason: "record_content_missing",
            field: "output",
          },
          {
            operation_id: "op-target",
            attempt: 1,
            reason: "business_target_missing",
            field: "business_refs",
          },
          {
            operation_id: "op-event",
            attempt: 1,
            reason: "record_content_missing",
            field: "evidence.result_completeness",
          },
        ]}
      />,
    );
    expect(screen.getByText("调用结局未记录")).not.toBeNull();
    expect(screen.getByText("结果内容")).not.toBeNull();
    expect(screen.getByText("业务目标未记录")).not.toBeNull();
    expect(screen.getByText("查询结果范围记录")).not.toBeNull();
    expect(screen.getByText("op-outcome / 2")).not.toBeNull();
  });
  it("adds no detail container to a complete call", () => {
    const { container } = render(<RecordMissingDetails items={[]} />);
    expect(container.childElementCount).toBe(0);
  });
});
