/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { RightOutlined, SearchOutlined, ToolOutlined } from "@ant-design/icons";
import { Input, Modal, Spin, Tabs } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import {
  buildActionSourceFromCatalogSelection,
  listActionTypeExecutionFactoryCatalog,
  loadActionTypeMcpServerTools,
  loadActionTypeToolBoxTools,
  type ActionTypeCatalogSelection,
  type ActionTypeCatalogTool,
  type ActionTypeExecutionFactoryCatalog,
} from "@/modules/knowledge-network/services/action-type-tool.service";
import type { ActionTypeActionSource } from "@/modules/knowledge-network/types/knowledge-network";
import type { ToolboxMetadataType } from "@/modules/execution-factory/types/toolbox";

import styles from "./ActionTypeToolSelectModal.module.css";

type ActionTypeToolSelectModalProps = {
  allowedKinds?: Array<"mcp" | "tool">;
  onCancel: () => void;
  onConfirm: (source: ActionTypeActionSource, selection: ActionTypeCatalogSelection) => void;
  open: boolean;
  toolboxTabLabel?: string;
  toolboxMetadataType?: ToolboxMetadataType;
  value?: ActionTypeActionSource;
};

function buildSelectionKey(selection: ActionTypeCatalogSelection) {
  if (selection.kind === "mcp") {
    return `mcp:${selection.mcpId}:${selection.tool.toolId}`;
  }

  return `tool:${selection.boxId}:${selection.tool.toolId}`;
}

function buildSelectionFromValue(
  catalog: ActionTypeExecutionFactoryCatalog,
  value?: ActionTypeActionSource,
): ActionTypeCatalogSelection | null {
  if (!value?.toolId) {
    return null;
  }

  if (value.type === "mcp" && value.mcpId) {
    const server = catalog.mcpServers.find((item) => item.mcpId === value.mcpId);
    const tool = server?.tools.find((item) => item.toolId === value.toolId);
    if (server && tool) {
      return {
        kind: "mcp",
        mcpId: server.mcpId,
        mcpName: server.mcpName,
        tool,
      };
    }
  }

  const box = catalog.toolBoxes.find((item) => item.boxId === value.boxId);
  const tool = box?.tools.find((item) => item.toolId === value.toolId);
  if (box && tool) {
    return {
      boxId: box.boxId,
      boxName: box.boxName,
      kind: "tool",
      tool,
    };
  }

  return null;
}

function buildToolFromValue(value: ActionTypeActionSource): ActionTypeCatalogTool | null {
  const toolId = value.toolId || value.toolName;
  const toolName = value.toolName || value.toolId;

  if (!toolId || !toolName) {
    return null;
  }

  return {
    parameters: [],
    toolId,
    toolName,
  };
}

const DEFAULT_ALLOWED_KINDS: Array<"mcp" | "tool"> = ["tool", "mcp"];
const CATALOG_SEARCH_DEBOUNCE_MS = 300;
type ActionTypeExecutionUnitTab = "function" | "mcp" | "openapi";

/** Stable key so catalog reloads only when the selected source identity changes. */
function buildActionSourceValueKey(value?: ActionTypeActionSource) {
  if (!value) {
    return "";
  }

  return [
    value.type,
    value.boxId ?? "",
    value.mcpId ?? "",
    value.toolId ?? "",
    value.toolName ?? "",
  ].join("|");
}

function buildAllowedKindsKey(allowedKinds: Array<"mcp" | "tool">) {
  return [...allowedKinds].sort().join("|");
}

function getExecutionUnitTabs(
  allowedKinds: Array<"mcp" | "tool">,
  toolboxMetadataType?: ToolboxMetadataType,
): ActionTypeExecutionUnitTab[] {
  const tabs: ActionTypeExecutionUnitTab[] = [];

  if (allowedKinds.includes("tool")) {
    if (toolboxMetadataType) {
      tabs.push(toolboxMetadataType);
    } else {
      tabs.push("openapi", "function");
    }
  }

  if (allowedKinds.includes("mcp")) {
    tabs.push("mcp");
  }

  return tabs;
}

