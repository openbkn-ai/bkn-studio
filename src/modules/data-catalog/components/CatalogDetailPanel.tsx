/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined, EllipsisOutlined, KeyOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Dropdown, Input, Select, Space, Spin, Tag, Tooltip, type MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { dataCatalogCreationAvailable } from "@/modules/data-catalog/lib/creation-availability";
import { formatRowCount } from "@/modules/data-catalog/lib/format";
import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";
import { authzPoints } from "@/modules/system-admin/permissions";
import { formatIndexStateLabel } from "@/modules/data-catalog/lib/format-index-state";
import { resourceQueryBlockReason } from "@/modules/data-catalog/lib/resource-query-availability";
import {
  indexStateOf,
  isCatalogPhysical,
} from "@/modules/data-catalog/lib/index-state";
import { listCatalogResourcePage } from "@/modules/data-catalog/services/resource.service";
import type {
  BuildTask,
  CatalogResource,
  ResourceDiscoverStatus,
} from "@/modules/data-catalog/types/data-catalog";
import { hasCatalogOperation, type CatalogRecord } from "@/shared/catalog";

import styles from "./CatalogDetailPanel.module.css";

const INDEX_FILTERS = ["built", "none", "building", "failed"] as const;
const CATEGORY_FILTERS = ["table", "logicview", "dataset"] as const;

const DISCOVER_STATUS_CLASSES: Record<ResourceDiscoverStatus, string> = {
  error: styles.statusTagError,
  missing: styles.statusTagError,
  new: styles.statusTagProcessing,
  restored: styles.statusTagSuccess,
  unchanged: styles.statusTagSuccess,
  updated: styles.statusTagProcessing,
};

function indexFilterBucket(key: string) {
  if (key === "built") return "built";
  if (key === "none") return "none";
  if (key === "building" || key === "rebuilding") return "building";
  return "failed";
}

