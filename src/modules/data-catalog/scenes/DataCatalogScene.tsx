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
import {
  getCatalog,
  listCatalogConnectorTypeStats,
  listCatalogs,
  type CatalogConnectorTypeStat,
  type CatalogRecord,
} from "@/shared/catalog";

import styles from "./DataCatalogScene.module.css";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const CATALOG_PAGE_SIZE = 100;

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
  const [catalogKeyword, setCatalogKeyword] = useState("");
  const [catalogSearchInput, setCatalogSearchInput] = useState("");
  const [catalogSearchLoading, setCatalogSearchLoading] = useState(false);
  const [connectorTypeStats, setConnectorTypeStats] = useState<CatalogConnectorTypeStat[]>([]);
  const [selectedCatalogLoadingId, setSelectedCatalogLoadingId] = useState<string | null>(null);
  const [discover, setDiscovers] = useState<CatalogDiscoverRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [resourceDrawer, setResourceDrawer] = useState<{
    catalogId?: string;
    open: boolean;
  }>({ open: false });
  const [resourceTotal, setResourceTotal] = useState(0);
  const initialLoadRef = useRef(false);
  const catalogQueryGeneration = useRef(0);

  const selectedCatalog = useMemo(() => {
    if (selection?.type === "catalog") {
      return catalogs.find((item) => item.id === selection.id) ?? null;
    }
    return null;
  }, [catalogs, selection]);
  const selectedCatalogRequestIds = useRef(new Set<string>());
  const selectedCatalogIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedCatalogIdRef.current = selection?.type === "catalog" ? selection.id : null;
  }, [selection]);

  const loadCatalogs = useCallback(async (
    keyword = "",
    preservePhysicalCatalogs = true,
    generation = catalogQueryGeneration.current,
    applyKeyword = false,
  ) => {
    const [logicalCatalogResult, statsResult] = await Promise.all([
      listCatalogs({ keyword, page: 1, pageSize: CATALOG_PAGE_SIZE, type: "logical" }),
      listCatalogConnectorTypeStats(keyword),
    ]);
    if (generation !== catalogQueryGeneration.current) {
      return false;
    }
    setCatalogs((current) => [
      ...(preservePhysicalCatalogs ? current.filter((catalog) => catalog.type !== "logical") : []),
      ...logicalCatalogResult.items,
    ]);
    if (applyKeyword) {
      setCatalogKeyword(keyword);
    }
    setConnectorTypeStats(statsResult);
    return true;
  }, []);

  const loadCatalogsByConnectorType = useCallback(async (connectorType: string, offset = 0) => {
    const generation = catalogQueryGeneration.current;
    const type = connectorType ? "physical" : "logical";
    const result = await listCatalogs({
      connectorType,
      keyword: catalogKeyword,
      page: offset / CATALOG_PAGE_SIZE + 1,
      pageSize: CATALOG_PAGE_SIZE,
      type,
    });
    if (generation !== catalogQueryGeneration.current) {
      return;
    }
    setCatalogs((current) => [
      ...current.filter((catalog) =>
        offset > 0 || catalog.type !== type || (type === "physical" && catalog.connectorType !== connectorType),
      ),
      ...result.items,
    ]);
  }, [catalogKeyword]);

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
    const generation = catalogQueryGeneration.current;
    setLoadError(null);
    try {
      await loadCatalogs(catalogKeyword, true, generation);
      await refreshResourceTotal();
    } catch (error) {
      if (generation === catalogQueryGeneration.current) {
        setLoadError(extractRequestErrorMessage(error));
      }
    } finally {
      if (generation === catalogQueryGeneration.current) {
        setLoading(false);
      }
    }
  }, [catalogKeyword, loadCatalogs, refreshResourceTotal]);

  const handleCatalogSearch = useCallback(() => {
    if (catalogSearchLoading) {
      return;
    }
    const keyword = catalogSearchInput;
    const generation = catalogQueryGeneration.current + 1;
    catalogQueryGeneration.current = generation;
    setLoadError(null);
    setCatalogSearchLoading(true);
    void loadCatalogs(keyword, false, generation, true)
      .then((applied) => {
        if (applied && selection?.type === "catalog") {
          void navigate("/data-catalog", { replace: true });
        }
      })
      .catch((error) => {
        if (generation === catalogQueryGeneration.current) {
          setLoadError(extractRequestErrorMessage(error));
        }
      })
      .finally(() => {
        if (generation === catalogQueryGeneration.current) {
          setCatalogSearchLoading(false);
          setLoading(false);
        }
      });
  }, [catalogSearchInput, catalogSearchLoading, loadCatalogs, navigate, selection]);

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
    if (initialLoadRef.current) {
      return;
    }
    initialLoadRef.current = true;
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (selection?.type !== "catalog") {
      return;
    }
    if (catalogs.some((catalog) => catalog.id === selection.id)) {
      setSelectedCatalogLoadingId(null);
      return;
    }
    if (selectedCatalogRequestIds.current.has(selection.id)) {
      return;
    }
    selectedCatalogRequestIds.current.add(selection.id);
    setSelectedCatalogLoadingId(selection.id);
    const generation = catalogQueryGeneration.current;
    void getCatalog(selection.id)
      .then((catalog) => {
        if (
          !catalog ||
          generation !== catalogQueryGeneration.current ||
          selectedCatalogIdRef.current !== selection.id
        ) {
          return;
        }
        setCatalogs((current) => (
          current.some((item) => item.id === catalog.id) ? current : [...current, catalog]
        ));
      })
      .catch((error) => {
        if (
          generation === catalogQueryGeneration.current &&
          selectedCatalogIdRef.current === selection.id
        ) {
          setLoadError(extractRequestErrorMessage(error));
        }
      })
      .finally(() => {
        selectedCatalogRequestIds.current.delete(selection.id);
        setSelectedCatalogLoadingId((current) => current === selection.id ? null : current);
      });
  }, [catalogs, selection]);

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
  const hasPhysicalCatalogs = connectorTypeStats.some(
    (stat) => stat.catalogType === "physical" && stat.catalogCount > 0,
  );

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

    if (selection?.type === "catalog" && selectedCatalogLoadingId === selection.id) {
      return (
        <div className={styles.placeholder}>
          <Spin />
        </div>
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

    if (catalogs.length === 0) {
      if (hasPhysicalCatalogs) {
        return (
          <EmptyStatePanel
            description={t("dataCatalog.catalog.selectPhysicalDescription")}
            icon={<DatabaseOutlined />}
            title={t("dataCatalog.title")}
          />
        );
      }
      if (catalogKeyword.trim()) {
        return (
          <EmptyStatePanel
            description=""
            icon={<DatabaseOutlined />}
            title={t("dataCatalog.tree.noCatalogMatch")}
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
          keyword={catalogKeyword}
          searchLoading={catalogSearchLoading}
          searchValue={catalogSearchInput}
          connectorTypeStats={connectorTypeStats}
          activeSchema={activeSchema}
          collapsed={treeCollapsed}
          onRefresh={async () => {
            await loadAll();
          }}
          onLoadCatalogSchemas={loadCatalogSchemas}
          onLoadCatalogsByConnectorType={loadCatalogsByConnectorType}
          onSearch={handleCatalogSearch}
          onSearchChange={setCatalogSearchInput}
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
