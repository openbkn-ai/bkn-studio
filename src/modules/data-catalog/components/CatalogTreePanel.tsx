/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  LeftOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Form, Input, Modal, Tooltip } from "antd";
import type { DataNode } from "antd/es/tree";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { BusinessTree, BusinessTreePanel } from "@/framework/ui/common/BusinessTreePanel";
import { isBuiltinLogicalCatalog } from "@/modules/data-catalog/lib/logical-catalog";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import { createLogicalCatalog, deleteCatalog } from "@/shared/catalog";
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
  discoveringCatalogIds: string[];
  selection: CatalogTreeSelection | null;
};

type LogicalFormValues = {
  description?: string;
  name: string;
};

type TreeNodeMeta =
  | { catalogId?: never; database?: never; key: string; type: "group" | "connector" }
  | { catalogId: string; key: string; type: "catalog" }
  | { catalogId: string; database: string; key: string; schema?: undefined; type: "database" }
  | {
      catalogId: string;
      database: string;
      key: string;
      schema: string;
      type: "schema";
    };

const PHYSICAL_GROUP_KEY = "group:physical";
const LOGICAL_GROUP_KEY = "group:logical";

function connectorKey(type: string) {
  return `connector:${type || "unknown"}`;
}

function catalogKey(catalogId: string) {
  return `catalog:${catalogId}`;
}

function databaseKey(catalogId: string, db: string) {
  return `db:${catalogId}:${db}`;
}

function schemaKey(catalogId: string, db: string, schema: string) {
  return `schema:${catalogId}:${db}:${schema}`;
}

type ScopeGroup = {
  db: string;
  schemas: string[];
};

