/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined, SearchOutlined } from "@ant-design/icons";
import { Input, Modal, Table, Tag } from "antd";
import type { TableProps } from "antd";
import type { Key } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import {
  addObjectTypesToKnowledgeNetworkConceptGroup,
  getKnowledgeNetworkConceptGroup,
  listKnowledgeNetworkObjectTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ConceptGroupAddObjectTypesModal.module.css";

type ConceptGroupAddObjectTypesModalProps = {
  groupId: string;
  groupName: string;
  networkId: string;
  onCancel: () => void;
  onSuccess: () => void;
  open: boolean;
};

export function ConceptGroupAddObjectTypesModal({
  groupId,
  groupName,
  networkId,
  onCancel,
  onSuccess,
  open,
}: ConceptGroupAddObjectTypesModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [existingObjectTypeIds, setExistingObjectTypeIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<
    Record<string, KnowledgeNetworkObjectTypeRecord>
  >({});

  useEffect(() => {
    if (!open) {
      return;
    }

    setKeyword("");
    setPage(1);
    setSelectedIds([]);
    setSelectedRecords({});

    const loadData = async () => {
      setLoading(true);

      try {
        const [groupDetail, objectTypeList] = await Promise.all([
          getKnowledgeNetworkConceptGroup(networkId, groupId),
          listKnowledgeNetworkObjectTypes(networkId),
        ]);

        setExistingObjectTypeIds((groupDetail?.objectTypes ?? []).map((item) => item.id));
        setObjectTypes(objectTypeList);
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [groupId, message, networkId, open]);

  const filteredObjectTypes = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return objectTypes;
    }

    return objectTypes.filter(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        item.id.toLowerCase().includes(normalized),
    );
  }, [keyword, objectTypes]);

  const pagedObjectTypes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredObjectTypes.slice(start, start + pageSize);
  }, [filteredObjectTypes, page, pageSize]);

  const selectedItems = useMemo(
    () => selectedIds.map((id) => selectedRecords[id]).filter(Boolean),
    [selectedIds, selectedRecords],
  );

  const handleSelectionChange = (
    nextSelectedRowKeys: Key[],
    nextSelectedRows: KnowledgeNetworkObjectTypeRecord[],
  ) => {
    const pageIds = new Set(pagedObjectTypes.map((item) => item.id));
    const retainedIds = selectedIds.filter((id) => !pageIds.has(id));
    const retainedRecords = { ...selectedRecords };

    pageIds.forEach((id) => {
      delete retainedRecords[id];
    });

    nextSelectedRows.forEach((item) => {
      retainedRecords[item.id] = item;
    });

    const mergedIds = [...retainedIds, ...nextSelectedRowKeys.map(String)];
    setSelectedIds(mergedIds);
    setSelectedRecords(retainedRecords);
  };

  const removeSelected = (objectTypeId: string) => {
    setSelectedIds((current) => current.filter((id) => id !== objectTypeId));
    setSelectedRecords((current) => {
      const next = { ...current };
      delete next[objectTypeId];
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) {
      void message.warning(t("knowledgeNetwork.conceptGroupSelectObjectTypesToAdd"));
      return;
    }

    setSubmitting(true);

    try {
      await addObjectTypesToKnowledgeNetworkConceptGroup(networkId, groupId, selectedIds);
      void message.success(t("knowledgeNetwork.conceptGroupAddObjectTypesSuccess"));
      onSuccess();
      onCancel();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableProps<KnowledgeNetworkObjectTypeRecord>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("common.name"),
      render: (value: string, record) => (
        <span className={styles.nameCell}>
          <span className={styles.nameIcon} style={{ backgroundColor: record.color ?? "#1677ff" }}>
            {renderResourceIcon(record.icon)}
          </span>
          <span className={styles.nameText}>{value}</span>
        </span>
      ),
    },
    {
      dataIndex: "tags",
      key: "tags",
      title: t("common.tag"),
      render: (value: string[]) =>
        value.length > 0 ? value.map((tag) => <Tag key={tag}>{tag}</Tag>) : t("knowledgeNetwork.noTags"),
    },
  ];

  return (
    <Modal
      className={styles.modal}
      destroyOnClose
      footer={null}
      onCancel={onCancel}
      open={open}
      title={null}
      width={1080}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          {t("knowledgeNetwork.conceptGroupAddObjectTypes", { name: groupName })}
        </div>

        <div className={styles.body}>
          <div className={styles.leftPanel}>
            <Input
              allowClear
              className={styles.searchInput}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder={t("knowledgeNetwork.conceptGroupSearchName")}
              prefix={<SearchOutlined />}
              value={keyword}
            />
            <Table<KnowledgeNetworkObjectTypeRecord>
              columns={columns}
              dataSource={pagedObjectTypes}
              loading={loading}
              pagination={{
                current: page,
                onChange: (nextPage, nextPageSize) => {
                  setPage(nextPage);
                  setPageSize(nextPageSize);
                },
                pageSize,
                showSizeChanger: true,
                total: filteredObjectTypes.length,
              }}
              rowKey="id"
              rowSelection={{
                getCheckboxProps: (record) => ({
                  disabled: existingObjectTypeIds.includes(record.id),
                }),
                onChange: handleSelectionChange,
                selectedRowKeys: selectedIds.filter((id) =>
                  pagedObjectTypes.some((item) => item.id === id),
                ),
              }}
              scroll={{ y: 360 }}
              size="small"
            />
          </div>

          <div className={styles.rightPanel}>
            <div className={styles.selectedTitle}>
              {t("knowledgeNetwork.conceptGroupSelectedObjectTypes", {
                count: selectedItems.length,
              })}
            </div>
            <div className={styles.selectedList}>
              {selectedItems.map((item) => (
                <div className={styles.selectedItem} key={item.id}>
                  <span className={styles.selectedName}>
                    <span
                      className={styles.nameIcon}
                      style={{ backgroundColor: item.color ?? "#1677ff" }}
                    >
                      {renderResourceIcon(item.icon)}
                    </span>
                    <span className={styles.selectedNameText}>{item.name}</span>
                  </span>
                  <AppButton
                    icon={<CloseOutlined />}
                    onClick={() => removeSelected(item.id)}
                    type="text"
                  />
                </div>
              ))}
            </div>
            <div className={styles.footer}>
              <AppButton onClick={onCancel}>{t("common.cancel")}</AppButton>
              <AppButton loading={submitting} onClick={() => void handleConfirm()} type="primary">
                {t("common.confirm")}
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
