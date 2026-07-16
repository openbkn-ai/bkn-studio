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

import styles from "./ActionTypeToolSelectModal.module.css";

type ActionTypeToolSelectModalProps = {
  onCancel: () => void;
  onConfirm: (source: ActionTypeActionSource, selection: ActionTypeCatalogSelection) => void;
  open: boolean;
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

export function ActionTypeToolSelectModal({
  onCancel,
  onConfirm,
  open,
  value,
}: ActionTypeToolSelectModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"mcp" | "tool">("tool");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<ActionTypeExecutionFactoryCatalog>({
    mcpServers: [],
    toolBoxes: [],
  });
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [loadingGroupKeys, setLoadingGroupKeys] = useState<string[]>([]);
  const loadedGroupKeysRef = useRef(new Set<string>());
  const loadingGroupKeysRef = useRef(new Set<string>());
  const [selectedSelection, setSelectedSelection] = useState<ActionTypeCatalogSelection | null>(
    null,
  );

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

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadCatalog = async () => {
      setLoading(true);
      try {
        const nextCatalog = await listActionTypeExecutionFactoryCatalog(keyword);
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
        setActiveTab(value?.type === "mcp" ? "mcp" : "tool");
        const initialGroupKey =
          value?.type === "mcp" && value.mcpId
            ? `group:mcp:${value.mcpId}`
            : value?.type === "tool" && value.boxId
              ? `group:tool:${value.boxId}`
              : "";

        if (initialGroupKey) {
          setExpandedKeys([initialGroupKey]);
          await ensureGroupToolsLoaded(initialGroupKey);
        } else {
          setExpandedKeys([]);
        }

        const initialSelection = buildSelectionFromValue(catalogRef.current, value);
        if (initialSelection) {
          setSelectedSelection(initialSelection);
        } else if (value?.type === "tool" && value.boxId) {
          const box = catalogRef.current.toolBoxes.find((item) => item.boxId === value.boxId);
          const fallbackTool = buildToolFromValue(value);
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
        } else if (value?.type === "mcp" && value.mcpId) {
          const server = catalogRef.current.mcpServers.find((item) => item.mcpId === value.mcpId);
          const fallbackTool = buildToolFromValue(value);
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
      } finally {
        setLoading(false);
      }
    };

    void loadCatalog();
  }, [ensureGroupToolsLoaded, keyword, open, value]);

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
          items={[
            {
              key: "tool",
              label: t("knowledgeNetwork.actionTypeExecutionSourceTool"),
            },
            {
              key: "mcp",
              label: "MCP",
            },
          ]}
          onChange={(nextTab) => setActiveTab(nextTab as "mcp" | "tool")}
        />
        <Input
          allowClear
          className={styles.searchInput}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t("knowledgeNetwork.actionTypeToolSearchPlaceholder")}
          suffix={<SearchOutlined />}
          value={keyword}
        />
        <div className={styles.listPanel}>
          {loading ? (
            <div className={styles.loadingState}>
              <Spin />
            </div>
          ) : activeTab === "tool" ? (
            renderToolBoxes()
          ) : (
            renderMcpServers()
          )}
        </div>
      </div>
    </Modal>
  );
}
