import type { SortOrder } from "antd/es/table/interface";

export function getModelTableColumnSortOrder(
  dataIndex: string,
  fieldMap: Record<string, string>,
  sortRule: string,
  sortOrder: "asc" | "desc",
): SortOrder | undefined {
  if (fieldMap[dataIndex] !== sortRule) {
    return undefined;
  }

  return sortOrder === "asc" ? "ascend" : "descend";
}

export function toggleModelSort(
  nextRule: string,
  currentRule: string,
  currentOrder: "asc" | "desc",
): "asc" | "desc" {
  if (nextRule !== currentRule) {
    return "desc";
  }

  return currentOrder === "desc" ? "asc" : "desc";
}
