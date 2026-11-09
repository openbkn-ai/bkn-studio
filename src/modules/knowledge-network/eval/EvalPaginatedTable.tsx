/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { resultUiText } from "./result-ui-text";

import { Table } from "antd";
import type { TablePaginationConfig, TableProps } from "antd";
import { useState } from "react";
import { useEvalTranslation } from "./useEvalTranslation";

import styles from "./EvalPaginatedTable.module.css";

import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";

/** Keep Eval tables on the same pagination control used by other knowledge-network lists. */
export function EvalPaginatedTable<RecordType>({
  pagination,
  dataSource,
  columns,
  className,
  size = "small",
  tableLayout = "fixed",
  ...tableProps
}: TableProps<RecordType>) {
  useEvalTranslation();
  const [localPage, setLocalPage] = useState(1);
  const config: TablePaginationConfig = typeof pagination === "object" ? pagination : {};
  const pageSize = config.pageSize ?? 10;
  const total = config.total ?? dataSource?.length ?? 0;
  const current = Math.min(config.current ?? localPage, Math.max(1, Math.ceil(total / pageSize)));
  // A supplied total larger than the returned rows denotes a server-paged response.
  const serverPaged = config.total !== undefined && config.total > (dataSource?.length ?? 0);
  const entries =
    pagination === false || serverPaged
      ? dataSource
      : dataSource?.slice((current - 1) * pageSize, current * pageSize);

  // Preserve header callbacks and leave cell content unchanged while exposing
  // the full text of plain headers when their columns are narrow.
  const readableColumns = columns?.map((column) => {
    const title = column.title;
    return typeof title === "string"
      ? {
          ...column,
          title: (
            <span className={styles.headerText} title={title}>
              {title}
            </span>
          ),
        }
      : column;
  });

  return (
    <>
      <Table<RecordType>
        {...tableProps}
        columns={readableColumns}
        className={[styles.table, className].filter(Boolean).join(" ")}
        size={size}
        tableLayout={tableLayout}
        dataSource={entries}
        pagination={false}
      />
      {pagination !== false && total > pageSize && (
        <TablePaginationBar
          current={current}
          pageSize={pageSize}
          total={total}
          showLessItems
          showSizeChanger={false}
          showTotal={(count) => resultUiText("total", { count })}
          onChange={(page, size) => {
            setLocalPage(page);
            config.onChange?.(page, size);
          }}
        />
      )}
    </>
  );
}
