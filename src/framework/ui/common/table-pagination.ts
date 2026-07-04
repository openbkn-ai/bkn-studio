/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TablePaginationConfig } from "antd";

export type StandardTablePaginationOptions = {
  hideOnSinglePage?: boolean;
  pageSizeOptions?: number[];
  showQuickJumper?: boolean;
  showSizeChanger?: boolean;
  showTotal?: TablePaginationConfig["showTotal"];
};

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50];

export function buildTablePagination(
  pagination: TablePaginationConfig,
  options: StandardTablePaginationOptions = {},
): TablePaginationConfig {
  const {
    hideOnSinglePage = true,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    showQuickJumper = false,
    showSizeChanger = true,
    showTotal,
  } = options;

  return {
    hideOnSinglePage,
    pageSizeOptions,
    showQuickJumper,
    showSizeChanger,
    ...pagination,
    showTotal: pagination.showTotal ?? showTotal,
  };
}
