/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Alert, Dropdown, Input, Select, Space, Tooltip } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { BuildProgress } from "@/modules/data-catalog/components/BuildProgress";
import { BuildStatusTag } from "@/modules/data-catalog/components/BuildStatusTag";
import { BuildTaskDetailDrawer } from "@/modules/data-catalog/components/BuildTaskDetailDrawer";
import { useBuildTaskActions } from "@/modules/data-catalog/hooks/use-build-task-actions";
import { resourceGateOf } from "@/modules/data-catalog/lib/index-state";
import {
  applyIndexBuildListFilters,
  readIndexBuildListFilters,
} from "@/modules/data-catalog/lib/index-build-filters";
import {
  type BuildExecuteType,
  deleteBuildTask,
  listBuildTaskPage,
} from "@/modules/data-catalog/services/build-task.service";
import { subscribeMockDb } from "@/modules/data-catalog/services/mock-db";
import { listCatalogResources } from "@/modules/data-catalog/services/resource.service";
import type {
  BuildTask,
  BuildTaskOrderBy,
  BuildTaskPageQuery,
  BuildTaskStatus,
  CatalogResource,
} from "@/modules/data-catalog/types/data-catalog";
import { catalogListAllQuery, listCatalogs } from "@/shared/catalog";
import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";

import sceneStyles from "./IndexBuildListScene.module.css";

const STATUS_OPTIONS: BuildTaskStatus[] = [
  "pending",
  "running",
  "listening",
  "paused",
  "succeeded",
  "failed",
];

function EllipsisText({ text, title }: { text: string; title?: string }) {
  return (
    <Tooltip title={title ?? text}>
      <span className={sceneStyles.cellEllipsis}>{text}</span>
    </Tooltip>
  );
}

function formatIndexTypes(record: BuildTask) {
  const parts: string[] = [];
  if (record.embeddingFields.length > 0) {
    parts.push("embedding");
  }
  if (record.fulltextFields.length > 0) {
    parts.push("fulltext");
  }
  return parts.length > 0 ? parts.join(", ") : "—";
}

