/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined, SearchOutlined } from "@ant-design/icons";
import { Input, Select, Space, Spin, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { formatRowCount } from "@/modules/data-catalog/lib/format";
import { formatIndexStateLabel } from "@/modules/data-catalog/lib/format-index-state";
import {
  indexStateOf,
  isCatalogPhysical,
} from "@/modules/data-catalog/lib/index-state";
import type {
  BuildTask,
  CatalogResource,
} from "@/modules/data-catalog/types/data-catalog";
import { parseResourceScope } from "@/modules/data-catalog/lib/resource-identifier";
import type { CatalogRecord } from "@/shared/catalog";

import styles from "./CatalogDetailPanel.module.css";

const INDEX_FILTERS = ["built", "none", "building", "listening", "failed"] as const;
const CATEGORY_FILTERS = ["table", "logicview", "dataset"] as const;

function indexFilterBucket(key: string) {
  if (key === "built") return "built";
  if (key === "none") return "none";
  if (key === "building" || key === "rebuilding") return "building";
  if (key === "listening" || key === "paused") return "listening";
  return "failed";
}

function deriveDisplayName(resource: CatalogResource) {
  const rawName = (resource.name ?? "").trim();
  const byName = rawName.includes(".") ? rawName.split(".").filter(Boolean).at(-1) : rawName;
  if (byName) {
    return byName;
  }

  const rawIdentifier = (resource.sourceIdentifier ?? "").trim();
  const fromMatch = rawIdentifier.match(/\bfrom\s+([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+){0,2})/i);
  const candidate = (fromMatch?.[1] ?? rawIdentifier).trim();
  const byIdentifier = candidate.includes(".") ? candidate.split(".").filter(Boolean).at(-1) : candidate;
  return byIdentifier || "-";
}

function EllipsisText({ text }: { text: string }) {
  return (
    <Tooltip title={text}>
      <span className={styles.cellEllipsis}>{text}</span>
    </Tooltip>
  );
}

type CatalogDetailPanelProps = {
  catalog: CatalogRecord;
  onCreateResource: (catalogId: string) => void;
  onOpenResource: (
    resourceId: string,
    tab?: "detail" | "index" | "preview",
    indexView?: "config",
  ) => void;
  resources: CatalogResource[];
  resourcesLoading?: boolean;
  tasks: BuildTask[];
};

export function CatalogDetailPanel({
  catalog,
  onCreateResource,
  onOpenResource,
  resources,
  resourcesLoading = false,
  tasks,
}: CatalogDetailPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeDb = searchParams.get("db")?.trim() || "";
  const activeSchema = searchParams.get("schema")?.trim() || "";
  const [resourceKeyword, setResourceKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [indexFilter, setIndexFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [nameColumnWidth, setNameColumnWidth] = useState(() => {
    try {
      const value = window.localStorage.getItem("data-catalog.resourceNameColumnWidth");
      const parsed = value ? Number(value) : NaN;
      return Number.isFinite(parsed) && parsed >= 160 ? parsed : 260;
    } catch {
      return 260;
    }
  });
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const physical = isCatalogPhysical(catalog);

  const tasksByResource = useMemo(() => {
    const map = new Map<string, BuildTask[]>();
    tasks.forEach((task) => {
      map.set(task.resourceId, [...(map.get(task.resourceId) ?? []), task]);
    });
    return map;
  }, [tasks]);

  const filteredResources = useMemo(() => {
    const kw = resourceKeyword.trim().toLowerCase();
    return resources.filter((resource) => {
      if (activeDb) {
        const scope = parseResourceScope(resource.sourceIdentifier);
        if (!scope.database || scope.database !== activeDb) {
          return false;
        }
        if (activeSchema && (!scope.schema || scope.schema !== activeSchema)) {
          return false;
        }
      }
      if (
        kw &&
        !resource.name.toLowerCase().includes(kw) &&
        !(resource.sourceIdentifier ?? "").toLowerCase().includes(kw)
      ) {
        return false;
      }
      if (categoryFilter && resource.category !== categoryFilter) {
        return false;
      }
      if (indexFilter) {
        const key = indexStateOf(tasksByResource.get(resource.id) ?? []).key;
        if (indexFilterBucket(key) !== indexFilter) {
          return false;
        }
      }
      return true;
    });
  }, [
    resources,
    resourceKeyword,
    categoryFilter,
    indexFilter,
    tasksByResource,
    activeDb,
    activeSchema,
  ]);

  useEffect(() => {
    setPage(1);
  }, [resourceKeyword, categoryFilter, indexFilter, catalog.id, activeDb, activeSchema]);

  const pagedResources = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredResources.slice(start, start + pageSize);
  }, [filteredResources, page, pageSize]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!resizingRef.current) {
        return;
      }
      const delta = event.clientX - resizingRef.current.startX;
      const next = Math.max(160, resizingRef.current.startWidth + delta);
      setNameColumnWidth(next);
    };

    const handleUp = () => {
      if (!resizingRef.current) {
        return;
      }
      resizingRef.current = null;
      try {
        window.localStorage.setItem(
          "data-catalog.resourceNameColumnWidth",
          String(nameColumnWidth),
        );
      } catch {
        // ignore
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [nameColumnWidth]);

  const resourceColumns: ColumnsType<CatalogResource> = [
    {
      dataIndex: "name",
      ellipsis: true,
      width: nameColumnWidth,
      title: (
        <div className={styles.resizableHeader}>
          <span>{t("dataCatalog.resource.name")}</span>
          <span
            className={styles.resizeHandle}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              resizingRef.current = { startX: event.clientX, startWidth: nameColumnWidth };
            }}
            role="separator"
          />
        </div>
      ),
      render: (_, record) => {
        const tooltip =
          record.sourceIdentifier && record.sourceIdentifier !== record.name
            ? `${record.name}\n${record.sourceIdentifier}`
            : record.name;
        const displayName = deriveDisplayName(record);
        return (
          <Tooltip title={tooltip}>
            <AppButton
              className={styles.ellipsisLink}
              onClick={() => onOpenResource(record.id, "detail")}
              type="link"
            >
              <span className={styles.cellEllipsis}>{displayName}</span>
            </AppButton>
          </Tooltip>
        );
      },
    },
    {
      dataIndex: "category",
      ellipsis: true,
      title: t("dataCatalog.resource.category"),
      width: 108,
      render: (value: CatalogResource["category"]) => (
        <EllipsisText text={t(`dataCatalog.categories.${value}`)} />
      ),
    },
    {
      dataIndex: "columnCount",
      title: t("dataCatalog.resource.fieldCount"),
      width: 88,
      sorter: (left, right) => (left.columnCount ?? 0) - (right.columnCount ?? 0),
      render: (value: number) =>
        value > 0 ? <span className={styles.monoText}>{value}</span> : "—",
    },
    {
      dataIndex: "rowCount",
      title: t("dataCatalog.resource.rowCount"),
      width: 112,
      sorter: (left, right) => (left.rowCount ?? 0) - (right.rowCount ?? 0),
      render: (value: number) =>
        value > 0 ? <span className={styles.monoText}>{formatRowCount(value)}</span> : "—",
    },
    {
      key: "indexState",
      ellipsis: true,
      title: t("dataCatalog.resource.indexState"),
      width: 140,
      render: (_, record) => {
        const label = formatIndexStateLabel(
          indexStateOf(tasksByResource.get(record.id) ?? []),
          t,
        );
        return <EllipsisText text={label} />;
      },
    },
    {
      key: "actions",
      title: t("common.actions"),
      width: 220,
      render: (_, record) => (
        <Space className={styles.actionGroup} size={4}>
          <AppButton onClick={() => onOpenResource(record.id, "detail")} type="link">
            {t("common.detail")}
          </AppButton>
          <AppButton
            disabled={physical && !catalog.enabled}
            onClick={() => onOpenResource(record.id, "preview")}
            title={
              physical && !catalog.enabled
                ? t("dataCatalog.gate.catalogDisabledShort")
                : undefined
            }
            type="link"
          >
            {t("dataCatalog.actions.preview")}
          </AppButton>
          <PermissionGate permissions="resource:task_manage">
            <AppButton
              disabled={physical && !catalog.enabled}
              onClick={() => onOpenResource(record.id, "index")}
              title={
                physical && !catalog.enabled
                  ? t("dataCatalog.gate.catalogDisabledShort")
                  : undefined
              }
              type="link"
            >
              {t("dataCatalog.actions.buildIndex")}
            </AppButton>
          </PermissionGate>
        </Space>
      ),
    },
  ];

  return (
    <section className={styles.contentSurface}>
      <div className={styles.operationBar}>
        <div className={styles.operationPrimary}>
          <div className={styles.toolbarActions}>
            {physical ? (
              <>
                <AppButton
                  onClick={() => {
                    void navigate(`/data-connect/scans?catalogId=${catalog.id}`);
                  }}
                >
                  {t("dataCatalog.catalog.goScan")}
                </AppButton>
                <AppButton
                  onClick={() => {
                    void navigate("/data-connect");
                  }}
                >
                  {t("dataCatalog.catalog.goConnection")}
                </AppButton>
              </>
            ) : (
              <PermissionGate permissions="resource:create">
                <AppButton onClick={() => onCreateResource(catalog.id)} type="primary">
                  {t("dataCatalog.resource.create")}
                </AppButton>
              </PermissionGate>
            )}
          </div>
        </div>
        {resources.length > 0 ? (
          <div className={styles.toolbarFilters}>
            <Input
              allowClear
              className={styles.searchInput}
              onChange={(event) => setResourceKeyword(event.target.value)}
              placeholder={t("dataCatalog.resource.searchPlaceholder")}
              prefix={<SearchOutlined className={styles.searchIcon} />}
              value={resourceKeyword}
            />
            <div className={styles.filterField}>
              <span className={styles.filterLabel}>{t("dataCatalog.resource.category")}</span>
              <Select
                className={styles.filterSelect}
                onChange={(value) => setCategoryFilter(value)}
                options={[
                  { label: t("common.all"), value: "" },
                  ...CATEGORY_FILTERS.map((key) => ({
                    label: t(`dataCatalog.categories.${key}`),
                    value: key,
                  })),
                ]}
                value={categoryFilter}
              />
            </div>
            <div className={styles.filterField}>
              <span className={styles.filterLabel}>
                {t("dataCatalog.resource.indexState")}
              </span>
              <Select
                className={styles.filterSelect}
                onChange={(value) => setIndexFilter(value)}
                options={[
                  { label: t("common.all"), value: "" },
                  ...INDEX_FILTERS.map((key) => ({
                    label: t(`dataCatalog.indexState.${key}`),
                    value: key,
                  })),
                ]}
                value={indexFilter}
              />
            </div>
          </div>
        ) : null}
      </div>

      <TableSurface className={styles.tableSurface}>
        {resourcesLoading ? (
          <div className={styles.tableLoading}>
            <Spin />
          </div>
        ) : resources.length === 0 ? (
          <EmptyStatePanel
            action={
              physical ? (
                <AppButton
                  onClick={() => {
                    void navigate(`/data-connect/scans?catalogId=${catalog.id}`);
                  }}
                  type="primary"
                >
                  {t("dataCatalog.catalog.goScanToDiscover")}
                </AppButton>
              ) : !physical ? (
                <PermissionGate permissions="resource:create">
                  <AppButton onClick={() => onCreateResource(catalog.id)} type="primary">
                    {t("dataCatalog.resource.create")}
                  </AppButton>
                </PermissionGate>
              ) : null
            }
            description={
              physical
                ? t("dataCatalog.catalog.emptyResourcesPhysical")
                : t("dataCatalog.catalog.emptyResourcesLogical")
            }
            icon={<DatabaseOutlined />}
            title={t("dataCatalog.catalog.resourceSection")}
          />
        ) : filteredResources.length === 0 ? (
          <EmptyStatePanel
            description={t("dataCatalog.resource.noMatch")}
            icon={<DatabaseOutlined />}
            title={t("dataCatalog.catalog.resourceSection")}
          />
        ) : (
          <AppTable<CatalogResource>
            columns={resourceColumns}
            dataSource={pagedResources}
            locale={{ emptyText: t("dataCatalog.resource.noMatch") }}
            pagination={false}
            rowKey="id"
            tableLayout="fixed"
          />
        )}
      </TableSurface>

      {filteredResources.length > 0 ? (
        <TablePaginationBar
          current={page}
          onChange={(nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          }}
          pageSize={pageSize}
          showSizeChanger
          showTotal={(count) => t("common.total", { total: count })}
          total={filteredResources.length}
        />
      ) : null}
    </section>
  );
}
