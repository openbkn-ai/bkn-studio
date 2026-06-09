import { RightOutlined, SearchOutlined, ToolOutlined } from "@ant-design/icons";
import { Input, Modal, Spin, Tabs } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import {
  buildActionSourceFromCatalogSelection,
  listActionTypeExecutionFactoryCatalog,
  type ActionTypeCatalogSelection,
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
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedSelection, setSelectedSelection] = useState<ActionTypeCatalogSelection | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadCatalog = async () => {
      setLoading(true);
      try {
        const nextCatalog = await listActionTypeExecutionFactoryCatalog(keyword);
        setCatalog(nextCatalog);
        const initialSelection = buildSelectionFromValue(nextCatalog, value);
        setSelectedSelection(initialSelection);
        setActiveTab(value?.type === "mcp" ? "mcp" : "tool");
        if (initialSelection) {
          setExpandedKeys([
            initialSelection.kind === "mcp"
              ? `group:mcp:${initialSelection.mcpId}`
              : `group:tool:${initialSelection.boxId}`,
          ]);
        } else {
          setExpandedKeys([]);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadCatalog();
  }, [keyword, open, value]);

  const selectedKey = useMemo(
    () => (selectedSelection ? buildSelectionKey(selectedSelection) : null),
    [selectedSelection],
  );

  const toggleExpand = (groupKey: string) => {
    setExpandedKeys((prev) =>
      prev.includes(groupKey) ? prev.filter((item) => item !== groupKey) : [...prev, groupKey],
    );
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
          {expanded
            ? box.tools.map((tool) => {
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
            : null}
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
          {expanded
            ? server.tools.map((tool) => {
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
            : null}
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
