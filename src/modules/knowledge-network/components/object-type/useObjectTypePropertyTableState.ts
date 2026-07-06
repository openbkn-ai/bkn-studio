/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FilterValue, TablePaginationConfig } from "antd/es/table/interface";
import { useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import {
  getDisplayedColumns,
  readDetailTableColumnConfig,
  type ColumnVisibilityPayload,
} from "@/modules/knowledge-network/components/shared/DetailTableColumnSettingsButton";
import { ObjectTypePropertyTableColumns } from "@/modules/knowledge-network/components/object-type/ObjectTypePropertyTableColumns";
import { useDetailTableColumnStorageScope } from "@/modules/knowledge-network/components/shared/useDetailTableColumnStorageScope";

type TableSorterPayload =
  | { columnKey?: string | number; order?: "ascend" | "descend" | null }
  | Array<{ columnKey?: string | number; order?: "ascend" | "descend" | null }>;

type TableChangeExtra = {
  action: "paginate" | "sort" | "filter";
};

type UseObjectTypePropertyTableStateOptions = {
  attributesLength: number;
};

function uniqueColumns(ids: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    next.push(id);
  }

  return next;
}

function getSortedColumnOrder(currentOrder: string[], sorter: TableSorterPayload) {
  const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
  const columnKey = singleSorter?.columnKey ? String(singleSorter.columnKey) : null;

  if (!columnKey || !currentOrder.includes(columnKey)) {
    return currentOrder;
  }

  const nextOrder = currentOrder.filter((column) => column !== columnKey);
  const targetIndex = singleSorter?.order ? currentOrder.indexOf(columnKey) : -1;

  if (singleSorter?.order && targetIndex >= 0) {
    nextOrder.splice(targetIndex, 0, columnKey);
  } else {
    nextOrder.push(columnKey);
  }

  return nextOrder;
}

function updateColumnOrder(ids: MutableRefObject<string[]>, order: string[]) {
  const validOrder = order.filter((column) => {
    if (column === "index" || column === "actions") {
      return true;
    }
    return ids.current.includes(column);
  });
  ids.current = uniqueColumns(validOrder);
}

function updateColumnVisibility(
  ids: MutableRefObject<string[]>,
  visibility: ColumnVisibilityPayload,
  setColumnVisibility: Dispatch<SetStateAction<ColumnVisibilityPayload>>,
) {
  const visibleKeys = getDisplayedColumns(ids.current, visibility);
  ids.current = visibleKeys;
  const nextVisibility = Object.fromEntries(
    visibleKeys.map((column) => [column, visibility[column] !== false]),
  ) as ColumnVisibilityPayload;

  setColumnVisibility(nextVisibility);
}

function buildInitialColumnState(storageScope: string) {
  const defaultOrder = ObjectTypePropertyTableColumns.map((column) => column.key);
  const saved = readDetailTableColumnConfig(storageScope);
  if (!saved) {
    return {
      order: defaultOrder,
      visibility: {} as ColumnVisibilityPayload,
    };
  }

  const mergedOrder = [
    ...saved.order.filter((key) => defaultOrder.includes(key)),
    ...defaultOrder.filter((key) => !saved.order.includes(key)),
  ];
  const order = getDisplayedColumns(
    mergedOrder.length > 0 ? mergedOrder : defaultOrder,
    saved.visibility,
  );

  return {
    order,
    visibility: saved.visibility,
  };
}

export function useObjectTypePropertyTableState({
  attributesLength,
}: UseObjectTypePropertyTableStateOptions) {
  const storageScope = useDetailTableColumnStorageScope("object-property");
  const initialState = useMemo(() => buildInitialColumnState(storageScope), [storageScope]);
  const columnOrderRef = useRef<string[]>(initialState.order);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityPayload>(
    () => initialState.visibility,
  );
  const [columnOrderVersion, setColumnOrderVersion] = useState(0);

  const tableColumns = useMemo(() => {
    return columnOrderRef.current
      .map((columnKey) =>
        ObjectTypePropertyTableColumns.find((column) => column.key === columnKey),
      )
      .filter((column): column is (typeof ObjectTypePropertyTableColumns)[number] => Boolean(column));
  }, [attributesLength, columnVisibility, columnOrderVersion]);

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: TableSorterPayload,
    extra: TableChangeExtra,
  ) => {
    if (extra.action !== "sort") {
      return;
    }

    updateColumnOrder(columnOrderRef, getSortedColumnOrder(columnOrderRef.current, sorter));
    setColumnOrderVersion((value) => value + 1);
  };

  const handleColumnConfigChange = (columnOrder: string[], visibility: ColumnVisibilityPayload) => {
    updateColumnOrder(columnOrderRef, columnOrder);
    updateColumnVisibility(columnOrderRef, visibility, setColumnVisibility);
    setColumnOrderVersion((value) => value + 1);
  };

  return {
    storageScope,
    tableColumns,
    columnVisibility,
    handleTableChange,
    handleColumnConfigChange,
  };
}
