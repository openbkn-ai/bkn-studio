/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BknTracePrototypeScene } from "@/modules/bkn-trace/prototype/BknTracePrototypeScene";

describe("BknTracePrototypeScene", () => {
  it("presents the real conversation as a business timeline", () => {
    render(<BknTracePrototypeScene />);

    expect(screen.getByText("业务溯源分析")).not.toBeNull();
    expect(screen.getByText(/Codex · 2 轮交互 · 9 次业务调用/)).not.toBeNull();
    expect(screen.getByRole<HTMLInputElement>("radio", { name: "时间链视图" }).checked).toBe(true);
    expect(screen.getByText(/查询物料 101-000015 有多少库存/)).not.toBeNull();
    expect(screen.getByText(/分析对比900-000044和900-000063/)).not.toBeNull();
    expect(screen.getByText("1分37.9秒")).not.toBeNull();
    expect(screen.getByText("30.7秒")).not.toBeNull();
    expect(screen.getAllByTestId("timeline-operation")).toHaveLength(9);
  });

  it("uses one collapsible detail panel for selection and reproduction", () => {
    render(<BknTracePrototypeScene />);

    fireEvent.click(screen.getByRole("button", { name: /查询库存分布/ }));
    expect(screen.getAllByText("物料编码 = 101-000015")).not.toHaveLength(0);
    expect(screen.getAllByText("库存")).not.toHaveLength(0);

    fireEvent.click(screen.getByText("复现查询"));
    expect(screen.getByText(/WHERE material_code = '101-000015'/)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "收起详情" }));
    expect(screen.queryByText("复现查询")).toBeNull();
    expect(screen.getByRole("button", { name: "展开详情" })).not.toBeNull();
  });

  it("switches to the knowledge-network workspace without losing the selection", () => {
    render(<BknTracePrototypeScene />);

    fireEvent.click(screen.getByRole("button", { name: /查询库存分布/ }));
    fireEvent.click(screen.getByText("知识网络视图"));

    expect(screen.getByRole<HTMLInputElement>("radio", { name: "知识网络视图" }).checked).toBe(true);
    expect(screen.getByText("物料编码 = 101-000015")).not.toBeNull();
  });

  it("progressively expands observed objects, real relations, and adjacent objects", () => {
    render(<BknTracePrototypeScene />);

    fireEvent.click(screen.getByText("知识网络视图"));
    expect(screen.getByRole("button", { name: /HD供应链业务知识网络_v3/ })).not.toBeNull();
    expect(screen.getByRole("button", { name: "28 个探索候选" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /采购订单，3 次实际查询/ }));
    expect(screen.getByRole("button", { name: /采购订单关联供应商，网络上下文/ })).not.toBeNull();
    expect(screen.getAllByText("网络上下文 · 未记录调用")).not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /采购订单关联供应商，网络上下文/ }));
    expect(screen.getByRole("button", { name: /供应商，相邻对象/ })).not.toBeNull();
    expect(screen.getByText("网络上下文，未记录为实际调用")).not.toBeNull();
    expect(screen.getByText("供应商编号 → 供应商编码")).not.toBeNull();
  });
});
