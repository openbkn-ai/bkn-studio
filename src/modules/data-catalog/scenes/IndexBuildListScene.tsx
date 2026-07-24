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
import { Alert, Dropdown, Select, Space, Tooltip } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  getCatalogResource,
  listCatalogResourcePage,
} from "@/modules/data-catalog/services/resource.service";
import type {
  BuildMode,
  BuildTask,
  BuildTaskOrderBy,
  BuildTaskPageQuery,
  BuildTaskStatus,
} from "@/modules/data-catalog/types/data-catalog";
import { getCatalog, listCatalogs } from "@/shared/catalog";
import type { CatalogRecord } from "@/shared/catalog";

import sceneStyles from "./IndexBuildListScene.module.css";
import taskPanelStyles from "./TaskManagementTaskPanels.module.css";

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

export function IndexBuildListScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [taskColumnWidth, setTaskColumnWidth] = useState(() => {
    try {
      const value = window.localStorage.getItem("index-builds.colWidth.task");
      const parsed = value ? Number(value) : NaN;
      return Number.isFinite(parsed) && parsed >= 120 ? parsed : 152;
    } catch {
      return 152;
    }
  });
  const [resourceColumnWidth, setResourceColumnWidth] = useState(() => {
    try {
      const value = window.localStorage.getItem("index-builds.colWidth.resource");
      const parsed = value ? Number(value) : NaN;
      return Number.isFinite(parsed) && parsed >= 160 ? parsed : 240;
    } catch {
      return 240;
    }
  });
  const resizingRef = useRef<{ key: "task" | "resource"; startX: number; startWidth: number } | null>(
    null,
  );

  const listFilters = useMemo(
    () => readIndexBuildListFilters(searchParams),
    [searchParams],
  );

  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<CatalogRecord[]>([]);
  const [resourceOptions, setResourceOptions] = useState<{ label: string; value: string }[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [resourceSearch, setResourceSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      mode: listFilters.mode,
      resourceId: listFilters.resourceId,
      statuses: listFilters.statuses.length === 0 ? undefined : listFilters.statuses,
    }),
    [listFilters.catalogId, listFilters.mode, listFilters.resourceId, listFilters.statuses, order, orderBy, page, pageSize],
  );

  const updateListFilters = useCallback(
    (patch: Partial<typeof listFilters>) => {
      const next = applyIndexBuildListFilters(searchParams, {
        catalogId: "catalogId" in patch ? patch.catalogId : listFilters.catalogId,
        mode: "mode" in patch ? patch.mode : listFilters.mode,
        resourceId: "resourceId" in patch ? patch.resourceId : listFilters.resourceId,
        statuses: "statuses" in patch ? patch.statuses! : listFilters.statuses,
      });
      setSearchParams(next, { replace: true });
      setPage(1);
    },
    [listFilters, searchParams, setSearchParams],
  );

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const taskResult = await listBuildTaskPage(taskQuery);
      setTasks(taskResult.items);
      setTotal(taskResult.total);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [taskQuery]);

  // 轮询只刷新当前页任务，避免随着资源量增加而放大请求量。
  const refreshTasksSilently = useCallback(async () => {
    try {
      const result = await listBuildTaskPage(taskQuery);
      setTasks(result.items);
      setTotal(result.total);
    } catch {
      // 轮询失败保留旧数据,等下一轮
    }
  }, [taskQuery]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => subscribeMockDb(() => void loadTasks()), [loadTasks]);

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
      void refreshTasksSilently();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [hasActive, refreshTasksSilently]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listCatalogs({ keyword: catalogSearch, page: 1, pageSize: 50, type: "all" })
        .then((result) => setCatalogOptions(result.items))
        .catch(() => setCatalogOptions([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [catalogSearch]);

  useEffect(() => {
    if (!listFilters.catalogId) {
      setResourceOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void listCatalogResourcePage({
        catalogId: listFilters.catalogId,
        keyword: resourceSearch,
        limit: 50,
        offset: 0,
      })
        .then((result) =>
          setResourceOptions(result.items.map((resource) => ({ label: resource.name, value: resource.id }))),
        )
        .catch(() => setResourceOptions([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [listFilters.catalogId, resourceSearch]);

  useEffect(() => {
    if (!listFilters.catalogId || catalogOptions.some((item) => item.id === listFilters.catalogId)) {
      return;
    }
    void getCatalog(listFilters.catalogId).then((catalog) => {
      if (catalog) setCatalogOptions((items) => [catalog, ...items]);
    }).catch(() => undefined);
  }, [catalogOptions, listFilters.catalogId]);

  useEffect(() => {
    if (!listFilters.resourceId || resourceOptions.some((item) => item.value === listFilters.resourceId)) {
      return;
    }
    void getCatalogResource(listFilters.resourceId).then((resource) => {
      if (resource) {
        setResourceOptions((items) => [{ label: resource.name, value: resource.id }, ...items]);
      }
    }).catch(() => undefined);
  }, [listFilters.resourceId, resourceOptions]);

  const { pauseOrResume: handlePauseResume, remove: handleDelete, retry: handleRetry } =
    useBuildTaskActions(loadTasks);

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
        await loadTasks();
      },
    });
  };

  const sortOrderOf = (key: BuildTaskOrderBy): "ascend" | "descend" | null =>
    orderBy === key ? (order === "asc" ? "ascend" : "descend") : null;

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!resizingRef.current) {
        return;
      }
      const delta = event.clientX - resizingRef.current.startX;
      const next = Math.max(120, resizingRef.current.startWidth + delta);
      if (resizingRef.current.key === "task") {
        setTaskColumnWidth(next);
      } else {
        setResourceColumnWidth(Math.max(160, next));
      }
    };

    const handleUp = () => {
      if (!resizingRef.current) {
        return;
      }
      const current = resizingRef.current;
      resizingRef.current = null;
      try {
        const width = current.key === "task" ? taskColumnWidth : resourceColumnWidth;
        window.localStorage.setItem(`index-builds.colWidth.${current.key}`, String(width));
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
  }, [resourceColumnWidth, taskColumnWidth]);

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
      width: taskColumnWidth,
      onHeaderCell: () => ({ style: { position: "relative" } }),
      title: (
        <div className={sceneStyles.resizableHeader}>
          <span>{t("dataCatalog.taskManagement.columns.task")}</span>
          <span
            className={sceneStyles.resizeHandle}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              resizingRef.current = { key: "task", startX: event.clientX, startWidth: taskColumnWidth };
            }}
            role="separator"
          />
        </div>
      ),
      render: (value: string) => <EllipsisText text={value} />,
    },
    {
      dataIndex: "catalogId",
      title: t("dataCatalog.resource.catalog"),
      width: 180,
      render: (value: string | undefined, record) => {
        const catalogId = value ?? record.catalogId;
        if (!catalogId) {
          return "-";
        }
        const label = record.catalogName ?? catalogId;
        return (
          <Tooltip title={label}>
            <button
              className={sceneStyles.textLink}
              onClick={() => void navigate(`/data-directory/catalog/${catalogId}`)}
              type="button"
            >
              <span className={sceneStyles.cellEllipsis}>{label}</span>
            </button>
          </Tooltip>
        );
      },
    },
    {
      dataIndex: "resourceId",
      width: resourceColumnWidth,
      onHeaderCell: () => ({ style: { position: "relative" } }),
      title: (
        <div className={sceneStyles.resizableHeader}>
          <span>{t("dataCatalog.build.resource")}</span>
          <span
            className={sceneStyles.resizeHandle}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              resizingRef.current = {
                key: "resource",
                startX: event.clientX,
                startWidth: resourceColumnWidth,
              };
            }}
            role="separator"
          />
        </div>
      ),
      render: (value: string, record) => {
        const label = record.resourceName ?? value;
        return value ? (
          <Tooltip title={label}>
            <button
              className={sceneStyles.textLink}
              onClick={() => {
                void navigate(`/data-directory/resource/${value}?tab=index`);
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
      title: t("dataCatalog.build.mode"),
      width: 108,
      onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (value: BuildTask["mode"]) => (
        <EllipsisText text={t(`dataCatalog.modes.${value}`)} />
      ),
    },
    {
      dataIndex: "status",
      title: t("common.status"),
      width: 116,
      render: (_value: BuildTaskStatus, record) => <BuildStatusTag plain task={record} />,
    },
    {
      key: "progress",
      title: t("dataCatalog.task.progress"),
      width: 196,
      onCell: () => ({ className: sceneStyles.progressCell }),
      render: (_, record) => <BuildProgress compact task={record} />,
    },
    {
      dataIndex: "createTime",
      key: "created_at",
      title: t("dataCatalog.task.createTime"),
      width: 180,
      sorter: true,
      sortOrder: sortOrderOf("created_at"),
      render: (value: string) => <EllipsisText text={value} />,
    },
    {
      key: "actions",
      title: t("common.actions"),
      width: 160,
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
                  <AppButton type="link">
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
      <div className={taskPanelStyles.operationBar}>
        <Space>
            <AppButton icon={<ReloadOutlined />} onClick={() => void loadTasks()}>
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
        </Space>
        <Space className={sceneStyles.taskFilters}>
            <Select
              allowClear
              className={taskPanelStyles.select}
              filterOption={false}
              onChange={(value) => {
                setResourceSearch("");
                updateListFilters({
                  catalogId: value ?? undefined,
                  resourceId: undefined,
                });
              }}
              onSearch={setCatalogSearch}
              options={catalogOptions.map((catalog) => ({ label: catalog.name, value: catalog.id }))}
              placeholder={t("dataCatalog.resource.catalog")}
              showSearch
              value={listFilters.catalogId ?? null}
            />
            <Select
              allowClear
              className={taskPanelStyles.select}
              disabled={!listFilters.catalogId && !listFilters.resourceId}
              filterOption={false}
              onChange={(value) => {
                updateListFilters({ resourceId: value ?? undefined });
              }}
              onSearch={setResourceSearch}
              options={resourceOptions}
              placeholder={t("dataCatalog.build.resource")}
              showSearch
              value={listFilters.resourceId ?? null}
            />
            <Select
              allowClear
              className={taskPanelStyles.select}
              onChange={(value: BuildMode | undefined) => {
                updateListFilters({ mode: value });
              }}
              options={["batch", "streaming"].map((value) => ({
                label: t(`dataCatalog.modes.${value}`),
                value,
              }))}
              placeholder={t("dataCatalog.build.mode")}
              value={listFilters.mode ?? null}
            />
            <Select
              allowClear
              className={taskPanelStyles.select}
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
              placeholder={t("common.status")}
              value={listFilters.statuses}
            />
        </Space>
      </div>

      <TableSurface className={sceneStyles.tableSurface}>
        {loadError ? (
          <Alert
            action={
              <AppButton onClick={() => void loadTasks()} type="link">
                {t("common.retry")}
              </AppButton>
            }
            message={loadError}
            showIcon
            type="error"
          />
        ) : !loading && tasks.length === 0 ? (
          <EmptyStatePanel
            description={t("dataCatalog.task.emptyDescription")}
            icon={<UnorderedListOutlined />}
            title={t("dataCatalog.task.empty")}
          />
        ) : (
          <AppTable<BuildTask>
            columns={columns}
            dataSource={tasks}
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
          resource={null}
          task={detailTask}
        />
      ) : null}
    </section>
  );
}
