/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Pagination } from "antd";
import type { PaginationProps } from "antd";

import styles from "./TablePaginationBar.module.css";

type TablePaginationBarProps = PaginationProps;

export function TablePaginationBar(props: TablePaginationBarProps) {
  return (
    <div className={styles.bar}>
      <Pagination {...props} />
    </div>
  );
}
