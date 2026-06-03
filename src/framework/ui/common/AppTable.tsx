import type { TableProps } from "antd";

import { Table } from "antd";

export function AppTable<RecordType extends object>(
  props: TableProps<RecordType>,
) {
  return <Table<RecordType> {...props} />;
}

