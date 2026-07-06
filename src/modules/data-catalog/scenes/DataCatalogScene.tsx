/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined } from "@ant-design/icons";
import { Alert, Spin } from "antd";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { CatalogDetailPanel } from "@/modules/data-catalog/components/CatalogDetailPanel";
import {
  CatalogTreePanel,
  type CatalogTreeSelection,
} from "@/modules/data-catalog/components/CatalogTreePanel";
import { ResourceFormDrawer } from "@/modules/data-catalog/components/ResourceFormDrawer";
import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import { subscribeMockDb } from "@/modules/data-catalog/services/mock-db";
import {
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
} from "@/modules/data-connect/services/data-connect.service";
import type {
  DataConnectConnectorType,
  DataConnectRecord,
} from "@/modules/data-connect/types/data-connect";
import { catalogListAllQuery, listCatalogs } from "@/shared/catalog";

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
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [resourceDrawer, setResourceDrawer] = useState<{
    catalogId?: string;
    open: boolean;
  }>({ open: false });
  const [resourceTotal, setResourceTotal] = useState(0);

  const selectedCatalog = useMemo(() => {
    if (selection?.type === "catalog") {
      return catalogs.find((item) => item.id === selection.id) ?? null;
    }
    return null;
  }, [catalogs, selection]);

  const selectedCatalogId = selectedCatalog?.id;

  const loadCatalogs = useCallback(async () => {
    const [catalogResult, typeResult] = await Promise.all([
      listCatalogs(catalogListAllQuery()),
      connectorTypes.length === 0
        ? listDataConnectConnectorTypes()
        : Promise.resolve(null),
    ]);
    setCatalogs(catalogResult.items);
    if (typeResult) {
      setConnectorTypes(typeResult);
    }
  }, [connectorTypes.length]);

  const loadCatalogDetail = useCallback(async (catalogId?: string) => {
    if (!catalogId) {
      setResources([]);
      setTasks([]);
      return;
    }
    const [nextResources, nextTasks] = await Promise.all([
      listCatalogResources({ catalogId }),
      listBuildTasks({ catalogId }),
    ]);
    setResources(nextResources);
    setTasks(nextTasks);
  }, []);

  const refreshResourceTotal = useCallback(async () => {
    const items = await listCatalogResources();
    setResourceTotal(items.length);
  }, []);

  const loadAll = useCallback(async () => {
    setLoadError(null);
    try {
      await loadCatalogs();
      await refreshResourceTotal();
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [loadCatalogs, refreshResourceTotal]);

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
      if (selectedCatalogId) {
        void loadCatalogDetail(selectedCatalogId);
      }
      void loadScans();
    });
  }, [loadAll, loadCatalogDetail, loadScans, selectedCatalogId]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!selectedCatalogId) {
      setResources([]);
      setTasks([]);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    void loadCatalogDetail(selectedCatalogId).finally(() => {
      if (!cancelled) {
        setDetailLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadCatalogDetail, loading, selectedCatalogId]);

  useLayoutEffect(() => {
    if (!loading && selectedCatalogId) {
      setDetailLoading(true);
    }
  }, [loading, selectedCatalogId]);

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
    if (!selectedCatalogId) {
      return;
    }
    try {
      setTasks(await listBuildTasks({ catalogId: selectedCatalogId }));
    } catch {
      // ignore
    }
    void loadScans();
  }, [loadScans, selectedCatalogId]);

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

  // 无选中时默认选第一个物理 catalog；用 layout effect 尽量在首帧绘制前跳转，避免闪空态。
  useLayoutEffect(() => {
    if (loading || selection || catalogs.length === 0) {
      return;
    }
    const target = catalogs.find((item) => item.type !== "logical") ?? catalogs[0];
    void navigate(`/data-directory/catalog/${target.id}`, { replace: true });
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

  const openResourceWorkspace = useCallback(
    (
      resourceId: string,
      tab: "detail" | "index" | "preview" = "detail",
      indexView?: "configure",
    ) => {
      const params = new URLSearchParams();
      if (tab !== "detail") {
        params.set("tab", tab);
      }
      if (tab === "index" && indexView === "configure") {
        params.set("view", "configure");
      }
      const query = params.toString();
      void navigate(`/data-directory/resource/${resourceId}${query ? `?${query}` : ""}`);
    },
    [navigate],
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

    if (selection?.type === "catalog" && !selectedCatalog) {
      return (
        <EmptyStatePanel
          action={
            <AppButton
              onClick={() => {
                void navigate("/data-directory");
              }}
            >
              {t("dataCatalog.backToCatalog")}
            </AppButton>
          }
          description=""
          icon={<DatabaseOutlined />}
          title={t("dataCatalog.catalog.notFound")}
        />
      );
    }

    if (selectedCatalog) {
      return (
        <CatalogDetailPanel
          catalog={selectedCatalog}
          onCreateResource={(catalogId) => setResourceDrawer({ catalogId, open: true })}
          onOpenResource={openResourceWorkspace}
          resources={selectedCatalogResources}
          resourcesLoading={detailLoading}
          tasks={tasks}
        />
      );
    }

    // /data-directory 根路径：等待默认 catalog 跳转，勿误报「未找到」。
    if (catalogs.length > 0) {
      return (
        <div className={styles.placeholder}>
          <Spin />
        </div>
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
          connectorTypes={connectorTypes}
          onRefresh={async () => {
            await loadAll();
          }}
          onSelectCatalog={(catalogId) => {
            void navigate(`/data-directory/catalog/${catalogId}`);
          }}
          resourceCount={resourceTotal}
          resources={resources}
          scanningCatalogIds={scanningCatalogIds}
          selection={selection}
        />
        <section className={styles.detailSurface}>{renderDetail()}</section>
      </div>

      <ResourceFormDrawer
        catalogs={catalogs}
        defaultCatalogId={resourceDrawer.catalogId}
        onClose={() => setResourceDrawer({ open: false })}
        onCreated={(resource) => {
          void refreshResourceTotal();
          if (selectedCatalogId) {
            void loadCatalogDetail(selectedCatalogId);
          }
          openResourceWorkspace(resource.id);
        }}
        open={resourceDrawer.open}
      />

    </>
  );
}
