/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { EvalPaginatedTable } from "./EvalPaginatedTable";

const columns = [{ title: "名称", dataIndex: "name" }];

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  })),
});

it("paginates local rows with the shared knowledge-network control", () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    id: index,
    name: `资源 ${index + 1}`,
  }));
  render(
    <EvalPaginatedTable
      rowKey="id"
      columns={columns}
      dataSource={entries}
      pagination={{ pageSize: 10 }}
    />,
  );
  expect(screen.getByText("资源 1")).toBeTruthy();
  expect(screen.queryByText("资源 11")).toBeNull();
  fireEvent.click(screen.getByRole("listitem", { name: "2" }));
  expect(screen.getByText("资源 11")).toBeTruthy();
  expect(screen.queryByText("资源 1")).toBeNull();
});

it("preserves server-paged rows and delegates navigation to the data loader", () => {
  const onChange = vi.fn();
  render(
    <EvalPaginatedTable
      rowKey="id"
      columns={columns}
      dataSource={[{ id: 11, name: "服务端第 2 页" }]}
      pagination={{ current: 2, pageSize: 10, total: 21, onChange }}
    />,
  );
  expect(screen.getByText("服务端第 2 页")).toBeTruthy();
  fireEvent.click(screen.getByRole("listitem", { name: "3" }));
  expect(onChange).toHaveBeenCalledWith(3, 10);
});

it("preserves header actions and explicit overrides while keeping long headers discoverable", () => {
  const onClick = vi.fn();
  const title = "A long resource name header that must remain discoverable";
  const { container } = render(
    <EvalPaginatedTable
      className="caller-table"
      tableLayout="auto"
      size="large"
      rowKey="id"
      pagination={false}
      dataSource={[{ id: 1, name: "Original content" }]}
      columns={[
        { title, dataIndex: "name" },
        {
          title: "Custom header",
          render: () => "Details",
          onHeaderCell: () => ({ className: "caller-header", onClick }),
        },
      ]}
    />,
  );
  expect(screen.getByText(title)).toHaveAttribute("title", title);
  const custom = screen.getByRole("columnheader", { name: "Custom header" });
  expect(custom).toHaveClass("caller-header");
  fireEvent.click(custom);
  expect(onClick).toHaveBeenCalledOnce();
  expect(container.querySelector(".caller-table table")).toHaveStyle({ tableLayout: "auto" });
  expect(screen.getByText("Original content")).toBeTruthy();
});
