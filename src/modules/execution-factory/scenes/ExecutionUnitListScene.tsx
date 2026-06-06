import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Input, Select, Spin, Tabs } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { usePageState } from "@/framework/hooks/use-page-state";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { CreateMenu } from "@/modules/execution-factory/components/create-menu/CreateMenu";
import { ExecutionUnitCard } from "@/modules/execution-factory/components/execution-unit/ExecutionUnitCard";
import type {
  ExecutionUnitCardItem,
  ExecutionUnitTab,
} from "@/modules/execution-factory/components/execution-unit/types";
import { InstallFromCatalogModal } from "@/modules/execution-factory/components/InstallFromCatalogModal";
import { McpDetailDrawer } from "@/modules/execution-factory/components/McpDetailDrawer";
import { OperatorDetailDrawer } from "@/modules/execution-factory/components/OperatorDetailDrawer";
import { SkillDetailDrawer } from "@/modules/execution-factory/components/SkillDetailDrawer";
import { ToolboxDetailDrawer } from "@/modules/execution-factory/components/ToolboxDetailDrawer";
import { listMcpMarket, listMcps } from "@/modules/execution-factory/services/mcp.service";
import {
  listOperatorMarket,
  listOperators,
} from "@/modules/execution-factory/services/operator.service";
import { listSkillMarket, listSkills } from "@/modules/execution-factory/services/skill.service";
import {
  listToolboxMarket,
  listToolboxes,
} from "@/modules/execution-factory/services/toolbox.service";
import type { ImpexComponentType } from "@/modules/execution-factory/types/impex";
import type { McpRecord } from "@/modules/execution-factory/types/mcp";
import type { OperatorRecord } from "@/modules/execution-factory/types/operator";
import type { SkillRecord } from "@/modules/execution-factory/types/skill";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";

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

const CATEGORY_OPTIONS = [
  { value: "", labelKey: "executionFactory.allCategory" },
  { value: "other_category", labelKey: "executionFactory.operatorCategories.other_category" },
  { value: "data_process", labelKey: "executionFactory.operatorCategories.data_process" },
  { value: "data_analysis", labelKey: "executionFactory.operatorCategories.data_analysis" },
];

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pageState, query, reset, setKeyword } = usePageState();
  const [activeTab, setActiveTab] = useState<ExecutionUnitTab>(() =>
    resolveActiveTab(searchParams.get("activeTab"), defaultTab, tabs),
  );
  const [category, setCategory] = useState("");
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
  const [installTarget, setInstallTarget] = useState<{
    id: string;
    name: string;
    type: ImpexComponentType;
  } | null>(null);

  useEffect(() => {
    if (defaultKeyword) {
      setKeyword(defaultKeyword);
    }
  }, [defaultKeyword, setKeyword]);

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
    }),
    [page, query.keyword, status],
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

  const reload = () => {
    reset();
    setStatus("");
    setCategory("");
    reloadList();
  };

  const hasMore = items.length < total;

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
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  className={`${styles.categoryChip} ${
                    category === option.value ? styles.categoryChipActive : ""
                  }`}
                  key={option.value || "all"}
                  onClick={() => setCategory(option.value)}
                  type="button"
                >
                  {t(option.labelKey)}
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
                    onClick={() => handleCardClick(item)}
                  />
                ))}
              </div>
              {hasMore ? (
                <div className={styles.loadMore}>
                  <AppButton
                    loading={loading}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {t("executionFactory.loadMore")}
                  </AppButton>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      <OperatorDetailDrawer
        marketMode={marketMode}
        onClose={() => setDetailOperatorId(null)}
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
        open={Boolean(detailSkillId)}
        skillId={detailSkillId}
      />
      <InstallFromCatalogModal
        componentId={installTarget?.id ?? ""}
        componentName={installTarget?.name ?? ""}
        componentType={installTarget?.type ?? "operator"}
        onClose={() => setInstallTarget(null)}
        open={Boolean(installTarget)}
      />
    </>
  );
}
