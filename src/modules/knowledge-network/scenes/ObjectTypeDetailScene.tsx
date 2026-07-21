/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ArrowRightOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Input, Segmented, Spin, Table, Tag } from "antd";
import type { TableProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { formatIndexStateLabel } from "@/modules/data-catalog/lib/format-index-state";
import { indexStateOf } from "@/modules/data-catalog/lib/index-state";
import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import { ObjectTypePropertyTable } from "@/modules/knowledge-network/components/object-type/ObjectTypePropertyTable";
import { enrichDataPropertiesWithRowTotal } from "@/modules/knowledge-network/lib/enrich-data-properties";
import { getObjectTypeResourcePreview } from "@/modules/knowledge-network/services/object-type-resource.service";
import {
  deleteKnowledgeNetworkObjectType,
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkRelationTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkRelationTypeRecord,
  ObjectTypeDetail,
  ObjectTypeLogicProperty,
  ObjectTypeResourcePreview,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectTypeDetailScene.module.css";

function normalizedSearchText(value: unknown) {
  if (typeof value === "string") {
    return value.toLowerCase();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase();
  }

  return "";
}

type ObjectTypeDetailLocationState = {
  knowledgeNetworkReturnTo?: string;
};

type RelatedRelationRole = "source" | "target";

type RelatedRelationRow = KnowledgeNetworkRelationTypeRecord & {
  oppositeObjectTypeId: string;
  oppositeObjectTypeName: string;
  role: RelatedRelationRole;
};

export function ObjectTypeDetailScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [preview, setPreview] = useState<ObjectTypeResourcePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewKeyword, setPreviewKeyword] = useState("");
  const [dataQueryExpanded, setDataQueryExpanded] = useState(false);
  const [previewLoadedResourceId, setPreviewLoadedResourceId] = useState<string | null>(null);
  const [relatedRelationsExpanded, setRelatedRelationsExpanded] = useState(false);
  const [relatedRelations, setRelatedRelations] = useState<RelatedRelationRow[]>([]);
  const [relatedRelationsLoading, setRelatedRelationsLoading] = useState(false);
  const [relatedRelationsError, setRelatedRelationsError] = useState<string | null>(null);
  const [relatedRelationsLoadedObjectTypeId, setRelatedRelationsLoadedObjectTypeId] =
    useState<string | null>(null);
  const [relatedRelationsPage, setRelatedRelationsPage] = useState(1);
  const [relatedRelationsPageSize, setRelatedRelationsPageSize] = useState(10);
  const [resourceBuildTasks, setResourceBuildTasks] = useState<BuildTask[]>([]);
  const [resourceBuildTasksLoading, setResourceBuildTasksLoading] = useState(false);
  const [dataPage, setDataPage] = useState(1);
  const [dataPageSize, setDataPageSize] = useState(10);
  const [logicPage, setLogicPage] = useState(1);
  const [logicPageSize, setLogicPageSize] = useState(10);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);

  const listPath = `/knowledge-network/workspace/${networkId}/object-types`;
  const detailPath = `/knowledge-network/workspace/${networkId}/object-types/${objectTypeId}/detail`;
  const locationState = location.state as ObjectTypeDetailLocationState | null;
  const returnPath =
    locationState?.knowledgeNetworkReturnTo?.startsWith(
      `/knowledge-network/workspace/${networkId}/`,
    )
      ? locationState.knowledgeNetworkReturnTo
      : listPath;

  const loadData = useCallback(async () => {
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
  }, [networkId, objectTypeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const resourceId = detail?.dataSource?.id;

    if (!dataQueryExpanded || !networkId || !resourceId) {
      if (!resourceId) {
        setPreview(null);
        setPreviewError(null);
        setPreviewLoadedResourceId(null);
      }
      setPreviewLoading(false);
      setPreviewKeyword("");
      return;
    }

    if (previewLoadedResourceId === resourceId && preview) {
      return;
    }

    if (previewLoadedResourceId && previewLoadedResourceId !== resourceId) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoadedResourceId(null);
      setPreviewKeyword("");
    }

    let cancelled = false;

    const loadPreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const result = await getObjectTypeResourcePreview(networkId, resourceId);
        if (!cancelled) {
          setPreview(result);
          setPreviewLoadedResourceId(resourceId);
        }
      } catch (nextError) {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(extractRequestErrorMessage(nextError));
          setPreviewLoadedResourceId(null);
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [
    dataQueryExpanded,
    detail?.dataSource?.id,
    networkId,
    preview,
    previewLoadedResourceId,
  ]);

  useEffect(() => {
    setDataQueryExpanded(false);
    setPreview(null);
    setPreviewError(null);
    setPreviewKeyword("");
    setPreviewLoadedResourceId(null);
    setPreviewPage(1);
    setRelatedRelationsExpanded(false);
    setRelatedRelations([]);
    setRelatedRelationsError(null);
    setRelatedRelationsLoadedObjectTypeId(null);
    setRelatedRelationsPage(1);
  }, [networkId, objectTypeId]);

  useEffect(() => {
    if (!relatedRelationsExpanded || !networkId || !objectTypeId) {
      setRelatedRelationsLoading(false);
      return;
    }

    if (relatedRelationsLoadedObjectTypeId === objectTypeId) {
      return;
    }

    let cancelled = false;
    setRelatedRelationsLoading(true);
    setRelatedRelationsError(null);

    void listKnowledgeNetworkRelationTypes(networkId)
      .then((items) => {
        if (cancelled) {
          return;
        }

        const rows = items.flatMap<RelatedRelationRow>((item) => {
          if (item.sourceObjectTypeId === objectTypeId) {
            return [
              {
                ...item,
                oppositeObjectTypeId: item.targetObjectTypeId,
                oppositeObjectTypeName: item.targetObjectTypeName,
                role: "source" as const,
              },
            ];
          }

          if (item.targetObjectTypeId === objectTypeId) {
            return [
              {
                ...item,
                oppositeObjectTypeId: item.sourceObjectTypeId,
                oppositeObjectTypeName: item.sourceObjectTypeName,
                role: "target" as const,
              },
            ];
          }

          return [];
        });

        setRelatedRelations(rows);
        setRelatedRelationsLoadedObjectTypeId(objectTypeId);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setRelatedRelations([]);
          setRelatedRelationsError(extractRequestErrorMessage(nextError));
          setRelatedRelationsLoadedObjectTypeId(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRelatedRelationsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    networkId,
    objectTypeId,
    relatedRelationsExpanded,
    relatedRelationsLoadedObjectTypeId,
  ]);

  useEffect(() => {
    const resourceId = detail?.dataSource?.id;

    if (!resourceId) {
      setResourceBuildTasks([]);
      setResourceBuildTasksLoading(false);
      return;
    }

    let cancelled = false;
    setResourceBuildTasksLoading(true);

    void listBuildTasks({ resourceId, silent: true })
      .then((tasks) => {
        if (!cancelled) {
          setResourceBuildTasks(tasks);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResourceBuildTasks([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setResourceBuildTasksLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detail?.dataSource?.id]);

  const filteredDataProperties = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    const items = detail?.dataProperties ?? [];

    if (!normalized) {
      return items;
    }

    return items.filter(
      (item) =>
        normalizedSearchText(item.name).includes(normalized) ||
        normalizedSearchText(item.displayName).includes(normalized),
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
        normalizedSearchText(item.name).includes(normalized) ||
        normalizedSearchText(item.displayName).includes(normalized),
    );
  }, [detail?.logicProperties, keyword]);

  const filteredPreviewRows = useMemo(() => {
    const rows = preview?.rows ?? [];
    const normalized = previewKeyword.trim().toLowerCase();

    if (!normalized) {
      return rows;
    }

    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(normalized)),
    );
  }, [preview?.rows, previewKeyword]);

  const enrichedDataProperties = useMemo(
    () => enrichDataPropertiesWithRowTotal(filteredDataProperties, preview?.rowTotalCount),
    [filteredDataProperties, preview?.rowTotalCount],
  );

  const resourceIndexState = useMemo(
    () => indexStateOf(resourceBuildTasks),
    [resourceBuildTasks],
  );

  const pagedDataProperties = useMemo(() => {
    const start = (dataPage - 1) * dataPageSize;
    return enrichedDataProperties.slice(start, start + dataPageSize);
  }, [dataPage, dataPageSize, enrichedDataProperties]);

  const pagedLogicProperties = useMemo(() => {
    const start = (logicPage - 1) * logicPageSize;
    return filteredLogicProperties.slice(start, start + logicPageSize);
  }, [filteredLogicProperties, logicPage, logicPageSize]);

  const pagedPreviewRows = useMemo(() => {
    const start = (previewPage - 1) * previewPageSize;
    return filteredPreviewRows.slice(start, start + previewPageSize);
  }, [filteredPreviewRows, previewPage, previewPageSize]);

  const pagedRelatedRelations = useMemo(() => {
    const start = (relatedRelationsPage - 1) * relatedRelationsPageSize;
    return relatedRelations.slice(start, start + relatedRelationsPageSize);
  }, [relatedRelations, relatedRelationsPage, relatedRelationsPageSize]);

  const previewColumns: TableProps<Record<string, string | number>>["columns"] = useMemo(
    () =>
      (preview?.columns ?? []).map((column) => ({
        dataIndex: column.dataIndex,
        key: column.dataIndex,
        title: column.title,
      })),
    [preview?.columns],
  );

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

  const relatedRelationColumns: TableProps<RelatedRelationRow>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("knowledgeNetwork.objectTypeRelatedRelationName"),
      width: 260,
      render: (value: string, record) => (
        <button
          className={styles.tableLink}
          onClick={() => {
            void navigate(
              `/knowledge-network/workspace/${networkId}/relation-types/${record.id}/detail`,
              {
                state: {
                  knowledgeNetworkReturnTo: detailPath,
                },
              },
            );
          }}
          title={value}
          type="button"
        >
          {value || "--"}
        </button>
      ),
    },
    {
      dataIndex: "role",
      key: "role",
      title: t("knowledgeNetwork.objectTypeRelatedRelationRole"),
      width: 120,
      render: (value: RelatedRelationRole) =>
        value === "source"
          ? t("knowledgeNetwork.objectTypeRelatedRelationRoleSource")
          : t("knowledgeNetwork.objectTypeRelatedRelationRoleTarget"),
    },
    {
      dataIndex: "oppositeObjectTypeName",
      key: "oppositeObjectTypeName",
      title: t("knowledgeNetwork.objectTypeRelatedRelationOppositeObject"),
      width: 220,
      render: (value: string, record) =>
        record.oppositeObjectTypeId ? (
          <button
            className={styles.tableLink}
            onClick={() => {
              void navigate(
                `/knowledge-network/workspace/${networkId}/object-types/${record.oppositeObjectTypeId}/detail`,
                {
                  state: {
                    knowledgeNetworkReturnTo: detailPath,
                  },
                },
              );
            }}
            title={value || record.oppositeObjectTypeId}
            type="button"
          >
            {value || record.oppositeObjectTypeId}
          </button>
        ) : (
          value || "--"
        ),
    },
    {
      dataIndex: "mappingMode",
      key: "mappingMode",
      title: t("knowledgeNetwork.relationTypeMappingMode"),
      width: 140,
      render: (value: KnowledgeNetworkRelationTypeRecord["mappingMode"]) =>
        value === "direct"
          ? t("knowledgeNetwork.relationTypeDirectMapping")
          : t("knowledgeNetwork.relationTypeResourceMapping"),
    },
    {
      dataIndex: "updateTime",
      key: "updateTime",
      title: t("common.updateTime"),
      width: 180,
      render: (value: string) => value || "--",
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

  const boundDataView = detail.dataSource;

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
            danger
            icon={<DeleteOutlined />}
            onClick={confirmDelete}
          >
            {t("common.delete")}
          </AppButton>
        </>
      }
      onBack={() => {
        void navigate(returnPath);
      }}
      subtitle={detail.id}
      title={detail.name}
    >
      <div className={styles.page}>
        <section className={styles.summaryCard}>
          <div className={styles.summaryLayout}>
            <div className={styles.summaryMain}>
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
            </div>
            <div className={styles.summaryDataSource}>
              <div className={styles.summaryDataSourceHeader}>
                <div className={styles.summaryDataSourceTitle}>
                  {t("knowledgeNetwork.objectTypeBoundDataView")}
                </div>
                {boundDataView ? (
                  <AppButton
                    icon={<ArrowRightOutlined />}
                    onClick={() => {
                      void navigate(`/data-directory/resource/${boundDataView.id}`);
                    }}
                    size="small"
                  >
                    {t("knowledgeNetwork.objectTypeViewDataResource")}
                  </AppButton>
                ) : null}
              </div>
              {boundDataView ? (
                <div className={styles.dataViewFields}>
                  <div className={styles.dataViewField}>
                    <span className={styles.dataViewLabel}>
                      {t("knowledgeNetwork.objectTypeDataViewName")}
                    </span>
                    <span className={styles.dataViewValue}>
                      {boundDataView.name || "--"}
                    </span>
                  </div>
                  <div className={styles.dataViewField}>
                    <span className={styles.dataViewLabel}>
                      {t("knowledgeNetwork.objectTypeDataViewResourceId")}
                    </span>
                    <span className={styles.dataViewCode}>{boundDataView.id || "--"}</span>
                  </div>
                  <div className={styles.dataViewField}>
                    <span className={styles.dataViewLabel}>
                      {t("knowledgeNetwork.objectTypeDataViewIndexState")}
                    </span>
                    <span className={styles.dataViewStatus}>
                      {resourceBuildTasksLoading
                        ? t("knowledgeNetwork.objectTypeDataViewIndexLoading")
                        : formatIndexStateLabel(resourceIndexState, t)}
                    </span>
                  </div>
                </div>
              ) : (
                <span className={styles.placeholder}>
                  {t("knowledgeNetwork.objectTypeBoundDataViewEmpty")}
                </span>
              )}
            </div>
          </div>
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionToolbar}>
            <Segmented
              onChange={(value) => {
                setPropertyType(value as "data" | "logic");
                setKeyword("");
                setDataPage(1);
                setLogicPage(1);
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
              onSearch={() => {
                setDataPage(1);
                setLogicPage(1);
              }}
              placeholder={t("knowledgeNetwork.objectTypeSearchProperty")}
              style={{ width: 280 }}
              value={keyword}
            />
          </div>

          {propertyType === "data" ? (
            <>
              {filteredDataProperties.length === 0 ? (
                <Empty description={t("knowledgeNetwork.objectTypePropertyEmpty")} />
              ) : (
                <>
                  <ObjectTypePropertyTable
                    properties={pagedDataProperties}
                    rowIndexOffset={(dataPage - 1) * dataPageSize}
                  />
                  <div className={styles.paginationBar}>
                    <TablePaginationBar
                      current={dataPage}
                      onChange={(nextPage, nextPageSize) => {
                        setDataPage(nextPage);
                        setDataPageSize(nextPageSize);
                      }}
                      pageSize={dataPageSize}
                      showSizeChanger
                      showTotal={(total) => t("common.total", { total })}
                      total={enrichedDataProperties.length}
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <Table<ObjectTypeLogicProperty>
                columns={logicColumns}
                dataSource={pagedLogicProperties}
                locale={{
                  emptyText: (
                    <Empty description={t("knowledgeNetwork.objectTypeLogicPropertyEmpty")} />
                  ),
                }}
                pagination={false}
                rowKey="name"
                size="small"
              />
              {filteredLogicProperties.length > 0 ? (
                <div className={styles.paginationBar}>
                  <TablePaginationBar
                    current={logicPage}
                    onChange={(nextPage, nextPageSize) => {
                      setLogicPage(nextPage);
                      setLogicPageSize(nextPageSize);
                    }}
                    pageSize={logicPageSize}
                    showSizeChanger
                    showTotal={(total) => t("common.total", { total })}
                    total={filteredLogicProperties.length}
                  />
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>{t("knowledgeNetwork.objectTypeDataQueryTitle")}</h3>
              <p className={styles.sectionHint}>
                {t("knowledgeNetwork.objectTypeDataQueryDescription")}
              </p>
            </div>
            <div className={styles.previewToolbar}>
              {dataQueryExpanded ? (
                <Input.Search
                  allowClear
                  disabled={!preview || previewLoading}
                  onChange={(event) => {
                    setPreviewKeyword(event.target.value);
                    setPreviewPage(1);
                  }}
                  placeholder={t("knowledgeNetwork.objectTypeDataQuerySearchPlaceholder")}
                  style={{ width: 280 }}
                  value={previewKeyword}
                />
              ) : null}
              <AppButton
                icon={dataQueryExpanded ? <DownOutlined /> : <RightOutlined />}
                onClick={() => {
                  setDataQueryExpanded((current) => !current);
                }}
              >
                {dataQueryExpanded
                  ? t("knowledgeNetwork.objectTypeDataQueryCollapse")
                  : t("knowledgeNetwork.objectTypeDataQueryAction")}
              </AppButton>
            </div>
          </div>

          {!dataQueryExpanded ? null : !boundDataView ? (
            <Empty description={t("knowledgeNetwork.objectTypeBoundDataViewEmpty")} />
          ) : previewError ? (
            <Alert message={previewError} showIcon type="error" />
          ) : previewLoading ? (
            <div className={styles.loadingState}>
              <Spin />
            </div>
          ) : preview && previewColumns.length > 0 ? (
            <>
              <div className={styles.previewSummary}>
                <span>
                  {t("knowledgeNetwork.objectTypeDataQueryResourceName")}: {preview.name || "--"}
                </span>
                <span>
                  {t("knowledgeNetwork.objectTypeDataQuerySampleCount", {
                    count: filteredPreviewRows.length,
                  })}
                </span>
              </div>
              <Table<Record<string, string | number>>
                columns={previewColumns}
                dataSource={pagedPreviewRows.map((row, index) => ({
                  ...row,
                  key: `${previewPage}-${index}-${Object.values(row).join("-")}`,
                }))}
                locale={{
                  emptyText: (
                    <Empty description={t("knowledgeNetwork.objectTypeDataQueryEmpty")} />
                  ),
                }}
                pagination={false}
                scroll={{ x: true }}
                size="small"
              />
              {filteredPreviewRows.length > 0 ? (
                <div className={styles.paginationBar}>
                  <TablePaginationBar
                    current={previewPage}
                    onChange={(nextPage, nextPageSize) => {
                      setPreviewPage(nextPage);
                      setPreviewPageSize(nextPageSize);
                    }}
                    pageSize={previewPageSize}
                    showSizeChanger
                    showTotal={(total) => t("common.total", { total })}
                    total={filteredPreviewRows.length}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <Empty description={t("knowledgeNetwork.objectTypeDataQueryEmpty")} />
          )}
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>
                {t("knowledgeNetwork.objectTypeRelatedRelationsTitle")}
              </h3>
              <p className={styles.sectionHint}>
                {t("knowledgeNetwork.objectTypeRelatedRelationsDescription")}
              </p>
            </div>
            <div className={styles.previewToolbar}>
              <AppButton
                icon={relatedRelationsExpanded ? <DownOutlined /> : <RightOutlined />}
                onClick={() => {
                  setRelatedRelationsExpanded((current) => !current);
                }}
              >
                {relatedRelationsExpanded
                  ? t("knowledgeNetwork.objectTypeDataQueryCollapse")
                  : t("knowledgeNetwork.objectTypeRelatedRelationsAction")}
              </AppButton>
            </div>
          </div>

          {!relatedRelationsExpanded ? null : relatedRelationsError ? (
            <Alert message={relatedRelationsError} showIcon type="error" />
          ) : (
            <>
              <Table<RelatedRelationRow>
                columns={relatedRelationColumns}
                dataSource={pagedRelatedRelations}
                loading={relatedRelationsLoading}
                locale={{
                  emptyText: (
                    <Empty
                      description={t("knowledgeNetwork.objectTypeRelatedRelationsEmpty")}
                    />
                  ),
                }}
                pagination={false}
                rowKey="id"
                scroll={{ x: 920 }}
                size="small"
              />
              {relatedRelations.length > relatedRelationsPageSize ? (
                <div className={styles.paginationBar}>
                  <TablePaginationBar
                    current={relatedRelationsPage}
                    onChange={(nextPage, nextPageSize) => {
                      setRelatedRelationsPage(nextPage);
                      setRelatedRelationsPageSize(nextPageSize);
                    }}
                    pageSize={relatedRelationsPageSize}
                    showSizeChanger
                    showTotal={(total) => t("common.total", { total })}
                    total={relatedRelations.length}
                  />
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </KnowledgeNetworkResourceConfigShell>
  );
}
