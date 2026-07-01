/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TableProps } from "antd";

import { Table } from "antd";

export function AppTable<RecordType extends object>(
  props: TableProps<RecordType>,
) {
  return <Table<RecordType> {...props} />;
}

