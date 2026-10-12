/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import i18n from "@/app/locales/i18n";
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
  it("identifies a genuinely unrecorded call by tool and the complete request ID", () => {
    render(
      <RecordMissingDetails
        items={[
          {
            operation_id: "",
            attempt: 0,
            tool_name: "execute_tool",
            reason: "call_outcome_missing",
            field: "request_id:req:third-party:17",
          },
        ]}
      />,
    );
    expect(screen.getByText("调用结局未记录")).not.toBeNull();
    expect(screen.getByText("execute_tool")).not.toBeNull();
    expect(screen.getByText("调用请求")).not.toBeNull();
    expect(screen.getByText("req:third-party:17")).not.toBeNull();
  });

  it("renders the same missing call in English without exposing translation keys", async () => {
    const originalLanguage = i18n.language;
    await i18n.changeLanguage("en-US");
    try {
      render(
        <RecordMissingDetails
          items={[
            {
              operation_id: "",
              attempt: 0,
              tool_name: "run_cypher",
              reason: "call_outcome_missing",
              field: "request_id:req-en",
            },
          ]}
        />,
      );
      expect(screen.getByText("Call outcome not recorded")).not.toBeNull();
      expect(screen.getByText("Call request")).not.toBeNull();
      expect(screen.getByText("run_cypher")).not.toBeNull();
      expect(screen.getByText("req-en")).not.toBeNull();
    } finally {
      await i18n.changeLanguage(originalLanguage);
    }
  });

  it("adds no detail container to a complete call", () => {
    const { container } = render(<RecordMissingDetails items={[]} />);
    expect(container.childElementCount).toBe(0);
  });
});
