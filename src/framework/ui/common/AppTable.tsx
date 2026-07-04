/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TableProps } from "antd";

import { Table } from "antd";

import {
  buildTablePagination,
  type StandardTablePaginationOptions,
} from "@/framework/ui/common/table-pagination";

type AppTableProps<RecordType extends object> = TableProps<RecordType> & {
  paginationOptions?: StandardTablePaginationOptions;
};

export function AppTable<RecordType extends object>(
  props: AppTableProps<RecordType>,
) {
  const { pagination, paginationOptions, ...restProps } = props;

  const resolvedPagination =
    pagination && typeof pagination === "object"
      ? buildTablePagination(pagination, paginationOptions)
      : pagination;

  return <Table<RecordType> {...restProps} pagination={resolvedPagination} />;
}