function resolveExecutionUnitTab(
  tabs: ActionTypeExecutionUnitTab[],
  value?: ActionTypeActionSource,
  toolboxMetadataType?: ToolboxMetadataType,
): ActionTypeExecutionUnitTab {
  if (value?.type === "mcp" && tabs.includes("mcp")) {
    return "mcp";
  }

  if (toolboxMetadataType && tabs.includes(toolboxMetadataType)) {
    return toolboxMetadataType;
  }

  return tabs[0] ?? "openapi";
}

export function ActionTypeToolSelectModal({
  allowedKinds = DEFAULT_ALLOWED_KINDS,
  onCancel,
  onConfirm,
  open,
  toolboxTabLabel,
  toolboxMetadataType,
  value,
}: ActionTypeToolSelectModalProps) {
  const { t } = useTranslation();
  const allowedKindsKey = useMemo(() => buildAllowedKindsKey(allowedKinds), [allowedKinds]);
  const executionUnitTabs = useMemo(
    () =>
      getExecutionUnitTabs(
        allowedKindsKey ? (allowedKindsKey.split("|") as Array<"mcp" | "tool">) : [],
        toolboxMetadataType,
      ),
    [allowedKindsKey, toolboxMetadataType],
  );
  const executionUnitTabsKey = useMemo(() => executionUnitTabs.join("|"), [executionUnitTabs]);
  const [activeTab, setActiveTab] = useState<ActionTypeExecutionUnitTab>(() =>
    resolveExecutionUnitTab(
      getExecutionUnitTabs(allowedKinds, toolboxMetadataType),
      value,
      toolboxMetadataType,
    ),
  );
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<ActionTypeExecutionFactoryCatalog>({
    mcpServers: [],
    toolBoxes: [],
  });
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const valueRef = useRef(value);
  valueRef.current = value;
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [loadingGroupKeys, setLoadingGroupKeys] = useState<string[]>([]);
  const loadedGroupKeysRef = useRef(new Set<string>());
  const loadingGroupKeysRef = useRef(new Set<string>());
  const catalogRequestIdRef = useRef(0);
  const restoredSelectionValueKeyRef = useRef<string | null>(null);
  const [selectedSelection, setSelectedSelection] = useState<ActionTypeCatalogSelection | null>(
    null,
  );
  const valueKey = useMemo(() => buildActionSourceValueKey(value), [value]);

  useEffect(() => {
    if (!open) {
      restoredSelectionValueKeyRef.current = null;
      return;
    }

    setActiveTab(
      resolveExecutionUnitTab(executionUnitTabs, valueRef.current, toolboxMetadataType),
    );
  }, [executionUnitTabs, executionUnitTabsKey, open, toolboxMetadataType, valueKey]);

  const ensureGroupToolsLoaded = useCallback(async (groupKey: string) => {
    if (loadedGroupKeysRef.current.has(groupKey) || loadingGroupKeysRef.current.has(groupKey)) {
      const isToolGroup = groupKey.startsWith("group:tool:");
      const resourceId = groupKey.replace(/^group:(tool|mcp):/, "");
      return isToolGroup
        ? catalogRef.current.toolBoxes.find((box) => box.boxId === resourceId)?.tools ?? []
        : catalogRef.current.mcpServers.find((server) => server.mcpId === resourceId)?.tools ?? [];
    }

    const isToolGroup = groupKey.startsWith("group:tool:");
    const resourceId = groupKey.replace(/^group:(tool|mcp):/, "");

    const hasCachedTools = isToolGroup
      ? catalogRef.current.toolBoxes.some(
          (box) => box.boxId === resourceId && box.tools.length > 0,
        )
      : catalogRef.current.mcpServers.some(
          (server) => server.mcpId === resourceId && server.tools.length > 0,
        );

    if (hasCachedTools) {
      loadedGroupKeysRef.current.add(groupKey);
      return isToolGroup
        ? catalogRef.current.toolBoxes.find((box) => box.boxId === resourceId)?.tools ?? []
        : catalogRef.current.mcpServers.find((server) => server.mcpId === resourceId)?.tools ?? [];
    }

    loadingGroupKeysRef.current.add(groupKey);
    setLoadingGroupKeys((prev) => [...prev, groupKey]);

    try {
      const tools = isToolGroup
        ? await loadActionTypeToolBoxTools(resourceId)
        : await loadActionTypeMcpServerTools(resourceId);

      const nextCatalog = {
        ...catalogRef.current,
        mcpServers: isToolGroup
          ? catalogRef.current.mcpServers
          : catalogRef.current.mcpServers.map((server) =>
              server.mcpId === resourceId ? { ...server, tools } : server,
            ),
        toolBoxes: isToolGroup
          ? catalogRef.current.toolBoxes.map((box) =>
              box.boxId === resourceId ? { ...box, tools } : box,
            )
          : catalogRef.current.toolBoxes,
      };
      catalogRef.current = nextCatalog;
      setCatalog((prev) => ({
        ...prev,
        mcpServers: isToolGroup
          ? prev.mcpServers
          : prev.mcpServers.map((server) =>
              server.mcpId === resourceId ? { ...server, tools } : server,
            ),
        toolBoxes: isToolGroup
          ? prev.toolBoxes.map((box) =>
              box.boxId === resourceId ? { ...box, tools } : box,
            )
          : prev.toolBoxes,
      }));
      if (tools.length > 0) {
        loadedGroupKeysRef.current.add(groupKey);
      }
      return tools;
    } finally {
      loadingGroupKeysRef.current.delete(groupKey);
      setLoadingGroupKeys((prev) => prev.filter((item) => item !== groupKey));
    }
  }, []);

  const ensureGroupToolsLoadedRef = useRef(ensureGroupToolsLoaded);
  ensureGroupToolsLoadedRef.current = ensureGroupToolsLoaded;

  useEffect(() => {
    if (!open) {
      setKeyword("");
      setDebouncedKeyword("");
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
    }, CATALOG_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [keyword, open]);

  useEffect(() => {
    if (!open) {
      catalogRequestIdRef.current += 1;
      setLoading(false);
      return;
    }

    const requestId = ++catalogRequestIdRef.current;
    const currentValue = valueRef.current;
    const loadCatalog = async () => {
      setLoading(true);
      try {
        const nextCatalog =
          activeTab === "mcp"
            ? await listActionTypeExecutionFactoryCatalog(debouncedKeyword)
            : await listActionTypeExecutionFactoryCatalog(debouncedKeyword, activeTab);
        if (requestId !== catalogRequestIdRef.current) {
          return;
        }

        // Keep ref in sync before optional preload (avoids stale hasCachedTools short-circuit).
        catalogRef.current = nextCatalog;
        setCatalog(nextCatalog);
        loadedGroupKeysRef.current = new Set();
        loadingGroupKeysRef.current = new Set();
        nextCatalog.toolBoxes.forEach((box) => {
          if (box.tools.length > 0) {
            loadedGroupKeysRef.current.add(`group:tool:${box.boxId}`);
          }
        });
        nextCatalog.mcpServers.forEach((server) => {
          if (server.tools.length > 0) {
            loadedGroupKeysRef.current.add(`group:mcp:${server.mcpId}`);
          }
        });
        if (restoredSelectionValueKeyRef.current === valueKey) {
          setExpandedKeys([]);
        } else {
          const initialGroupKey =
            currentValue?.type === "mcp" && currentValue.mcpId
              ? `group:mcp:${currentValue.mcpId}`
              : currentValue?.type === "tool" && currentValue.boxId
                ? `group:tool:${currentValue.boxId}`
                : "";
          const hasInitialGroup =
            currentValue?.type === "mcp"
              ? nextCatalog.mcpServers.some((server) => server.mcpId === currentValue.mcpId)
              : currentValue?.type === "tool"
                ? nextCatalog.toolBoxes.some((box) => box.boxId === currentValue.boxId)
                : false;

          if (initialGroupKey && hasInitialGroup) {
            setExpandedKeys([initialGroupKey]);
            await ensureGroupToolsLoadedRef.current(initialGroupKey);
            if (requestId !== catalogRequestIdRef.current) {
              return;
            }
          } else {
            setExpandedKeys([]);
          }

          const initialSelection = buildSelectionFromValue(catalogRef.current, currentValue);
          if (initialSelection) {
            setSelectedSelection(initialSelection);
          } else if (
            currentValue?.type === "tool" &&
            !toolboxMetadataType &&
            activeTab === "openapi" &&
            executionUnitTabs.includes("function")
          ) {
            setActiveTab("function");
            return;
          } else if (currentValue?.type === "tool" && currentValue.boxId) {
            const box = catalogRef.current.toolBoxes.find((item) => item.boxId === currentValue.boxId);
            const fallbackTool = buildToolFromValue(currentValue);
            setSelectedSelection(
              box && fallbackTool
                ? {
                    boxId: box.boxId,
                    boxName: box.boxName,
                    kind: "tool",
                    tool: fallbackTool,
                  }
                : null,
            );
          } else if (currentValue?.type === "mcp" && currentValue.mcpId) {
            const server = catalogRef.current.mcpServers.find(
              (item) => item.mcpId === currentValue.mcpId,
            );
            const fallbackTool = buildToolFromValue(currentValue);
            setSelectedSelection(
              server && fallbackTool
                ? {
                    kind: "mcp",
                    mcpId: server.mcpId,
                    mcpName: server.mcpName,
                    tool: fallbackTool,
                  }
                : null,
            );
          } else {
            setSelectedSelection(null);
          }

          restoredSelectionValueKeyRef.current = valueKey;
        }
      } finally {
        if (requestId === catalogRequestIdRef.current) {
          setLoading(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      catalogRequestIdRef.current += 1;
    };
  }, [activeTab, debouncedKeyword, executionUnitTabs, open, toolboxMetadataType, valueKey]);

  const selectedKey = useMemo(
    () => (selectedSelection ? buildSelectionKey(selectedSelection) : null),
    [selectedSelection],
  );

  const toggleExpand = (groupKey: string) => {
    const willExpand = !expandedKeys.includes(groupKey);
    setExpandedKeys((prev) =>
      willExpand ? [...prev, groupKey] : prev.filter((item) => item !== groupKey),
    );

    if (willExpand) {
      void ensureGroupToolsLoaded(groupKey);
    }
  };

  const renderToolBoxes = () => {
    if (catalog.toolBoxes.length === 0) {
      return <div className={styles.emptyState}>{t("knowledgeNetwork.actionTypeToolCatalogEmpty")}</div>;
    }

    return catalog.toolBoxes.map((box) => {
      const groupKey = `group:tool:${box.boxId}`;
      const expanded = expandedKeys.includes(groupKey);

      return (
        <div key={groupKey}>
          <div
            className={styles.groupRow}
            onClick={() => toggleExpand(groupKey)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleExpand(groupKey);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <RightOutlined
              className={`${styles.expandIcon} ${expanded ? styles.expandIconExpanded : ""}`}
            />
            <span className={styles.boxIcon}>
              <ToolOutlined />
            </span>
            <div className={styles.itemBody}>
              <div className={styles.itemTitle}>{box.boxName}</div>
              {box.description ? (
                <div className={styles.itemDescription}>{box.description}</div>
              ) : null}
            </div>
          </div>
          {expanded ? (
            loadingGroupKeys.includes(groupKey) ? (
              <div className={styles.loadingState}>
                <Spin size="small" />
              </div>
            ) : box.tools.length === 0 ? (
              <div className={styles.emptyState}>{t("knowledgeNetwork.actionTypeToolCatalogEmpty")}</div>
            ) : (
              box.tools.map((tool) => {
                const toolKey = `tool:${box.boxId}:${tool.toolId}`;
                const selected = selectedKey === toolKey;

                return (
                  <div
                    className={`${styles.toolRow} ${selected ? styles.toolRowSelected : ""}`}
                    key={toolKey}
                    onClick={() => {
                      setSelectedSelection({
                        boxId: box.boxId,
                        boxName: box.boxName,
                        kind: "tool",
                        tool,
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedSelection({
                          boxId: box.boxId,
                          boxName: box.boxName,
                          kind: "tool",
                          tool,
                        });
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <span className={styles.expandPlaceholder} />
                    <span className={styles.toolIcon}>
                      <ToolOutlined />
                    </span>
                    <div className={styles.itemBody}>
                      <div className={styles.itemTitle}>{tool.toolName}</div>
                      {tool.description ? (
                        <div className={styles.itemDescription}>{tool.description}</div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )
          ) : null}
        </div>
      );
    });
  };

  const renderMcpServers = () => {
    if (catalog.mcpServers.length === 0) {
      return <div className={styles.emptyState}>{t("knowledgeNetwork.actionTypeMcpCatalogEmpty")}</div>;
    }

    return catalog.mcpServers.map((server) => {
      const groupKey = `group:mcp:${server.mcpId}`;
      const expanded = expandedKeys.includes(groupKey);

      return (
        <div key={groupKey}>
          <div
            className={styles.groupRow}
            onClick={() => toggleExpand(groupKey)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleExpand(groupKey);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <RightOutlined
              className={`${styles.expandIcon} ${expanded ? styles.expandIconExpanded : ""}`}
            />
            <span className={styles.boxIcon}>
              <ToolOutlined />
            </span>
            <div className={styles.itemBody}>
              <div className={styles.itemTitle}>{server.mcpName}</div>
              {server.description ? (
                <div className={styles.itemDescription}>{server.description}</div>
              ) : null}
            </div>
          </div>
          {expanded ? (
            loadingGroupKeys.includes(groupKey) ? (
              <div className={styles.loadingState}>
                <Spin size="small" />
              </div>
            ) : server.tools.length === 0 ? (
              <div className={styles.emptyState}>{t("knowledgeNetwork.actionTypeMcpCatalogEmpty")}</div>
            ) : (
              server.tools.map((tool) => {
                const toolKey = `mcp:${server.mcpId}:${tool.toolId}`;
                const selected = selectedKey === toolKey;

                return (
                  <div
                    className={`${styles.toolRow} ${selected ? styles.toolRowSelected : ""}`}
                    key={toolKey}
                    onClick={() => {
                      setSelectedSelection({
                        kind: "mcp",
                        mcpId: server.mcpId,
                        mcpName: server.mcpName,
                        tool,
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedSelection({
                          kind: "mcp",
                          mcpId: server.mcpId,
                          mcpName: server.mcpName,
                          tool,
                        });
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <span className={styles.expandPlaceholder} />
                    <span className={styles.toolIcon}>
                      <ToolOutlined />
                    </span>
                    <div className={styles.itemBody}>
                      <div className={styles.itemTitle}>{tool.toolName}</div>
                      {tool.description ? (
                        <div className={styles.itemDescription}>{tool.description}</div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )
          ) : null}
        </div>
      );
    });
  };

  return (
    <Modal
      destroyOnClose
      footer={
        <div className={styles.footerActions}>
          <AppButton onClick={onCancel}>{t("common.cancel")}</AppButton>
          <AppButton
            disabled={!selectedSelection}
            onClick={() => {
              if (!selectedSelection) {
                return;
              }

              onConfirm(buildActionSourceFromCatalogSelection(selectedSelection), selectedSelection);
            }}
            type="primary"
          >
            {t("common.confirm")}
          </AppButton>
        </div>
      }
      onCancel={onCancel}
      open={open}
      title={t("knowledgeNetwork.actionTypeToolSelectTitle")}
      width={720}
    >
      <div className={styles.catalogPanel}>
        <Tabs
          activeKey={activeTab}
          items={executionUnitTabs.map((tab) => ({
            key: tab,
            label:
              tab === "openapi"
                ? t("executionFactory.openapiToolboxTab")
                : tab === "function"
                  ? toolboxTabLabel ?? t("executionFactory.functionToolboxTab")
                  : t("executionFactory.executionUnitTabsV2.mcp"),
          }))}
          onChange={(nextTab) => setActiveTab(nextTab as ActionTypeExecutionUnitTab)}
        />
        <Input
          allowClear
          className={styles.searchInput}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t(
            activeTab === "mcp"
              ? "knowledgeNetwork.actionTypeMcpSearchPlaceholder"
              : activeTab === "function"
                ? "knowledgeNetwork.actionTypeFunctionToolSearchPlaceholder"
                : "knowledgeNetwork.actionTypeOpenapiToolSearchPlaceholder",
          )}
          suffix={<SearchOutlined />}
          value={keyword}
        />
        <div className={styles.listPanel}>
          {loading ? (
            <div className={styles.loadingState}>
              <Spin />
            </div>
          ) : activeTab === "mcp" ? (
            renderMcpServers()
          ) : (
            renderToolBoxes()
          )}
        </div>
      </div>
    </Modal>
  );
}
