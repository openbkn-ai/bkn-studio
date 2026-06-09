import {
  CheckCircleFilled,
  InfoCircleFilled,
  LeftOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Input, Select, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ObjectTypeIndexSettingModal } from "@/modules/knowledge-network/components/object-type/ObjectTypeIndexSettingModal";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import {
  getKnowledgeNetworkObjectTypeDetail,
  updateKnowledgeNetworkObjectTypeIndex,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ObjectTypeDataProperty,
  ObjectTypeDetail,
  ObjectTypeIndexConfig,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectTypeIndexSettingsScene.module.css";

const CONFIGURABLE_TYPES = ["string", "vector", "text"];

const PROPERTY_TYPE_OPTIONS = [
  "string",
  "text",
  "vector",
  "double",
  "integer",
  "boolean",
  "metric",
  "operator",
];

function isIndexConfigured(config?: ObjectTypeIndexConfig) {
  if (!config) {
    return false;
  }

  return (
    config.keywordConfig.enabled ||
    config.fulltextConfig.enabled ||
    config.vectorConfig.enabled
  );
}

export function ObjectTypeIndexSettingsScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { networkId = "", objectTypeId = "" } = useParams<{
    networkId: string;
    objectTypeId: string;
  }>();
  const [detail, setDetail] = useState<ObjectTypeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeProperty, setActiveProperty] = useState<ObjectTypeDataProperty | null>(
    null,
  );

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

  const hasActiveFilter = Boolean(keyword.trim() || typeFilter || stateFilter);

  const filteredProperties = useMemo(() => {
    const properties = [...(detail?.dataProperties ?? [])];

    properties.sort((left, right) => {
      const leftConfigurable = CONFIGURABLE_TYPES.includes(left.type);
      const rightConfigurable = CONFIGURABLE_TYPES.includes(right.type);

      if (leftConfigurable && !rightConfigurable) {
        return -1;
      }

      if (!leftConfigurable && rightConfigurable) {
        return 1;
      }

      return left.name.localeCompare(right.name);
    });

    return properties.filter((item) => {
      const keywordMatch = keyword
        ? item.name.toLowerCase().includes(keyword.trim().toLowerCase())
        : true;
      const typeMatch = typeFilter ? item.type === typeFilter : true;

      if (!stateFilter) {
        return keywordMatch && typeMatch;
      }

      if (!CONFIGURABLE_TYPES.includes(item.type)) {
        return false;
      }

      const configured = isIndexConfigured(item.indexConfig) ? "configured" : "pending";
      return keywordMatch && typeMatch && configured === stateFilter;
    });
  }, [detail?.dataProperties, keyword, stateFilter, typeFilter]);

  const columns: ColumnsType<ObjectTypeDataProperty> = [
    {
      dataIndex: "name",
      fixed: "left",
      title: t("knowledgeNetwork.objectTypePropertyName"),
      width: 280,
      render: (_, record) => (
        <div className={styles.propertyNameCell}>
          <span>{record.name}</span>
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
      title: t("knowledgeNetwork.objectTypePropertyDisplayName"),
      width: 280,
    },
    {
      dataIndex: "type",
      title: t("knowledgeNetwork.objectTypePropertyType"),
      width: 160,
    },
    {
      key: "configured",
      title: t("knowledgeNetwork.objectTypeIndexConfigured"),
      width: 160,
      render: (_, record) => {
        if (!CONFIGURABLE_TYPES.includes(record.type)) {
          return <span className={styles.stateNotConfigured}>--</span>;
        }

        if (isIndexConfigured(record.indexConfig)) {
          return (
            <span className={styles.stateCell}>
              <CheckCircleFilled className={styles.stateConfigured} />
              <span>{t("knowledgeNetwork.objectTypeIndexConfiguredYes")}</span>
            </span>
          );
        }

        return (
          <span className={styles.stateCell}>
            <InfoCircleFilled className={styles.stateNotConfigured} />
            <span>{t("knowledgeNetwork.objectTypeIndexConfiguredNo")}</span>
          </span>
        );
      },
    },
    {
      align: "center",
      key: "actions",
      title: t("knowledgeNetwork.objectTypeIndexConfiguration"),
      width: 100,
      render: (_, record) => (
        <AppButton
          disabled={!CONFIGURABLE_TYPES.includes(record.type)}
          onClick={() => {
            setActiveProperty(record);
            setModalOpen(true);
          }}
          type="link"
        >
          {t("knowledgeNetwork.objectTypeIndexConfigure")}
        </AppButton>
      ),
    },
  ];

  const handleSubmit = async (indexConfig: ObjectTypeIndexConfig) => {
    if (!activeProperty || !detail) {
      return;
    }

    const nextProperty: ObjectTypeDataProperty = {
      ...activeProperty,
      indexConfig,
    };

    await updateKnowledgeNetworkObjectTypeIndex(
      networkId,
      objectTypeId,
      [activeProperty.name],
      [nextProperty],
    );

    void message.success(t("common.success"));
    setModalOpen(false);
    setActiveProperty(null);
    await loadData();
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spin />
      </div>
    );
  }

  if (error) {
    return <Alert message={error} showIcon type="error" />;
  }

  if (!detail) {
    return <Empty description={t("knowledgeNetwork.emptyObjectTypes")} />;
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => {
            void navigate(listPath);
          }}
          type="button"
        >
          <LeftOutlined />
          <span>{t("knowledgeNetwork.resourcePageExit")}</span>
        </button>
        <span aria-hidden className={styles.headerDivider} />
        <div className={styles.headerInfo}>
          <span className={styles.headerInfoLabel}>
            {t("knowledgeNetwork.objectTypeIndexSettingsTitle")}:
          </span>
          <span
            className={styles.headerInfoIcon}
            style={{ backgroundColor: detail.color ?? "#1677ff" }}
          >
            {renderResourceIcon(detail.icon)}
          </span>
          <span className={styles.headerInfoName}>{detail.name}</span>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.panelTitle}>
          <span>{t("knowledgeNetwork.objectTypePropertyList")}</span>
          <span className={styles.countBadge}>{filteredProperties.length}</span>
        </div>

        <div className={styles.toolbar}>
          <Input
            allowClear
            className={styles.searchInput}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("knowledgeNetwork.searchPlaceholder")}
            prefix={<SearchOutlined />}
            value={keyword}
          />
          <div className={styles.toolbarFilters}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>
                {t("knowledgeNetwork.objectTypePropertyType")}
              </span>
              <Select
                allowClear
                className={styles.filterSelect}
                onChange={(value) => setTypeFilter(value ?? "")}
                options={[
                  { label: t("common.all"), value: "" },
                  ...PROPERTY_TYPE_OPTIONS.map((item) => ({
                    label: item,
                    value: item,
                  })),
                ]}
                value={typeFilter || undefined}
              />
            </div>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>{t("common.status")}</span>
              <Select
                allowClear
                className={styles.filterSelect}
                onChange={(value) => setStateFilter(value ?? "")}
                options={[
                  { label: t("common.all"), value: "" },
                  {
                    label: t("knowledgeNetwork.objectTypeIndexConfiguredYes"),
                    value: "configured",
                  },
                  {
                    label: t("knowledgeNetwork.objectTypeIndexConfiguredNo"),
                    value: "pending",
                  },
                ]}
                value={stateFilter || undefined}
              />
            </div>
            <button
              aria-label={t("common.refresh")}
              className={styles.iconButton}
              onClick={() => {
                void loadData();
              }}
              type="button"
            >
              <ReloadOutlined />
            </button>
          </div>
        </div>

        <div className={styles.tableCard}>
          <Table<ObjectTypeDataProperty>
            columns={columns}
            dataSource={filteredProperties}
            locale={{
              emptyText: (
                <Empty
                  description={
                    hasActiveFilter
                      ? t("knowledgeNetwork.objectTypePropertySearchEmpty")
                      : t("knowledgeNetwork.objectTypePropertyEmpty")
                  }
                />
              ),
            }}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            rowKey="name"
            scroll={{ x: 980 }}
            size="middle"
          />
        </div>
      </div>

      <ObjectTypeIndexSettingModal
        onCancel={() => {
          setModalOpen(false);
          setActiveProperty(null);
        }}
        onSubmit={handleSubmit}
        open={modalOpen}
        propertyName={activeProperty?.name ?? ""}
        values={activeProperty?.indexConfig}
      />
    </section>
  );
}
