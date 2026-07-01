/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Input, Select, Spin, Tabs } from "antd";
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
import { listOperatorCategories } from "@/modules/execution-factory/services/category.service";
import type { McpRecord, McpStatus } from "@/modules/execution-factory/types/mcp";
import type { OperatorRecord, PublicOperatorStatus } from "@/modules/execution-factory/types/operator";
import type { SkillRecord, SkillStatus } from "@/modules/execution-factory/types/skill";
import type { ToolboxRecord, ToolboxStatus } from "@/modules/execution-factory/types/toolbox";
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
const TAB_STORAGE_KEY = "execution-factory.activeTab";
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

function mapOperator(item: OperatorRecord): ExecutionUnitCardItem {
  return {
    id: item.operatorId,
    name: item.name,
    description: item.description,
    metadataType: item.metadataType,
    category: item.category,
    categoryName: item.categoryName,
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
    category: item.categoryType,
    categoryName: item.categoryName,
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
    category: item.category,
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
    category: item.category,
    categoryName: item.categoryName,
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
  tabs = DEFAULT_TABS,
  titleKey,
  descriptionKey,
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
  const [status, setStatus] = useState<string>("");
  const [items, setItems] = useState<ExecutionUnitCardItem[]>([]);
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
  const [detailBoxEditMode, setDetailBoxEditMode] = useState(false);
  const [detailMcpId, setDetailMcpId] = useState<string | null>(null);
  const [detailSkillId, setDetailSkillId] = useState<string | null>(null);
  const [authorizeTarget, setAuthorizeTarget] = useState<{ id: string; name: string; type: string } | null>(
    null,
  );
  const [historySkillId, setHistorySkillId] = useState<string | null>(null);
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

    setActiveTab(resolved);

    if (param && resolvableTabs.includes(param as ExecutionUnitTab)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("activeTab", resolved);
    setSearchParams(nextParams, { replace: true });
  }, [defaultTab, resolvableTabs, searchParams, setSearchParams]);

  useEffect(() => {
    const detailId = searchParams.get("detailId");
    if (!detailId || marketMode) {
      return;
    }

    if (activeTab === "operator") {
      setDetailOperatorId(detailId);
    } else if (activeTab === "toolbox") {
      setDetailBoxId(detailId);
    } else if (activeTab === "mcp") {
      setDetailMcpId(detailId);
    } else if (activeTab === "skill") {
      setDetailSkillId(detailId);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("detailId");
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, marketMode, searchParams, setSearchParams]);

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
    }),
    [activeTab, category, debouncedKeyword, page, status],
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
        const mapped = result.items.map(mapOperator);
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
      const mapped = result.items.map(mapToolbox);
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
        const mapped = result.items.map(mapMcp);
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
      const mapped = result.items.map(mapSkill);
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
  }, [activeTab, listQuery, marketMode, page, scheduleInstalledResourceSync]);

  useEffect(() => {
    setPage(1);
    setItems([]);
    setLoading(true);
  }, [activeTab, debouncedKeyword, status, marketMode, category]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const tabLabel = t(getExecutionUnitTabLabelKey(activeTab));
  const emptyDescription = t(
    marketMode
      ? `executionFactory.catalogEmptyByTab.${activeTab}`
      : `executionFactory.emptyByTab.${activeTab}`,
  );
  const showCategoryFilter = supportsCategoryFilter(activeTab);
  const hasOriginFilteredEmpty = !loading && items.length > 0 && displayItems.length === 0;

  const openEmptyCreate = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("create", "1");
    setSearchParams(nextParams);
  };

  const tabItems = useMemo(
    () =>
      resolveVisibleManagementTabs(activeTab)
        .filter((tab) => resolvableTabs.includes(tab))
        .map((tab) => ({
          key: tab,
          label: t(getExecutionUnitTabLabelKey(tab)),
        })),
    [activeTab, resolvableTabs, t],
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
    if (activeTab === "operator") {
      setDetailOperatorId(item.id);
      return;
    }

    if (activeTab === "toolbox") {
      setDetailBoxEditMode(false);
      setDetailBoxId(item.id);
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
            try {
              await onConfirm();
              void message.success(t("common.success"));
              reloadList();
              if (!marketMode && nextStatus === "published") {
                setPublishedPermTarget({ name: item.name });
              }
            } catch (error) {
              void message.error(extractRequestErrorMessage(error));
              return Promise.reject(error);
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
              return Promise.reject(error);
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
        if (activeTab === "operator") {
          setDetailOperatorId(item.id);
        } else if (activeTab === "toolbox") {
          setDetailBoxEditMode(false);
          setDetailBoxId(item.id);
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
          setDetailBoxEditMode(true);
          setDetailBoxId(item.id);
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

  const overlayRequested = useMemo(
    () =>
      Boolean(
        detailOperatorId ||
          detailBoxId ||
          detailMcpId ||
          detailSkillId ||
          historySkillId ||
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
      historySkillId,
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
        <div className={styles.pageIntro}>
          <h2 className={styles.pageIntroTitle}>{t(titleKey)}</h2>
          <p className={styles.pageIntroDescription}>{t(descriptionKey)}</p>
          {isCapabilityUxV2() && !marketMode && activeTab === "operator" ? (
            <div className={styles.pageIntroActions}>
              <Button onClick={returnToPrimaryCapabilities} type="link">
                {t("executionFactory.backToCapabilities")}
              </Button>
            </div>
          ) : null}
        </div>

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
              onResourceCreated={({ tab, id, toolId }) => {
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
                  setDetailMcpId(id);
                  return;
                }
                setDetailSkillId(id);
              }}
            />
            <span className={styles.toolbarMeta}>{t(toolbarHintKey)}</span>
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
          activeKey={activeTab}
          className={styles.tabs}
          items={tabItems}
          onChange={(key) => {
            const nextTab = key as ExecutionUnitTab;
            window.localStorage.setItem(TAB_STORAGE_KEY, nextTab);
            const nextParams = new URLSearchParams(searchParams);
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
              <>
                <span className={styles.filterLabel}>{t("executionFactory.originFilter")}</span>
                <div className={styles.categoryGroup}>
                  {originFilterOptions.map((option) => (
                    <button
                      className={`${styles.categoryChip} ${
                        originFilter === option.value ? styles.categoryChipActive : ""
                      }`}
                      key={option.value || "all"}
                      onClick={() => setOriginFilter(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {showCategoryFilter ? (
              <>
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
              </>
            ) : null}
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
                  <AppButton onClick={openEmptyCreate} type="primary">
                    {t(`executionFactory.emptyCreateByTab.${activeTab}`)}
                  </AppButton>
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
            detailBoxEditMode={detailBoxEditMode}
            detailMcpId={detailMcpId}
            detailOperatorId={detailOperatorId}
            detailSkillId={detailSkillId}
            editMcpId={editMcpId}
            historySkillId={historySkillId}
            installTarget={installTarget}
            marketMode={marketMode}
            navigate={navigate}
            onCloseDetailBox={() => setDetailBoxId(null)}
            onCloseDetailBoxEditMode={() => setDetailBoxEditMode(false)}
            onCloseDetailMcp={() => setDetailMcpId(null)}
            onCloseDetailOperator={() => setDetailOperatorId(null)}
            onCloseDetailSkill={() => setDetailSkillId(null)}
            onCloseEditMcp={() => setEditMcpId(null)}
            onCloseHistorySkill={() => setHistorySkillId(null)}
            onCloseInstallTarget={() => setInstallTarget(null)}
            onClosePublishedPerm={() => setPublishedPermTarget(null)}
            onCloseSkillInstallTarget={() => setSkillInstallTarget(null)}
            onCloseUpdateSkillPackage={() => setUpdateSkillPackageTarget(null)}
            onOpenHistorySkill={(skillId) => setHistorySkillId(skillId)}
            onReloadInstalledResourceIds={reloadInstalledResourceIds}
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
