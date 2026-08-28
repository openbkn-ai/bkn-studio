/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  EllipsisOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Alert, Dropdown, Select, Space, Tooltip, type MenuProps } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { formatDateTimeYmdHms } from "@/framework/i18n/format";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { collectVisiblePage, pagerTotal } from "@/modules/data-catalog/lib/visible-page";
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
  deleteBuildTask,
  listBuildTaskPage,
} from "@/modules/data-catalog/services/build-task.service";
import { subscribeMockDb } from "@/modules/data-catalog/services/mock-db";
import type {
  BuildMode,
  BuildTask,
  BuildTaskExecuteType,
  BuildTaskPageQuery,
  BuildTaskSort,
  BuildTaskStatus,
} from "@/modules/data-catalog/types/data-catalog";
import { isActiveBuildTask } from "@/modules/data-catalog/utils/build-task-guards";

import sceneStyles from "./IndexBuildListScene.module.css";
import taskPanelStyles from "./TaskManagementTaskPanels.module.css";

const STATUS_OPTIONS: BuildTaskStatus[] = [
  "pending",
  "running",
  "stopping",
  "stopped",
  "completed",
  "failed",
  "cancelled",
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
  const { message, modal, runtimeConfig } = useAppServices();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const listFilters = useMemo(
    () => readIndexBuildListFilters(searchParams),
    [searchParams],
  );

  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<BuildTaskSort>("create_time");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  // Page cursors into the raw (unfiltered) space: offsets[n] starts page n+1, because the backend
  // filters after paging and a page number alone cannot say where its rows begin (#977). Held in a
  // ref, not state — loading a page writes the next cursor, so as state it would re-create the
  // loader that produced it and the effect below would load forever.
  const offsetsRef = useRef<number[]>([0]);
  const [hasMore, setHasMore] = useState(false);
  const [rawTotal, setRawTotal] = useState(0);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const canManageResourceTasks = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: "catalog:task_manage",
  });

  // Query parameters for server pagination, sorting, and status filtering.
  const taskQuery = useMemo<BuildTaskPageQuery>(
    () => ({
      page,
      pageSize,
      sort,
      direction,
      executeType: listFilters.executeType,
      mode: listFilters.mode,
      statuses: listFilters.statuses.length === 0 ? undefined : listFilters.statuses,
    }),
    [
      direction,
      listFilters.executeType,
      listFilters.mode,
      listFilters.statuses,
      page,
      pageSize,
      sort,
    ],
  );

  const updateListFilters = useCallback(
    (patch: Partial<typeof listFilters>) => {
      const next = applyIndexBuildListFilters(searchParams, {
        executeType: "executeType" in patch ? patch.executeType : listFilters.executeType,
        mode: "mode" in patch ? patch.mode : listFilters.mode,
        statuses: "statuses" in patch ? patch.statuses! : listFilters.statuses,
      });
      setSearchParams(next, { replace: true });
      offsetsRef.current = [0];
      setPage(1);
    },
    [listFilters, searchParams, setSearchParams],
  );

  const readPage = useCallback(
    async (startOffset: number) =>
      collectVisiblePage(
        (offset, limit) =>
          listBuildTaskPage({ ...taskQuery, limit, offset }).then((result) => ({
            items: result.items,
            total: result.total,
          })),
        { pageSize, startOffset },
      ),
    [pageSize, taskQuery],
  );

  const applyPage = useCallback(
    (result: Awaited<ReturnType<typeof readPage>>) => {
      setTasks(result.items);
      setRawTotal(result.rawTotal);
      // A spent request budget is not the end of the list: the next page stays reachable.
      setHasMore(!result.exhausted);
      offsetsRef.current[page] = result.nextOffset;
    },
    [page],
  );

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      applyPage(await readPage(offsetsRef.current[page - 1] ?? 0));
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [applyPage, page, readPage]);

  // Poll only tasks on the current page to prevent request volume growing with resource count.
  const refreshTasksSilently = useCallback(async () => {
    try {
      applyPage(await readPage(offsetsRef.current[page - 1] ?? 0));
    } catch {
      // Retain existing data when polling fails and wait for the next cycle.
    }
  }, [applyPage, page, readPage]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => subscribeMockDb(() => void loadTasks()), [loadTasks]);

  const hasActive = useMemo(() => tasks.some(isActiveBuildTask), [tasks]);

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
              stopFirst: isActiveBuildTask(task),
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

  const sortOrderOf = (key: BuildTaskSort): "ascend" | "descend" | null =>
    sort === key ? (direction === "asc" ? "ascend" : "descend") : null;

  // Header sorting follows the shared task-list sort/direction contract.
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
      setSort("create_time");
      setDirection("desc");
    } else {
      setSort(single.columnKey as BuildTaskSort);
      setDirection(single.order === "ascend" ? "asc" : "desc");
    }
    setPage(1);
  };

  const columns: ColumnsType<BuildTask> = [
    {
      dataIndex: "id",
      width: 160,
      title: t("dataCatalog.taskManagement.columns.task"),
      render: (value: string) => <EllipsisText text={value} />,
    },
    {
      dataIndex: "catalogId",
      title: t("dataCatalog.taskManagement.columns.catalog"),
      width: 160,
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
      width: 160,
      title: t("dataCatalog.taskManagement.columns.resource"),
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
      width: 100,
      onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (value: BuildTask["mode"]) => (
        <EllipsisText text={t(`dataCatalog.modes.${value}`)} />
      ),
    },
    {
      dataIndex: "executeType",
      title: t("dataCatalog.build.executeType"),
      width: 100,
      onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_value: BuildTask["executeType"], record) => (
        <EllipsisText
          text={
            record.mode === "batch"
              ? record.executeType === "incremental"
                ? t("dataCatalog.build.executeIncremental")
                : record.executeType === "full"
                  ? t("dataCatalog.build.executeFull")
                  : "-"
              : "-"
          }
        />
      ),
    },
    {
      dataIndex: "status",
      title: t("dataCatalog.task.detailSections.status"),
      width: 120,
      render: (_value: BuildTaskStatus, record) => <BuildStatusTag task={record} />,
    },
    {
      key: "progress",
      title: t("dataCatalog.task.progress"),
      width: 200,
      onCell: () => ({ className: sceneStyles.progressCell }),
      render: (_, record) => <BuildProgress compact task={record} />,
    },
    {
      dataIndex: "lastProgressTime",
      key: "last_progress_time",
      title: t("dataCatalog.task.fields.lastProgressTime"),
      width: 180,
      sorter: true,
      sortOrder: sortOrderOf("last_progress_time"),
      render: (value: number | null) => <EllipsisText text={formatDateTimeYmdHms(value || undefined)} />,
    },
    {
      dataIndex: "finishTime",
      key: "finish_time",
      title: t("dataCatalog.task.finishedAt"),
      width: 180,
      sorter: true,
      sortOrder: sortOrderOf("finish_time"),
      render: (value: number | null) => <EllipsisText text={formatDateTimeYmdHms(value || undefined)} />,
    },
    {
      align: "center",
      key: "actions",
      title: t("common.actions"),
      width: 84,
      fixed: "right",
      render: (_, record) => {
        const pauseResumeLabel =
          record.status === "stopped"
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

        const menuItems: NonNullable<MenuProps["items"]> = [{ key: "detail", label: t("common.detail") }];
        if (
          canManageResourceTasks &&
          (record.status === "running" ||
            record.status === "pending" ||
            record.status === "stopped")
        ) {
          menuItems.push({ key: "pauseResume", label: pauseResumeLabel });
        }
        if (canManageResourceTasks && record.status === "failed") {
          menuItems.push({ key: "retry", label: t("dataCatalog.task.rerun") });
        }
        if (canManageResourceTasks && record.status !== "stopping") {
          menuItems.push({ danger: true, key: "delete", label: t("common.delete") });
        }

        return (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === "detail") {
                  setDetailTaskId(record.id);
                  return;
                }
                if (key === "pauseResume") {
                  void handlePauseResume(record);
                  return;
                }
                if (key === "retry") {
                  void handleRetry(record);
                  return;
                }
                if (key === "delete") {
                  handleDelete(record);
                }
              },
            }}
            trigger={["click"]}
          >
            <AppButton aria-label={t("dataConnect.moreActions")} className={sceneStyles.actionMore} icon={<EllipsisOutlined />} type="link" />
          </Dropdown>
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
            <PermissionGate permissions="catalog:task_manage">
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
              onChange={(value: BuildTaskExecuteType | undefined) => {
                updateListFilters({ executeType: value });
              }}
              options={["full", "incremental"].map((value) => ({
                label: t(value === "incremental"
                  ? "dataCatalog.build.executeIncremental"
                  : "dataCatalog.build.executeFull"),
                value,
              }))}
              placeholder={t("dataCatalog.build.executeType")}
              value={listFilters.executeType ?? null}
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
                label: t(`dataCatalog.task.statuses.${status}`),
                value: status,
              }))}
              placeholder={t("dataCatalog.task.detailSections.status")}
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
            description={
              rawTotal > 0
                ? t("dataCatalog.task.emptyUnauthorizedDescription")
                : t("dataCatalog.task.emptyDescription")
            }
            icon={<UnorderedListOutlined />}
            title={rawTotal > 0 ? t("dataCatalog.task.emptyVisible") : t("dataCatalog.task.empty")}
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
      {tasks.length > 0 || page > 1 || hasMore ? (
        <TablePaginationBar
          current={page}
          onChange={(nextPage, nextPageSize) => {
            if (nextPageSize !== pageSize) {
              offsetsRef.current = [0];
              setPage(1);
              setPageSize(nextPageSize);
              return;
            }
            // Only a page whose cursor is known can be entered, which is this one or the next.
            setPage(Math.min(nextPage, page + 1));
          }}
          pageSize={pageSize}
          showSizeChanger
          // The backend's count includes tasks this account cannot see, so it is not shown as a total.
          showTotal={() => t("dataCatalog.task.visibleCount", { count: tasks.length })}
          total={pagerTotal({ hasMore, loaded: tasks.length, page, pageSize })}
        />
      ) : null}

      {detailTaskId ? (
        <BuildTaskDetailDrawer
          onClose={() => setDetailTaskId(null)}
          open
          resource={null}
          taskId={detailTaskId}
        />
      ) : null}
    </section>
  );
}
