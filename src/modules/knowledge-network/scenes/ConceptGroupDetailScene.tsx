/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Input, Select, Spin, Table, Tabs, Tag } from "antd";
import type { TableProps } from "antd";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ConceptGroupAddObjectTypesModal } from "@/modules/knowledge-network/components/concept-group/ConceptGroupAddObjectTypesModal";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import {
  deleteKnowledgeNetworkConceptGroup,
  getKnowledgeNetworkConceptGroup,
  removeObjectTypesFromKnowledgeNetworkConceptGroup,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ConceptGroupDetail,
  ConceptGroupRelatedItem,
  KnowledgeNetworkActionTypeKind,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ConceptGroupDetailScene.module.css";

type RelatedTabKey = "object" | "relation" | "action";

type TabSearchState = {
  keyword: string;
  tag: string;
};

const DEFAULT_TAB_SEARCH: Record<RelatedTabKey, TabSearchState> = {
  action: { keyword: "", tag: "all" },
  object: { keyword: "", tag: "all" },
  relation: { keyword: "", tag: "all" },
};

function downloadConceptGroupExport(detail: ConceptGroupDetail) {
  const blob = new Blob([JSON.stringify(detail, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${detail.name}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function renderMemberNameCell(
  record: ConceptGroupRelatedItem,
  onClick?: () => void,
  fallbackIcon?: ReactNode,
) {
  const content = (
    <>
      <span
        className={styles.memberIcon}
        style={{ backgroundColor: record.color ?? "#1677ff" }}
      >
        {record.icon ? renderResourceIcon(record.icon) : fallbackIcon}
      </span>
      <span className={styles.memberName}>{record.name}</span>
    </>
  );

  if (!onClick) {
    return <span className={styles.memberLinkStatic}>{content}</span>;
  }

  return (
    <button className={styles.memberLink} onClick={onClick} type="button">
      {content}
    </button>
  );
}

function renderObjectRefCell(
  value: ConceptGroupRelatedItem["sourceObjectType"],
  onClick?: () => void,
) {
  if (!value?.name) {
    return <span className={styles.placeholder}>--</span>;
  }

  const content = (
    <>
      <span
        className={styles.memberIcon}
        style={{ backgroundColor: value.color ?? "#1677ff" }}
      >
        {renderResourceIcon(value.icon)}
      </span>
      <span className={styles.memberName}>{value.name}</span>
    </>
  );

  if (!onClick) {
    return <span className={styles.memberLinkStatic}>{content}</span>;
  }

  return (
    <button className={styles.memberLink} onClick={onClick} type="button">
      {content}
    </button>
  );
}

export function ConceptGroupDetailScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { conceptGroupId = "", networkId = "" } = useParams<{
    conceptGroupId: string;
    networkId: string;
  }>();
  const [detail, setDetail] = useState<ConceptGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RelatedTabKey>("object");
  const [searchStates, setSearchStates] =
    useState<Record<RelatedTabKey, TabSearchState>>(DEFAULT_TAB_SEARCH);
  const [selectedObjectTypeIds, setSelectedObjectTypeIds] = useState<string[]>([]);
  const [addObjectTypesOpen, setAddObjectTypesOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listPath = `/knowledge-network/workspace/${networkId}/concept-groups`;

  const loadData = useCallback(async () => {
    if (!networkId || !conceptGroupId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getKnowledgeNetworkConceptGroup(networkId, conceptGroupId);
      setDetail(result);
    } catch (nextError) {
      setError(extractRequestErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [conceptGroupId, networkId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
    setSelectedObjectTypeIds([]);
  }, [activeTab]);

  const actionKindLabel = (kind?: KnowledgeNetworkActionTypeKind) => {
    if (!kind) {
      return "--";
    }

    const labels: Record<KnowledgeNetworkActionTypeKind, string> = {
      create: t("knowledgeNetwork.actionTypeKindCreate"),
      delete: t("knowledgeNetwork.actionTypeKindDelete"),
      notify: t("knowledgeNetwork.actionTypeKindNotify"),
      update: t("knowledgeNetwork.actionTypeKindUpdate"),
    };

    return labels[kind] ?? kind;
  };

  const currentItems = useMemo(() => {
    if (!detail) {
      return [] as ConceptGroupRelatedItem[];
    }

    if (activeTab === "relation") {
      return detail.relationTypes;
    }

    if (activeTab === "action") {
      return detail.actionTypes;
    }

    return detail.objectTypes;
  }, [activeTab, detail]);

  const { keyword, tag } = searchStates[activeTab];

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    currentItems.forEach((item) => {
      item.tags.forEach((entry) => tags.add(entry));
    });

    return [
      { label: t("common.all"), value: "all" },
      ...[...tags].sort((left, right) => left.localeCompare(right)).map((entry) => ({
        label: entry,
        value: entry,
      })),
    ];
  }, [currentItems, t]);

  const filteredItems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();

    return currentItems.filter((item) => {
      const matchesKeyword =
        !normalized ||
        item.name.toLowerCase().includes(normalized) ||
        item.id.toLowerCase().includes(normalized);
      const matchesTag = tag === "all" || item.tags.includes(tag);
      return matchesKeyword && matchesTag;
    });
  }, [currentItems, keyword, tag]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const confirmDelete = () => {
    if (!detail) {
      return;
    }

    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t("knowledgeNetwork.conceptGroupDeleteDescription", { name: detail.name }),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: async () => {
        await deleteKnowledgeNetworkConceptGroup(networkId, detail.id);
        void message.success(t("common.success"));
        void navigate(listPath);
      },
      title: t("knowledgeNetwork.conceptGroupDeleteTitle"),
    });
  };

  const openResourceDetail = (item: ConceptGroupRelatedItem) => {
    if (activeTab === "object") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/object-types/${item.id}/detail`,
      );
      return;
    }

    if (activeTab === "relation") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/relation-types/${item.id}/detail`,
      );
      return;
    }

    void navigate(
      `/knowledge-network/workspace/${networkId}/action-types/${item.id}/detail`,
    );
  };

  const openObjectTypeDetail = (objectTypeId?: string) => {
    if (!objectTypeId) {
      return;
    }

    void navigate(
      `/knowledge-network/workspace/${networkId}/object-types/${objectTypeId}/detail`,
    );
  };

  const handleRemoveObjectTypes = async () => {
    if (!detail || selectedObjectTypeIds.length === 0) {
      void message.warning(t("knowledgeNetwork.conceptGroupSelectObjectTypesToRemove"));
      return;
    }

    try {
      await removeObjectTypesFromKnowledgeNetworkConceptGroup(
        networkId,
        detail.id,
        selectedObjectTypeIds,
      );
      void message.success(t("knowledgeNetwork.conceptGroupRemoveObjectTypesSuccess"));
      setSelectedObjectTypeIds([]);
      await loadData();
    } catch (nextError) {
      void message.error(extractRequestErrorMessage(nextError));
    }
  };

  const objectColumns: TableProps<ConceptGroupRelatedItem>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("common.name"),
      render: (_value: string, record) =>
        renderMemberNameCell(record, () => openResourceDetail(record)),
    },
    {
      dataIndex: "tags",
      key: "tags",
      title: t("common.tag"),
      render: (value: string[]) =>
        value.length > 0 ? (
          <div className={styles.tagRow}>
            {value.map((entry) => (
              <Tag key={entry}>{entry}</Tag>
            ))}
          </div>
        ) : (
          t("knowledgeNetwork.noTags")
        ),
    },
  ];

  const relationColumns: TableProps<ConceptGroupRelatedItem>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("common.name"),
      render: (_value: string, record) =>
        renderMemberNameCell(record, () => openResourceDetail(record)),
    },
    {
      dataIndex: "sourceObjectType",
      key: "sourceObjectType",
      title: t("knowledgeNetwork.relationTypeSourceObject"),
      render: (value: ConceptGroupRelatedItem["sourceObjectType"]) =>
        renderObjectRefCell(value, () => openObjectTypeDetail(value?.id)),
    },
    {
      dataIndex: "targetObjectType",
      key: "targetObjectType",
      title: t("knowledgeNetwork.relationTypeTargetObject"),
      render: (value: ConceptGroupRelatedItem["targetObjectType"]) =>
        renderObjectRefCell(value, () => openObjectTypeDetail(value?.id)),
    },
    {
      dataIndex: "tags",
      key: "tags",
      title: t("common.tag"),
      render: (value: string[]) =>
        value.length > 0 ? (
          <div className={styles.tagRow}>
            {value.map((entry) => (
              <Tag key={entry}>{entry}</Tag>
            ))}
          </div>
        ) : (
          t("knowledgeNetwork.noTags")
        ),
    },
  ];

  const actionColumns: TableProps<ConceptGroupRelatedItem>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("common.name"),
      render: (_value: string, record) =>
        renderMemberNameCell(record, () => openResourceDetail(record), <AppstoreOutlined />),
    },
    {
      dataIndex: "actionKind",
      key: "actionKind",
      title: t("knowledgeNetwork.actionTypeKind"),
      render: (value: KnowledgeNetworkActionTypeKind | undefined) => actionKindLabel(value),
      width: 120,
    },
    {
      dataIndex: "boundObjectType",
      key: "boundObjectType",
      title: t("knowledgeNetwork.actionTypeObject"),
      render: (value: ConceptGroupRelatedItem["boundObjectType"]) =>
        renderObjectRefCell(value, () => openObjectTypeDetail(value?.id)),
    },
    {
      dataIndex: "tags",
      key: "tags",
      title: t("common.tag"),
      render: (value: string[]) =>
        value.length > 0 ? (
          <div className={styles.tagRow}>
            {value.map((entry) => (
              <Tag key={entry}>{entry}</Tag>
            ))}
          </div>
        ) : (
          t("knowledgeNetwork.noTags")
        ),
    },
  ];

  const tableColumns =
    activeTab === "relation"
      ? relationColumns
      : activeTab === "action"
        ? actionColumns
        : objectColumns;

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spin />
      </div>
    );
  }

  if (error || !detail) {
    return <Alert message={error ?? t("common.notFound")} showIcon type="error" />;
  }

  return (
    <>
      <KnowledgeNetworkResourceConfigShell
        actions={
          <>
            <AppButton
              icon={<EditOutlined />}
              onClick={() => {
                void navigate(
                  `/knowledge-network/workspace/${networkId}/concept-groups/${conceptGroupId}/edit`,
                );
              }}
            >
              {t("common.edit")}
            </AppButton>
            <AppButton
              icon={<DownloadOutlined />}
              onClick={() => {
                downloadConceptGroupExport(detail);
                void message.success(t("knowledgeNetwork.conceptGroupExportSuccess"));
              }}
            >
              {t("knowledgeNetwork.conceptGroupExport")}
            </AppButton>
            <AppButton danger onClick={confirmDelete}>
              {t("common.delete")}
            </AppButton>
          </>
        }
        onBack={() => {
          void navigate(listPath);
        }}
        subtitle={t("knowledgeNetwork.conceptGroupDetailDescription")}
        title={detail.name}
      >
        <div className={styles.page}>
          <section className={styles.summaryCard}>
            <div className={styles.summaryHead}>
              <span
                className={styles.summaryIcon}
                style={{ backgroundColor: detail.color ?? "#1677ff" }}
              >
                <AppstoreOutlined />
              </span>
              <div className={styles.summaryMain}>
                <h2 className={styles.summaryTitle}>{detail.name}</h2>
                <p className={styles.summaryDescription}>
                  {detail.description || t("knowledgeNetwork.noDescription")}
                </p>
              </div>
            </div>
            <div className={styles.tagRow}>
              {detail.tags && detail.tags.length > 0 ? (
                detail.tags.map((entry) => <Tag key={entry}>{entry}</Tag>)
              ) : (
                <span className={styles.placeholder}>{t("knowledgeNetwork.noTags")}</span>
              )}
            </div>
            <div className={styles.summaryMeta}>
              <span>
                {t("common.id")}: {detail.id}
              </span>
              {detail.updaterName ? (
                <span>
                  {t("knowledgeNetwork.modifier")}: {detail.updaterName}
                </span>
              ) : null}
              <span>
                {t("common.updateTime")}: {detail.updateTime}
              </span>
            </div>
          </section>

          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("knowledgeNetwork.conceptGroupSectionTitle")}</h3>
            <Tabs
              activeKey={activeTab}
              items={[
                { key: "object", label: t("knowledgeNetwork.objectTypes") },
                { key: "relation", label: t("knowledgeNetwork.relationTypes") },
                { key: "action", label: t("knowledgeNetwork.actionTypes") },
              ]}
              onChange={(key) => setActiveTab(key as RelatedTabKey)}
            />
            <div className={styles.sectionToolbar}>
              <div className={styles.toolbarLeft}>
                {activeTab === "object" ? (
                  <>
                    <AppButton
                      icon={<PlusOutlined />}
                      onClick={() => setAddObjectTypesOpen(true)}
                      type="primary"
                    >
                      {t("common.add")}
                    </AppButton>
                    <AppButton
                      danger
                      disabled={selectedObjectTypeIds.length === 0}
                      onClick={() => void handleRemoveObjectTypes()}
                    >
                      {t("common.remove")}
                    </AppButton>
                  </>
                ) : null}
              </div>
              <div className={styles.toolbarRight}>
                <Input
                  allowClear
                  className={styles.searchInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSearchStates((current) => ({
                      ...current,
                      [activeTab]: { ...current[activeTab], keyword: value },
                    }));
                    setPage(1);
                  }}
                  placeholder={t("knowledgeNetwork.conceptGroupSearchName")}
                  value={keyword}
                />
                <Select
                  className={styles.tagSelect}
                  onChange={(value) => {
                    setSearchStates((current) => ({
                      ...current,
                      [activeTab]: { ...current[activeTab], tag: value },
                    }));
                    setPage(1);
                  }}
                  options={tagOptions}
                  value={tag}
                />
              </div>
            </div>
            <Table<ConceptGroupRelatedItem>
              columns={tableColumns}
              dataSource={pagedItems}
              locale={{
                emptyText: (
                  <Empty description={t("knowledgeNetwork.conceptGroupMembersEmpty")} />
                ),
              }}
              pagination={{
                current: page,
                onChange: (nextPage, nextPageSize) => {
                  setPage(nextPage);
                  setPageSize(nextPageSize);
                },
                pageSize,
                showSizeChanger: true,
                showTotal: (total) => t("common.total", { total }),
                total: filteredItems.length,
              }}
              rowKey="id"
              rowSelection={
                activeTab === "object"
                  ? {
                      onChange: (keys) => setSelectedObjectTypeIds(keys.map(String)),
                      selectedRowKeys: selectedObjectTypeIds,
                    }
                  : undefined
              }
              scroll={{ x: "max-content" }}
              size="middle"
            />
          </section>
        </div>
      </KnowledgeNetworkResourceConfigShell>

      <ConceptGroupAddObjectTypesModal
        groupId={detail.id}
        groupName={detail.name}
        networkId={networkId}
        onCancel={() => setAddObjectTypesOpen(false)}
        onSuccess={() => void loadData()}
        open={addObjectTypesOpen}
      />
    </>
  );
}
