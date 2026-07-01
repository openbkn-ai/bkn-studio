/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined } from "@ant-design/icons";
import { Alert, Spin } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { BuildTaskDetailModal } from "@/modules/data-catalog/components/BuildTaskDetailModal";
import { BuildTaskModal } from "@/modules/data-catalog/components/BuildTaskModal";
import { CatalogDetailPanel } from "@/modules/data-catalog/components/CatalogDetailPanel";
import {
  CatalogTreePanel,
  type CatalogTreeSelection,
} from "@/modules/data-catalog/components/CatalogTreePanel";
import { DataPreviewModal } from "@/modules/data-catalog/components/DataPreviewModal";
import { ResourceDetailPanel } from "@/modules/data-catalog/components/ResourceDetailPanel";
import { ResourceFormDrawer } from "@/modules/data-catalog/components/ResourceFormDrawer";
import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import { subscribeMockDb } from "@/modules/data-catalog/services/mock-db";
import {
  getCatalogResource,
  isCatalogScanning,
  listCatalogResources,
  listCatalogScans,
} from "@/modules/data-catalog/services/resource.service";
import type {
  BuildTask,
  CatalogResource,
  CatalogScanRecord,
} from "@/modules/data-catalog/types/data-catalog";
import {
  listDataConnectConnectorTypes,
  listDataConnectRecords,
} from "@/modules/data-connect/services/data-connect.service";
import type {
  DataConnectConnectorType,
  DataConnectRecord,
} from "@/modules/data-connect/types/data-connect";

import styles from "./DataCatalogScene.module.css";

export type DataCatalogSceneProps = {
  selection: CatalogTreeSelection | null;
};

