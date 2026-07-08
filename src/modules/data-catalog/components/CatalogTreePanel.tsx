/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  AppstoreOutlined,
  DeleteOutlined,
  DownOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Form, Input, Modal, Tabs, Tooltip } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { isBuiltinLogicalCatalog } from "@/modules/data-catalog/lib/logical-catalog";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import {
  createLogicalCatalog,
  deleteCatalog,
} from "@/shared/catalog";
import type { CatalogRecord } from "@/shared/catalog";
import type { DataConnectConnectorType } from "@/modules/data-connect/types/data-connect";

import styles from "./CatalogTreePanel.module.css";

export type CatalogTreeSelection =
  | { id: string; type: "catalog" }
  | { id: string; type: "resource" };

type CatalogTreePanelProps = {
  activeDb?: string;
  activeSchema?: string;
  catalogs: CatalogRecord[];
  collapsed?: boolean;
  connectorTypes: DataConnectConnectorType[];
  onRefresh: () => Promise<void> | void;
  onSelectCatalog: (catalogId: string) => void;
  onSelectScope?: (scope: { database?: string; schema?: string } | null) => void;
  onToggleCollapsed?: () => void;
  resourceCount: number;
  resources: CatalogResource[];
  scanningCatalogIds: string[];
  selection: CatalogTreeSelection | null;
};

type ConnectorTypeGroup = {
  catalogs: CatalogRecord[];
  key: string;
  label: string;
};

type LogicalFormValues = {
  description?: string;
  name: string;
};

