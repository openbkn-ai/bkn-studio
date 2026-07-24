/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Input, Select, Spin, Tabs } from "antd";
import type { ReactNode } from "react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { extractRequestErrorDetail } from "@/modules/execution-factory/utils/request-error-detail";
import { AppButton } from "@/framework/ui/common/AppButton";
import { CreateMenu } from "@/modules/execution-factory/components/create-menu/CreateMenu";
import { ExecutionUnitCard } from "@/modules/execution-factory/components/execution-unit/ExecutionUnitCard";
import { ExecutionUnitCardSkeleton } from "@/modules/execution-factory/components/execution-unit/ExecutionUnitCardSkeleton";
import type { ExecutionUnitCardAction } from "@/modules/execution-factory/components/execution-unit/ExecutionUnitCardMenu";
import type {
  ExecutionUnitCardItem,
  ExecutionUnitTab,
} from "@/modules/execution-factory/components/execution-unit/types";
import type { ImpexComponentType } from "@/modules/execution-factory/types/impex";
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
import { getToolDetail, listTools } from "@/modules/execution-factory/services/tool.service";
import {
  collectToolboxPublishIssues,
  type ToolboxPublishIssue,
} from "@/modules/execution-factory/utils/toolbox-publish-preflight";
import { listOperatorCategories } from "@/modules/execution-factory/services/category.service";
import type { McpRecord, McpStatus } from "@/modules/execution-factory/types/mcp";
import type { OperatorRecord, PublicOperatorStatus } from "@/modules/execution-factory/types/operator";
import type { SkillRecord, SkillStatus } from "@/modules/execution-factory/types/skill";
import type { ToolboxRecord, ToolboxStatus } from "@/modules/execution-factory/types/toolbox";
import {
  resolveLifecycleActionStatus,
} from "@/modules/execution-factory/utils/execution-unit-lifecycle";
import {
  collectLocalResourceIds,
  invalidateLocalResourceIdsCache,
} from "@/modules/execution-factory/utils/collect-local-resource-ids";
import {
  getDefaultManagementTab,
  getExecutionUnitTabLabelKey,
  isCapabilityUxV2,
  resolveVisibleManagementTabs,
} from "@/modules/execution-factory/utils/capability-ux";
import { supportsCategoryFilter } from "@/modules/execution-factory/utils/capability-parity";
import { formatAuditUserDisplay } from "@/modules/execution-factory/utils/audit-user-display";
import { useAuditUserDirectory } from "@/modules/execution-factory/utils/use-audit-user-directory";
import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";

import styles from "./execution-unit-list.module.css";

// 执行单元 tab → bkn-safe 对象类型（toolbox 的后端 type 是 tool_box）。
const AUTHZ_TYPE_BY_TAB: Record<ExecutionUnitTab, string> = {
  operator: "operator",
  toolbox: "tool_box",
  mcp: "mcp",
  skill: "skill",
};

const ExecutionUnitListOverlays = lazy(async () => {
  const module = await import("@/modules/execution-factory/scenes/ExecutionUnitListOverlays");
  return { default: module.ExecutionUnitListOverlays };
});

const PAGE_SIZE = 20;
/** 逐个取详情才拿得到函数代码，工具多的工具箱不值得为一次发布确认打这么多请求。 */
const PUBLISH_PREFLIGHT_DETAIL_LIMIT = 20;
const TAB_STORAGE_KEY = "execution-factory.activeTab";
/** 工具集下的「API / 函数」子视图，和 activeTab 一样要能被详情页返回时还原。 */
const TOOLBOX_VIEW_STORAGE_KEY = "execution-factory.toolboxView";
const DEFAULT_TABS: ExecutionUnitTab[] = ["operator", "toolbox", "mcp", "skill"];

type IdleTaskHandle = {
  cancel: () => void;
};

function scheduleIdleTask(task: () => void, timeoutMs: number): IdleTaskHandle {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(task, { timeout: timeoutMs });
    return {
      cancel: () => window.cancelIdleCallback(id),
    };
  }

  const id = window.setTimeout(task, Math.min(timeoutMs, 1500));
  return {
    cancel: () => window.clearTimeout(id),
  };
}

type ToolboxView = "openapi" | "function";

function resolveToolboxView(param: string | null): ToolboxView {
  if (param === "function" || param === "openapi") {
    return param;
  }

  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(TOOLBOX_VIEW_STORAGE_KEY);
    if (stored === "function" || stored === "openapi") {
      return stored;
    }
  }

  return "openapi";
}

