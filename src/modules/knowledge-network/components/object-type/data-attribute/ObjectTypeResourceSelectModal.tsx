/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  CloseOutlined,
  DatabaseOutlined,
  DownOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, Checkbox, Dropdown, Empty, Input, Modal, Pagination, Splitter, Table, Tree } from "antd";
import type { DataNode } from "antd/es/tree";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getObjectTypeResourcePreview,
  listObjectTypeResourceGroups,
  queryObjectTypeResources,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ObjectTypeDataSource,
  ObjectTypeResourceGroup,
  ObjectTypeResourcePreview,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectTypeResourceSelectModal.module.css";

type ObjectTypeResourceSelectModalProps = {
  networkId: string;
  onCancel: () => void;
  onOk: (resource: ObjectTypeDataSource) => void;
  open: boolean;
  selectedId?: string;
};

function getGroupIcon(group: ObjectTypeResourceGroup) {
  if (group.type === "other") {
    return <AppstoreOutlined className={styles.groupIconLogical} />;
  }

  if (group.type === "mysql" || group.type === "mariadb") {
    return <span className={`${styles.groupBadge} ${styles.groupBadgeMysql}`}>My</span>;
  }

  if (group.type === "postgresql" || group.type === "postgres") {
    return <span className={`${styles.groupBadge} ${styles.groupBadgeMysql}`}>PG</span>;
  }

  if (group.type === "opensearch" || group.type === "index_base") {
    return <DatabaseOutlined className={styles.groupIcon} />;
  }

  return <span className={`${styles.groupBadge} ${styles.groupBadgeDefault}`}>DB</span>;
}

