/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined } from "@ant-design/icons";
import { Alert, Spin } from "antd";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import {
  CatalogTreePanel,
  type CatalogTreeSelection,
} from "@/modules/data-catalog/components/CatalogTreePanel";
import { ResourceFormDrawer } from "@/modules/data-catalog/components/ResourceFormDrawer";
import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import { subscribeMockDb } from "@/modules/data-catalog/services/mock-db";
import {
  countCatalogResources,
  isCatalogScanning,
  listCatalogResources,
  listCatalogScans,
} from "@/modules/data-catalog/services/resource.service";
import type {
  BuildTask,
  CatalogResource,
  CatalogScanRecord,
} from "@/modules/data-catalog/types/data-catalog";
import { listDataConnectConnectorTypes } from "@/modules/data-connect/services/data-connect.service";
import type { DataConnectConnectorType } from "@/modules/data-connect/types/data-connect";
import { catalogListAllQuery, listCatalogs, type CatalogRecord } from "@/shared/catalog";

import styles from "./DataCatalogScene.module.css";

const CatalogDetailPanel = lazy(
  () => import("@/modules/data-catalog/components/CatalogDetailPanel"),
);

export type DataCatalogSceneProps = {
  selection: CatalogTreeSelection | null;
  suppressAutoSelect?: boolean;
};

export function DataCatalogScene({
  selection,
  suppressAutoSelect = false,
}: DataCatalogSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeDb = searchParams.get("db")?.trim() || "";
  const activeSchema = searchParams.get("schema")?.trim() || "";
  const [treeCollapsed, setTreeCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("data-catalog.treeCollapsed") === "1";
    } catch {
      return false;
    }
  });

  const [catalogs, setCatalogs] = useState<CatalogRecord[]>([]);
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
    setResourceTotal(await countCatalogResources());
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
      return;
    }

    void loadCatalogDetail(selectedCatalogId);
  }, [loadCatalogDetail, loading, selectedCatalogId]);

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

  const prevActiveRef = useRef(hasActiveWork);
  useEffect(() => {
    if (prevActiveRef.current && !hasActiveWork) {
      void loadAll();
    }
    prevActiveRef.current = hasActiveWork;
  }, [hasActiveWork, loadAll]);

  useLayoutEffect(() => {
    if (loading || selection || catalogs.length === 0 || suppressAutoSelect) {
      return;
    }
    const target = catalogs.find((item) => item.type !== "logical") ?? catalogs[0];
    void navigate(`/data-directory/catalog/${target.id}`, { replace: true });
  }, [catalogs, loading, navigate, selection, suppressAutoSelect]);

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

  const openResourceWorkspace = useCallback(
    (
      resourceId: string,
      tab: "detail" | "index" | "preview" = "detail",
      indexView?: "config",
    ) => {
      const params = new URLSearchParams();
      if (tab !== "detail") {
        params.set("tab", tab);
      }
      if (tab === "index" && indexView === "config") {
        params.set("view", "config");
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
        <Suspense
          fallback={
            <div className={styles.placeholder}>
              <Spin />
            </div>
          }
        >
          <CatalogDetailPanel
            catalog={selectedCatalog}
            onCreateResource={(catalogId) => setResourceDrawer({ catalogId, open: true })}
            onOpenResource={openResourceWorkspace}
            tasks={tasks}
          />
        </Suspense>
      );
    }

    if (suppressAutoSelect) {
      return (
        <EmptyStatePanel
          description="请从左侧物理数据源树中选择一个数据连接。"
          icon={<DatabaseOutlined />}
          title={t("dataCatalog.title")}
        />
      );
    }

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
      <div className={[styles.explorer, treeCollapsed ? styles.explorerCollapsed : ""].join(" ")}>
        <CatalogTreePanel
          catalogs={catalogs}
          activeDb={activeDb}
          activeSchema={activeSchema}
          connectorTypes={connectorTypes}
          collapsed={treeCollapsed}
          onRefresh={async () => {
            await loadAll();
          }}
          onSelectCatalog={(catalogId) => {
            const next = new URLSearchParams(searchParams);
            next.delete("db");
            next.delete("schema");
            setSearchParams(next, { replace: true });
            void navigate(`/data-directory/catalog/${catalogId}`);
          }}
          onSelectScope={(scope) => {
            const next = new URLSearchParams(searchParams);
            if (!scope?.database) {
              next.delete("db");
              next.delete("schema");
            } else {
              next.set("db", scope.database);
              if (scope.schema) {
                next.set("schema", scope.schema);
              } else {
                next.delete("schema");
              }
            }
            setSearchParams(next, { replace: true });
          }}
          onToggleCollapsed={() => {
            setTreeCollapsed((value) => {
              const next = !value;
              try {
                window.localStorage.setItem("data-catalog.treeCollapsed", next ? "1" : "0");
              } catch {
                // ignore
              }
              return next;
            });
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