function deriveDisplayName(resource: CatalogResource, connectorType: string) {
  const rawName = (resource.name ?? "").trim();
  const rawIdentifier = (resource.sourceIdentifier ?? "").trim();

  if (connectorType === "opensearch") {
    if (rawName && rawIdentifier && rawName !== rawIdentifier) {
      return `${rawName} / ${rawIdentifier}`;
    }
    return rawName || rawIdentifier || "-";
  }

  const byName = rawName.includes(".") ? rawName.split(".").filter(Boolean).at(-1) : rawName;
  if (byName) {
    return byName;
  }

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

function getResourceNameTooltip(
  resource: CatalogResource,
  connectorType: string,
  displayName: string,
) {
  if (connectorType === "opensearch") {
    return displayName;
  }

  if (resource.sourceIdentifier && resource.sourceIdentifier !== resource.name) {
    return `${resource.name}\n${resource.sourceIdentifier}`;
  }

  return resource.name || displayName;
}

type CatalogDetailPanelProps = {
  catalog: CatalogRecord;
  onCreateResource: (catalogId: string) => void;
  onOpenResource: (
    resourceId: string,
    tab?: "detail" | "index" | "preview" | "semantic-understanding",
    indexView?: "config",
  ) => void;
  tasks: BuildTask[];
};

export function CatalogDetailPanel({
  catalog,
  onCreateResource,
  onOpenResource,
  tasks,
}: CatalogDetailPanelProps) {
  const { t } = useTranslation();
  const { runtimeConfig } = useAppServices();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeSchema = searchParams.get("schema")?.trim() || "";
  const [resourceKeyword, setResourceKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [indexFilter, setIndexFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [resources, setResources] = useState<CatalogResource[]>([]);
  const [resourceTotal, setResourceTotal] = useState(0);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourceLoadError, setResourceLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [authorizeOpen, setAuthorizeOpen] = useState(false);
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
  const showIndexState = !catalog.internal;
  const canManageResourceTasks = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: "catalog:task_manage",
  });
  const hasResourceQuery =
    resourceKeyword.trim().length > 0 ||
    categoryFilter.length > 0 ||
    (showIndexState && indexFilter.length > 0);
  const canAuthorizeGrants = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: authzPoints.grant,
  });
  // Two ways to earn the button, and they are different questions. `authorize` on THIS catalog is
  // what its creator holds (vega writes it at create time); admin-authz:grant is the platform-wide
  // point. Asking only the second one hid the button from every person who built a data connection.
  const ownsCatalogAuthorize = hasCatalogOperation(catalog, "authorize");
  const canAuthorizeCatalog = !catalog.internal && (ownsCatalogAuthorize || canAuthorizeGrants);
  const showOperationBar =
    resourceTotal > 0 ||
    hasResourceQuery ||
    canAuthorizeCatalog ||
    (dataCatalogCreationAvailable && !physical && !catalog.internal);

  const tasksByResource = useMemo(() => {
    const map = new Map<string, BuildTask[]>();
    tasks.forEach((task) => {
      map.set(task.resourceId, [...(map.get(task.resourceId) ?? []), task]);
    });
    return map;
  }, [tasks]);

  const displayResources = useMemo(() => {
    return resources.filter((resource) => {
      if (showIndexState && indexFilter) {
        const key = indexStateOf(
          tasksByResource.get(resource.id) ?? [],
          resource.localIndexStatus,
        ).key;
        if (indexFilterBucket(key) !== indexFilter) {
          return false;
        }
      }
      return true;
    });
  }, [indexFilter, resources, showIndexState, tasksByResource]);

  useEffect(() => {
    if (!showIndexState && indexFilter) {
      setIndexFilter("");
    }
  }, [indexFilter, showIndexState]);

  useEffect(() => {
    setPage(1);
  }, [resourceKeyword, categoryFilter, indexFilter, catalog.id, activeSchema]);

  useEffect(() => {
    let cancelled = false;
    setResourcesLoading(true);
    setResourceLoadError(null);

    void listCatalogResourcePage({
      catalogId: catalog.id,
      category: categoryFilter ? (categoryFilter as CatalogResource["category"]) : undefined,
      schema: activeSchema || undefined,
      keyword: resourceKeyword,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setResources(result.items);
        setResourceTotal(result.total);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setResources([]);
        setResourceTotal(0);
        setResourceLoadError(extractRequestErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          setResourcesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSchema, catalog.id, categoryFilter, page, pageSize, reloadKey, resourceKeyword]);

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
        const displayName = deriveDisplayName(record, catalog.connectorType);
        const tooltip = getResourceNameTooltip(record, catalog.connectorType, displayName);
        return (
          <Tooltip
            overlayClassName={styles.resourceNameTooltip}
            title={tooltip}
          >
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
      dataIndex: "enabled",
      ellipsis: true,
      title: t("dataCatalog.resource.enabledStatus"),
      width: 96,
      render: (value: boolean | undefined) => {
        const enabled = value !== false;
        return <Tag className={enabled ? styles.statusTagSuccess : styles.statusTagNeutral}>{t(enabled ? "common.enabled" : "common.disabled")}</Tag>;
      },
    },
    {
      dataIndex: "lastDiscoverStatus",
      ellipsis: true,
      title: t("dataCatalog.resource.discoverStatus"),
      width: 112,
      render: (value: ResourceDiscoverStatus | undefined) =>
        value ? (
          <Tag className={DISCOVER_STATUS_CLASSES[value]}>
            {t(`dataCatalog.discoverStatuses.${value}`)}
          </Tag>
        ) : (
          "—"
        ),
    },
    {
      dataIndex: "columnCount",
      title: t("dataCatalog.resource.fieldCount"),
      width: 88,
      render: (value: number | null) =>
        value !== null && value > 0 ? (
          <span className={styles.monoText}>{value}</span>
        ) : (
          "—"
        ),
    },
    {
      dataIndex: "rowCount",
      title: t("dataCatalog.resource.rowCount"),
      width: 112,
      render: (value: number) =>
        value > 0 ? <span className={styles.monoText}>{formatRowCount(value)}</span> : "—",
    },
    ...(showIndexState
      ? [
          {
            key: "indexState",
            ellipsis: true,
            title: t("dataCatalog.resource.indexState"),
            width: 140,
            render: (_: unknown, record: CatalogResource) => {
              const state = indexStateOf(tasksByResource.get(record.id) ?? [], record.localIndexStatus);
              const label = formatIndexStateLabel(state, t);
              const className = state.key === "built" ? styles.statusTagSuccess
                : state.key === "building" || state.key === "rebuilding" || state.key === "listening" ? styles.statusTagProcessing
                  : state.key === "failed" || state.key === "failed-stale" ? styles.statusTagError
                    : styles.statusTagNeutral;
              return <Tag className={className}>{label}</Tag>;
            },
          },
        ]
      : []),
    {
      key: "actions",
      title: t("common.actions"),
      align: "center",
      fixed: "right",
      width: 84,
      render: (_, record) => {
        const blockedByDisabledCatalog = physical && !catalog.enabled;
        const queryBlockReason = resourceQueryBlockReason(record, record.columnCount);
        const previewDisabled = blockedByDisabledCatalog || queryBlockReason !== null;
        const indexDisabled = blockedByDisabledCatalog || queryBlockReason !== null;
        const previewLabel = t("dataCatalog.actions.preview");
        const indexLabel = t("dataCatalog.actions.dataIndex");
        const moreItems: NonNullable<MenuProps["items"]> = [
          {
            key: "detail",
            label: t("common.detail"),
          },
          {
            disabled: previewDisabled,
            key: "preview",
            label: queryBlockReason ? (
              <Tooltip
                title={t(
                  queryBlockReason === "missing"
                    ? "dataCatalog.actions.previewMissingHint"
                    : queryBlockReason === "disabled"
                      ? "dataCatalog.actions.previewDisabledHint"
                      : queryBlockReason === "stale"
                        ? "dataCatalog.actions.previewStaleHint"
                        : "dataCatalog.actions.previewMetadataUnavailableHint",
                )}
              >
                <span>{previewLabel}</span>
              </Tooltip>
            ) : (
              previewLabel
            ),
          },
        ];
        if (canManageResourceTasks) {
          moreItems.push({
            disabled: indexDisabled,
            key: "index",
            label: queryBlockReason ? (
              <Tooltip
                title={t(
                  queryBlockReason === "missing"
                    ? "dataCatalog.actions.indexMissingHint"
                    : queryBlockReason === "disabled"
                      ? "dataCatalog.actions.indexDisabledHint"
                      : queryBlockReason === "stale"
                        ? "dataCatalog.actions.indexStaleHint"
                        : "dataCatalog.actions.indexMetadataUnavailableHint",
                )}
              >
                <span>{indexLabel}</span>
              </Tooltip>
            ) : (
              indexLabel
            ),
          });
        }
        if (canAuthorizeGrants && !catalog.internal) {
          // 读这张表的数据是表一级的授权,和目录一级的管理动词分开(bkn-foundry#986)。
          moreItems.push({ key: "authorize", label: t("dataCatalog.catalog.authorize") });
        }
        if (!catalog.internal) {
          moreItems.push({
            key: "semantic-understanding",
            label: (
              <span className="console-tab-with-tier">
                {t("dataCatalog.resourceWorkspace.tabSemanticUnderstanding")}
                <EditionBadge capability={CAPABILITIES.SEMANTIC_TASK} edition="professional" />
              </span>
            ),
          });
        }

        return (
          <Space className={styles.actionGroup} size={4}>
            <Dropdown
              menu={{
                items: moreItems,
                onClick: ({ key, domEvent }) => {
                  domEvent.stopPropagation();
                  if (key === "detail") {
                    onOpenResource(record.id, "detail");
                    return;
                  }
                  if (key === "preview") {
                    onOpenResource(record.id, "preview");
                    return;
                  }
                  if (key === "index") {
                    onOpenResource(record.id, "index");
                    return;
                  }
                  if (key === "authorize") {
                    void navigate(
                      `/system/authorizations/new?object=${encodeURIComponent(`resource::${record.id}`)}`,
                      { state: { objectGrantReturnTo: `${location.pathname}${location.search}` } },
                    );
                    return;
                  }
                  if (key === "semantic-understanding") {
                    onOpenResource(record.id, "semantic-understanding");
                  }
                },
              }}
              trigger={["click"]}
            >
              <AppButton
                aria-label={t("dataCatalog.actions.more")}
                className={styles.actionMore}
                icon={<EllipsisOutlined />}
                onClick={(event) => event.stopPropagation()}
                title={blockedByDisabledCatalog ? t("dataCatalog.gate.catalogDisabledShort") : undefined}
                type="link"
              />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <section className={styles.contentSurface}>
      {showOperationBar ? <div className={styles.operationBar}>
        <div className={styles.operationPrimary}>
          <div className={styles.toolbarActions}>
            {dataCatalogCreationAvailable && !physical && !catalog.internal ? (
              <PermissionGate permissions="catalog:resource_manage">
                <AppButton onClick={() => onCreateResource(catalog.id)} type="primary">
                  {t("dataCatalog.resource.create")}
                </AppButton>
              </PermissionGate>
            ) : null}
            {/*
              授权在抽屉里当场做完,走 /me/object-grants 自助面。原先这里跳系统管理的对象授权页,
              那张页面打的是 /admin/object-grants,整组挂在 RequireAdmin 后面——建这个连接的人
              够不到,而按钮本身又门控在 admin-authz:grant 上,于是"自己建的目录自己授不了"。
              判定改成问这个目录自己的 operations:建目录时创建者就拿到了 authorize,
              管理员则继续走平台点位。
            */}
            {canAuthorizeCatalog ? (
              <AppButton icon={<KeyOutlined />} onClick={() => setAuthorizeOpen(true)}>
                {t("dataCatalog.catalog.authorize")}
              </AppButton>
            ) : null}
          </div>
        </div>
        {resourceTotal > 0 || hasResourceQuery ? (
          <>
            <Input
              allowClear
              className={styles.searchInput}
              onChange={(event) => setResourceKeyword(event.target.value)}
              placeholder={t("dataCatalog.resource.searchPlaceholder")}
              prefix={<SearchOutlined className={styles.searchIcon} />}
              value={resourceKeyword}
            />
            <div className={styles.toolbarFilters}>
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
            {showIndexState ? (
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
            ) : null}
            </div>
          </>
        ) : null}
      </div> : null}

      <TableSurface className={styles.tableSurface}>
        {resourcesLoading ? (
          <div className={styles.tableLoading}>
            <Spin />
          </div>
        ) : resourceLoadError ? (
          <Alert
            action={
              <AppButton onClick={() => setReloadKey((value) => value + 1)} type="link">
                {t("common.retry")}
              </AppButton>
            }
            message={resourceLoadError}
            showIcon
            type="error"
          />
        ) : resourceTotal === 0 && !hasResourceQuery ? (
          <EmptyStatePanel
            action={
              physical ? (
                <AppButton
                  onClick={() => {
                    void navigate(`/data-connect/discover?catalogId=${catalog.id}`);
                  }}
                  type="primary"
                >
                  {t("dataCatalog.catalog.goDiscoverToDiscover")}
                </AppButton>
              ) : !physical && !catalog.internal ? (
                dataCatalogCreationAvailable ? (
                  <PermissionGate permissions="catalog:resource_manage">
                    <AppButton onClick={() => onCreateResource(catalog.id)} type="primary">
                      {t("dataCatalog.resource.create")}
                    </AppButton>
                  </PermissionGate>
                ) : null
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
        ) : displayResources.length === 0 ? (
          <EmptyStatePanel
            description={t("dataCatalog.resource.noMatch")}
            icon={<DatabaseOutlined />}
            title={t("dataCatalog.catalog.resourceSection")}
          />
        ) : (
          <AppTable<CatalogResource>
            columns={resourceColumns}
            dataSource={displayResources}
            locale={{ emptyText: t("dataCatalog.resource.noMatch") }}
            pagination={false}
            rowKey="id"
            scroll={{ x: 1040 }}
            tableLayout="fixed"
          />
        )}
      </TableSurface>

      {resourceTotal > 0 ? (
        <TablePaginationBar
          current={page}
          onChange={(nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          }}
          pageSize={pageSize}
          showSizeChanger
          showTotal={(count) => t("common.total", { total: count })}
          total={showIndexState && indexFilter ? displayResources.length : resourceTotal}
        />
      ) : null}

      <ObjectAuthorizeDrawer
        objectAuthorized={ownsCatalogAuthorize}
        objId={catalog.id}
        objName={catalog.name}
        objType="catalog"
        onClose={() => setAuthorizeOpen(false)}
        open={authorizeOpen}
      />
    </section>
  );
}

export default CatalogDetailPanel;
