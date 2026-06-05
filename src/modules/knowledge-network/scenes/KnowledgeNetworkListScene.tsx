import {
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SortAscendingOutlined,
} from "@ant-design/icons";
import { Alert, Dropdown, Input, Pagination, Select, Space } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import type { KnowledgeNetworkListSceneProps } from "@/modules/knowledge-network/contracts/scenes";
import { KnowledgeNetworkCard } from "@/modules/knowledge-network/components/KnowledgeNetworkCard";
import { KnowledgeNetworkFormModal } from "@/modules/knowledge-network/components/KnowledgeNetworkFormModal";
import {
  createKnowledgeNetwork,
  deleteKnowledgeNetwork,
  listKnowledgeNetworks,
  listKnowledgeNetworkTags,
  updateKnowledgeNetwork,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkMutationPayload,
  KnowledgeNetworkRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./KnowledgeNetworkListScene.module.css";

export function KnowledgeNetworkListScene({
  onOpenWorkspace,
}: KnowledgeNetworkListSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { pageState, query, reset, setKeyword, setPagination } = usePageState({
    pageSize: 20,
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

  const listQuery = useMemo(
    () => ({
      ...query,
      direction: sortDirection,
      sortBy,
      tag: selectedTag === "all" ? undefined : selectedTag,
    }),
    [query, selectedTag, sortBy, sortDirection],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [listResult, tagResult] = await Promise.all([
        listKnowledgeNetworks(listQuery),
        tags.length === 0 ? listKnowledgeNetworkTags() : Promise.resolve(tags),
      ]);

      setItems(listResult.items);
      setTotal(listResult.total);
      setTags(tagResult);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [listQuery, tags]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  const openPreview = (record: KnowledgeNetworkRecord) => {
    void navigate(`/knowledge-network/workspace/${record.id}/preview`);
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

    await loadData();
  };

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{t("knowledgeNetwork.title")}</h1>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Space wrap>
            <AppButton
              className={styles.toolbarButton}
              icon={<PlusOutlined />}
              onClick={openCreate}
              type="primary"
            >
              {t("common.create")}
            </AppButton>
            <AppButton
              className={styles.toolbarButton}
              icon={<ImportOutlined />}
              onClick={() => {
                void modal.info({
                  title: t("knowledgeNetwork.importTitle"),
                  content: t("knowledgeNetwork.importPending"),
                });
              }}
            >
              {t("knowledgeNetwork.importButton")}
            </AppButton>
          </Space>
        </div>
        <div className={styles.toolbarRight}>
          <Input
            allowClear
            className={styles.searchInput}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={(event) => {
              const nextValue = (event.target as HTMLInputElement).value;
              setKeyword(nextValue);
            }}
            placeholder={t("knowledgeNetwork.searchPlaceholder")}
            suffix={<SearchOutlined className={styles.searchIcon} />}
            value={pageState.keyword}
          />
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>{t("common.tag")}</span>
            <Select
              className={styles.filterSelect}
              onChange={(value) => setSelectedTag(value)}
              options={[
                { label: t("common.all"), value: "all" },
                ...tags.map((tag) => ({ label: tag, value: tag })),
              ]}
              placeholder={t("knowledgeNetwork.tagFilterPlaceholder")}
              value={selectedTag ?? "all"}
            />
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
                },
              }}
              trigger={["click"]}
            >
              <button className={styles.iconButton} type="button">
                <SortAscendingOutlined />
              </button>
            </Dropdown>
            <button
              className={styles.iconButton}
              onClick={() => {
                reset();
                setSelectedTag("all");
                setSortBy("updateTime");
                setSortDirection("desc");
                void loadData();
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
                void loadData();
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
        {!loadError && !loading && items.length === 0 ? (
          <div className={styles.emptyWrapper}>
            <EmptyStatePanel
              action={
                <AppButton onClick={openCreate} type="primary">
                  {t("common.create")}
                </AppButton>
              }
              description={t("knowledgeNetwork.emptyDescription")}
              icon={<PlusOutlined />}
              title={t("knowledgeNetwork.emptyTitle")}
            />
          </div>
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
                    okButtonProps: { danger: true },
                    okText: t("common.delete"),
                    cancelText: t("common.cancel"),
                    onOk: async () => {
                      await deleteKnowledgeNetwork(nextRecord.id);
                      void message.success(t("common.success"));
                      await loadData();
                    },
                  });
                }}
                onEdit={openEdit}
                onOpen={openWorkspace}
                onPreview={openPreview}
                record={record}
              />
            ))}
          </div>
        )}
        <div className={styles.paginationBar}>
          <Pagination
            current={pageState.page}
            onChange={(page, pageSize) => setPagination(page, pageSize)}
            pageSize={pageState.pageSize}
            pageSizeOptions={["20", "50", "100"]}
            showSizeChanger
            showTotal={(nextTotal) => t("common.total", { total: nextTotal })}
            total={total}
          />
        </div>
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