function resolveActiveTab(
  param: string | null,
  defaultTab: ExecutionUnitTab | undefined,
  tabs: ExecutionUnitTab[],
): ExecutionUnitTab {
  if (param && tabs.includes(param as ExecutionUnitTab)) {
    return param as ExecutionUnitTab;
  }

  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (stored && tabs.includes(stored as ExecutionUnitTab)) {
      return stored as ExecutionUnitTab;
    }
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

function PublishIssueList({ issues }: { issues: ToolboxPublishIssue[] }) {
  const { t } = useTranslation();

  return (
    <>
      <p style={{ marginBottom: 4, marginTop: 12 }}>
        {t("executionFactory.publishPreflightSummary", { count: issues.length })}
      </p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {issues.map((issue, index) => (
          <li key={`${issue.key}-${index}`}>
            {t(`executionFactory.publishIssues.${issue.key}`, issue.params)}
          </li>
        ))}
      </ul>
    </>
  );
}

function mapAuditUser(userId: string | undefined, directory: Map<string, string>) {
  return formatAuditUserDisplay({ directory, id: userId });
}

function mapOperator(item: OperatorRecord, directory: Map<string, string>): ExecutionUnitCardItem {
  return {
    id: item.operatorId,
    name: item.name,
    description: item.description,
    metadataType: item.metadataType,
    category: item.category,
    categoryName: item.categoryName,
    isInternal: item.isInternal,
    releaseUser: mapAuditUser(item.releaseUser, directory),
    updateUser: mapAuditUser(item.createUser, directory),
    releaseTime: item.releaseTime,
    updateTime: item.updateTime,
    status: item.status,
    version: item.version,
  };
}

function mapToolbox(item: ToolboxRecord, directory: Map<string, string>): ExecutionUnitCardItem {
  return {
    id: item.boxId,
    name: item.name,
    description: item.description,
    metadataType: item.metadataType,
    category: item.categoryType,
    categoryName: item.categoryName,
    isInternal: item.isInternal,
    toolCount: item.toolCount ?? item.tools?.length ?? 0,
    releaseUser: mapAuditUser(item.releaseUser, directory),
    updateUser: mapAuditUser(item.updateUser ?? item.createUser, directory),
    releaseTime: item.releaseTime,
    updateTime: item.updateTime,
    status: item.status,
  };
}

function mapMcp(item: McpRecord, directory: Map<string, string>): ExecutionUnitCardItem {
  return {
    id: item.mcpId,
    name: item.name,
    description: item.description,
    category: item.category,
    isInternal: item.isInternal,
    releaseUser: mapAuditUser(item.releaseUser, directory),
    updateUser: mapAuditUser(item.createUser, directory),
    releaseTime: item.releaseTime,
    updateTime: item.updateTime,
    status: item.status,
  };
}

function mapSkill(item: SkillRecord, directory: Map<string, string>): ExecutionUnitCardItem {
  return {
    id: item.skillId,
    name: item.name,
    description: item.description,
    category: item.category,
    categoryName: item.categoryName,
    releaseUser: mapAuditUser(item.releaseUser, directory),
    updateUser: mapAuditUser(item.createUser, directory),
    releaseTime: item.releaseTime,
    updateTime: item.updateTime,
    status: item.status,
  };
}

export function ExecutionUnitListScene({
  defaultKeyword,
  defaultTab,
  marketMode = false,
  tabs = DEFAULT_TABS,
  toolbarHintKey,
}: ExecutionUnitListSceneProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pageState, reset, setKeyword } = usePageState();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const listLoadGenerationRef = useRef(0);
  const installedSyncIdleRef = useRef<IdleTaskHandle | null>(null);
  const [overlaysReady, setOverlaysReady] = useState(false);
  const resolvableTabs = useMemo(() => {
    if (!isCapabilityUxV2() || tabs.includes("operator")) {
      return tabs;
    }

    return [...tabs, "operator" as const];
  }, [tabs]);
  const [activeTab, setActiveTab] = useState<ExecutionUnitTab>(() =>
    resolveActiveTab(searchParams.get("activeTab"), defaultTab, resolvableTabs),
  );
  const [category, setCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<CategoryChipOption[]>([]);
  const [originFilter, setOriginFilter] = useState<"" | "internal" | "custom">("");
  /** 工具集下再分一个「代码函数」视图，靠服务端 metadata_type 过滤。 */
  /** 工具集拆成两个互斥视图：API 工具集 / 函数集。和新建菜单的分类一一对应。 */
  const [toolboxView, setToolboxView] = useState<ToolboxView>(() =>
    resolveToolboxView(searchParams.get("toolboxView")),
  );
  const functionTabKey = "toolbox:function";
  const openapiTabKey = "toolbox:openapi";
  const [status, setStatus] = useState<string>("");
  const [items, setItems] = useState<ExecutionUnitCardItem[]>([]);
  const auditUserDirectory = useAuditUserDirectory();
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [installedResourceIdsError, setInstalledResourceIdsError] = useState<string | null>(
    null,
  );
  const [, setPendingActionKey] = useState<string | null>(null);
  const [detailOperatorId, setDetailOperatorId] = useState<string | null>(null);
  const [detailBoxId, setDetailBoxId] = useState<string | null>(null);
  const [detailMcpId, setDetailMcpId] = useState<string | null>(null);
  const [detailSkillId, setDetailSkillId] = useState<string | null>(null);
  const [authorizeTarget, setAuthorizeTarget] = useState<{ id: string; name: string; type: string } | null>(
    null,
  );
  const [installTarget, setInstallTarget] = useState<{
    id: string;
    name: string;
    type: ImpexComponentType;
    alreadyInstalled: boolean;
  } | null>(null);
  const [skillInstallTarget, setSkillInstallTarget] = useState<{
    id: string;
    name: string;
    alreadyInstalled: boolean;
  } | null>(null);
  const [installedResourceIds, setInstalledResourceIds] = useState<Set<string>>(() => new Set());
  const [installedResourceIdsReady, setInstalledResourceIdsReady] = useState(!marketMode);
  const installedSyncAbortRef = useRef<AbortController | null>(null);
  const installedSyncManualRef = useRef(false);
  const [publishedPermTarget, setPublishedPermTarget] = useState<{
    name: string;
  } | null>(null);
  const [editMcpId, setEditMcpId] = useState<string | null>(null);
  const [updateSkillPackageTarget, setUpdateSkillPackageTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [debouncedKeyword, setDebouncedKeyword] = useState(pageState.keyword);
  const [tabCounts, setTabCounts] = useState<
    Partial<Record<ExecutionUnitTab | "openapi" | "function", number>>
  >({});
  /** 计数只在挂载和显式刷新时重拉；跟着 total 走会在列表加载完后再触发一整轮。 */
  const [countsVersion, setCountsVersion] = useState(0);

  useEffect(() => {
    if (defaultKeyword) {
      setKeyword(defaultKeyword);
    }
  }, [defaultKeyword, setKeyword]);

  useEffect(() => {
    if (pageState.keyword === "") {
      setDebouncedKeyword("");
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedKeyword(pageState.keyword);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [pageState.keyword]);

  useEffect(() => {
    if (!supportsCategoryFilter(activeTab)) {
      setCategoryOptions([]);
      setCategory("");
      return;
    }

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
  }, [activeTab, t]);

  useEffect(() => {
    setCategory("");
    setOriginFilter("");
    setStatus("");
  }, [activeTab]);

  useEffect(() => {
    const param = searchParams.get("activeTab");
    const resolved = resolveActiveTab(param, defaultTab, resolvableTabs);
    const viewParam = searchParams.get("toolboxView");
    const resolvedView = resolveToolboxView(viewParam);

    setActiveTab(resolved);
    if (resolved === "toolbox") {
      setToolboxView(resolvedView);
      // 直接带 URL 进来时也要落盘，详情页返回没带参数时才有得可依。
      window.localStorage.setItem(TOOLBOX_VIEW_STORAGE_KEY, resolvedView);
    }

    const tabParamValid = Boolean(param) && resolvableTabs.includes(param as ExecutionUnitTab);
    const viewParamValid = resolved !== "toolbox" || viewParam === resolvedView;
    if (tabParamValid && viewParamValid) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("activeTab", resolved);
    if (resolved === "toolbox") {
      nextParams.set("toolboxView", resolvedView);
    } else {
      nextParams.delete("toolboxView");
    }
    setSearchParams(nextParams, { replace: true });
  }, [defaultTab, resolvableTabs, searchParams, setSearchParams]);

  /**
   * 工具箱/MCP/Skill 都有独立详情页，本域列表点卡片直接进页面，不再中转详情抽屉。
   * 市场态仍走抽屉：引入前只要只读预览，详情页还得靠 ?from=catalog 才拿得到数据。
   */
  const openDetail = useCallback(
    (tab: ExecutionUnitTab, id: string) => {
      if (tab === "operator") {
        setDetailOperatorId(id);
        return;
      }

      if (marketMode) {
        if (tab === "toolbox") {
          setDetailBoxId(id);
        } else if (tab === "mcp") {
          setDetailMcpId(id);
        } else {
          setDetailSkillId(id);
        }
        return;
      }

      if (tab === "toolbox") {
        void navigate(`/execution-factory/toolboxes/${id}/tools`);
        return;
      }

      if (tab === "mcp") {
        void navigate(`/execution-factory/mcp/${id}`);
        return;
      }

      void navigate(`/execution-factory/skills/${id}`);
    },
    [marketMode, navigate],
  );

  useEffect(() => {
    const detailId = searchParams.get("detailId");
    if (!detailId || marketMode) {
      return;
    }

    // 先摘掉 detailId 再打开：openDetail 可能直接路由走，之后再改 searchParams 就落到旧 location 上了。
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("detailId");
    setSearchParams(nextParams, { replace: true });

    openDetail(activeTab, detailId);
  }, [activeTab, marketMode, openDetail, searchParams, setSearchParams]);

  const reloadInstalledResourceIds = useCallback(async (options?: { manual?: boolean }) => {
    if (!marketMode) {
      setInstalledResourceIds(new Set());
      setInstalledResourceIdsReady(true);
      setInstalledResourceIdsError(null);
      return;
    }

    installedSyncAbortRef.current?.abort();
    const controller = new AbortController();
    installedSyncAbortRef.current = controller;

    const manual = options?.manual ?? false;
    if (manual) {
      installedSyncManualRef.current = true;
      invalidateLocalResourceIdsCache(activeTab);
    }

    setInstalledResourceIdsReady(false);
    if (manual) {
      setInstalledResourceIdsError(null);
    }

    try {
      const ids = await collectLocalResourceIds(activeTab, {
        signal: controller.signal,
        singlePage: true,
        useCache: !manual,
      });

      if (controller.signal.aborted) {
        return;
      }

      setInstalledResourceIds(ids);
      setInstalledResourceIdsError(null);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setInstalledResourceIds(new Set());
      if (manual || installedSyncManualRef.current) {
        setInstalledResourceIdsError(extractRequestErrorMessage(error));
      }
    } finally {
      if (installedSyncAbortRef.current === controller) {
        installedSyncAbortRef.current = null;
      }

      if (!controller.signal.aborted) {
        setInstalledResourceIdsReady(true);
      }
    }
  }, [activeTab, marketMode]);

  useEffect(() => {
    return () => {
      installedSyncAbortRef.current?.abort();
      installedSyncIdleRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!marketMode) {
      void reloadInstalledResourceIds();
      return;
    }

    installedSyncManualRef.current = false;
    setInstalledResourceIdsError(null);
  }, [activeTab, marketMode, reloadInstalledResourceIds]);

  const scheduleInstalledResourceSync = useCallback(() => {
    if (!marketMode) {
      return;
    }

    installedSyncIdleRef.current?.cancel();

    const run = () => {
      installedSyncIdleRef.current = null;
      void reloadInstalledResourceIds();
    };

    installedSyncIdleRef.current = scheduleIdleTask(run, 4000);
  }, [marketMode, reloadInstalledResourceIds]);

  const showOriginFilter =
    !marketMode &&
    (activeTab === "toolbox" || activeTab === "mcp" || activeTab === "operator");

  const originFilterOptions = useMemo(
    () => [
      { value: "" as const, label: t("executionFactory.originFilterAll") },
      { value: "internal" as const, label: t("executionFactory.originFilterInternal") },
      { value: "custom" as const, label: t("executionFactory.originFilterCustom") },
    ],
    [t],
  );

  const displayItems = useMemo(() => {
    let filtered = items;

    if (originFilter === "internal") {
      filtered = filtered.filter((item) => item.isInternal);
    } else if (originFilter === "custom") {
      filtered = filtered.filter((item) => !item.isInternal);
    } else if (showOriginFilter) {
      filtered = [...filtered].sort(
        (left, right) => Number(Boolean(right.isInternal)) - Number(Boolean(left.isInternal)),
      );
    }

    if (!marketMode) {
      return filtered;
    }

    return filtered.map((item) => ({
      ...item,
      installedInDomain: installedResourceIds.has(item.id),
    }));
  }, [installedResourceIds, items, marketMode, originFilter, showOriginFilter]);

  const listQuery = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      keyword: debouncedKeyword,
      status: status || undefined,
      category: supportsCategoryFilter(activeTab) && category ? category : undefined,
      metadataType: activeTab === "toolbox" ? toolboxView : undefined,
    }),
    [activeTab, category, debouncedKeyword, page, status, toolboxView],
  );

  const loadItems = useCallback(async () => {
    const generation = listLoadGenerationRef.current + 1;
    listLoadGenerationRef.current = generation;

    setLoading(true);
    if (page === 1) {
      setLoadError(null);
    } else {
      setLoadMoreError(null);
    }

    try {
      if (activeTab === "operator") {
        // status/category are cross-tab filter strings; assert to this tab's
        // query shape at the call boundary (the select only emits valid values).
        const query = listQuery as Parameters<typeof listOperators>[0];
        const result = marketMode
          ? await listOperatorMarket(query)
          : await listOperators(query);
        if (generation !== listLoadGenerationRef.current) {
          return;
        }
        const mapped = result.items.map((item) => mapOperator(item, auditUserDirectory));
        setItems((prev) => (page === 1 ? mapped : [...prev, ...mapped]));
        setTotal(result.total);
        if (page === 1) {
          scheduleInstalledResourceSync();
        }
        return;
      }

      if (activeTab === "toolbox") {
        const query = listQuery as Parameters<typeof listToolboxes>[0];
        const result = marketMode
          ? await listToolboxMarket(query)
          : await listToolboxes(query);
        if (generation !== listLoadGenerationRef.current) {
          return;
        }
      const mapped = result.items.map((item) => mapToolbox(item, auditUserDirectory));
      setItems((prev) => (page === 1 ? mapped : [...prev, ...mapped]));
      setTotal(result.total);
      if (page === 1) {
        scheduleInstalledResourceSync();
      }
      return;
      }

      if (activeTab === "mcp") {
        const query = listQuery as Parameters<typeof listMcps>[0];
        const result = marketMode ? await listMcpMarket(query) : await listMcps(query);
        if (generation !== listLoadGenerationRef.current) {
          return;
        }
        const mapped = result.items.map((item) => mapMcp(item, auditUserDirectory));
        setItems((prev) => (page === 1 ? mapped : [...prev, ...mapped]));
        setTotal(result.total);
        if (page === 1) {
          scheduleInstalledResourceSync();
        }
        return;
      }

      const query = listQuery as Parameters<typeof listSkills>[0];
      const result = marketMode
        ? await listSkillMarket(query)
        : await listSkills(query);
      if (generation !== listLoadGenerationRef.current) {
        return;
      }
      const mapped = result.items.map((item) => mapSkill(item, auditUserDirectory));
      setItems((prev) => (page === 1 ? mapped : [...prev, ...mapped]));
      setTotal(result.total);
      if (page === 1) {
        scheduleInstalledResourceSync();
      }
    } catch (error) {
      if (generation !== listLoadGenerationRef.current) {
        return;
      }
      if (page === 1) {
        setItems([]);
        setTotal(0);
        setLoadError(extractRequestErrorMessage(error));
      } else {
        setLoadMoreError(extractRequestErrorMessage(error));
      }
    } finally {
      if (generation === listLoadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [activeTab, auditUserDirectory, listQuery, marketMode, page, scheduleInstalledResourceSync]);

  useEffect(() => {
    setPage(1);
    setItems([]);
    setLoading(true);
  }, [activeTab, debouncedKeyword, status, marketMode, category]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // 函数视图是工具集的过滤视图，「共 N 个…」也要跟着叫函数集，否则数的东西和说的名字对不上。
  const tabLabel =
    activeTab === "toolbox"
      ? t(
          toolboxView === "function"
            ? "executionFactory.functionToolboxTab"
            : "executionFactory.openapiToolboxTab",
        )
      : t(getExecutionUnitTabLabelKey(activeTab));
  const emptyDescription = t(
    marketMode
      ? `executionFactory.catalogEmptyByTab.${activeTab}`
      : `executionFactory.emptyByTab.${activeTab}`,
  );
  const showCategoryFilter = supportsCategoryFilter(activeTab);
  const hasOriginFilteredEmpty = !loading && items.length > 0 && displayItems.length === 0;

  const tabItems = useMemo(
    () =>
      resolveVisibleManagementTabs(activeTab)
        .filter((tab) => resolvableTabs.includes(tab))
        .flatMap((tab) => {
          const count = tabCounts[tab];
          const entry = {
            key: tab,
            label: (
              <span className={styles.tabLabel}>
                {t(getExecutionUnitTabLabelKey(tab))}
                {count === undefined ? null : (
                  <span className={styles.tabLabelCount}>{count}</span>
                )}
              </span>
            ),
          };

          if (tab !== "toolbox") {
            return [entry];
          }

          // 工具集拆成两个互斥视图，都是服务端过滤，不再保留并集入口。
          return [
            {
              key: openapiTabKey,
              label: (
                <span className={styles.tabLabel}>
                  {t("executionFactory.openapiToolboxTab")}
                  {tabCounts.openapi === undefined ? null : (
                    <span className={styles.tabLabelCount}>{tabCounts.openapi}</span>
                  )}
                </span>
              ),
            },
            {
              key: functionTabKey,
              label: (
                <span className={styles.tabLabel}>
                  {t("executionFactory.functionToolboxTab")}
                  {tabCounts.function === undefined ? null : (
                    <span className={styles.tabLabelCount}>{tabCounts.function}</span>
                  )}
                </span>
              ),
            },
          ];
        }),
    [activeTab, functionTabKey, openapiTabKey, resolvableTabs, t, tabCounts],
  );

  const returnToPrimaryCapabilities = () => {
    const primaryTab = getDefaultManagementTab();
    window.localStorage.setItem(TAB_STORAGE_KEY, primaryTab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("activeTab", primaryTab);
    setSearchParams(nextParams);
  };

  const statusOptions = useMemo(() => {
    const base = [
      { value: "", label: t("executionFactory.allStatus") },
      { value: "published", label: t("executionFactory.statuses.published") },
      { value: "unpublish", label: t("executionFactory.statuses.unpublish") },
      { value: "offline", label: t("executionFactory.statuses.offline") },
    ];

    if (activeTab === "operator") {
      return [
        ...base,
        { value: "editing", label: t("executionFactory.statuses.editing") },
      ];
    }

    if (
      activeTab === "toolbox" ||
      activeTab === "mcp" ||
      activeTab === "skill"
    ) {
      return base.filter((item) => item.value !== "editing");
    }

    return [];
  }, [activeTab, t]);

  const handleCardClick = (item: ExecutionUnitCardItem) => {
    openDetail(activeTab, item.id);
  };

  const reloadList = useCallback(() => {
    setPage(1);
    setItems([]);
    setCountsVersion((current) => current + 1);
    void loadItems();
  }, [loadItems]);

  const handleCreateMenuResourceCreated = useCallback(
    ({ tab, id, toolId }: { tab: ExecutionUnitTab; id: string; toolId?: string }) => {
      reloadList();
      if (tab === "operator") {
        setDetailOperatorId(id);
        return;
      }
      if (tab === "toolbox") {
        if (toolId) {
          void navigate(`/execution-factory/toolboxes/${id}/tools?toolId=${toolId}`);
          return;
        }
        void navigate(`/execution-factory/toolboxes/${id}/tools?create=1`);
        return;
      }
      if (tab === "mcp") {
        void navigate(`/execution-factory/mcp/${id}`);
        return;
      }
      void navigate(`/execution-factory/skills/${id}`);
    },
    [navigate, reloadList],
  );

  /**
   * 工具箱一发布，里面的工具就直接暴露给 Agent 选用——缺描述的工具等于永远不会被调到。
   * 预检查只提示不拦截：拿不到工具清单时按无问题处理，不能因为预检查失败堵住发布。
   */
  const collectPublishIssues = useCallback(
    async (item: ExecutionUnitCardItem): Promise<ToolboxPublishIssue[]> => {
      try {
        const { items: tools } = await listTools(item.id, { page: 1, pageSize: 100 });
        const shouldLoadCode =
          item.metadataType === "function" && tools.length <= PUBLISH_PREFLIGHT_DETAIL_LIMIT;
        const codes = shouldLoadCode
          ? await Promise.all(
              tools.map(async (tool) => {
                try {
                  const detail = await getToolDetail(item.id, tool.toolId);
                  return detail.functionInput?.code;
                } catch {
                  return undefined;
                }
              }),
            )
          : [];

        return collectToolboxPublishIssues(
          tools.map((tool, index) => ({
            code: codes[index],
            description: tool.description,
            metadataType: tool.metadataType,
            name: tool.name,
            status: tool.status,
          })),
        );
      } catch {
        return [];
      }
    },
    [],
  );

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
        options?: { extraContent?: ReactNode; okTextKey?: string; danger?: boolean },
      ) => {
        void modal.confirm({
          title: t(titleKey),
          content: (
            <>
              {t(descriptionKey, {
                name: item.name,
                status: t(`executionFactory.statuses.${nextStatus}`),
              })}
              {options?.extraContent}
            </>
          ),
          okButtonProps: options?.danger ? { danger: true } : undefined,
          okText: t(options?.okTextKey ?? "common.save"),
          cancelText: t("common.cancel"),
          onOk: async () => {
            try {
              await onConfirm();
              void message.success(t("common.success"));
              reloadList();
              if (!marketMode && nextStatus === "published") {
                setPublishedPermTarget({ name: item.name });
              }
            } catch (error) {
              void message.error(extractRequestErrorMessage(error));
              return Promise.reject(error instanceof Error ? error : new Error(String(error)));
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
            try {
              await onConfirm();
              void message.success(t("common.success"));
              reloadList();
            } catch (error) {
              void message.error(extractRequestErrorMessage(error));
              return Promise.reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
        });
      };

      if (action === "authorize") {
        setAuthorizeTarget({ id: item.id, name: item.name, type: AUTHZ_TYPE_BY_TAB[activeTab] });
        return;
      }

      if (action === "install") {
        if (activeTab === "skill") {
          setSkillInstallTarget({
            id: item.id,
            name: item.name,
            alreadyInstalled: item.installedInDomain === true,
          });
          return;
        }

        const componentType = impexTypeForTab(activeTab);
        if (!componentType) {
          return;
        }

        setInstallTarget({
          id: item.id,
          name: item.name,
          type: componentType,
          alreadyInstalled: item.installedInDomain === true,
        });
        return;
      }

      if (action === "view") {
        openDetail(activeTab, item.id);
        return;
      }

      if (action === "export") {
        const componentType = impexTypeForTab(activeTab);
        if (!componentType) {
          return;
        }

        const actionKey = `${action}:${item.id}`;
        setPendingActionKey(actionKey);

        void (async () => {
          try {
            await downloadComponentExport(componentType, item.id, item.name);
            void message.success(t("executionFactory.exportSuccess"));
          } catch (error) {
            const detail = extractRequestErrorDetail(error);
            void message.error(detail.description ?? detail.message);
          } finally {
            setPendingActionKey((current) => (current === actionKey ? null : current));
          }
        })();
        return;
      }

      if (action === "download") {
        if (activeTab !== "skill") {
          return;
        }

        const actionKey = `${action}:${item.id}`;
        setPendingActionKey(actionKey);

        void (async () => {
          try {
            await downloadSkillPackage(item.id, item.name);
            void message.success(t("executionFactory.downloadSuccess"));
          } catch (error) {
            void message.error(extractRequestErrorMessage(error));
          } finally {
            setPendingActionKey((current) => (current === actionKey ? null : current));
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

      if (action === "publish" || action === "offline") {
        const nextStatus = resolveLifecycleActionStatus(action);
        if (activeTab === "operator" && item.version) {
          runStatusChange(
            nextStatus,
            "executionFactory.operatorStatusChangeConfirmTitle",
            "executionFactory.operatorStatusChangeConfirmDescription",
            () => updateOperatorStatus(item.id, item.version!, nextStatus),
          );
        } else if (activeTab === "toolbox") {
          // 发布前跑一次预检查（缺 summary、broken $ref 等），有问题就在确认框里
          // 列出并给「仍然发布」。下架（offline）不需要预检查，走 main 的直连即可。
          if (nextStatus === "published") {
            void (async () => {
              const issues = await collectPublishIssues(item);
              runStatusChange(
                "published",
                "executionFactory.toolboxStatusChangeConfirmTitle",
                "executionFactory.toolboxStatusChangeConfirmDescription",
                () => updateToolboxStatus(item.id, "published"),
                issues.length > 0
                  ? {
                      danger: true,
                      extraContent: <PublishIssueList issues={issues} />,
                      okTextKey: "executionFactory.publishAnyway",
                    }
                  : undefined,
              );
            })();
          } else {
            runStatusChange(
              nextStatus,
              "executionFactory.toolboxStatusChangeConfirmTitle",
              "executionFactory.toolboxStatusChangeConfirmDescription",
              () => updateToolboxStatus(item.id, nextStatus),
            );
          }
        } else if (activeTab === "mcp") {
          runStatusChange(
            nextStatus,
            "executionFactory.mcpStatusChangeConfirmTitle",
            "executionFactory.mcpStatusChangeConfirmDescription",
            () => updateMcpStatus(item.id, nextStatus),
          );
        } else if (activeTab === "skill") {
          runStatusChange(
            nextStatus,
            "executionFactory.skillStatusChangeConfirmTitle",
            "executionFactory.skillStatusChangeConfirmDescription",
            () => updateSkillStatus(item.id, nextStatus),
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
    [
      activeTab,
      collectPublishIssues,
      impexTypeForTab,
      marketMode,
      message,
      modal,
      navigate,
      openDetail,
      reloadList,
      t,
    ],
  );

  const countedTabsKey = useMemo(
    () =>
      resolveVisibleManagementTabs(activeTab)
        .filter((tab) => resolvableTabs.includes(tab))
        .join(","),
    [activeTab, resolvableTabs],
  );

  // tab 上的数量各拉一次 total；page_size=1 只为拿计数，不取列表内容。
  // 依赖 tab 列表本身而不是 activeTab——来回切 tab 时列表没变，不该重拉。
  useEffect(() => {
    const tabs = countedTabsKey.split(",").filter(Boolean) as ExecutionUnitTab[];
    let cancelled = false;

    void (async () => {
      const entries = await Promise.all(
        tabs.map(async (tab) => {
          try {
            const query = { page: 1, pageSize: 1 };
            const total = marketMode
              ? tab === "toolbox"
                ? (await listToolboxMarket(query)).total
                : tab === "mcp"
                  ? (await listMcpMarket(query)).total
                  : tab === "skill"
                    ? (await listSkillMarket(query)).total
                    : (await listOperatorMarket(query)).total
              : tab === "toolbox"
                ? (await listToolboxes(query)).total
                : tab === "mcp"
                  ? (await listMcps(query)).total
                  : tab === "skill"
                    ? (await listSkills(query)).total
                    : (await listOperators(query)).total;
            return [tab, total] as const;
          } catch {
            return [tab, undefined] as const;
          }
        }),
      );

      // 工具集下面还有「仅 API」「仅函数」两个子视图，各自的数量单独拉一次。
      const subtotals: Partial<Record<"openapi" | "function", number>> = {};
      if (tabs.includes("toolbox")) {
        await Promise.all(
          (["openapi", "function"] as const).map(async (metadataType) => {
            try {
              const query = { page: 1, pageSize: 1, metadataType };
              subtotals[metadataType] = marketMode
                ? (await listToolboxMarket(query)).total
                : (await listToolboxes(query)).total;
            } catch {
              subtotals[metadataType] = undefined;
            }
          }),
        );
      }

      if (!cancelled) {
        setTabCounts({
          ...Object.fromEntries(entries.filter(([, total]) => total !== undefined)),
          ...subtotals,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [countedTabsKey, countsVersion, marketMode]);

  const reload = () => {
    reset();
    setStatus("");
    setCategory("");
    reloadList();
  };

  const hasMore = items.length < total;

  const overlayRequested = useMemo(
    () =>
      Boolean(
        detailOperatorId ||
          detailBoxId ||
          detailMcpId ||
          detailSkillId ||
          installTarget ||
          skillInstallTarget ||
          publishedPermTarget ||
          editMcpId ||
          updateSkillPackageTarget,
      ),
    [
      detailBoxId,
      detailMcpId,
      detailOperatorId,
      detailSkillId,
      editMcpId,
      installTarget,
      publishedPermTarget,
      skillInstallTarget,
      updateSkillPackageTarget,
    ],
  );

  useEffect(() => {
    if (overlayRequested) {
      setOverlaysReady(true);
    }
  }, [overlayRequested]);

  useEffect(() => {
    if (marketMode) {
      return;
    }

    const handle = scheduleIdleTask(() => setOverlaysReady(true), 3000);
    return () => handle.cancel();
  }, [marketMode]);

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
        {/* 页面标题由面包屑承担，这里不再重复一遍；算子视图仍需要返回入口。 */}
        {isCapabilityUxV2() && !marketMode && activeTab === "operator" ? (
          <div className={styles.pageIntroActions}>
            <Button onClick={returnToPrimaryCapabilities} type="link">
              {t("executionFactory.backToCapabilities")}
            </Button>
          </div>
        ) : null}

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
              onRefresh={reloadList}
              onResourceCreated={handleCreateMenuResourceCreated}
            />
          </div>
        ) : (
          <div className={styles.toolbarActions}>
            {installedResourceIdsError ? (
              <Alert
                action={
                  <AppButton onClick={() => void reloadInstalledResourceIds({ manual: true })} type="link">
                    {t("common.retry")}
                  </AppButton>
                }
                message={t("executionFactory.installedStateSyncFailed")}
                showIcon
                type="warning"
              />
            ) : null}
            <span className={styles.toolbarMeta}>{t(toolbarHintKey)}</span>
          </div>
        )}

        <Tabs
          activeKey={
            activeTab === "toolbox"
              ? toolboxView === "function"
                ? functionTabKey
                : openapiTabKey
              : activeTab
          }
          className={styles.tabs}
          items={tabItems}
          onChange={(key) => {
            const isFunctionView = key === functionTabKey;
            const isOpenapiView = key === openapiTabKey;
            const nextTab = (isFunctionView || isOpenapiView
              ? "toolbox"
              : key) as ExecutionUnitTab;
            const nextParams = new URLSearchParams(searchParams);

            if (isFunctionView || isOpenapiView) {
              const nextView: ToolboxView = isFunctionView ? "function" : "openapi";
              setToolboxView(nextView);
              // 子视图跟着进 URL，详情页返回时才落回原来那个 tab。
              window.localStorage.setItem(TOOLBOX_VIEW_STORAGE_KEY, nextView);
              nextParams.set("toolboxView", nextView);
            } else {
              nextParams.delete("toolboxView");
            }

            setPage(1);
            window.localStorage.setItem(TAB_STORAGE_KEY, nextTab);
            nextParams.set("activeTab", nextTab);
            setSearchParams(nextParams);
          }}
        />

        {isCapabilityUxV2() && !marketMode && activeTab === "operator" ? (
          <Alert
            message={t("executionFactory.advancedOperatorBanner")}
            showIcon
            style={{ marginBottom: 16 }}
            type="info"
          />
        ) : null}

        <div className={styles.filterBar}>
          <div className={styles.filterLeft}>
            {showOriginFilter ? (
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>{t("executionFactory.originFilter")}</span>
                <Select
                  onChange={setOriginFilter}
                  options={originFilterOptions}
                  style={{ minWidth: 140 }}
                  value={originFilter}
                />
              </div>
            ) : null}
            {showCategoryFilter ? (
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>{t("executionFactory.typeFilter")}</span>
                <Select
                  onChange={setCategory}
                  options={categoryOptions}
                  style={{ minWidth: 160 }}
                  value={category}
                />
              </div>
            ) : null}
            {!marketMode && statusOptions.length > 0 ? (
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>
                  {t("executionFactory.publishStatusFilter")}
                </span>
                <Select
                  options={statusOptions}
                  style={{ minWidth: 140 }}
                  value={status}
                  onChange={setStatus}
                />
              </div>
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

        {!loading && total > 0 ? (
          <div className={styles.resultCount}>
            {items.length < total
              ? t("executionFactory.resultCountLoaded", {
                  loaded: items.length,
                  total,
                  tab: tabLabel,
                })
              : t("executionFactory.resultCount", { count: total, tab: tabLabel })}
          </div>
        ) : null}

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
            <div className={styles.cardGrid}>
              <ExecutionUnitCardSkeleton count={8} />
            </div>
          ) : null}
          {!loading && displayItems.length === 0 ? (
            <div className={styles.emptyWrap}>
              <Empty
                description={
                  hasOriginFilteredEmpty
                    ? t("executionFactory.originFilterEmpty", { tab: tabLabel })
                    : emptyDescription
                }
              >
                {!marketMode && !hasOriginFilteredEmpty ? (
                  <CreateMenu
                    activeTab={activeTab}
                    onRefresh={reloadList}
                    onResourceCreated={handleCreateMenuResourceCreated}
                    variant="empty"
                  />
                ) : null}
              </Empty>
            </div>
          ) : null}
          {displayItems.length > 0 ? (
            <>
              <div className={styles.cardGrid}>
                {displayItems.map((item) => (
                  <ExecutionUnitCard
                    activeTab={activeTab}
                    installedStateReady={installedResourceIdsReady}
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
                  {loadMoreError ? (
                    <Alert
                      action={
                        <AppButton onClick={() => void loadItems()} type="link">
                          {t("common.retry")}
                        </AppButton>
                      }
                      message={t("executionFactory.loadMoreFailed")}
                      showIcon
                      type="error"
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      {overlaysReady ? (
        <Suspense fallback={null}>
          <ExecutionUnitListOverlays
            activeTab={activeTab}
            detailBoxId={detailBoxId}
            detailMcpId={detailMcpId}
            detailOperatorId={detailOperatorId}
            detailSkillId={detailSkillId}
            editMcpId={editMcpId}
            installTarget={installTarget}
            marketMode={marketMode}
            navigate={navigate}
            onCloseDetailBox={() => setDetailBoxId(null)}
            onCloseDetailMcp={() => setDetailMcpId(null)}
            onCloseDetailOperator={() => setDetailOperatorId(null)}
            onCloseDetailSkill={() => setDetailSkillId(null)}
            onCloseEditMcp={() => setEditMcpId(null)}
            onCloseInstallTarget={() => setInstallTarget(null)}
            onClosePublishedPerm={() => setPublishedPermTarget(null)}
            onCloseSkillInstallTarget={() => setSkillInstallTarget(null)}
            onCloseUpdateSkillPackage={() => setUpdateSkillPackageTarget(null)}
            onReloadInstalledResourceIds={() => void reloadInstalledResourceIds()}
            onReloadList={reloadList}
            publishedPermTarget={publishedPermTarget}
            skillInstallTarget={skillInstallTarget}
            updateSkillPackageTarget={updateSkillPackageTarget}
          />
        </Suspense>
      ) : null}

      {authorizeTarget ? (
        <ObjectAuthorizeDrawer
          objId={authorizeTarget.id}
          objName={authorizeTarget.name}
          objType={authorizeTarget.type}
          onClose={() => setAuthorizeTarget(null)}
          open={Boolean(authorizeTarget)}
        />
      ) : null}
    </>
  );
}
