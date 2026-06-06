import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Input, Select, Spin, Tabs } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { CreateMenu } from "@/modules/execution-factory/components/create-menu/CreateMenu";
import { CreateMcpDrawer } from "@/modules/execution-factory/components/create-menu/CreateMcpDrawer";
import { UpdateSkillPackageModal } from "@/modules/execution-factory/components/create-menu/UpdateSkillPackageModal";
import { ExecutionUnitCard } from "@/modules/execution-factory/components/execution-unit/ExecutionUnitCard";
import type { ExecutionUnitCardAction } from "@/modules/execution-factory/components/execution-unit/ExecutionUnitCardMenu";
import type {
  ExecutionUnitCardItem,
  ExecutionUnitTab,
} from "@/modules/execution-factory/components/execution-unit/types";
import { InstallFromCatalogModal } from "@/modules/execution-factory/components/InstallFromCatalogModal";
import { PublishedPermModal } from "@/modules/execution-factory/components/PublishedPermModal";
import { McpDetailDrawer } from "@/modules/execution-factory/components/McpDetailDrawer";
import { OperatorDetailDrawer } from "@/modules/execution-factory/components/OperatorDetailDrawer";
import { SkillDetailDrawer } from "@/modules/execution-factory/components/SkillDetailDrawer";
import { SkillHistoryDrawer } from "@/modules/execution-factory/components/SkillHistoryDrawer";
import { ToolboxDetailDrawer } from "@/modules/execution-factory/components/ToolboxDetailDrawer";
import { listOperatorCategories } from "@/modules/execution-factory/services/category.service";
import { downloadComponentExport } from "@/modules/execution-factory/services/impex.service";
import {
  deleteMcp,
  listMcpMarket,
  listMcps,
  updateMcpStatus,
} from "@/modules/execution-factory/services/mcp.service";
import {
  deleteOperator,
  listOperatorMarket,
  listOperators,
  updateOperatorStatus,
} from "@/modules/execution-factory/services/operator.service";
import {
  deleteSkill,
  downloadSkillPackage,
  listSkillMarket,
  listSkills,
  updateSkillStatus,
} from "@/modules/execution-factory/services/skill.service";
import {
  deleteToolbox,
  listToolboxMarket,
  listToolboxes,
  updateToolboxStatus,
} from "@/modules/execution-factory/services/toolbox.service";
import type { ImpexComponentType } from "@/modules/execution-factory/types/impex";
import type { McpRecord, McpStatus } from "@/modules/execution-factory/types/mcp";
import type { OperatorRecord, PublicOperatorStatus } from "@/modules/execution-factory/types/operator";
import type { SkillRecord, SkillStatus } from "@/modules/execution-factory/types/skill";
import type { ToolboxRecord, ToolboxStatus } from "@/modules/execution-factory/types/toolbox";

import styles from "./execution-unit-list.module.css";

const PAGE_SIZE = 20;

function resolveActiveTab(
  param: string | null,
  defaultTab: ExecutionUnitTab | undefined,
  tabs: ExecutionUnitTab[],
): ExecutionUnitTab {
  if (param && tabs.includes(param as ExecutionUnitTab)) {
    return param as ExecutionUnitTab;
  }

  if (defaultTab && tabs.includes(defaultTab)) {
    return defaultTab;
  }

  return tabs[0];
}

type CategoryChipOption = {
  value: string;
  label: string;
};

type ExecutionUnitListSceneProps = {
  defaultKeyword?: string;
  defaultTab?: ExecutionUnitTab;
  marketMode?: boolean;
  tabs?: ExecutionUnitTab[];
  titleKey: string;
  descriptionKey: string;
  toolbarHintKey: string;
};

function mapOperator(item: OperatorRecord): ExecutionUnitCardItem {
  return {
    id: item.operatorId,
    name: item.name,
    description: item.description,
    metadataType: item.metadataType,
    isInternal: item.isInternal,
    releaseUser: item.releaseUser,
    updateUser: item.createUser,
    releaseTime: item.releaseTime,
    updateTime: item.updateTime,
    status: item.status,
    version: item.version,
  };
}

