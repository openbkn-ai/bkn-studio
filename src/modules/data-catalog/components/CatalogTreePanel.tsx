import {
  ApiOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  DownOutlined,
  EyeOutlined,
  PlusOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { Input, Select } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import { indexStateOf } from "@/modules/data-catalog/lib/index-state";
import type {
  BuildTask,
  CatalogResource,
  IndexStateKey,
} from "@/modules/data-catalog/types/data-catalog";
import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";

import styles from "./CatalogTreePanel.module.css";

export type CatalogTreeSelection =
  | { id: string; type: "catalog" }
  | { id: string; type: "resource" };

type CatalogTreePanelProps = {
  catalogs: DataConnectRecord[];
  onCreateConnection: () => void;
  onCreateResource: (catalogId: string) => void;
  onSelectCatalog: (catalogId: string) => void;
  onSelectResource: (resourceId: string) => void;
  resources: CatalogResource[];
  scanningCatalogIds: string[];
  selection: CatalogTreeSelection | null;
  tasks: BuildTask[];
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const DOT_CLASS: Partial<Record<IndexStateKey, string>> = {
  built: styles.treeDotBuilt,
  building: styles.treeDotBuilding,
  rebuilding: styles.treeDotBuilding,
  listening: styles.treeDotListening,
  paused: styles.treeDotPaused,
  failed: styles.treeDotFailed,
  "failed-stale": styles.treeDotFailed,
};

function resourceIcon(category: CatalogResource["category"]) {
  if (category === "logicview") {
    return <EyeOutlined />;
  }
  if (category === "dataset") {
    return <DatabaseOutlined />;
  }
  return <TableOutlined />;
}

export function CatalogTreePanel({
  catalogs,
  onCreateConnection,
  onCreateResource,
  onSelectCatalog,
  onSelectResource,
  resources,
  scanningCatalogIds,
  selection,
  tasks,
}: CatalogTreePanelProps) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [pages, setPages] = useState<Map<string, number>>(() => new Map());

  const tasksByResource = useMemo(() => {
    const map = new Map<string, BuildTask[]>();
    tasks.forEach((task) => {
      map.set(task.resourceId, [...(map.get(task.resourceId) ?? []), task]);
    });
    return map;
  }, [tasks]);

  const resourcesByCatalog = useMemo(() => {
    const map = new Map<string, CatalogResource[]>();
    resources.forEach((resource) => {
      map.set(resource.catalogId, [
        ...(map.get(resource.catalogId) ?? []),
        resource,
      ]);
    });
    return map;
  }, [resources]);

  // 选中资源/目录时自动展开所属 catalog 一次;之后仍可手动收起
  useEffect(() => {
    if (!selection) {
      return;
    }
    const catalogId =
      selection.type === "catalog"
        ? selection.id
        : resources.find((item) => item.id === selection.id)?.catalogId;
    if (catalogId) {
      setExpanded((previous) => {
        if (previous.has(catalogId)) {
          return previous;
        }
        const next = new Set(previous);
        next.add(catalogId);
        return next;
      });
    }
  }, [resources, selection]);

  // 搜索词或页大小变化时回到第一页
  useEffect(() => {
    setPages(new Map());
  }, [keyword, pageSize]);

  const query = keyword.trim().toLowerCase();

  const matchesCatalog = (catalog: DataConnectRecord) =>
    query.length === 0 ||
    catalog.name.toLowerCase().includes(query) ||
    catalog.id.toLowerCase().includes(query);

  const matchedResources = (catalog: DataConnectRecord) => {
    const list = resourcesByCatalog.get(catalog.id) ?? [];
    if (query.length === 0 || matchesCatalog(catalog)) {
      return list;
    }
    return list.filter(
      (resource) =>
        resource.name.toLowerCase().includes(query) ||
        resource.sourceIdentifier.toLowerCase().includes(query),
    );
  };

  const visibleCatalogs = catalogs.filter(
    (catalog) => matchesCatalog(catalog) || matchedResources(catalog).length > 0,
  );

  const physicalCatalogs = visibleCatalogs.filter((catalog) => catalog.type !== "logical");
  const logicalCatalogs = visibleCatalogs.filter((catalog) => catalog.type === "logical");

  const setPage = (catalogId: string, page: number) => {
    setPages((previous) => {
      const next = new Map(previous);
      next.set(catalogId, page);
      return next;
    });
  };

  const toggleExpanded = (catalogId: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(catalogId)) {
        next.delete(catalogId);
      } else {
        next.add(catalogId);
      }
      return next;
    });
  };

  const renderCatalogNode = (catalog: DataConnectRecord) => {
    const children = matchedResources(catalog);
    const forcedOpen = query.length > 0 && !matchesCatalog(catalog) && children.length > 0;
    // 选中只在切换选区时自动展开一次(见上方 effect),这里不强制,否则"收起"失效
    const isOpen = forcedOpen || expanded.has(catalog.id);
    const isSelected = selection?.type === "catalog" && selection.id === catalog.id;
    const isPhysical = catalog.type !== "logical";
    const scanning = scanningCatalogIds.includes(catalog.id);
    const resourceCount = (resourcesByCatalog.get(catalog.id) ?? []).length;

    const totalPages = Math.max(1, Math.ceil(children.length / pageSize));
    const page = Math.min(pages.get(catalog.id) ?? 1, totalPages);
    const pagedChildren = children.slice((page - 1) * pageSize, page * pageSize);

    return (
      <div key={catalog.id}>
        <div
          className={[
            styles.treeNode,
            styles.treeNodeCatalog,
            isSelected ? styles.treeNodeSelected : "",
            isPhysical && !catalog.enabled ? styles.treeNodeOff : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => {
            setExpanded((previous) => {
              const next = new Set(previous);
              next.add(catalog.id);
              return next;
            });
            onSelectCatalog(catalog.id);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSelectCatalog(catalog.id);
            }
          }}
        >
          <button
            aria-label={isOpen ? t("dataCatalog.tree.collapse") : t("dataCatalog.tree.expand")}
            className={[styles.treeCaret, isOpen ? styles.treeCaretOpen : ""].join(" ")}
            onClick={(event) => {
              event.stopPropagation();
              toggleExpanded(catalog.id);
            }}
            type="button"
          >
            <DownOutlined />
          </button>
          <span className={styles.treeNodeIcon}>
            {isPhysical ? <ApiOutlined /> : <AppstoreOutlined />}
          </span>
          <span className={styles.treeNodeName} title={catalog.name}>
            {catalog.name}
          </span>
          {scanning ? (
            <span className={[styles.treeMiniTag, styles.treeMiniTagScan].join(" ")}>
              {t("dataCatalog.tree.scanning")}
            </span>
          ) : null}
          {isPhysical && !catalog.enabled ? (
            <span className={styles.treeMiniTag}>{t("common.disabled")}</span>
          ) : null}
          <span className={styles.treeCount}>{resourceCount}</span>
          <PermissionGate permissions="resource:create">
            <button
              aria-label={t("dataCatalog.tree.addResource")}
              className={styles.treeAdd}
              onClick={(event) => {
                event.stopPropagation();
                onCreateResource(catalog.id);
              }}
              title={t("dataCatalog.tree.addResource")}
              type="button"
            >
              <PlusOutlined />
            </button>
          </PermissionGate>
        </div>
        {isOpen ? (
          <div className={styles.treeChildren}>
            {children.length === 0 ? (
              <div className={styles.treeEmptyHint}>
                {isPhysical
                  ? t("dataCatalog.tree.emptyPhysical")
                  : t("dataCatalog.tree.emptyLogical")}
              </div>
            ) : (
              pagedChildren.map((resource) => {
                const state = indexStateOf(tasksByResource.get(resource.id) ?? []);
                const isResourceSelected =
                  selection?.type === "resource" && selection.id === resource.id;

                return (
                  <div
                    className={[
                      styles.treeNode,
                      styles.treeNodeResource,
                      isResourceSelected ? styles.treeNodeSelected : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={resource.id}
                    onClick={() => onSelectResource(resource.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        onSelectResource(resource.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    title={resource.sourceIdentifier}
                  >
                    <span className={styles.treeNodeIcon}>
                      {resourceIcon(resource.category)}
                    </span>
                    <span className={styles.treeNodeName}>{resource.name}</span>
                    <span
                      className={[styles.treeDot, DOT_CLASS[state.key] ?? ""].join(" ")}
                      title={t(`dataCatalog.indexState.${state.key === "failed-stale" ? "rebuildFailed" : state.key}`)}
                    />
                  </div>
                );
              })
            )}
            {children.length > pageSize ? (
              <div className={styles.treePager}>
                <button
                  aria-label={t("dataCatalog.preview.prev")}
                  className={styles.treePagerBtn}
                  disabled={page <= 1}
                  onClick={() => setPage(catalog.id, page - 1)}
                  type="button"
                >
                  ‹
                </button>
                <span>
                  {t("dataCatalog.tree.pageInfo", {
                    from: (page - 1) * pageSize + 1,
                    to: Math.min(page * pageSize, children.length),
                    total: children.length,
                  })}
                </span>
                <button
                  aria-label={t("dataCatalog.preview.next")}
                  className={styles.treePagerBtn}
                  disabled={page >= totalPages}
                  onClick={() => setPage(catalog.id, page + 1)}
                  type="button"
                >
                  ›
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <aside className={styles.treePanel}>
      <div className={styles.treeHead}>
        <span className={styles.treeHeadTitle}>{t("dataCatalog.title")}</span>
        <PermissionGate permissions="catalog:create">
          <AppButton onClick={onCreateConnection} size="small" type="primary">
            {t("dataCatalog.tree.newConnection")}
          </AppButton>
        </PermissionGate>
      </div>
      <Input
        allowClear
        onChange={(event) => setKeyword(event.target.value)}
        placeholder={t("dataCatalog.tree.searchPlaceholder")}
        size="small"
        value={keyword}
      />
      <div className={styles.treeBody}>
        {visibleCatalogs.length === 0 ? (
          <div className={styles.treeEmpty}>
            {query.length > 0
              ? t("dataCatalog.tree.noMatch")
              : t("dataCatalog.tree.empty")}
          </div>
        ) : (
          <>
            {physicalCatalogs.length > 0 ? (
              <>
                <div className={styles.treeSection}>
                  {t("dataCatalog.tree.physicalGroup")}
                  <span className={styles.treeSectionHint}>physical</span>
                </div>
                {physicalCatalogs.map(renderCatalogNode)}
              </>
            ) : null}
            {logicalCatalogs.length > 0 ? (
              <>
                <div className={styles.treeSection}>
                  {t("dataCatalog.tree.logicalGroup")}
                  <span className={styles.treeSectionHint}>
                    {t("dataCatalog.tree.logicalGroupHint")}
                  </span>
                </div>
                {logicalCatalogs.map(renderCatalogNode)}
              </>
            ) : null}
          </>
        )}
      </div>
      <div className={styles.treeFoot}>
        <span>
          {t("dataCatalog.tree.summary", {
            catalogCount: catalogs.length as never,
            resourceCount: resources.length as never,
          })}
        </span>
        <Select
          onChange={(value: number) => setPageSize(value)}
          options={PAGE_SIZE_OPTIONS.map((size) => ({
            label: t("dataCatalog.tree.pageSize", { size }),
            value: size,
          }))}
          popupMatchSelectWidth={false}
          size="small"
          value={pageSize}
          variant="borderless"
        />
      </div>
    </aside>
  );
}