export function DataCatalogScene({ selection }: DataCatalogSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [catalogs, setCatalogs] = useState<DataConnectRecord[]>([]);
  const [connectorTypes, setConnectorTypes] = useState<DataConnectConnectorType[]>([]);
  const [resources, setResources] = useState<CatalogResource[]>([]);
  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [scans, setScans] = useState<CatalogScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [resourceDrawer, setResourceDrawer] = useState<{
    catalogId?: string;
    open: boolean;
  }>({ open: false });
  const [previewResource, setPreviewResource] = useState<CatalogResource | null>(null);
  const [buildResource, setBuildResource] = useState<CatalogResource | null>(null);
  const [detailTask, setDetailTask] = useState<BuildTask | null>(null);

  const selectedCatalog = useMemo(() => {
    if (selection?.type === "catalog") {
      return catalogs.find((item) => item.id === selection.id) ?? null;
    }
    if (selection?.type === "resource") {
      const resource = resources.find((item) => item.id === selection.id);
      return resource
        ? (catalogs.find((item) => item.id === resource.catalogId) ?? null)
        : null;
    }
    return null;
  }, [catalogs, resources, selection]);

  // 列表接口不返回 schema_definition,详情页需单独拉取补全 schema
  const [resourceDetail, setResourceDetail] = useState<CatalogResource | null>(null);

  useEffect(() => {
    if (selection?.type !== "resource") {
      setResourceDetail(null);
      return;
    }

    let cancelled = false;
    getCatalogResource(selection.id)
      .then((detail) => {
        if (!cancelled) {
          setResourceDetail(detail);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResourceDetail(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selection]);

  const selectedResource = useMemo(() => {
    if (selection?.type !== "resource") {
      return null;
    }
    const listItem = resources.find((item) => item.id === selection.id) ?? null;
    if (resourceDetail?.id === selection.id) {
      return listItem ? { ...listItem, ...resourceDetail } : resourceDetail;
    }
    return listItem;
  }, [resourceDetail, resources, selection]);

  const loadAll = useCallback(async () => {
    setLoadError(null);
    try {
      const [catalogResult, resourceResult, taskResult, typeResult] = await Promise.all([
        listDataConnectRecords({ keyword: "", page: 1, pageSize: 200 }),
        listCatalogResources(),
        listBuildTasks(),
        connectorTypes.length === 0
          ? listDataConnectConnectorTypes()
          : Promise.resolve(null),
      ]);

      setCatalogs(catalogResult.items);
      setResources(resourceResult);
      setTasks(taskResult);
      if (typeResult) {
        setConnectorTypes(typeResult);
      }
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [connectorTypes.length]);

  const loadScans = useCallback(async () => {
    if (!selectedCatalog) {
      setScans([]);
      return;
    }
    try {
      setScans(await listCatalogScans(selectedCatalog.id));
    } catch {
      setScans([]);
    }
  }, [selectedCatalog]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void loadScans();
  }, [loadScans]);

  // mock 数据变更(构建进度 / 扫描完成 / 监听增量)即时刷新;真实后端走下方轮询
  useEffect(() => {
    return subscribeMockDb(() => {
      void loadAll();
      void loadScans();
    });
  }, [loadAll, loadScans]);

  const hasActiveWork = useMemo(
    () =>
      tasks.some(
        (task) =>
          task.status === "pending" ||
          task.status === "running" ||
          task.status === "listening",
      ) || scans.some((scan) => scan.status === "running"),
    [scans, tasks],
  );

  // 轮询只刷新会变化的任务/扫描;失败保留旧数据等下一轮
  const pollActive = useCallback(async () => {
    try {
      setTasks(await listBuildTasks());
    } catch {
      // ignore
    }
    void loadScans();
  }, [loadScans]);

  useEffect(() => {
    if (!hasActiveWork) {
      return;
    }
    const timer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      void pollActive();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [hasActiveWork, pollActive]);

  // 活跃任务全部结束时整体刷一次,带回资源行数 / 索引状态等结果数据
  const prevActiveRef = useRef(hasActiveWork);
  useEffect(() => {
    if (prevActiveRef.current && !hasActiveWork) {
      void loadAll();
    }
    prevActiveRef.current = hasActiveWork;
  }, [hasActiveWork, loadAll]);

  // 无选中时默认选第一个物理数据源(与树形分组一致,物理优先);无物理时退回第一个 catalog
  useEffect(() => {
    if (loading || selection || catalogs.length === 0) {
      return;
    }
    const target = catalogs.find((item) => item.type !== "logical") ?? catalogs[0];
    void navigate(`/data-catalog/catalog/${target.id}`, { replace: true });
  }, [catalogs, loading, navigate, selection]);

  const scanningCatalogIds = useMemo(() => {
    const ids = catalogs
      .filter((catalog) => isCatalogScanning(catalog.id))
      .map((catalog) => catalog.id);
    if (
      selectedCatalog &&
      scans.some((scan) => scan.status === "running") &&
      !ids.includes(selectedCatalog.id)
    ) {
      ids.push(selectedCatalog.id);
    }
    return ids;
  }, [catalogs, scans, selectedCatalog]);

  const selectedCatalogResources = useMemo(
    () =>
      selectedCatalog
        ? resources.filter((resource) => resource.catalogId === selectedCatalog.id)
        : [],
    [resources, selectedCatalog],
  );

  const selectedResourceTasks = useMemo(
    () =>
      selectedResource
        ? tasks.filter((task) => task.resourceId === selectedResource.id)
        : [],
    [selectedResource, tasks],
  );

  const detailTaskResource = useMemo(
    () =>
      detailTask
        ? (resources.find((item) => item.id === detailTask.resourceId) ?? null)
        : null,
    [detailTask, resources],
  );

  const renderDetail = () => {
    if (loading) {
      return (
        <div className={styles.placeholder}>
          <Spin />
        </div>
      );
    }

    if (loadError) {
      return (
        <Alert
          action={
            <AppButton onClick={() => void loadAll()} type="link">
              {t("common.retry")}
            </AppButton>
          }
          message={loadError}
          showIcon
          type="error"
        />
      );
    }

    if (catalogs.length === 0) {
      return (
        <EmptyStatePanel
          action={
            <AppButton
              onClick={() => {
                void navigate("/data-connect/new");
              }}
              type="primary"
            >
              {t("dataCatalog.tree.newConnection")}
            </AppButton>
          }
          description={t("dataCatalog.emptyDescription")}
          icon={<DatabaseOutlined />}
          title={t("dataCatalog.tree.empty")}
        />
      );
    }

    if (selection?.type === "resource") {
      if (!selectedResource) {
        return (
          <EmptyStatePanel
            action={
              <AppButton
                onClick={() => {
                  void navigate("/data-catalog");
                }}
              >
                {t("dataCatalog.backToCatalog")}
              </AppButton>
            }
            description=""
            icon={<DatabaseOutlined />}
            title={t("dataCatalog.resource.notFound")}
          />
        );
      }

      return (
        <ResourceDetailPanel
          catalog={selectedCatalog}
          onBuild={(resource) => setBuildResource(resource)}
          onOpenTask={(task) => setDetailTask(task)}
          onPreview={(resource) => setPreviewResource(resource)}
          onRefresh={async () => {
            await loadAll();
            await loadScans();
          }}
          resource={selectedResource}
          tasks={selectedResourceTasks}
        />
      );
    }

    if (selectedCatalog) {
      return (
        <CatalogDetailPanel
          catalog={selectedCatalog}
          connectorTypes={connectorTypes}
          onBuildResource={(resource) => setBuildResource(resource)}
          onCreateResource={(catalogId) => setResourceDrawer({ catalogId, open: true })}
          onRefresh={async () => {
            await loadAll();
            await loadScans();
          }}
          onSelectResource={(resourceId) => {
            void navigate(`/data-catalog/resource/${resourceId}`);
          }}
          resources={selectedCatalogResources}
          scanning={scanningCatalogIds.includes(selectedCatalog.id)}
          scans={scans}
          tasks={tasks}
        />
      );
    }

    return (
      <EmptyStatePanel
        description=""
        icon={<DatabaseOutlined />}
        title={t("dataCatalog.catalog.notFound")}
      />
    );
  };

  return (
    <>
      <div className={styles.explorer}>
        <CatalogTreePanel
          catalogs={catalogs}
          onCreateConnection={() => {
            void navigate("/data-connect/new");
          }}
          onCreateResource={(catalogId) => setResourceDrawer({ catalogId, open: true })}
          onSelectCatalog={(catalogId) => {
            void navigate(`/data-catalog/catalog/${catalogId}`);
          }}
          onSelectResource={(resourceId) => {
            void navigate(`/data-catalog/resource/${resourceId}`);
          }}
          resources={resources}
          scanningCatalogIds={scanningCatalogIds}
          selection={selection}
          tasks={tasks}
        />
        <section className={styles.detailSurface}>{renderDetail()}</section>
      </div>

      <ResourceFormDrawer
        catalogs={catalogs}
        defaultCatalogId={resourceDrawer.catalogId}
        onClose={() => setResourceDrawer({ open: false })}
        onCreated={(resource) => {
          void loadAll();
          void navigate(`/data-catalog/resource/${resource.id}`);
        }}
        open={resourceDrawer.open}
      />

      {previewResource ? (
        <DataPreviewModal
          onClose={() => setPreviewResource(null)}
          open
          resource={previewResource}
        />
      ) : null}

      {buildResource ? (
        <BuildTaskModal
          onClose={() => setBuildResource(null)}
          onCreated={() => {
            void loadAll();
          }}
          open
          resource={buildResource}
        />
      ) : null}

      {detailTask ? (
        <BuildTaskDetailModal
          onClose={() => setDetailTask(null)}
          open
          resource={detailTaskResource}
          task={detailTask}
        />
      ) : null}
    </>
  );
}
