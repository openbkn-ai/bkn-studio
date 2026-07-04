/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SortAscendingOutlined,
} from "@ant-design/icons";
import { Alert, Dropdown, Empty, Input, Select, Spin } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import type { KnowledgeNetworkListSceneProps } from "@/modules/knowledge-network/contracts/scenes";
import { KnowledgeNetworkCard } from "@/modules/knowledge-network/components/network/KnowledgeNetworkCard";
import { KnowledgeNetworkFormModal } from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal";
import { KnowledgeNetworkImportButton } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkImportButton";
import {
  createKnowledgeNetwork,
  deleteKnowledgeNetwork,
  exportKnowledgeNetwork,
  listKnowledgeNetworks,
  listKnowledgeNetworkTags,
  updateKnowledgeNetwork,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import { logServiceFallback } from "@/modules/knowledge-network/services/shared/runtime";
import type {
  KnowledgeNetworkMutationPayload,
  KnowledgeNetworkRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";

import styles from "./KnowledgeNetworkListScene.module.css";

const CARD_GRID_PAGE_SIZE = 12;
const CARD_GRID_PAGE_SIZE_OPTIONS = ["12", "24", "36"];

export function KnowledgeNetworkListScene({
  onOpenWorkspace,
}: KnowledgeNetworkListSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { pageState, query, setKeyword, setPagination } = usePageState({
    pageSize: CARD_GRID_PAGE_SIZE,
  });
  const [items, setItems] = useState<KnowledgeNetworkRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingRecord, setEditingRecord] = useState<KnowledgeNetworkRecord | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "updateTime">("updateTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const hasActiveFilter = useMemo(
    () => Boolean(pageState.keyword.trim()) || selectedTag !== "all",
    [pageState.keyword, selectedTag],
  );

  const listQuery = useMemo(
    () => ({
      ...query,
      direction: sortDirection,
      sortBy,
      tag: selectedTag === "all" ? undefined : selectedTag,
    }),
    [query, selectedTag, sortBy, sortDirection],
  );

  const loadListData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listKnowledgeNetworks(listQuery);

      setItems(listResult.items);
      setTotal(listResult.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  const loadTags = useCallback(async () => {
    try {
      const tagResult = await listKnowledgeNetworkTags();
      setTags(tagResult);
    } catch (error) {
      logServiceFallback("KnowledgeNetworkListScene.loadTags", error);
      setTags([]);
    }
  }, []);

  const reloadData = useCallback(async () => {
    await Promise.all([loadListData(), loadTags()]);
  }, [loadListData, loadTags]);

  useEffect(() => {
    void loadListData();
  }, [loadListData]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const openCreate = () => {
    setModalMode("create");
    setEditingRecord(null);
    setFormOpen(true);
  };

  const openEdit = (record: KnowledgeNetworkRecord) => {
    setModalMode("edit");
    setEditingRecord(record);
    setFormOpen(true);
  };

  const openWorkspace = (record: KnowledgeNetworkRecord) => {
    if (onOpenWorkspace) {
      onOpenWorkspace(record.id);
      return;
    }

    void navigate(`/knowledge-network/workspace/${record.id}/overview`);
  };

  const submitForm = async (values: KnowledgeNetworkMutationPayload) => {
    if (modalMode === "create") {
      const nextRecord = await createKnowledgeNetwork(values);
      setFormOpen(false);
      void message.success(t("common.success"));

      if (nextRecord) {
        openWorkspace(nextRecord);
        return;
      }
    } else if (editingRecord) {
      await updateKnowledgeNetwork(editingRecord.id, values);
      setFormOpen(false);
      void message.success(t("common.success"));
    }

    await reloadData();
  };

  const renderEmptyContent = () => {
    if (hasActiveFilter) {
      return (
        <Empty
          className={styles.emptyPanel}
          description={t("knowledgeNetwork.emptyNoSearchResult")}
        />
      );
    }

    return (
      <Empty
        className={styles.emptyPanel}
        description={
          <span>
            {t("knowledgeNetwork.emptyCreateHint")}
            <AppButton onClick={openCreate} type="link">
              {t("knowledgeNetwork.emptyCreateAction")}
            </AppButton>
            {t("knowledgeNetwork.emptyCreateSuffix")}
          </span>
        }
      />
    );
  };

  return (
    <section className={styles.page}>
      {/* 页面标题与顶栏面包屑「领域业务知识网络」重复，去掉避免冗余 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <AppButton
            className={styles.toolbarButton}
            icon={<PlusOutlined />}
            onClick={openCreate}
            type="primary"
          >
            {t("common.create")}
          </AppButton>
          <KnowledgeNetworkImportButton
            className={styles.toolbarButton}
            onImported={reloadData}
          />
        </div>
        <div className={styles.toolbarRight}>
          <Input
            allowClear
            className={styles.searchInput}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("knowledgeNetwork.searchPlaceholder")}
            prefix={<SearchOutlined className={styles.searchIcon} />}
            value={pageState.keyword}
          />
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>{t("common.tag")}</span>
            <Select
              className={styles.filterSelect}
              onChange={(value) => {
                setSelectedTag(value);
                setPagination(1, pageState.pageSize);
              }}
              options={[
                { label: t("common.all"), value: "all" },
                ...tags.map((tag) => ({ label: tag, value: tag })),
              ]}
              value={selectedTag ?? "all"}
            />
          </div>
          <div className={styles.toolbarActions}>
            <Dropdown
              menu={{
                items: [
                  {
                    key: "updateTime",
                    label: t("knowledgeNetwork.sortByUpdateTime"),
                  },
                  {
                    key: "name",
                    label: t("knowledgeNetwork.sortByName"),
                  },
                ],
                onClick: ({ key }) => {
                  const nextSortBy = key as "name" | "updateTime";
                  setSortDirection((current) =>
                    nextSortBy === sortBy ? (current === "desc" ? "asc" : "desc") : "desc",
                  );
                  setSortBy(nextSortBy);
                  setPagination(1, pageState.pageSize);
                },
              }}
              trigger={["click"]}
            >
              <button
                aria-label={t("knowledgeNetwork.sortByUpdateTime")}
                className={styles.iconButton}
                type="button"
              >
                <SortAscendingOutlined />
              </button>
            </Dropdown>
            <button
              className={styles.iconButton}
              disabled={loading}
              onClick={() => {
                void reloadData();
              }}
              type="button"
            >
              <ReloadOutlined />
            </button>
          </div>
        </div>
      </div>

      {loadError ? (
        <Alert
          action={
            <AppButton
              onClick={() => {
                void reloadData();
              }}
              type="link"
            >
              {t("common.retry")}
            </AppButton>
          }
          message={loadError}
          showIcon
          type="error"
        />
      ) : null}

      <div className={styles.contentArea}>
        <Spin spinning={loading} wrapperClassName={styles.loadingWrapper}>
          <div className={styles.listContent}>
            {!loadError && !loading && items.length === 0 ? (
              renderEmptyContent()
            ) : (
              <div className={styles.grid}>
                {items.map((record) => (
                  <KnowledgeNetworkCard
                    key={record.id}
                    onDelete={(nextRecord) => {
                      void modal.confirm({
                        title: t("knowledgeNetwork.deleteTitle"),
                        content: t("knowledgeNetwork.deleteDescription", {
                          name: nextRecord.name,
                        }),
                        className: modalStyles.businessModal,
                        okButtonProps: { danger: true },
                        okText: t("common.delete"),
                        cancelText: t("common.cancel"),
                        onOk: async () => {
                          await deleteKnowledgeNetwork(nextRecord.id);
                          void message.success(t("common.success"));
                          await reloadData();
                        },
                      });
                    }}
                    onEdit={openEdit}
                    onExport={(nextRecord) => {
                      void exportKnowledgeNetwork(nextRecord.id).then(() => {
                        void message.success(t("knowledgeNetwork.exportSuccess"));
                      });
                    }}
                    onOpen={openWorkspace}
                    record={record}
                  />
                ))}
              </div>
            )}
          </div>
        </Spin>

        {items.length > 0 ? (
          <div className={styles.paginationBar}>
            <TablePaginationBar
              current={pageState.page}
              onChange={(page, pageSize) => setPagination(page, pageSize)}
              pageSize={pageState.pageSize}
              pageSizeOptions={CARD_GRID_PAGE_SIZE_OPTIONS}
              showSizeChanger
              showTotal={(nextTotal) => t("common.total", { total: nextTotal })}
              total={total}
            />
          </div>
        ) : null}
      </div>

      <KnowledgeNetworkFormModal
        mode={modalMode}
        onCancel={() => setFormOpen(false)}
        onSubmit={submitForm}
        open={formOpen}
        record={editingRecord}
      />
    </section>
  );
}
