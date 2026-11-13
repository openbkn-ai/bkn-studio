/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PaginationProps } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/** The project pages' lists show 20 rows a page, as the knowledge network list pages its cards. */
export const LIST_PAGE_SIZE = 20;
export const LIST_PAGE_SIZE_OPTIONS = [20, 50, 100];

export type ListPage = {
  /** The pagination of a table, or of a TablePaginationBar under a list; false without rows. */
  pagination: false | PaginationProps;
  /** The rows of the page shown. */
  slice: <T>(items: T[]) => T[];
};

/**
 * Pages a list of total rows. A change of filter, the reset key, goes back to the first page; a
 * page past the end, once rows are gone, shows the last.
 */
export function useListPage(total: number, reset: string = ""): ListPage {
  const { t } = useTranslation();
  const [state, setState] = useState({ page: 1, pageSize: LIST_PAGE_SIZE, reset });
  let { page } = state;
  if (state.reset !== reset) {
    page = 1;
    setState({ ...state, page, reset });
  }
  const last = Math.max(1, Math.ceil(total / state.pageSize));
  page = Math.min(page, last);
  const start = (page - 1) * state.pageSize;
  return {
    pagination: total
      ? {
          current: page,
          hideOnSinglePage: false,
          onChange: (nextPage, pageSize) =>
            setState((prev) => ({
              ...prev,
              // A new page size starts over from the first page.
              page: pageSize === prev.pageSize ? nextPage : 1,
              pageSize,
            })),
          pageSize: state.pageSize,
          pageSizeOptions: LIST_PAGE_SIZE_OPTIONS,
          // Choosing how many a page shows matters once there is more than one page of the least.
          showSizeChanger: total > LIST_PAGE_SIZE,
          showTotal: (count) => t("common.total", { total: count }),
          total,
        }
      : false,
    slice: (items) => items.slice(start, start + state.pageSize),
  };
}
