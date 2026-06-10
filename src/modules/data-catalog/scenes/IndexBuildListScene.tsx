import { ReloadOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Input, Modal, Select, Space } from "antd";
import type { ColumnsType } from "antd/es/table";
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
import { BuildTaskDetailModal } from "@/modules/data-catalog/components/BuildTaskDetailModal";
import { BuildTaskModal } from "@/modules/data-catalog/components/BuildTaskModal";
import { resourceGateOf } from "@/modules/data-catalog/lib/index-state";
import {
  listBuildTasks,
  pauseBuildTask,
  resumeBuildTask,
  retryBuildTask,
} from "@/modules/data-catalog/services/build-task.service";
import { subscribeMockDb } from "@/modules/data-catalog/services/mock-db";
import { listCatalogResources } from "@/modules/data-catalog/services/resource.service";
import type {
  BuildTask,
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
  const { message } = useAppServices();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [resources, setResources] = useState<CatalogResource[]>([]);
  const [catalogs, setCatalogs] = useState<DataConnectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<BuildTaskStatus>();
  const [detailTask, setDetailTask] = useState<BuildTask | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedResourceId, setPickedResourceId] = useState<string>();
  const [buildResource, setBuildResource] = useState<CatalogResource | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [taskResult, resourceResult, catalogResult] = await Promise.all([
        listBuildTasks(),
        listCatalogResources(),
        listDataConnectRecords({ keyword: "", page: 1, pageSize: 200 }),
      ]);
      setTasks(taskResult);
      setResources(resourceResult);
      setCatalogs(catalogResult.items);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

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
    const timer = window.setInterval(() => void loadData(), 4000);
    return () => window.clearInterval(timer);
  }, [hasActive, loadData]);

  const resourceMap = useMemo(
    () => new Map(resources.map((resource) => [resource.id, resource])),
    [resources],
  );
  const catalogMap = useMemo(
    () => new Map(catalogs.map((catalog) => [catalog.id, catalog])),
    [catalogs],
  );

  const filteredTasks = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return tasks.filter((task) => {
      const resource = resourceMap.get(task.resourceId);
      const matchesKeyword =
        query.length === 0 ||
        task.id.toLowerCase().includes(query) ||
        (resource?.name.toLowerCase().includes(query) ?? false);
      const matchesStatus = !statusFilter || task.status === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [keyword, resourceMap, statusFilter, tasks]);

  const gateOf = (task: BuildTask) => {
    const resource = resourceMap.get(task.resourceId);
    return resourceGateOf(resource ? (catalogMap.get(resource.catalogId) ?? null) : null);
  };

  const handlePauseResume = async (task: BuildTask) => {
    try {
      if (task.status === "listening") {
        await pauseBuildTask(task.id);
        message.success(t("dataCatalog.task.paused"));
      } else {
        await resumeBuildTask(task.id);
        message.success(t("dataCatalog.task.resumed"));
      }
      await loadData();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    }
  };

  const handleRetry = async (task: BuildTask) => {
    try {
      const next = await retryBuildTask(task.id);
      if (next) {
        message.success(t("dataCatalog.task.retried", { id: next.id }));
      }
      await loadData();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    }
  };

  const columns: ColumnsType<BuildTask> = [
    {
      dataIndex: "id",
      title: t("dataCatalog.task.column"),
      render: (_, record) => (
        <div style={{ display: "grid", gap: 4 }}>
          <span className={styles.slugChip}>{record.id}</span>
          <span style={{ color: "#8b98ac", fontSize: 12 }}>{record.createTime}</span>
        </div>
      ),
    },
    {
      dataIndex: "resourceId",
      title: t("dataCatalog.build.resource"),
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
      title: t("dataCatalog.build.mode"),
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
      title: t("common.status"),
      render: (value: BuildTaskStatus) => (
        <span
          className={[
            styles.tag,
            value === "failed"
              ? styles.taskFailed
              : value === "succeeded"
                ? styles.taskSucceeded
                : value === "listening"
                  ? styles.modeStreaming
                  : value === "running"
                    ? styles.taskRunning
                    : styles.taskPending,
          ].join(" ")}
        >
          {t(`dataCatalog.task.statuses.${value}`)}
        </span>
      ),
    },
    {
      key: "progress",
      title: t("dataCatalog.task.progress"),
      render: (_, record) => <BuildProgress task={record} />,
    },
    {
      key: "embedding",
      title: "Embedding",
      render: (_, record) => (
        <div style={{ display: "grid", gap: 4 }}>
          <span className={styles.chipRow}>
            {record.embeddingFields.map((field) => (
              <span className={styles.fieldChip} key={field}>
                {field}
              </span>
            ))}
          </span>
          <span style={{ color: "#8b98ac", fontSize: 12 }}>
            {record.embeddingModel} · {record.modelDimensions}d
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_, record) => (
        <Space>
          <AppButton onClick={() => setDetailTask(record)} type="link">
            {t("common.detail")}
          </AppButton>
          {record.status === "listening" || record.status === "paused" ? (
            <PermissionGate permissions="resource:task_manage">
              <AppButton
                disabled={record.status === "paused" && !gateOf(record).ok}
                onClick={() => void handlePauseResume(record)}
                type="link"
              >
                {record.status === "listening"
                  ? t("dataCatalog.task.pauseListening")
                  : t("dataCatalog.task.resumeListening")}
              </AppButton>
            </PermissionGate>
          ) : null}
          {record.status === "failed" ? (
            <PermissionGate permissions="resource:task_manage">
              <AppButton
                disabled={!gateOf(record).ok}
                onClick={() => void handleRetry(record)}
                type="link"
              >
                {t("dataCatalog.task.rebuild")}
              </AppButton>
            </PermissionGate>
          ) : null}
        </Space>
      ),
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
            onChange={(value) => setStatusFilter(value)}
            options={STATUS_OPTIONS.map((status) => ({
              label: t(`dataCatalog.task.statuses.${status}`),
              value: status,
            }))}
            placeholder={t("dataCatalog.task.statusFilterPlaceholder")}
            value={statusFilter}
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
            pagination={false}
            rowKey="id"
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
