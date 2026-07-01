/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  EditOutlined,
  EllipsisOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Alert, Dropdown, Empty, Input, Segmented, Spin, Table, Tag } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import {
  deleteKnowledgeNetworkObjectType,
  getKnowledgeNetworkObjectTypeDetail,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ObjectTypeDataProperty,
  ObjectTypeDetail,
  ObjectTypeLogicProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectTypeDetailScene.module.css";

export function ObjectTypeDetailScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { networkId = "", objectTypeId = "" } = useParams<{
    networkId: string;
    objectTypeId: string;
  }>();
  const [detail, setDetail] = useState<ObjectTypeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyType, setPropertyType] = useState<"data" | "logic">("data");
  const [keyword, setKeyword] = useState("");

  const listPath = `/knowledge-network/workspace/${networkId}/object-types`;

  const loadData = async () => {
    if (!networkId || !objectTypeId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getKnowledgeNetworkObjectTypeDetail(networkId, objectTypeId);
      setDetail(result);
    } catch (nextError) {
      setError(extractRequestErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [networkId, objectTypeId]);

  const filteredDataProperties = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    const items = detail?.dataProperties ?? [];

    if (!normalized) {
      return items;
    }

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        item.displayName.toLowerCase().includes(normalized),
    );
  }, [detail?.dataProperties, keyword]);

  const filteredLogicProperties = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    const items = detail?.logicProperties ?? [];

    if (!normalized) {
      return items;
    }

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        item.displayName.toLowerCase().includes(normalized),
    );
  }, [detail?.logicProperties, keyword]);

  const confirmDelete = () => {
    if (!detail) {
      return;
    }

    void modal.confirm({
      title: t("knowledgeNetwork.objectTypeDeleteTitle"),
      content: t("knowledgeNetwork.objectTypeDeleteDescription", { name: detail.name }),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: async () => {
        await deleteKnowledgeNetworkObjectType(networkId, detail.id);
        void message.success(t("common.success"));
        void navigate(listPath);
      },
    });
  };

  const menuItems: MenuProps["items"] = [
    {
      danger: true,
      key: "delete",
      label: t("common.delete"),
    },
  ];

  const dataColumns: TableProps<ObjectTypeDataProperty>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("common.name"),
      render: (value: string, record) => (
        <div className={styles.propertyTitle}>
          <span>{value}</span>
          {record.primaryKey ? (
            <span className={styles.keyBadge}>{t("knowledgeNetwork.objectTypePrimaryKey")}</span>
          ) : null}
          {record.displayKey ? (
            <span className={styles.keyBadge}>{t("knowledgeNetwork.objectTypeDisplayKey")}</span>
          ) : null}
          {record.incrementalKey ? (
            <span className={styles.keyBadge}>
              {t("knowledgeNetwork.objectTypeIncrementalKey")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      dataIndex: "displayName",
      key: "displayName",
      title: t("knowledgeNetwork.objectTypePropertyDisplayName"),
      render: (value: string) => value || "--",
    },
    {
      dataIndex: "type",
      key: "type",
      title: t("knowledgeNetwork.objectTypePropertyType"),
      width: 120,
    },
  ];

  const logicColumns: TableProps<ObjectTypeLogicProperty>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("common.name"),
    },
    {
      dataIndex: "displayName",
      key: "displayName",
      title: t("knowledgeNetwork.objectTypePropertyDisplayName"),
      render: (value: string) => value || "--",
    },
    {
      dataIndex: "dataSource",
      key: "bindResource",
      render: (_value, record) => record.dataSource?.name || "--",
      title: t("knowledgeNetwork.objectTypeBindResource"),
      width: 220,
    },
    {
      dataIndex: "comment",
      key: "comment",
      title: t("common.description"),
      render: (value?: string) => value || "--",
    },
  ];

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
    <KnowledgeNetworkResourceConfigShell
      actions={
        <>
          <AppButton
            icon={<EditOutlined />}
            onClick={() => {
              void navigate(
                `/knowledge-network/workspace/${networkId}/object-types/${objectTypeId}/edit`,
              );
            }}
          >
            {t("common.edit")}
          </AppButton>
          <AppButton
            icon={<SettingOutlined />}
            onClick={() => {
              void navigate(
                `/knowledge-network/workspace/${networkId}/object-types/${objectTypeId}/index-settings`,
              );
            }}
          >
            {t("knowledgeNetwork.objectTypeIndexSettingsEntry")}
          </AppButton>
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key }) => {
                if (key === "delete") {
                  confirmDelete();
                }
              },
            }}
            trigger={["click"]}
          >
            <AppButton icon={<EllipsisOutlined style={{ fontSize: 20 }} />} type="text" />
          </Dropdown>
        </>
      }
      onBack={() => {
        void navigate(listPath);
      }}
      subtitle={detail.id}
      title={detail.name}
    >
      <div className={styles.page}>
        <section className={styles.summaryCard}>
          <div className={styles.summaryHead}>
            <span
              className={styles.objectIconSquare}
              style={{ backgroundColor: detail.color }}
            >
              {renderResourceIcon(detail.icon)}
            </span>
            <div>
              <h2 className={styles.summaryTitle}>{detail.name}</h2>
              <p className={styles.summaryDescription}>
                {detail.description || t("knowledgeNetwork.noDescription")}
              </p>
            </div>
          </div>
          <div className={styles.tagRow}>
            {detail.tags.length > 0 ? (
              detail.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)
            ) : (
              <span className={styles.placeholder}>{t("knowledgeNetwork.noTags")}</span>
            )}
          </div>
          <div className={styles.metaRow}>
            <span>
              {t("knowledgeNetwork.objectTypeHasIndex")}:{" "}
              {detail.hasIndex
                ? t("knowledgeNetwork.objectTypeIndexed")
                : t("knowledgeNetwork.objectTypeNotIndexed")}
            </span>
            <span>
              {t("knowledgeNetwork.modifier")}: {detail.updaterName || "--"}
            </span>
            <span>
              {t("common.updateTime")}: {detail.updateTime || "--"}
            </span>
            <span>
              {t("knowledgeNetwork.objectTypeConceptGroups")}:{" "}
              {detail.conceptGroupNames.length}
            </span>
          </div>
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionToolbar}>
            <Segmented
              onChange={(value) => {
                setPropertyType(value as "data" | "logic");
                setKeyword("");
              }}
              options={[
                { label: t("knowledgeNetwork.objectTypeDataProperty"), value: "data" },
                { label: t("knowledgeNetwork.objectTypeLogicProperty"), value: "logic" },
              ]}
              value={propertyType}
            />
            <Input.Search
              allowClear
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t("knowledgeNetwork.objectTypeSearchProperty")}
              style={{ width: 280 }}
              value={keyword}
            />
          </div>

          {propertyType === "data" ? (
            <Table<ObjectTypeDataProperty>
              columns={dataColumns}
              dataSource={filteredDataProperties}
              locale={{
                emptyText: (
                  <Empty description={t("knowledgeNetwork.objectTypePropertyEmpty")} />
                ),
              }}
              pagination={false}
              rowKey="name"
              size="small"
            />
          ) : (
            <Table<ObjectTypeLogicProperty>
              columns={logicColumns}
              dataSource={filteredLogicProperties}
              locale={{
                emptyText: (
                  <Empty description={t("knowledgeNetwork.objectTypeLogicPropertyEmpty")} />
                ),
              }}
              pagination={false}
              rowKey="name"
              size="small"
            />
          )}
        </section>
      </div>
    </KnowledgeNetworkResourceConfigShell>
  );
}
