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

import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
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
  isCatalogDiscovering,
  listCatalogDiscovers,
} from "@/modules/data-catalog/services/resource.service";
import type {
  BuildTask,
  CatalogDiscoverRecord,
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
  const { runtimeConfig } = useAppServices();
  const [searchParams, setSearchParams] = useSearchParams();
  // A user who cannot create a connection sees an empty list because nothing has
  // been granted to them, not because the platform is empty (#986). Offering
  // "new connection" there sends them to a page they cannot use.
  const canCreateCatalog = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: "catalog:create",
  });
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
  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [discover, setDiscovers] = useState<CatalogDiscoverRecord[]>([]);
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

  const loadCatalogTasks = useCallback(async (catalogId?: string) => {
    if (!catalogId) {
      setTasks([]);
      return;
    }
    setTasks(await listBuildTasks({ catalogId }));
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

  const loadDiscovers = useCallback(async () => {
    if (!selectedCatalog) {
      setDiscovers([]);
      return;
    }
    try {
      setDiscovers(await listCatalogDiscovers(selectedCatalog.id));
    } catch {
      setDiscovers([]);
    }
  }, [selectedCatalog]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void loadDiscovers();
  }, [loadDiscovers]);

  useEffect(() => {
    return subscribeMockDb(() => {
      void loadAll();
      if (selectedCatalogId) {
        void loadCatalogTasks(selectedCatalogId);
      }
      void loadDiscovers();
    });
  }, [loadAll, loadCatalogTasks, loadDiscovers, selectedCatalogId]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!selectedCatalogId) {
      setTasks([]);
      return;
    }

    void loadCatalogTasks(selectedCatalogId);
  }, [loadCatalogTasks, loading, selectedCatalogId]);

  const hasActiveWork = useMemo(
    () =>
      tasks.some(
        (task) =>
          task.status === "pending" ||
          task.status === "running" ||
          task.status === "listening",
      ) || discover.some((discover) => discover.status === "running"),
    [discover, tasks],
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
    void loadDiscovers();
  }, [loadDiscovers, selectedCatalogId]);

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

  const discoveringCatalogIds = useMemo(() => {
    const ids = catalogs
      .filter((catalog) => isCatalogDiscovering(catalog.id))
      .map((catalog) => catalog.id);
    if (
      selectedCatalog &&
      discover.some((discover) => discover.status === "running") &&
      !ids.includes(selectedCatalog.id)
    ) {
      ids.push(selectedCatalog.id);
    }
    return ids;
  }, [catalogs, discover, selectedCatalog]);

  const openResourceWorkspace = useCallback(
    (
      resourceId: string,
      tab: "detail" | "index" | "preview" | "semantic-understanding" = "detail",
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
      if (!canCreateCatalog) {
        return (
          <EmptyStatePanel
            description={t("dataCatalog.unauthorizedDescription")}
            icon={<DatabaseOutlined />}
            title={t("dataCatalog.unauthorizedTitle")}
          />
        );
      }
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
          description={t("dataCatalog.catalog.selectPhysicalDescription")}
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
          activeSchema={activeSchema}
          connectorTypes={connectorTypes}
          collapsed={treeCollapsed}
          onRefresh={async () => {
            await loadAll();
          }}
          onSelectCatalog={(catalogId) => {
            const next = new URLSearchParams(searchParams);
            next.delete("schema");
            setSearchParams(next, { replace: true });
            void navigate(`/data-directory/catalog/${catalogId}`);
          }}
          onSelectScope={(scope) => {
            const next = new URLSearchParams(searchParams);
            if (!scope) {
              next.delete("schema");
            } else {
              next.set("schema", scope.schema);
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
          discoveringCatalogIds={discoveringCatalogIds}
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
            void loadCatalogTasks(selectedCatalogId);
          }
          openResourceWorkspace(resource.id);
        }}
        open={resourceDrawer.open}
      />
    </>
  );
}
