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
import { subscribeMockDb } from "@/modules/data-catalog/services/mock-db";
import {
  countCatalogResources,
  isCatalogDiscovering,
  listCatalogDiscovers,
} from "@/modules/data-catalog/services/resource.service";
import type { CatalogDiscoverRecord } from "@/modules/data-catalog/types/data-catalog";
import { listDataConnectConnectorTypes } from "@/modules/data-connect/services/data-connect.service";
import type { DataConnectConnectorType } from "@/modules/data-connect/types/data-connect";
import { catalogListAllQuery, getCatalog, listCatalogs, type CatalogRecord } from "@/shared/catalog";

import styles from "./DataCatalogScene.module.css";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

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

  const loadCatalogs = useCallback(async () => {
    const [catalogResult, typeResult] = await Promise.all([
      listCatalogs(catalogListAllQuery()),
      listDataConnectConnectorTypes(),
    ]);
    setCatalogs(catalogResult.items);
    setConnectorTypes(typeResult);
  }, []);

  const loadCatalogSchemas = useCallback(async (catalogId: string) => {
    const catalog = await getCatalog(catalogId);
    const schemas = catalog?.metadata.schemas;
    return Array.isArray(schemas)
      ? schemas.filter((schema): schema is string => typeof schema === "string")
      : [];
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
      void loadDiscovers();
    });
  }, [loadAll, loadDiscovers]);

  const hasActiveWork = useMemo(
    () => discover.some((discover) => discover.status === "running"),
    [discover],
  );

  const pollActive = useCallback(() => {
    void loadDiscovers();
  }, [loadDiscovers]);

  useEffect(() => {
    if (useMock || !hasActiveWork) {
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
    void navigate(`/data-catalog/catalog/${target.id}`, { replace: true });
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
      params.set("tab", tab);
      if (tab === "index" && indexView === "config") {
        params.set("view", "config");
      }
      const query = params.toString();
      void navigate(`/data-catalog/resource/${resourceId}${query ? `?${query}` : ""}`);
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
                void navigate("/data-catalog");
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
          onLoadCatalogSchemas={loadCatalogSchemas}
          onSelectCatalog={(catalogId) => {
            const next = new URLSearchParams(searchParams);
            next.delete("schema");
            setSearchParams(next, { replace: true });
            void navigate(`/data-catalog/catalog/${catalogId}`);
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
            openResourceWorkspace(resource.id);
          }}
        open={resourceDrawer.open}
      />
    </>
  );
}