export function ObjectTypeResourceSelectModal({
  networkId,
  onCancel,
  onOk,
  open,
  selectedId,
}: ObjectTypeResourceSelectModalProps) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<ObjectTypeResourceGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [searchValue, setSearchValue] = useState("");
  const [checkedItem, setCheckedItem] = useState<ObjectTypeDataSource | null>(null);
  const [previewId, setPreviewId] = useState("");
  const [preview, setPreview] = useState<ObjectTypeResourcePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [listItems, setListItems] = useState<ObjectTypeDataSource[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });

  const renderGroupTitle = useCallback(
    (group: ObjectTypeResourceGroup) => {
      const displayName =
        group.id === "source-type:other"
          ? t("knowledgeNetwork.objectTypeLogicalDataCatalog")
          : group.name;

      return (
        <span className={styles.groupNodeTitle}>
          <span className={styles.groupNodeIcon}>{getGroupIcon(group)}</span>
          <span className={styles.groupNodeText}>{displayName}</span>
        </span>
      );
    },
    [t],
  );

  const treeData = useMemo<DataNode[]>(
    () => {
      const nodeMap = new Map<string, DataNode>();
      const roots: DataNode[] = [];

      groups.forEach((group) => {
        nodeMap.set(group.id, {
          children: [],
          key: group.id,
          selectable: group.selectable !== false,
          title: renderGroupTitle(group),
        });
      });

      groups.forEach((group) => {
        const node = nodeMap.get(group.id);
        if (!node) {
          return;
        }

        if (group.parentId) {
          const parent = nodeMap.get(group.parentId);
          if (parent) {
            const nextChildren = parent.children ?? [];
            nextChildren.push(node);
            parent.children = nextChildren;
            return;
          }
        }

        roots.push(node);
      });

      return roots;
    },
    [groups, renderGroupTitle],
  );

  const dropdownItems = useMemo(() => {
    if (!checkedItem) {
      return [];
    }

    return [
      {
        key: "header",
        label: (
          <div className={styles.checkedBoxTitle} onClick={(event) => event.stopPropagation()}>
            <span>{t("knowledgeNetwork.objectTypeResourceCheckedCount", { count: 1 })}</span>
            <button
              className={styles.checkedBoxClear}
              onClick={() => setCheckedItem(null)}
              type="button"
            >
              {t("knowledgeNetwork.objectTypeResourceClearAll")}
            </button>
          </div>
        ),
      },
      {
        key: checkedItem.id,
        label: (
          <div className={styles.checkedBoxItem} onClick={(event) => event.stopPropagation()}>
            <span className={styles.checkedBoxText} title={checkedItem.name}>
              {checkedItem.name}
            </span>
            <CloseOutlined onClick={() => setCheckedItem(null)} />
          </div>
        ),
      },
    ];
  }, [checkedItem, t]);

  const loadGroups = useCallback(async () => {
    const nextGroups = await listObjectTypeResourceGroups(networkId);
    setGroups(nextGroups);
  }, [networkId]);

  const loadList = useCallback(async (nextPagination = pagination) => {
    const result = await queryObjectTypeResources(networkId, {
      dataSourceId: selectedGroupId || undefined,
      name: searchValue,
      page: nextPagination.page,
      pageSize: nextPagination.pageSize,
    });
    setListItems(result.items);
    setListTotal(result.total);
  }, [networkId, pagination, searchValue, selectedGroupId]);

  const loadPreview = useCallback(async (resourceId: string) => {
    if (!resourceId) {
      setPreview(null);
      return;
    }

    setPreviewLoading(true);
    try {
      const nextPreview = await getObjectTypeResourcePreview(networkId, resourceId);
      setPreview(nextPreview);
    } finally {
      setPreviewLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadGroups();
  }, [loadGroups, open]);

  useEffect(() => {
    if (!open) {
      setCheckedItem(null);
      setPreviewId("");
      setPreview(null);
      setSearchValue("");
      setSelectedGroupId("");
      setPagination({ page: 1, pageSize: 10 });
      return;
    }

    if (selectedId) {
      setPreviewId(selectedId);
    }
  }, [open, selectedId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadList();
  }, [loadList, open, pagination.page, pagination.pageSize, searchValue, selectedGroupId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadPreview(previewId);
  }, [loadPreview, open, previewId]);

  const handleToggleItem = (item: ObjectTypeDataSource) => {
    if (checkedItem?.id === item.id) {
      setCheckedItem(null);
      return;
    }

    setCheckedItem(item);
    setPreviewId(item.id);
  };

  const footer = (
    <div className={styles.footerBox}>
      {!checkedItem ? (
        <div className={styles.footerText}>
          {t("knowledgeNetwork.objectTypeResourceCheckedCount", { count: 0 })}
        </div>
      ) : (
        <Dropdown menu={{ items: dropdownItems }} trigger={["click"]}>
          <div className={styles.footerTextActive}>
            {t("knowledgeNetwork.objectTypeResourceCheckedCount", { count: 1 })}
            <DownOutlined />
          </div>
        </Dropdown>
      )}
      <div className={styles.footerActions}>
        <Button
          disabled={!checkedItem}
          onClick={() => {
            if (checkedItem) {
              onOk(checkedItem);
            }
          }}
          type="primary"
        >
          {t("common.ok")}
        </Button>
        <Button onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
    </div>
  );

  return (
    <Modal
      className={styles.modal}
      footer={footer}
      maskClosable={false}
      onCancel={onCancel}
      open={open}
      title={
        <div className={styles.titleBox}>
          <span className={styles.titleText}>{t("knowledgeNetwork.objectTypeSelectResource")}</span>
        </div>
      }
      width={1080}
    >
      <Splitter className={styles.splitter}>
        <Splitter.Panel className={styles.panelBox} defaultSize={210} max={280} min={150}>
          <div className={styles.groupBox}>
            <div
              className={`${styles.allItem} ${selectedGroupId ? "" : styles.allItemActive}`}
              onClick={() => {
                setSelectedGroupId("");
                setPagination((current) => ({ ...current, page: 1 }));
              }}
            >
              {t("knowledgeNetwork.objectTypeResourceAll")}
            </div>
            <Tree
              blockNode
              className={styles.groupTree}
              defaultExpandAll
              onSelect={(keys, info) => {
                if (info.node.selectable === false) {
                  return;
                }

                const nextGroupId = String(keys[0] ?? "");
                if (!nextGroupId || nextGroupId.startsWith("source-type:")) {
                  return;
                }

                setSelectedGroupId(nextGroupId);
                setPreviewId("");
                setPreview(null);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              selectedKeys={selectedGroupId ? [selectedGroupId] : []}
              switcherIcon={<DownOutlined style={{ fontSize: 12 }} />}
              treeData={treeData}
            />
          </div>
        </Splitter.Panel>

        <Splitter.Panel className={styles.panelBox} defaultSize={252} min={150}>
          <div className={styles.listBox}>
            <div className={styles.searchInput}>
              <Input
                allowClear
                onChange={(event) => {
                  setSearchValue(event.target.value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
                placeholder={t("common.search")}
                prefix={<SearchOutlined style={{ color: "rgba(0,0,0,0.3)", fontSize: 16 }} />}
                value={searchValue}
              />
            </div>
            <div className={styles.listContainer}>
              {listItems.length > 0 ? (
                listItems.map((item) => {
                  const isChecked = checkedItem?.id === item.id;
                  const isDisabled = selectedId === item.id;
                  return (
                    <div
                      className={`${styles.listItem} ${previewId === item.id ? styles.listItemActive : ""}`}
                      key={item.id}
                    >
                      {isDisabled ? (
                        <Checkbox checked disabled />
                      ) : (
                        <Checkbox
                          checked={isChecked}
                          onChange={() => handleToggleItem(item)}
                        />
                      )}
                      <div
                        className={styles.listItemContent}
                        onClick={() => {
                          setPreviewId(item.id);
                          setPreview(null);
                        }}
                      >
                        <span className={styles.listItemIconBox}>
                          <span className={styles.listItemIconGrid}>
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                          </span>
                        </span>
                        <div className={styles.listItemTitle}>{item.name}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={styles.previewEmpty}>
                  <Empty description={t("knowledgeNetwork.objectTypeEmptyNoSearchResult")} />
                </div>
              )}
            </div>
            <div className={styles.paginationBox}>
              <Pagination
                current={pagination.page}
                onChange={(page, pageSize) => {
                  setPagination({ page, pageSize });
                }}
                pageSize={pagination.pageSize}
                showSizeChanger={false}
                simple
                total={listTotal}
              />
            </div>
          </div>
        </Splitter.Panel>

        <Splitter.Panel className={styles.panelBox}>
          {preview ? (
            <div className={styles.previewContainer}>
              <div className={styles.previewTitle}>
                <span>{preview.name}</span>
                <span className={styles.previewTip}>
                  {t("knowledgeNetwork.objectTypeResourcePreviewTip")}
                </span>
              </div>
              <Table
                columns={preview.columns.map((column) => ({
                  ...column,
                  ellipsis: true,
                  width: 120,
                }))}
                dataSource={preview.rows.map((row, index) => ({
                  ...row,
                  key: String(index),
                }))}
                loading={previewLoading}
                pagination={false}
                scroll={{ x: 720, y: 380 }}
                size="small"
              />
            </div>
          ) : (
            <div className={styles.previewEmpty}>
              {t("knowledgeNetwork.objectTypeResourcePreviewEmpty")}
            </div>
          )}
        </Splitter.Panel>
      </Splitter>
    </Modal>
  );
}