function parseScopeGroupsByCatalog(resources: CatalogResource[]) {
  const groupedByCatalog = new Map<string, Map<string, Set<string>>>();

  resources.forEach((item) => {
    if (!item.catalogId) {
      return;
    }
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
      if (!groupedByCatalog.has(item.catalogId)) {
        groupedByCatalog.set(item.catalogId, new Map());
      }
      const catalogGroups = groupedByCatalog.get(item.catalogId)!;
      if (!catalogGroups.has(db)) {
        catalogGroups.set(db, new Set());
      }
      if (schema) {
        catalogGroups.get(db)?.add(schema);
      }
    }
  });

  return new Map<string, ScopeGroup[]>(
    [...groupedByCatalog.entries()].map(([catalogId, groups]) => [
      catalogId,
      [...groups.entries()]
        .map(([db, schemas]) => ({
          db,
          schemas: [...schemas].sort((a, b) => a.localeCompare(b, "zh-CN")),
        }))
        .sort((a, b) => a.db.localeCompare(b.db, "zh-CN")),
    ]),
  );
}

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
  discoveringCatalogIds,
  selection,
}: CatalogTreePanelProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [keyword, setKeyword] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<string[]>([PHYSICAL_GROUP_KEY, LOGICAL_GROUP_KEY]);
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

  const scopeGroupsByCatalog = useMemo(() => parseScopeGroupsByCatalog(resources), [resources]);

  const selectedKey = useMemo(() => {
    if (selectedCatalogId && activeDb && activeSchema) {
      return schemaKey(selectedCatalogId, activeDb, activeSchema);
    }
    if (selectedCatalogId && activeDb) {
      return databaseKey(selectedCatalogId, activeDb);
    }
    if (selectedCatalogId) {
      return catalogKey(selectedCatalogId);
    }
    return undefined;
  }, [activeDb, activeSchema, selectedCatalogId]);

  const query = keyword.trim().toLowerCase();

  const physicalCatalogs = useMemo(
    () =>
      catalogs.filter((catalog) => {
        if (catalog.type === "logical") {
          return false;
        }
        if (!query) {
          return true;
        }
        return (
          catalog.name.toLowerCase().includes(query) ||
          catalog.id.toLowerCase().includes(query) ||
          catalog.connectorType.toLowerCase().includes(query) ||
          (connectorTypeNameMap.get(catalog.connectorType) ?? "")
            .toLowerCase()
            .includes(query)
        );
      }),
    [catalogs, connectorTypeNameMap, query],
  );

  const logicalCatalogs = useMemo(() => {
    const items = catalogs.filter((catalog) => {
      if (catalog.type !== "logical") {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        catalog.name.toLowerCase().includes(query) ||
        catalog.id.toLowerCase().includes(query)
      );
    });

    return items.sort((left, right) => {
      const leftBuiltin = isBuiltinLogicalCatalog(left) ? 0 : 1;
      const rightBuiltin = isBuiltinLogicalCatalog(right) ? 0 : 1;
      if (leftBuiltin !== rightBuiltin) {
        return leftBuiltin - rightBuiltin;
      }
      return left.name.localeCompare(right.name, "zh-CN");
    });
  }, [catalogs, query]);

  const treeModel = useMemo(() => {
    const metaMap = new Map<string, TreeNodeMeta>();
    const requiredExpanded = new Set<string>([PHYSICAL_GROUP_KEY]);

    const attachCatalogChildren = (catalog: CatalogRecord): DataNode[] | undefined => {
      const scopeGroups = scopeGroupsByCatalog.get(catalog.id) ?? [];
      if (scopeGroups.length === 0) {
        return undefined;
      }
      if (selectedCatalogId === catalog.id) {
        requiredExpanded.add(catalogKey(catalog.id));
      }
      return scopeGroups.map((group) => {
        const dbKey = databaseKey(catalog.id, group.db);
        metaMap.set(dbKey, {
          catalogId: catalog.id,
          database: group.db,
          key: dbKey,
          type: "database",
        });
        if (selectedCatalogId === catalog.id && activeDb === group.db) {
          requiredExpanded.add(dbKey);
        }
        return {
          children: group.schemas.map((schema) => {
            const nodeKey = schemaKey(catalog.id, group.db, schema);
            metaMap.set(nodeKey, {
              catalogId: catalog.id,
              database: group.db,
              key: nodeKey,
              schema,
              type: "schema",
            });
            return {
              isLeaf: true,
              key: nodeKey,
              title: (
                <span className={styles.scopeLeafTitle}>
                  <span className={styles.scopeLeafName}>{schema}</span>
                </span>
              ),
            };
          }),
          key: dbKey,
          title: (
            <span className={styles.scopeGroupTitle}>
              <span className={styles.scopeGroupName}>{group.db}</span>
            </span>
          ),
        };
      });
    };

    const physicalGroups = [...new Set(physicalCatalogs.map((catalog) => catalog.connectorType || "unknown"))]
      .map((type) => ({
        catalogs: physicalCatalogs
          .filter((catalog) => (catalog.connectorType || "unknown") === type)
          .sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
        key: connectorKey(type),
        label: connectorTypeNameMap.get(type) ?? type,
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));

    const physicalChildren = physicalGroups.map((group) => {
      metaMap.set(group.key, { key: group.key, type: "connector" });
      if (selectedCatalogId) {
        const selected = group.catalogs.find((item) => item.id === selectedCatalogId);
        if (selected) {
          requiredExpanded.add(group.key);
        }
      }
      if (query) {
        requiredExpanded.add(group.key);
      }

      return {
        children: group.catalogs.map((catalog) => {
          const nodeKey = catalogKey(catalog.id);
          metaMap.set(nodeKey, { catalogId: catalog.id, key: nodeKey, type: "catalog" });
          return {
            children: attachCatalogChildren(catalog),
            key: nodeKey,
            title: (
              <span className={styles.catalogNodeTitle}>
                <span className={styles.catalogNodeIcon}>
                  <DatabaseOutlined className={styles.catalogIcon} />
                </span>
                <span className={styles.catalogNodeName}>{catalog.name}</span>
                {discoveringCatalogIds.includes(catalog.id) ? (
                  <span className={[styles.treeMiniTag, styles.treeMiniTagScan].join(" ")}>
                    {t("dataCatalog.tree.discovering")}
                  </span>
                ) : null}
                {!catalog.enabled ? (
                  <span className={styles.treeMiniTag}>{t("common.disabled")}</span>
                ) : null}
              </span>
            ),
          };
        }),
        key: group.key,
        selectable: false,
        title: (
          <span className={styles.groupNodeTitle}>
            <span className={styles.groupNodeName}>{group.label}</span>
            <span className={styles.groupCount}>{group.catalogs.length}</span>
          </span>
        ),
      };
    });

    metaMap.set(PHYSICAL_GROUP_KEY, { key: PHYSICAL_GROUP_KEY, type: "group" });
    const logicalChildren = logicalCatalogs.map((catalog) => {
      const nodeKey = catalogKey(catalog.id);
      metaMap.set(nodeKey, { catalogId: catalog.id, key: nodeKey, type: "catalog" });
      if (selectedCatalogId === catalog.id) {
        requiredExpanded.add(LOGICAL_GROUP_KEY);
      }
      return {
        key: nodeKey,
        title: (
          <span className={styles.catalogNodeTitle}>
            <span className={styles.catalogNodeIcon}>
              <AppstoreOutlined className={styles.logicalIcon} />
            </span>
            <span className={styles.catalogNodeName}>{catalog.name}</span>
            {isBuiltinLogicalCatalog(catalog) ? (
              <span className={styles.treeMiniTag}>{t("dataCatalog.tree.builtin")}</span>
            ) : (
              <PermissionGate permissions="catalog:delete">
                <button
                  aria-label={t("common.delete")}
                  className={styles.treeActionBtnVisible}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void modal.confirm({
                      title: t("dataCatalog.tree.deleteLogicalTitle"),
                      content: t("dataCatalog.tree.deleteLogicalDescription", {
                        name: catalog.name,
                      }),
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
                  }}
                  title={t("common.delete")}
                  type="button"
                >
                  <DeleteOutlined />
                </button>
              </PermissionGate>
            )}
          </span>
        ),
      };
    });

    if (logicalChildren.length > 0 || !query) {
      requiredExpanded.add(LOGICAL_GROUP_KEY);
    }

    metaMap.set(LOGICAL_GROUP_KEY, { key: LOGICAL_GROUP_KEY, type: "group" });

    const treeData: DataNode[] = [];

    if (physicalChildren.length > 0 || !query) {
      treeData.push({
        children: physicalChildren,
        key: PHYSICAL_GROUP_KEY,
        selectable: false,
        title: (
          <span className={styles.rootNodeTitle}>
            <span className={styles.rootNodeIcon}>
              <DatabaseOutlined className={styles.rootIcon} />
            </span>
            <span className={styles.rootNodeName}>{t("dataCatalog.tree.physicalGroup")}</span>
            <span className={styles.rootCount}>{physicalCatalogs.length}</span>
          </span>
        ),
      });
    }

    if (logicalChildren.length > 0 || !query) {
      treeData.push({
        children: logicalChildren,
        key: LOGICAL_GROUP_KEY,
        selectable: false,
        title: (
          <span className={styles.rootNodeTitle}>
            <span className={styles.rootNodeIcon}>
              <AppstoreOutlined className={styles.rootIcon} />
            </span>
            <span className={styles.rootNodeName}>{t("dataCatalog.tree.logicalGroup")}</span>
            <span className={styles.rootCount}>{logicalCatalogs.length}</span>
          </span>
        ),
      });
    }

    return {
      metaMap,
      requiredExpandedKeys: [...requiredExpanded],
      treeData,
    };
  }, [
    activeDb,
    connectorTypeNameMap,
    logicalCatalogs,
    message,
    modal,
    onRefresh,
    physicalCatalogs,
    query,
    discoveringCatalogIds,
    scopeGroupsByCatalog,
    selectedCatalogId,
    t,
  ]);

  useEffect(() => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      treeModel.requiredExpandedKeys.forEach((key) => next.add(key));
      const nextKeys = [...next];
      return nextKeys.length === current.length &&
        nextKeys.every((key, index) => key === current[index])
        ? current
        : nextKeys;
    });
  }, [treeModel.requiredExpandedKeys]);

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

  if (collapsed) {
    return (
      <BusinessTreePanel
        collapsed
        collapsedIcon={<DatabaseOutlined />}
        expandAriaLabel={t("dataCatalog.tree.expand")}
        onExpandPanel={() => onToggleCollapsed?.()}
        title={t("dataCatalog.title")}
      >
        {null}
      </BusinessTreePanel>
    );
  }

  return (
    <>
      <BusinessTreePanel
        empty={
          treeModel.treeData.length === 0
            ? query
              ? t("dataCatalog.tree.noMatch")
              : t("dataCatalog.tree.empty")
            : undefined
        }
        footer={
          <span>
            {t("dataCatalog.tree.summary", {
              catalogCount: catalogs.length as never,
              resourceCount: resourceCount as never,
            })}
          </span>
        }
        headerActions={
          <>
            <PermissionGate permissions="catalog:create">
              <Tooltip title={t("dataCatalog.tree.addLogical")}>
                <AppButton
                  aria-label={t("dataCatalog.tree.addLogical")}
                  className={styles.treeActionBtn}
                  icon={<PlusOutlined />}
                  onClick={() => {
                    form.resetFields();
                    setCreateOpen(true);
                  }}
                />
              </Tooltip>
            </PermissionGate>
            <Tooltip title={t("dataCatalog.tree.collapse")}>
              <AppButton
                aria-label={t("dataCatalog.tree.collapse")}
                className={styles.treeActionBtn}
                icon={<LeftOutlined />}
                onClick={() => onToggleCollapsed?.()}
              />
            </Tooltip>
          </>
        }
        onSearchChange={setKeyword}
        searchPlaceholder={t("dataCatalog.tree.searchPlaceholder")}
        searchValue={keyword}
        title={t("dataCatalog.title")}
      >
        <BusinessTree
          className={styles.catalogTree}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys.map(String))}
          onSelect={(keys) => {
            const key = String(keys[0] ?? "");
            if (!key) {
              return;
            }
            const meta = treeModel.metaMap.get(key);
            if (!meta) {
              return;
            }
            if (meta.type === "catalog") {
              onSelectScope?.(null);
              onSelectCatalog(meta.catalogId);
              return;
            }
            if (meta.type === "database") {
              onSelectCatalog(meta.catalogId);
              onSelectScope?.({ database: meta.database });
              return;
            }
            if (meta.type === "schema") {
              onSelectCatalog(meta.catalogId);
              onSelectScope?.({ database: meta.database, schema: meta.schema });
            }
          }}
          selectedKeys={selectedKey ? [selectedKey] : []}
          treeData={treeModel.treeData}
        />
      </BusinessTreePanel>

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
          <Form.Item label={t("common.description")} name="description">
            <Input.TextArea
              maxLength={200}
              placeholder={t("dataCatalog.tree.logicalDescriptionPlaceholder")}
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
