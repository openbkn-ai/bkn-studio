/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, renderHook } from "@testing-library/react";
import type { PaginationProps } from "antd";
import { describe, expect, it } from "vitest";

import { useListPage } from "./useListPage";

const rows = (count: number) => Array.from({ length: count }, (_, index) => index + 1);
const props = (pagination: false | PaginationProps) => pagination as PaginationProps;

describe("useListPage", () => {
  it("shows 20 a page, goes back to the first on a new filter, and to the last once rows go", () => {
    const { rerender, result } = renderHook(({ reset, total }) => useListPage(total, reset), {
      initialProps: { reset: "all", total: 45 },
    });
    expect(result.current.slice(rows(45))).toEqual(rows(20));
    expect(props(result.current.pagination).showSizeChanger).toBe(true);

    act(() => props(result.current.pagination).onChange?.(3, 20));
    expect(result.current.slice(rows(45))).toEqual([41, 42, 43, 44, 45]);

    rerender({ reset: "all", total: 30 });
    expect(props(result.current.pagination).current).toBe(2);

    rerender({ reset: "metric", total: 30 });
    expect(props(result.current.pagination).current).toBe(1);
  });

  it("shows no pagination without rows, and no size choice for one page", () => {
    const { rerender, result } = renderHook(({ total }) => useListPage(total), {
      initialProps: { total: 0 },
    });
    expect(result.current.pagination).toBe(false);
    rerender({ total: 5 });
    expect(props(result.current.pagination).showSizeChanger).toBe(false);
    expect(props(result.current.pagination).hideOnSinglePage).toBe(false);
  });
});
