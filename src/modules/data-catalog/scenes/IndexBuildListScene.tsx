/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RedoOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Alert, Dropdown, Input, Modal, Select, Space, Tooltip } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { BuildProgress } from "@/modules/data-catalog/components/BuildProgress";
import { BuildStatusTag } from "@/modules/data-catalog/components/BuildStatusTag";
import { BuildTaskDetailModal } from "@/modules/data-catalog/components/BuildTaskDetailModal";
import { BuildTaskModal } from "@/modules/data-catalog/components/BuildTaskModal";
import { resourceGateOf } from "@/modules/data-catalog/lib/index-state";
import {
  type BuildExecuteType,
  deleteBuildTask,
  listBuildTaskPage,
  pauseBuildTask,
  resumeBuildTask,
  retryBuildTask,
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
import { listDataConnectRecords } from "@/modules/data-connect/services/data-connect.service";
import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";

import sceneStyles from "./IndexBuildListScene.module.css";
import styles from "../components/shared.module.css";

const STATUS_OPTIONS: BuildTaskStatus[] = [
  "pending",
  "running",
  "listening",
  "paused",
  "succeeded",
  "failed",
];

export function IndexBuildListScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [resources, setResources] = useState<CatalogResource[]>([]);
  const [catalogs, setCatalogs] = useState<DataConnectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statuses, setStatuses] = useState<BuildTaskStatus[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [orderBy, setOrderBy] = useState<BuildTaskOrderBy>("default");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [total, setTotal] = useState(0);
  const [detailTask, setDetailTask] = useState<BuildTask | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedResourceId, setPickedResourceId] = useState<string>();
  const [buildResource, setBuildResource] = useState<CatalogResource | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // 服务端分页 + 排序 + 状态过滤的查询参数。
  const taskQuery = useMemo<BuildTaskPageQuery>(
    () => ({
      page,
      pageSize,
      orderBy,
      order,
      statuses: statuses.length === 0 ? undefined : statuses,
    }),
    [order, orderBy, page, pageSize, statuses],
  );

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [taskResult, resourceResult, catalogResult] = await Promise.all([
        listBuildTaskPage(taskQuery),
        listCatalogResources(),
        listDataConnectRecords({ keyword: "", page: 1, pageSize: 200 }),
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

  const gateOf = (task: BuildTask) => {
    const resource = resourceMap.get(task.resourceId);
    return resourceGateOf(resource ? (catalogMap.get(resource.catalogId) ?? null) : null);
  };

  const handlePauseResume = async (task: BuildTask) => {
    const isStreaming = task.mode === "streaming";
    try {
      if (
        task.status === "listening" ||
        task.status === "running" ||
        task.status === "pending"
      ) {
        await pauseBuildTask(task.id);
        message.success(
          t(isStreaming ? "dataCatalog.task.paused" : "dataCatalog.task.stopped"),
        );
      } else {
        await resumeBuildTask(task.id);
        message.success(
          t(isStreaming ? "dataCatalog.task.resumed" : "dataCatalog.task.buildResumed"),
        );
      }
      await loadData();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    }
  };

  const handleRetry = async (task: BuildTask, executeType: BuildExecuteType) => {
    const run = async () => {
      try {
        const next = await retryBuildTask(task.id, executeType);
        if (next) {
          message.success(t("dataCatalog.task.retried", { id: next.id }));
        }
        await loadData();
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      }
    };
    // 全量重建先删旧索引再重建,重建完成前不可用 → 先确认;增量不 drop 索引,不弹。
    if (executeType === "full") {
      modal.confirm({
        title: t("dataCatalog.task.rebuildFullConfirmTitle"),
        content: t("dataCatalog.task.rebuildFullConfirmContent"),
        okText: t("common.confirm"),
        cancelText: t("common.cancel"),
        okButtonProps: { danger: true },
        onOk: run,
      });
      return;
    }
    await run();
  };

  const handleDelete = (task: BuildTask) => {
    const isActive = task.status === "running" || task.status === "listening";
    void modal.confirm({
      title: t("dataCatalog.task.deleteConfirmTitle", { id: task.id }),
      content: isActive
        ? t("dataCatalog.task.deleteConfirmContentActive")
        : t("dataCatalog.task.deleteConfirmContent"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteBuildTask(task.id, { stopFirst: isActive });
          message.success(t("common.success"));
          await loadData();
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        }
      },
    });
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
      width: 190,
      render: (value: string) => (
        // nowrap:auto 布局下 slug 不被 break-all 压成单字一列
        <span className={styles.slugChip} style={{ whiteSpace: "nowrap", wordBreak: "normal" }}>
          {value}
        </span>
      ),
    },
    {
      dataIndex: "resourceId",
      title: t("dataCatalog.build.resource"),
      // 给宽度 → auto 布局下不再独占剩余空间;窄屏靠 ellipsis 截断。
      width: 240,
      ellipsis: true,
      render: (value: string) => {
        const resource = resourceMap.get(value);
        return resource ? (
          <AppButton
            onClick={() => {
              void navigate(`/data-catalog/resource/${resource.id}`);
            }}
            style={{ padding: 0, height: "auto" }}
            type="link"
          >
            {resource.name}
          </AppButton>
        ) : (
          <span className={styles.slugChip}>{value}</span>
        );
      },
    },
    {
      dataIndex: "mode",
      key: "mode",
      title: t("dataCatalog.build.mode"),
      width: 110,
      onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
      sorter: true,
      sortOrder: sortOrderOf("mode"),
      render: (value: BuildTask["mode"]) => (
        <span
          className={[
            styles.tag,
            value === "batch" ? styles.modeBatch : styles.modeStreaming,
          ].join(" ")}
        >
          {t(`dataCatalog.modes.${value}`)}
        </span>
      ),
    },
    {
      dataIndex: "status",
      key: "status",
      title: t("common.status"),
      width: 190,
      sorter: true,
      sortOrder: sortOrderOf("status"),
      render: (_value: BuildTaskStatus, record) => <BuildStatusTag task={record} />,
    },
    {
      dataIndex: "createTime",
      key: "created_at",
      title: t("dataCatalog.task.createTime"),
      width: 160,
      sorter: true,
      sortOrder: sortOrderOf("created_at"),
      render: (value: string) => (
        <span style={{ color: "#4b5563", fontSize: 14 }}>{value}</span>
      ),
    },
    {
      key: "progress",
      title: t("dataCatalog.task.progress"),
      width: 200,
      render: (_, record) => <BuildProgress task={record} />,
    },
    {
      key: "index",
      title: t("dataCatalog.task.indexColumn"),
      width: 130,
      render: (_, record) => (
        <span className={styles.chipRow}>
          {record.embeddingFields.length > 0 ? (
            <span className={[styles.tag, styles.taskRunning].join(" ")}>embedding</span>
          ) : null}
          {record.fulltextFields.length > 0 ? (
            <span className={[styles.tag, styles.modeStreaming].join(" ")}>fulltext</span>
          ) : null}
          {record.embeddingFields.length === 0 && record.fulltextFields.length === 0 ? (
            <span style={{ color: "#6b7280", fontSize: 14 }}>—</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "actions",
      title: t("common.actions"),
      width: 150,
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
          <Space size={2}>
            <Tooltip title={t("common.detail")}>
              <AppButton
                aria-label={t("common.detail")}
                icon={<EyeOutlined />}
                onClick={() => setDetailTask(record)}
                type="text"
              />
            </Tooltip>
            {record.status === "running" ||
            record.status === "listening" ||
            record.status === "pending" ||
            record.status === "paused" ? (
              <PermissionGate permissions="resource:task_manage">
                <Tooltip title={pauseResumeLabel}>
                  <AppButton
                    aria-label={pauseResumeLabel}
                    disabled={record.status === "paused" && !gateOf(record).ok}
                    icon={
                      record.status === "paused" ? (
                        <PlayCircleOutlined />
                      ) : (
                        <PauseCircleOutlined />
                      )
                    }
                    onClick={() => void handlePauseResume(record)}
                    type="text"
                  />
                </Tooltip>
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
                  <AppButton
                    aria-label={t("dataCatalog.task.rebuild")}
                    disabled={!gateOf(record).ok}
                    icon={<RedoOutlined />}
                    type="text"
                  />
                </Dropdown>
              </PermissionGate>
            ) : null}
            <PermissionGate permissions="resource:task_manage">
              <Tooltip title={t("common.delete")}>
                <AppButton
                  aria-label={t("common.delete")}
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                  type="text"
                />
              </Tooltip>
            </PermissionGate>
          </Space>
        );
      },
    },
  ];

  const buildableResources = resources.filter(
    (resource) => resourceGateOf(catalogMap.get(resource.catalogId) ?? null).ok,
  );

  return (
    <section className={sceneStyles.contentSurface}>
      <div className={sceneStyles.operationBar}>
        <div className={sceneStyles.operationPrimary}>
          <div className={sceneStyles.toolbarActions}>
            <PermissionGate permissions="resource:task_manage">
              <AppButton
                icon={<ThunderboltOutlined />}
                onClick={() => {
                  setPickedResourceId(undefined);
                  setPickerOpen(true);
                }}
                type="primary"
              >
                {t("dataCatalog.task.create")}
              </AppButton>
            </PermissionGate>
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
          <span className={sceneStyles.toolbarMeta}>{t("dataCatalog.task.toolbarHint")}</span>
        </div>
        <div className={sceneStyles.toolbarFilters}>
          <Input.Search
            allowClear
            className={sceneStyles.searchInput}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={setKeyword}
            placeholder={t("dataCatalog.task.searchPlaceholder")}
            value={keyword}
          />
          <Select
            allowClear
            className={sceneStyles.filterSelect}
            mode="multiple"
            onChange={(value: BuildTaskStatus[]) => {
              setStatuses(value);
              setPage(1);
            }}
            options={STATUS_OPTIONS.map((status) => ({
              // paused 内部状态同时承载 streaming 暂停与 batch 停止
              label:
                status === "paused"
                  ? `${t("dataCatalog.task.statuses.paused")} / ${t("dataCatalog.task.statuses.stopped")}`
                  : t(`dataCatalog.task.statuses.${status}`),
              value: status,
            }))}
            placeholder={t("dataCatalog.task.statusFilterPlaceholder")}
            value={statuses}
          />
        </div>
      </div>
      <div className={sceneStyles.tableSurface}>
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
            action={
              <PermissionGate permissions="resource:task_manage">
                <AppButton onClick={() => setPickerOpen(true)} type="primary">
                  {t("dataCatalog.task.create")}
                </AppButton>
              </PermissionGate>
            }
            description={t("dataCatalog.task.emptyDescription")}
            icon={<ThunderboltOutlined />}
            title={t("dataCatalog.task.empty")}
          />
        ) : (
          <AppTable<BuildTask>
            columns={columns}
            dataSource={filteredTasks}
            loading={loading}
            onChange={handleTableChange}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (count) => t("common.total", { total: count }),
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              },
            }}
            rowKey="id"
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys.map(String)),
            }}
            tableLayout="auto"
          />
        )}
      </div>

      <Modal
        okButtonProps={{ disabled: !pickedResourceId }}
        okText={t("common.confirm")}
        onCancel={() => setPickerOpen(false)}
        onOk={() => {
          const resource = resources.find((item) => item.id === pickedResourceId);
          if (resource) {
            setBuildResource(resource);
            setPickerOpen(false);
          }
        }}
        open={pickerOpen}
        title={t("dataCatalog.task.pickResource")}
      >
        <Select
          onChange={(value) => setPickedResourceId(value)}
          optionFilterProp="label"
          options={buildableResources.map((resource) => {
            const catalog = catalogMap.get(resource.catalogId);
            return {
              label: `${catalog ? `${catalog.name} / ` : ""}${resource.name}(${t(
                `dataCatalog.categories.${resource.category}`,
              )})`,
              value: resource.id,
            };
          })}
          placeholder={t("dataCatalog.task.pickResourcePlaceholder")}
          showSearch
          style={{ width: "100%" }}
          value={pickedResourceId}
        />
        <div style={{ marginTop: 8, color: "#8b98ac", fontSize: 12 }}>
          {t("dataCatalog.build.resourceHint")}
        </div>
      </Modal>

      {buildResource ? (
        <BuildTaskModal
          onClose={() => setBuildResource(null)}
          onCreated={() => void loadData()}
          open
          resource={buildResource}
        />
      ) : null}

      {detailTask ? (
        <BuildTaskDetailModal
          onClose={() => setDetailTask(null)}
          open
          resource={resourceMap.get(detailTask.resourceId) ?? null}
          task={detailTask}
        />
      ) : null}
    </section>
  );
}