function mapToolbox(item: ToolboxRecord): ExecutionUnitCardItem {
  return {
    id: item.boxId,
    name: item.name,
    description: item.description,
    metadataType: item.metadataType,
    isInternal: item.isInternal,
    toolCount: item.toolCount ?? item.tools?.length ?? 0,
    releaseUser: item.releaseUser,
    updateUser: item.updateUser ?? item.createUser,
    releaseTime: item.releaseTime,
    updateTime: item.updateTime,
    status: item.status,
  };
}

function mapMcp(item: McpRecord): ExecutionUnitCardItem {
  return {
    id: item.mcpId,
    name: item.name,
    description: item.description,
    isInternal: item.isInternal,
    releaseUser: item.releaseUser,
    updateUser: item.createUser,
    releaseTime: item.releaseTime,
    updateTime: item.updateTime,
    status: item.status,
  };
}

function mapSkill(item: SkillRecord): ExecutionUnitCardItem {
  return {
    id: item.skillId,
    name: item.name,
    description: item.description,
    releaseUser: item.releaseUser,
    updateUser: item.createUser,
    releaseTime: item.releaseTime,
    updateTime: item.updateTime,
    status: item.status,
  };
}

export function ExecutionUnitListScene({
  defaultKeyword,
  defaultTab,
  marketMode = false,
  tabs = ["mcp", "toolbox", "operator", "skill"],
  titleKey,
  descriptionKey,
  toolbarHintKey,
}: ExecutionUnitListSceneProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pageState, query, reset, setKeyword } = usePageState();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<ExecutionUnitTab>(() =>
    resolveActiveTab(searchParams.get("activeTab"), defaultTab, tabs),
  );
  const [category, setCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<CategoryChipOption[]>([]);
  const [status, setStatus] = useState<string>("");
  const [items, setItems] = useState<ExecutionUnitCardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailOperatorId, setDetailOperatorId] = useState<string | null>(null);
  const [detailBoxId, setDetailBoxId] = useState<string | null>(null);
  const [detailMcpId, setDetailMcpId] = useState<string | null>(null);
  const [detailSkillId, setDetailSkillId] = useState<string | null>(null);
  const [historySkillId, setHistorySkillId] = useState<string | null>(null);
  const [installTarget, setInstallTarget] = useState<{
    id: string;
    name: string;
    type: ImpexComponentType;
  } | null>(null);
  const [publishedPermTarget, setPublishedPermTarget] = useState<{
    name: string;
  } | null>(null);
  const [editMcpId, setEditMcpId] = useState<string | null>(null);
  const [updateSkillPackageTarget, setUpdateSkillPackageTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (defaultKeyword) {
      setKeyword(defaultKeyword);
    }
  }, [defaultKeyword, setKeyword]);

  useEffect(() => {
    void (async () => {
      const items = await listOperatorCategories();
      setCategoryOptions([
        { value: "", label: t("executionFactory.allCategory") },
        ...items.map((item) => ({
          value: item.categoryType,
          label: item.name,
        })),
      ]);
    })();
  }, [t]);

  useEffect(() => {
    const param = searchParams.get("activeTab");
    const resolved = resolveActiveTab(param, defaultTab, tabs);

    setActiveTab(resolved);

    if (param !== resolved) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("activeTab", resolved);
      setSearchParams(nextParams, { replace: true });
    }
  }, [defaultTab, marketMode, searchParams, setSearchParams, tabs]);

  const listQuery = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      keyword: query.keyword,
      status: status || undefined,
      category: category || undefined,
    }),
    [category, page, query.keyword, status],
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      if (activeTab === "operator") {
        const result = marketMode
          ? await listOperatorMarket(listQuery)
          : await listOperators(listQuery);
        const mapped = result.items.map(mapOperator);
        setItems((prev) => (page === 1 ? mapped : [...prev, ...mapped]));
        setTotal(result.total);
        return;
      }

      if (activeTab === "toolbox") {
        const result = marketMode
          ? await listToolboxMarket(listQuery)
          : await listToolboxes(listQuery);
      const mapped = result.items.map(mapToolbox);
      setItems((prev) => (page === 1 ? mapped : [...prev, ...mapped]));
      setTotal(result.total);
      return;
      }

      if (activeTab === "mcp") {
        const result = marketMode ? await listMcpMarket(listQuery) : await listMcps(listQuery);
        const mapped = result.items.map(mapMcp);
        setItems((prev) => (page === 1 ? mapped : [...prev, ...mapped]));
        setTotal(result.total);
        return;
      }

      const result = marketMode
        ? await listSkillMarket(listQuery)
        : await listSkills(listQuery);
      const mapped = result.items.map(mapSkill);
      setItems((prev) => (page === 1 ? mapped : [...prev, ...mapped]));
      setTotal(result.total);
    } catch (error) {
      if (page === 1) {
        setItems([]);
        setTotal(0);
      }
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [activeTab, listQuery, marketMode, page]);

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [activeTab, query.keyword, status, marketMode, category]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const tabItems = useMemo(
    () =>
      tabs.map((tab) => ({
        key: tab,
        label: t(`executionFactory.executionUnitTabs.${tab}`),
      })),
    [t, tabs],
  );

  const statusOptions = useMemo(() => {
    const base = [
      { value: "", label: t("executionFactory.allCategory") },
      { value: "published", label: t("executionFactory.statuses.published") },
      { value: "unpublish", label: t("executionFactory.statuses.unpublish") },
      { value: "offline", label: t("executionFactory.statuses.offline") },
    ];

    if (activeTab === "toolbox") {
      return base.filter((item) => item.value !== "editing");
    }

    if (activeTab === "operator") {
      return [
        ...base,
        { value: "editing", label: t("executionFactory.statuses.editing") },
      ];
    }

    return [];
  }, [activeTab, t]);

  const handleCardClick = (item: ExecutionUnitCardItem) => {
    const action = marketMode ? "view" : "edit";

    if (activeTab === "toolbox") {
      void navigate(
        `/execution-factory/toolboxes/${item.id}/tools?action=${action}`,
      );
      return;
    }

    if (activeTab === "operator") {
      if (marketMode) {
        setDetailOperatorId(item.id);
        return;
      }

      void navigate(`/execution-factory/units/${item.id}/edit`);
      return;
    }

    if (activeTab === "mcp") {
      setDetailMcpId(item.id);
      return;
    }

    setDetailSkillId(item.id);
  };

  const reloadList = useCallback(() => {
    setPage(1);
    setItems([]);
    void loadItems();
  }, [loadItems]);

  const impexTypeForTab = useCallback((tab: ExecutionUnitTab): ImpexComponentType | null => {
    if (tab === "operator" || tab === "toolbox" || tab === "mcp") {
      return tab;
    }

    return null;
  }, []);

  const handleCardAction = useCallback(
    (action: ExecutionUnitCardAction, item: ExecutionUnitCardItem) => {
      const runStatusChange = (
        nextStatus: PublicOperatorStatus | ToolboxStatus | McpStatus | SkillStatus,
        titleKey: string,
        descriptionKey: string,
        onConfirm: () => Promise<void>,
      ) => {
        void modal.confirm({
          title: t(titleKey),
          content: t(descriptionKey, { name: item.name, status: t(`executionFactory.statuses.${nextStatus}`) }),
          okText: t("common.save"),
          cancelText: t("common.cancel"),
          onOk: async () => {
            await onConfirm();
            void message.success(t("common.success"));
            reloadList();
            if (!marketMode && nextStatus === "published") {
              setPublishedPermTarget({ name: item.name });
            }
          },
        });
      };

      const runDelete = (titleKey: string, descriptionKey: string, onConfirm: () => Promise<void>) => {
        void modal.confirm({
          title: t(titleKey),
          content: t(descriptionKey, { name: item.name }),
          okButtonProps: { danger: true },
          okText: t("common.delete"),
          cancelText: t("common.cancel"),
          onOk: async () => {
            await onConfirm();
            void message.success(t("common.success"));
            reloadList();
          },
        });
      };

      if (action === "install") {
        const componentType = impexTypeForTab(activeTab);
        if (!componentType) {
          return;
        }

        setInstallTarget({
          id: item.id,
          name: item.name,
          type: componentType,
        });
        return;
      }

      if (action === "view") {
        if (activeTab === "operator") {
          setDetailOperatorId(item.id);
        } else if (activeTab === "mcp") {
          setDetailMcpId(item.id);
        } else if (activeTab === "skill") {
          setDetailSkillId(item.id);
        }
        return;
      }

      if (action === "export") {
        const componentType = impexTypeForTab(activeTab);
        if (!componentType) {
          return;
        }

        void (async () => {
          try {
            await downloadComponentExport(componentType, item.id, item.name);
            void message.success(t("executionFactory.exportSuccess"));
          } catch (error) {
            void message.error(extractRequestErrorMessage(error));
          }
        })();
        return;
      }

      if (action === "download") {
        if (activeTab !== "skill") {
          return;
        }

        void (async () => {
          try {
            await downloadSkillPackage(item.id, item.name);
            void message.success(t("executionFactory.downloadSuccess"));
          } catch (error) {
            void message.error(extractRequestErrorMessage(error));
          }
        })();
        return;
      }

      if (action === "updatePackage") {
        if (activeTab !== "skill") {
          return;
        }

        setUpdateSkillPackageTarget({ id: item.id, name: item.name });
        return;
      }

      if (action === "edit") {
        if (activeTab === "operator") {
          void navigate(`/execution-factory/units/${item.id}/edit`);
        } else if (activeTab === "toolbox") {
          void navigate(`/execution-factory/toolboxes/${item.id}/edit`);
        } else if (activeTab === "mcp") {
          setEditMcpId(item.id);
        } else if (activeTab === "skill") {
          void navigate(`/execution-factory/skills/${item.id}/edit`);
        }
        return;
      }

      if (action === "publish") {
        if (activeTab === "operator" && item.version) {
          runStatusChange(
            "published",
            "executionFactory.operatorStatusChangeConfirmTitle",
            "executionFactory.operatorStatusChangeConfirmDescription",
            () => updateOperatorStatus(item.id, item.version!, "published"),
          );
        } else if (activeTab === "toolbox") {
          runStatusChange(
            "published",
            "executionFactory.toolboxStatusChangeConfirmTitle",
            "executionFactory.toolboxStatusChangeConfirmDescription",
            () => updateToolboxStatus(item.id, "published"),
          );
        } else if (activeTab === "mcp") {
          runStatusChange(
            "published",
            "executionFactory.mcpStatusChangeConfirmTitle",
            "executionFactory.mcpStatusChangeConfirmDescription",
            () => updateMcpStatus(item.id, "published"),
          );
        } else if (activeTab === "skill") {
          runStatusChange(
            "published",
            "executionFactory.skillStatusChangeConfirmTitle",
            "executionFactory.skillStatusChangeConfirmDescription",
            () => updateSkillStatus(item.id, "published"),
          );
        }
        return;
      }

      if (action === "unpublish") {
        if (activeTab === "operator" && item.version) {
          runStatusChange(
            "unpublish",
            "executionFactory.operatorStatusChangeConfirmTitle",
            "executionFactory.operatorStatusChangeConfirmDescription",
            () => updateOperatorStatus(item.id, item.version!, "unpublish"),
          );
        } else if (activeTab === "toolbox") {
          runStatusChange(
            "unpublish",
            "executionFactory.toolboxStatusChangeConfirmTitle",
            "executionFactory.toolboxStatusChangeConfirmDescription",
            () => updateToolboxStatus(item.id, "unpublish"),
          );
        } else if (activeTab === "mcp") {
          runStatusChange(
            "unpublish",
            "executionFactory.mcpStatusChangeConfirmTitle",
            "executionFactory.mcpStatusChangeConfirmDescription",
            () => updateMcpStatus(item.id, "unpublish"),
          );
        } else if (activeTab === "skill") {
          runStatusChange(
            "unpublish",
            "executionFactory.skillStatusChangeConfirmTitle",
            "executionFactory.skillStatusChangeConfirmDescription",
            () => updateSkillStatus(item.id, "unpublish"),
          );
        }
        return;
      }

      if (action === "offline") {
        if (activeTab === "operator" && item.version) {
          runStatusChange(
            "offline",
            "executionFactory.operatorStatusChangeConfirmTitle",
            "executionFactory.operatorStatusChangeConfirmDescription",
            () => updateOperatorStatus(item.id, item.version!, "offline"),
          );
        } else if (activeTab === "toolbox") {
          runStatusChange(
            "offline",
            "executionFactory.toolboxStatusChangeConfirmTitle",
            "executionFactory.toolboxStatusChangeConfirmDescription",
            () => updateToolboxStatus(item.id, "offline"),
          );
        } else if (activeTab === "mcp") {
          runStatusChange(
            "offline",
            "executionFactory.mcpStatusChangeConfirmTitle",
            "executionFactory.mcpStatusChangeConfirmDescription",
            () => updateMcpStatus(item.id, "offline"),
          );
        } else if (activeTab === "skill") {
          runStatusChange(
            "offline",
            "executionFactory.skillStatusChangeConfirmTitle",
            "executionFactory.skillStatusChangeConfirmDescription",
            () => updateSkillStatus(item.id, "offline"),
          );
        }
        return;
      }

      if (action === "delete") {
        if (activeTab === "operator") {
          runDelete(
            "executionFactory.operatorDeleteConfirmTitle",
            "executionFactory.operatorDeleteConfirmDescription",
            async () => {
              if (item.status === "published" && item.version) {
                await updateOperatorStatus(item.id, item.version, "offline");
              }

              if (!item.version) {
                throw new Error("Missing operator version");
              }

              await deleteOperator(item.id, item.version);
            },
          );
        } else if (activeTab === "toolbox") {
          runDelete(
            "executionFactory.toolboxDeleteConfirmTitle",
            "executionFactory.toolboxDeleteConfirmDescription",
            () => deleteToolbox(item.id),
          );
        } else if (activeTab === "mcp") {
          runDelete(
            "executionFactory.mcpDeleteConfirmTitle",
            "executionFactory.mcpDeleteConfirmDescription",
            async () => {
              if (item.status === "published") {
                await updateMcpStatus(item.id, "offline");
              }

              await deleteMcp(item.id);
            },
          );
        } else if (activeTab === "skill") {
          runDelete(
            "executionFactory.skillDeleteConfirmTitle",
            "executionFactory.skillDeleteConfirmDescription",
            async () => {
              if (item.status === "published") {
                await updateSkillStatus(item.id, "offline");
              }

              await deleteSkill(item.id);
            },
          );
        }
      }
    },
    [activeTab, impexTypeForTab, marketMode, message, modal, navigate, reloadList, t],
  );

  const reload = () => {
    reset();
    setStatus("");
    setCategory("");
    reloadList();
  };

  const hasMore = items.length < total;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore || loading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPage((current) => current + 1);
        }
      },
      { rootMargin: "120px", threshold: 0.1 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, items.length]);

  return (
    <>
      <section className={styles.page}>
        {!marketMode ? (
          <div className={styles.toolbarActions}>
            <CreateMenu
              activeTab={activeTab}
              autoOpen={searchParams.get("create") === "1"}
              onAutoOpenHandled={() => {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.delete("create");
                setSearchParams(nextParams, { replace: true });
              }}
              onMcpCreated={(mcpId) => setDetailMcpId(mcpId)}
              onRefresh={reloadList}
            />
            <span className={styles.toolbarMeta}>{t(toolbarHintKey)}</span>
          </div>
        ) : null}

        <Tabs
          activeKey={activeTab}
          className={styles.tabs}
          items={tabItems}
          onChange={(key) => {
            const nextTab = key as ExecutionUnitTab;
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set("activeTab", nextTab);
            setSearchParams(nextParams);
          }}
        />

        <div className={styles.filterBar}>
          <div className={styles.filterLeft}>
            <span className={styles.filterLabel}>{t("executionFactory.typeFilter")}</span>
            <div className={styles.categoryGroup}>
              {categoryOptions.map((option) => (
                <button
                  className={`${styles.categoryChip} ${
                    category === option.value ? styles.categoryChipActive : ""
                  }`}
                  key={option.value || "all"}
                  onClick={() => setCategory(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            {!marketMode && statusOptions.length > 0 ? (
              <>
                <span className={styles.filterLabel}>
                  {t("executionFactory.publishStatusFilter")}
                </span>
                <Select
                  options={statusOptions}
                  style={{ minWidth: 140 }}
                  value={status}
                  onChange={setStatus}
                />
              </>
            ) : null}
          </div>
          <div className={styles.filterRight}>
            <Input
              allowClear
              className={styles.searchInput}
              placeholder={t("executionFactory.searchNamePlaceholder")}
              prefix={<SearchOutlined />}
              value={pageState.keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Button icon={<ReloadOutlined />} type="text" onClick={reload} />
          </div>
        </div>

        {loadError ? (
          <Alert
            action={
              <AppButton onClick={() => void loadItems()} type="link">
                {t("common.retry")}
              </AppButton>
            }
            message={loadError}
            showIcon
            style={{ marginBottom: 16 }}
            type="error"
          />
        ) : null}

        <div className={styles.gridWrap}>
          {loading && items.length === 0 ? (
            <div className={styles.emptyWrap}>
              <Spin size="large" />
            </div>
          ) : null}
          {!loading && items.length === 0 ? (
            <div className={styles.emptyWrap}>
              <Empty description={t("executionFactory.catalogEmptyDescription")} />
            </div>
          ) : null}
          {items.length > 0 ? (
            <>
              <div className={styles.cardGrid}>
                {items.map((item) => (
                  <ExecutionUnitCard
                    activeTab={activeTab}
                    item={item}
                    key={item.id}
                    marketMode={marketMode}
                    onAction={handleCardAction}
                    onClick={() => handleCardClick(item)}
                  />
                ))}
              </div>
              {hasMore ? (
                <div className={styles.loadMore} ref={loadMoreRef}>
                  {loading ? <Spin size="small" /> : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      <OperatorDetailDrawer
        marketMode={marketMode}
        onClose={() => setDetailOperatorId(null)}
        onEdit={(id) => {
          setDetailOperatorId(null);
          void navigate(`/execution-factory/units/${id}/edit`);
        }}
        open={Boolean(detailOperatorId)}
        operatorId={detailOperatorId}
      />
      <ToolboxDetailDrawer
        boxId={detailBoxId}
        marketMode={marketMode}
        onClose={() => setDetailBoxId(null)}
        open={Boolean(detailBoxId)}
      />
      <McpDetailDrawer
        marketMode={marketMode}
        mcpId={detailMcpId}
        onClose={() => setDetailMcpId(null)}
        open={Boolean(detailMcpId)}
      />
      <SkillDetailDrawer
        marketMode={marketMode}
        onClose={() => setDetailSkillId(null)}
        onEdit={(skillId) => {
          setDetailSkillId(null);
          void navigate(`/execution-factory/skills/${skillId}/edit`);
        }}
        onOpenHistory={(skillId) => {
          setDetailSkillId(null);
          setHistorySkillId(skillId);
        }}
        open={Boolean(detailSkillId)}
        skillId={detailSkillId}
      />
      <SkillHistoryDrawer
        onClose={() => setHistorySkillId(null)}
        onUpdated={reloadList}
        open={Boolean(historySkillId)}
        skillId={historySkillId}
      />
      <InstallFromCatalogModal
        componentId={installTarget?.id ?? ""}
        componentName={installTarget?.name ?? ""}
        componentType={installTarget?.type ?? "operator"}
        onClose={() => setInstallTarget(null)}
        onSuccess={reloadList}
        open={Boolean(installTarget)}
      />
      <PublishedPermModal
        activeTab={activeTab}
        onClose={() => setPublishedPermTarget(null)}
        open={Boolean(publishedPermTarget)}
        resourceName={publishedPermTarget?.name ?? ""}
      />
      <CreateMcpDrawer
        mcpId={editMcpId}
        onClose={() => setEditMcpId(null)}
        onUpdated={reloadList}
        open={Boolean(editMcpId)}
      />
      <UpdateSkillPackageModal
        onClose={() => setUpdateSkillPackageTarget(null)}
        onUpdated={reloadList}
        open={Boolean(updateSkillPackageTarget)}
        skillId={updateSkillPackageTarget?.id ?? null}
        skillName={updateSkillPackageTarget?.name}
      />
    </>
  );
}