export function IndexBuildListScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const listFilters = useMemo(
    () => readIndexBuildListFilters(searchParams),
    [searchParams],
  );

  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [resources, setResources] = useState<CatalogResource[]>([]);
  const [catalogs, setCatalogs] = useState<DataConnectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [orderBy, setOrderBy] = useState<BuildTaskOrderBy>("default");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [total, setTotal] = useState(0);
  const [detailTask, setDetailTask] = useState<BuildTask | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // 服务端分页 + 排序 + 状态过滤的查询参数。
  const taskQuery = useMemo<BuildTaskPageQuery>(
    () => ({
      page,
      pageSize,
      orderBy,
      order,
      catalogId: listFilters.catalogId,
      resourceId: listFilters.resourceId,
      statuses: listFilters.statuses.length === 0 ? undefined : listFilters.statuses,
    }),
    [listFilters.catalogId, listFilters.resourceId, listFilters.statuses, order, orderBy, page, pageSize],
  );

  const updateListFilters = useCallback(
    (patch: Partial<typeof listFilters>) => {
      const next = applyIndexBuildListFilters(searchParams, {
        catalogId: "catalogId" in patch ? patch.catalogId : listFilters.catalogId,
        resourceId: "resourceId" in patch ? patch.resourceId : listFilters.resourceId,
        statuses: "statuses" in patch ? patch.statuses! : listFilters.statuses,
      });
      setSearchParams(next, { replace: true });
      setPage(1);
    },
    [listFilters, searchParams, setSearchParams],
  );

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [taskResult, resourceResult, catalogResult] = await Promise.all([
        listBuildTaskPage(taskQuery),
        listCatalogResources(),
        listCatalogs(catalogListAllQuery()),
      ]);
      setTasks(taskResult.items);
      setTotal(taskResult.total);
      setResources(resourceResult);
      setCatalogs(catalogResult.items);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [taskQuery]);

  // 轮询只刷新当前页任务;资源/连接等静态数据进页和手动刷新时才拉
  const loadTasks = useCallback(async () => {
    try {
      const result = await listBuildTaskPage(taskQuery);
      setTasks(result.items);
      setTotal(result.total);
    } catch {
      // 轮询失败保留旧数据,等下一轮
    }
  }, [taskQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => subscribeMockDb(() => void loadData()), [loadData]);

  const hasActive = useMemo(
    () =>
      tasks.some(
        (task) =>
          task.status === "pending" ||
          task.status === "running" ||
          task.status === "listening",
      ),
    [tasks],
  );

  useEffect(() => {
    if (!hasActive) {
      return;
    }
    const timer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      void loadTasks();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [hasActive, loadTasks]);

  const resourceMap = useMemo(
    () => new Map(resources.map((resource) => [resource.id, resource])),
    [resources],
  );
  const catalogMap = useMemo(
    () => new Map(catalogs.map((catalog) => [catalog.id, catalog])),
    [catalogs],
  );

  const resourceOptions = useMemo(() => {
    const items = listFilters.catalogId
      ? resources.filter((resource) => resource.catalogId === listFilters.catalogId)
      : resources;
    return items.map((resource) => ({
      label: resource.name,
      value: resource.id,
    }));
  }, [listFilters.catalogId, resources]);

  useEffect(() => {
    if (!listFilters.resourceId) {
      return;
    }
    const resource = resourceMap.get(listFilters.resourceId);
    if (!resource) {
      return;
    }
    if (listFilters.catalogId && resource.catalogId !== listFilters.catalogId) {
      updateListFilters({ resourceId: undefined });
    }
  }, [listFilters.catalogId, listFilters.resourceId, resourceMap, updateListFilters]);

  // 状态过滤/排序/分页已下沉服务端;此处只对「当前页」做关键字过滤。
  // TODO(后端): build-tasks 暂无 keyword 参数,搜索无法跨页;后端补 search 后改服务端。
  const filteredTasks = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (query.length === 0) {
      return tasks;
    }
    return tasks.filter((task) => {
      const resource = resourceMap.get(task.resourceId);
      return (
        task.id.toLowerCase().includes(query) ||
        (resource?.name.toLowerCase().includes(query) ?? false)
      );
    });
  }, [keyword, resourceMap, tasks]);

  const { pauseOrResume: handlePauseResume, remove: handleDelete, retry: handleRetry } =
    useBuildTaskActions(loadData);

  const gateOf = (task: BuildTask) => {
    const resource = resourceMap.get(task.resourceId);
    return resourceGateOf(resource ? (catalogMap.get(resource.catalogId) ?? null) : null);
  };

  const handleBatchDelete = () => {
    const targets = tasks.filter((task) => selectedKeys.includes(task.id));
    if (!targets.length) {
      return;
    }
    void modal.confirm({
      title: t("dataCatalog.task.batchDeleteConfirmTitle", { count: targets.length }),
      content: t("dataCatalog.task.batchDeleteConfirmContent"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        const results = await Promise.allSettled(
          targets.map((task) =>
            deleteBuildTask(task.id, {
              stopFirst: task.status === "running" || task.status === "listening",
            }),
          ),
        );
        const failed = results.filter((result) => result.status === "rejected").length;
        if (failed) {
          void message.error(
            t("dataCatalog.task.batchDeletePartial", { failed, total: targets.length }),
          );
        } else {
          message.success(t("common.success"));
        }
        setSelectedKeys([]);
        await loadData();
      },
    });
  };

  const sortOrderOf = (key: BuildTaskOrderBy): "ascend" | "descend" | null =>
    orderBy === key ? (order === "asc" ? "ascend" : "descend") : null;

  // 列头排序:有方向 → order_by=列key + order;清除 → 回 default(不显箭头)。
  const handleTableChange: TableProps<BuildTask>["onChange"] = (
    _pagination,
    _filters,
    sorter,
    extra,
  ) => {
    if (extra.action !== "sort") {
      return;
    }
    const single = Array.isArray(sorter) ? sorter[0] : sorter;
    if (!single || !single.order || !single.columnKey) {
      setOrderBy("default");
      setOrder("desc");
    } else {
      setOrderBy(single.columnKey as BuildTaskOrderBy);
      setOrder(single.order === "ascend" ? "asc" : "desc");
    }
    setPage(1);
  };

  const columns: ColumnsType<BuildTask> = [
    {
      dataIndex: "id",
      title: t("dataCatalog.task.column"),
      width: 152,
      render: (value: string) => <EllipsisText text={value} />,
    },
    {
      dataIndex: "resourceId",
      title: t("dataCatalog.build.resource"),
      render: (value: string) => {
        const resource = resourceMap.get(value);
        const label = resource?.name ?? value;
        return resource ? (
          <Tooltip title={label}>
            <button
              className={sceneStyles.textLink}
              onClick={() => {
                void navigate(`/data-directory/resource/${resource.id}?tab=index`);
              }}
              type="button"
            >
              <span className={sceneStyles.cellEllipsis}>{label}</span>
            </button>
          </Tooltip>
        ) : (
          <EllipsisText text={label} />
        );
      },
    },
    {
      dataIndex: "mode",
      key: "mode",
      title: t("dataCatalog.build.mode"),
      width: 108,
      onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
      sorter: true,
      sortOrder: sortOrderOf("mode"),
      render: (value: BuildTask["mode"]) => (
        <EllipsisText text={t(`dataCatalog.modes.${value}`)} />
      ),
    },
    {
      dataIndex: "status",
      key: "status",
      title: t("common.status"),
      width: 116,
      sorter: true,
      sortOrder: sortOrderOf("status"),
      render: (_value: BuildTaskStatus, record) => <BuildStatusTag plain task={record} />,
    },
    {
      dataIndex: "createTime",
      key: "created_at",
      title: t("dataCatalog.task.createTime"),
      width: 132,
      sorter: true,
      sortOrder: sortOrderOf("created_at"),
      render: (value: string) => <EllipsisText text={value} />,
    },
    {
      key: "progress",
      title: t("dataCatalog.task.progress"),
      width: 196,
      onCell: () => ({ className: sceneStyles.progressCell }),
      render: (_, record) => <BuildProgress compact task={record} />,
    },
    {
      key: "index",
      title: t("dataCatalog.task.indexColumn"),
      width: 88,
      render: (_, record) => <EllipsisText text={formatIndexTypes(record)} />,
    },
    {
      key: "actions",
      title: t("common.actions"),
      width: 220,
      fixed: "right",
      render: (_, record) => {
        const pauseResumeLabel =
          record.status === "paused"
            ? t(
                record.mode === "streaming"
                  ? "dataCatalog.task.resumeListening"
                  : "dataCatalog.task.resumeBuild",
              )
            : t(
                record.mode === "streaming"
                  ? "dataCatalog.task.pauseListening"
                  : "dataCatalog.task.stopBuild",
              );

        return (
          <Space className={sceneStyles.actionGroup} size={4}>
            <AppButton onClick={() => setDetailTask(record)} type="link">
              {t("common.detail")}
            </AppButton>
            {record.status === "running" ||
            record.status === "listening" ||
            record.status === "pending" ||
            record.status === "paused" ? (
              <PermissionGate permissions="resource:task_manage">
                <AppButton
                  disabled={record.status === "paused" && !gateOf(record).ok}
                  onClick={() => void handlePauseResume(record)}
                  type="link"
                >
                  {pauseResumeLabel}
                </AppButton>
              </PermissionGate>
            ) : null}
            {record.status === "failed" || record.status === "succeeded" ? (
              <PermissionGate permissions="resource:task_manage">
                <Dropdown
                  disabled={!gateOf(record).ok}
                  menu={{
                    items: [
                      {
                        key: "incremental",
                        label: t("dataCatalog.task.rebuildIncremental"),
                      },
                      {
                        key: "full",
                        label: t("dataCatalog.task.rebuildFull"),
                      },
                    ],
                    onClick: ({ key }) =>
                      void handleRetry(record, key as BuildExecuteType),
                  }}
                >
                  <AppButton disabled={!gateOf(record).ok} type="link">
                    {t("dataCatalog.task.rebuild")}
                  </AppButton>
                </Dropdown>
              </PermissionGate>
            ) : null}
            <PermissionGate permissions="resource:task_manage">
              <AppButton danger onClick={() => handleDelete(record)} type="link">
                {t("common.delete")}
              </AppButton>
            </PermissionGate>
          </Space>
        );
      },
    },
  ];

  return (
    <section className={sceneStyles.contentSurface}>
      <div className={sceneStyles.operationBar}>
        <div className={sceneStyles.operationPrimary}>
          <div className={sceneStyles.toolbarActions}>
            <AppButton icon={<ReloadOutlined />} onClick={() => void loadData()}>
              {t("common.refresh")}
            </AppButton>
            <PermissionGate permissions="resource:task_manage">
              <AppButton
                danger
                disabled={selectedKeys.length === 0}
                icon={<DeleteOutlined />}
                onClick={handleBatchDelete}
              >
                {selectedKeys.length > 0
                  ? `${t("dataCatalog.task.batchDelete")} (${selectedKeys.length})`
                  : t("dataCatalog.task.batchDelete")}
              </AppButton>
            </PermissionGate>
          </div>
        </div>
        <div className={sceneStyles.toolbarFilters}>
          <div className={sceneStyles.filterField}>
            <span className={sceneStyles.filterLabel}>{t("dataCatalog.resource.catalog")}</span>
            <Select
              allowClear
              className={sceneStyles.filterSelect}
              onChange={(value) => {
                updateListFilters({
                  catalogId: value ?? undefined,
                  resourceId: undefined,
                });
              }}
              options={catalogs.map((catalog) => ({
                label: catalog.name,
                value: catalog.id,
              }))}
              placeholder={t("common.all")}
              value={listFilters.catalogId ?? null}
            />
          </div>
          <div className={sceneStyles.filterField}>
            <span className={sceneStyles.filterLabel}>{t("dataCatalog.build.resource")}</span>
            <Select
              allowClear
              className={sceneStyles.filterSelectWide}
              onChange={(value) => {
                updateListFilters({ resourceId: value ?? undefined });
              }}
              options={resourceOptions}
              placeholder={t("common.all")}
              value={listFilters.resourceId ?? null}
            />
          </div>
          <div className={sceneStyles.filterField}>
            <span className={sceneStyles.filterLabel}>{t("common.status")}</span>
            <Select
              allowClear
              className={`${sceneStyles.filterSelect} ${sceneStyles.filterSelectMultiple}`}
              maxTagCount="responsive"
              mode="multiple"
              onChange={(value: BuildTaskStatus[]) => {
                updateListFilters({ statuses: value });
              }}
              options={STATUS_OPTIONS.map((status) => ({
                label:
                  status === "paused"
                    ? `${t("dataCatalog.task.statuses.paused")} / ${t("dataCatalog.task.statuses.stopped")}`
                    : t(`dataCatalog.task.statuses.${status}`),
                value: status,
              }))}
              placeholder={t("dataCatalog.task.statusFilterPlaceholder")}
              value={listFilters.statuses}
            />
          </div>
          <Input.Search
            allowClear
            className={sceneStyles.searchInput}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={setKeyword}
            placeholder={t("dataCatalog.task.searchPlaceholder")}
            value={keyword}
          />
        </div>
      </div>

      <TableSurface className={sceneStyles.tableSurface}>
        {loadError ? (
          <Alert
            action={
              <AppButton onClick={() => void loadData()} type="link">
                {t("common.retry")}
              </AppButton>
            }
            message={loadError}
            showIcon
            type="error"
          />
        ) : !loading && filteredTasks.length === 0 ? (
          <EmptyStatePanel
            description={t("dataCatalog.task.emptyDescription")}
            icon={<UnorderedListOutlined />}
            title={t("dataCatalog.task.empty")}
          />
        ) : (
          <AppTable<BuildTask>
            columns={columns}
            dataSource={filteredTasks}
            loading={loading}
            onChange={handleTableChange}
            pagination={false}
            rowKey="id"
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys.map(String)),
            }}
            tableLayout="fixed"
          />
        )}
      </TableSurface>
      {total > 0 ? (
        <TablePaginationBar
          current={page}
          onChange={(nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          }}
          pageSize={pageSize}
          showSizeChanger
          showTotal={(count) => t("common.total", { total: count })}
          total={total}
        />
      ) : null}

      {detailTask ? (
        <BuildTaskDetailDrawer
          onClose={() => setDetailTask(null)}
          open
          resource={resourceMap.get(detailTask.resourceId) ?? null}
          task={detailTask}
        />
      ) : null}
    </section>
  );
}
