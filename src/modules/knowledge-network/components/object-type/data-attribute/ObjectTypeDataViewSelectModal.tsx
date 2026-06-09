import {
  CloseOutlined,
  DatabaseOutlined,
  DownOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, Checkbox, Dropdown, Input, Modal, Pagination, Splitter, Table, Tree } from "antd";
import type { DataNode } from "antd/es/tree";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getObjectTypeDataViewPreview,
  listObjectTypeDataViewGroups,
  queryObjectTypeDataViews,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ObjectTypeDataSource,
  ObjectTypeDataViewGroup,
  ObjectTypeDataViewPreview,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectTypeDataViewSelectModal.module.css";

type ObjectTypeDataViewSelectModalProps = {
  networkId: string;
  onCancel: () => void;
  onOk: (dataView: ObjectTypeDataSource) => void;
  open: boolean;
  selectedId?: string;
};

function getGroupIcon(type: string) {
  if (type === "mysql") {
    return <span className={`${styles.groupBadge} ${styles.groupBadgeMysql}`}>My</span>;
  }

  if (type === "index_base") {
    return <DatabaseOutlined className={styles.groupIcon} />;
  }

  return <span className={`${styles.groupBadge} ${styles.groupBadgeDefault}`}>DB</span>;
}

function renderGroupTitle(group: ObjectTypeDataViewGroup) {
  return (
    <span className={styles.groupNodeTitle}>
      <span className={styles.groupNodeIcon}>{getGroupIcon(group.type)}</span>
      <span className={styles.groupNodeText}>{group.name}</span>
    </span>
  );
}

export function ObjectTypeDataViewSelectModal({
  networkId,
  onCancel,
  onOk,
  open,
  selectedId,
}: ObjectTypeDataViewSelectModalProps) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<ObjectTypeDataViewGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [searchValue, setSearchValue] = useState("");
  const [checkedItem, setCheckedItem] = useState<ObjectTypeDataSource | null>(null);
  const [previewId, setPreviewId] = useState("");
  const [preview, setPreview] = useState<ObjectTypeDataViewPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [listItems, setListItems] = useState<ObjectTypeDataSource[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });

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
    [groups],
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
            <span>{t("knowledgeNetwork.objectTypeDataViewCheckedCount", { count: 1 })}</span>
            <button
              className={styles.checkedBoxClear}
              onClick={() => setCheckedItem(null)}
              type="button"
            >
              {t("knowledgeNetwork.objectTypeDataViewClearAll")}
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
    const nextGroups = await listObjectTypeDataViewGroups(networkId);
    setGroups(nextGroups);
  }, [networkId]);

  const loadList = useCallback(async (nextPagination = pagination) => {
    const result = await queryObjectTypeDataViews(networkId, {
      dataSourceId: selectedGroupId || undefined,
      name: searchValue,
      page: nextPagination.page,
      pageSize: nextPagination.pageSize,
    });
    setListItems(result.items);
    setListTotal(result.total);
  }, [networkId, pagination, searchValue, selectedGroupId]);

  const loadPreview = useCallback(async (dataViewId: string) => {
    if (!dataViewId) {
      setPreview(null);
      return;
    }

    setPreviewLoading(true);
    try {
      const nextPreview = await getObjectTypeDataViewPreview(networkId, dataViewId);
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
          {t("knowledgeNetwork.objectTypeDataViewCheckedCount", { count: 0 })}
        </div>
      ) : (
        <Dropdown menu={{ items: dropdownItems }} trigger={["click"]}>
          <div className={styles.footerTextActive}>
            {t("knowledgeNetwork.objectTypeDataViewCheckedCount", { count: 1 })}
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
          <span className={styles.titleText}>{t("knowledgeNetwork.objectTypeSelectDataView")}</span>
        </div>
      }
      width={1080}
    >
      <Splitter className={styles.splitter}>
        <Splitter.Panel className={styles.panelBox} defaultSize={210} max={280} min={150}>
          <div className={styles.groupBox}>
            <div
              className={`${styles.allItem} ${selectedGroupId ? "" : styles.allItemActive}`}
              onClick={() => setSelectedGroupId("")}
            >
              {t("knowledgeNetwork.objectTypeDataViewAll")}
            </div>
            <Tree
              blockNode
              className={styles.groupTree}
              defaultExpandAll
              onSelect={(keys, info) => {
                if (info.node.selectable === false) {
                  return;
                }

                setSelectedGroupId(String(keys[0] ?? ""));
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
              {listItems.map((item) => {
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
              })}
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
                  {t("knowledgeNetwork.objectTypeDataViewPreviewTip")}
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
              {t("knowledgeNetwork.objectTypeDataViewPreviewEmpty")}
            </div>
          )}
        </Splitter.Panel>
      </Splitter>
    </Modal>
  );
}