export function CatalogTreePanel({
  activeDb = "",
  activeSchema = "",
  catalogs,
  collapsed = false,
  connectorTypes,
  onRefresh,
  onSelectCatalog,
  onSelectScope,
  onToggleCollapsed,
  resourceCount,
  resources,
  scanningCatalogIds,
  selection,
}: CatalogTreePanelProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [keyword, setKeyword] = useState("");
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(() => new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<LogicalFormValues>();

  const connectorTypeNameMap = useMemo(
    () => new Map(connectorTypes.map((item) => [item.type, item.name])),
    [connectorTypes],
  );

  const selectedCatalogId = useMemo(() => {
    if (!selection) {
      return undefined;
    }
    if (selection.type === "catalog") {
      return selection.id;
    }
    return resources.find((item) => item.id === selection.id)?.catalogId;
  }, [resources, selection]);

  const scopeGroups = useMemo(() => {
    if (!selectedCatalogId) {
      return [];
    }
    const scoped = resources.filter((item) => item.catalogId === selectedCatalogId);
    const group = new Map<string, Set<string>>();
    scoped.forEach((item) => {
      const raw = (item.sourceIdentifier ?? "").trim();
      const fromMatch = raw.match(/\bfrom\s+([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+){0,2})/i);
      const candidate = (fromMatch?.[1] ?? raw).trim();
      const parts = candidate
        .split(".")
        .map((part) => part.trim().match(/[A-Za-z0-9_]+/g)?.[0] ?? "")
        .filter(Boolean);
      if (parts.length >= 2) {
        const db = parts[0];
        const schema = parts.length >= 3 ? parts[1] : "";
        if (!group.has(db)) {
          group.set(db, new Set());
        }
        if (schema) {
          group.get(db)?.add(schema);
        }
      }
    });

    return [...group.entries()]
      .map(([db, schemas]) => ({
        db,
        schemas: [...schemas].sort((a, b) => a.localeCompare(b, "zh-CN")),
      }))
      .sort((a, b) => a.db.localeCompare(b.db, "zh-CN"));
  }, [resources, selectedCatalogId]);

  const query = keyword.trim().toLowerCase();

  const matchesCatalog = (catalog: CatalogRecord) =>
    query.length === 0 ||
    catalog.name.toLowerCase().includes(query) ||
    catalog.id.toLowerCase().includes(query) ||
    catalog.connectorType.toLowerCase().includes(query) ||
    (connectorTypeNameMap.get(catalog.connectorType) ?? "")
      .toLowerCase()
      .includes(query);

  const physicalCatalogs = useMemo(
    () =>
      catalogs.filter(
        (catalog) => catalog.type !== "logical" && matchesCatalog(catalog),
      ),
    [catalogs, query, connectorTypeNameMap],
  );

  const logicalCatalogs = useMemo(() => {
    const items = catalogs.filter(
      (catalog) => catalog.type === "logical" && matchesCatalog(catalog),
    );

    return items.sort((left, right) => {
      const leftBuiltin = isBuiltinLogicalCatalog(left) ? 0 : 1;
      const rightBuiltin = isBuiltinLogicalCatalog(right) ? 0 : 1;
      if (leftBuiltin !== rightBuiltin) {
        return leftBuiltin - rightBuiltin;
      }
      return left.name.localeCompare(right.name, "zh-CN");
    });
  }, [catalogs, query, connectorTypeNameMap]);

  const physicalGroups = useMemo(() => {
    const groupMap = new Map<string, CatalogRecord[]>();

    physicalCatalogs.forEach((catalog) => {
      const key = catalog.connectorType || "unknown";
      groupMap.set(key, [...(groupMap.get(key) ?? []), catalog]);
    });

    return [...groupMap.entries()]
      .map(([key, items]) => ({
        key,
        label: connectorTypeNameMap.get(key) ?? key,
        catalogs: items.sort((left, right) =>
          left.name.localeCompare(right.name, "zh-CN"),
        ),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
  }, [connectorTypeNameMap, physicalCatalogs]);

  // 搜索时展开匹配类型；选中物理 catalog 时仅展开其所属类型。首次加载保持全部收起。
  useEffect(() => {
    setExpandedTypes((previous) => {
      const next = new Set(previous);
      let changed = false;

      if (query.length > 0) {
        physicalGroups.forEach((group) => {
          if (!next.has(group.key)) {
            next.add(group.key);
            changed = true;
          }
        });
      }

      if (selectedCatalogId) {
        const catalog = catalogs.find((item) => item.id === selectedCatalogId);
        if (catalog && catalog.type !== "logical") {
          const typeKey = catalog.connectorType || "unknown";
          if (!next.has(typeKey)) {
            next.add(typeKey);
            changed = true;
          }
        }
      }

      return changed ? next : previous;
    });
  }, [catalogs, physicalGroups, query, selectedCatalogId]);

  const toggleTypeExpanded = (typeKey: string) => {
    setExpandedTypes((previous) => {
      const next = new Set(previous);
      if (next.has(typeKey)) {
        next.delete(typeKey);
      } else {
        next.add(typeKey);
      }
      return next;
    });
  };

  const handleCreateLogical = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      await createLogicalCatalog({
        name: values.name.trim(),
        description: values.description?.trim() ?? "",
      });
      message.success(t("common.success"));
      setCreateOpen(false);
      form.resetFields();
      await onRefresh();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLogical = (catalog: CatalogRecord) => {
    void modal.confirm({
      title: t("dataCatalog.tree.deleteLogicalTitle"),
      content: t("dataCatalog.tree.deleteLogicalDescription", { name: catalog.name }),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCatalog(catalog.id);
          message.success(t("common.success"));
          await onRefresh();
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
          throw error;
        }
      },
    });
  };

  const renderCatalogLeaf = (
    catalog: CatalogRecord,
    options?: { indented?: boolean; showDelete?: boolean },
  ) => {
    const isSelected = selectedCatalogId === catalog.id;
    const scanning = scanningCatalogIds.includes(catalog.id);
    const isPhysical = catalog.type !== "logical";
    const builtin = !isPhysical && isBuiltinLogicalCatalog(catalog);

    return (
      <div key={catalog.id}>
        <div
          className={[
            styles.treeNode,
            options?.indented ? styles.treeNodeCatalog : styles.treeNodeLogical,
            isSelected ? styles.treeNodeSelected : "",
            isPhysical && !catalog.enabled ? styles.treeNodeOff : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onSelectCatalog(catalog.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSelectCatalog(catalog.id);
            }
          }}
          role="button"
          tabIndex={0}
          title={catalog.name}
        >
          <span className={styles.treeNodeIcon}>
            {isPhysical ? <ApiOutlined /> : <AppstoreOutlined />}
          </span>
          <span className={styles.treeNodeName}>{catalog.name}</span>
          {scanning ? (
            <span className={[styles.treeMiniTag, styles.treeMiniTagScan].join(" ")}>
              {t("dataCatalog.tree.scanning")}
            </span>
          ) : null}
          {isPhysical && !catalog.enabled ? (
            <span className={styles.treeMiniTag}>{t("common.disabled")}</span>
          ) : null}
          {builtin ? (
            <span className={styles.treeMiniTag}>{t("dataCatalog.tree.builtin")}</span>
          ) : options?.showDelete ? (
            <PermissionGate permissions="catalog:delete">
              <button
                aria-label={t("common.delete")}
                className={styles.treeActionBtnVisible}
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteLogical(catalog);
                }}
                title={t("common.delete")}
                type="button"
              >
                <DeleteOutlined />
              </button>
            </PermissionGate>
          ) : null}
        </div>
        {isSelected && isPhysical && scopeGroups.length > 0 ? (
          <div className={styles.scopeBlock}>
            {scopeGroups.map((group) => (
              <div key={group.db} className={styles.scopeGroup}>
                <div
                  className={[
                    styles.scopeNode,
                    activeDb === group.db && !activeSchema ? styles.scopeNodeActive : "",
                  ].join(" ")}
                  onClick={() => onSelectScope?.({ database: group.db })}
                  role="button"
                  tabIndex={0}
                  title={group.db}
                >
                  <span className={styles.scopeNodeName}>{group.db}</span>
                </div>
                {group.schemas.length > 0 ? (
                  <div className={styles.scopeChildren}>
                    {group.schemas.map((schema) => (
                      <div
                        key={`${group.db}.${schema}`}
                        className={[
                          styles.scopeNode,
                          styles.scopeNodeChild,
                          activeDb === group.db && activeSchema === schema
                            ? styles.scopeNodeActive
                            : "",
                        ].join(" ")}
                        onClick={() => onSelectScope?.({ database: group.db, schema })}
                        role="button"
                        tabIndex={0}
                        title={schema}
                      >
                        <span className={styles.scopeNodeName}>{schema}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderPhysicalGroup = (group: ConnectorTypeGroup) => {
    const isOpen = query.length > 0 || expandedTypes.has(group.key);

    return (
      <div key={group.key}>
        <div
          className={styles.treeNodeType}
          onClick={() => toggleTypeExpanded(group.key)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              toggleTypeExpanded(group.key);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <button
            aria-label={isOpen ? t("dataCatalog.tree.collapse") : t("dataCatalog.tree.expand")}
            className={[styles.treeCaret, isOpen ? styles.treeCaretOpen : ""].join(" ")}
            onClick={(event) => {
              event.stopPropagation();
              toggleTypeExpanded(group.key);
            }}
            type="button"
          >
            <DownOutlined />
          </button>
          <span className={styles.treeNodeIcon}>
            <ApiOutlined />
          </span>
          <span className={styles.treeNodeName} title={group.label}>
            {group.label}
          </span>
          <span className={styles.treeCount}>{group.catalogs.length}</span>
        </div>
        {isOpen ? (
          <div className={styles.treeChildren}>
            {group.catalogs.map((catalog) =>
              renderCatalogLeaf(catalog, { indented: true }),
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const hasAny = physicalGroups.length > 0 || logicalCatalogs.length > 0;
  const hasPhysical = physicalGroups.length > 0;
  const hasLogical = logicalCatalogs.length > 0;
  const [activeTab, setActiveTab] = useState<"physical" | "logical">(() =>
    hasPhysical ? "physical" : "logical",
  );

  useEffect(() => {
    if (activeTab === "physical" && !hasPhysical && hasLogical) {
      setActiveTab("logical");
    }
    if (activeTab === "logical" && !hasLogical && hasPhysical) {
      setActiveTab("physical");
    }
  }, [activeTab, hasLogical, hasPhysical]);

  if (collapsed) {
    return (
      <aside className={[styles.treePanel, styles.treePanelCollapsed].join(" ")}>
        <div className={styles.treeCollapsedHead}>
          <Tooltip title={t("dataCatalog.title")}>
            <span className={styles.treeCollapsedIcon}>
              <ApiOutlined />
            </span>
          </Tooltip>
          <AppButton
            aria-label={t("dataCatalog.tree.expand")}
            className={styles.treeCollapseBtn}
            icon={<RightOutlined />}
            onClick={() => onToggleCollapsed?.()}
          />
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.treePanel}>
      <div className={styles.treeHead}>
        <span className={styles.treeHeadTitle}>{t("dataCatalog.title")}</span>
        <div className={styles.treeHeadActions}>
          <Tooltip title={t("dataCatalog.tree.collapse")}>
            <AppButton
              aria-label={t("dataCatalog.tree.collapse")}
              className={styles.treeCollapseBtn}
              icon={<LeftOutlined />}
              onClick={() => onToggleCollapsed?.()}
            />
          </Tooltip>
        </div>
      </div>
      <Input
        allowClear
        className={styles.treeSearch}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder={t("dataCatalog.tree.searchPlaceholder")}
        value={keyword}
      />
      <div className={styles.treeBody}>
        {!hasAny ? (
          <div className={styles.treeEmpty}>
            {query.length > 0
              ? t("dataCatalog.tree.noMatch")
              : t("dataCatalog.tree.empty")}
          </div>
        ) : (
          <Tabs
            activeKey={activeTab}
            className={styles.treeTabs}
            items={[
              {
                key: "physical",
                label: (
                  <span className={styles.treeTabLabel}>
                    {t("dataCatalog.tree.physicalGroup")}
                    <span className={styles.treeTabCount}>{physicalCatalogs.length}</span>
                  </span>
                ),
                children: (
                  <div className={styles.treeTabScroll}>
                    {physicalGroups.length === 0 ? (
                      <div className={styles.treeEmptyHint}>
                        {t("dataCatalog.tree.emptyPhysicalGroup")}
                      </div>
                    ) : (
                      physicalGroups.map(renderPhysicalGroup)
                    )}
                  </div>
                ),
              },
              {
                key: "logical",
                label: (
                  <span className={styles.treeTabLabel}>
                    {t("dataCatalog.tree.logicalGroup")}
                    <span className={styles.treeTabCount}>{logicalCatalogs.length}</span>
                  </span>
                ),
                children: (
                  <div className={styles.treeTabScroll}>
                    {logicalCatalogs.length === 0 ? (
                      <div className={styles.treeEmptyHint}>
                        {t("dataCatalog.tree.emptyLogicalGroup")}
                      </div>
                    ) : (
                      logicalCatalogs.map((catalog) =>
                        renderCatalogLeaf(catalog, { showDelete: true }),
                      )
                    )}
                  </div>
                ),
              },
            ]}
            tabBarExtraContent={
              activeTab === "logical" ? (
                <PermissionGate permissions="catalog:create">
                  <button
                    aria-label={t("dataCatalog.tree.addLogical")}
                    className={styles.treeSectionBtn}
                    onClick={() => {
                      form.resetFields();
                      setCreateOpen(true);
                    }}
                    title={t("dataCatalog.tree.addLogical")}
                    type="button"
                  >
                    <PlusOutlined />
                  </button>
                </PermissionGate>
              ) : null
            }
            onChange={(key) => setActiveTab(key as "physical" | "logical")}
            size="small"
          />
        )}
      </div>
      <div className={styles.treeFoot}>
        <span>
          {t("dataCatalog.tree.summary", {
            catalogCount: catalogs.length as never,
            resourceCount: resourceCount as never,
          })}
        </span>
      </div>

      <Modal
        cancelText={t("common.cancel")}
        className={styles.logicalModal}
        confirmLoading={creating}
        destroyOnHidden
        okText={t("common.create")}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
        }}
        onOk={() => {
          void handleCreateLogical();
        }}
        open={createOpen}
        rootClassName={styles.logicalModalRoot}
        title={t("dataCatalog.tree.addLogicalTitle")}
        width={440}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label={t("dataCatalog.tree.logicalName")}
            name="name"
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input
              maxLength={64}
              placeholder={t("dataCatalog.tree.logicalNamePlaceholder")}
            />
          </Form.Item>
          <Form.Item
            label={t("common.description")}
            name="description"
          >
            <Input.TextArea
              maxLength={200}
              placeholder={t("dataCatalog.tree.logicalDescriptionPlaceholder")}
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </aside>
  );
}
