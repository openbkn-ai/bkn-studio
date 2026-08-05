/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ArrowRightOutlined,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Input, Segmented, Spin, Table, Tabs, Tag, Tooltip } from "antd";
import type { TableProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { formatIndexStateLabel } from "@/modules/data-catalog/lib/format-index-state";
import { indexStateOf } from "@/modules/data-catalog/lib/index-state";
import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import {
  ObjectTypePropertyTable,
  ObjectTypePropertyTableColumnSettings,
} from "@/modules/knowledge-network/components/object-type/ObjectTypePropertyTable";
import { useObjectTypePropertyTableState } from "@/modules/knowledge-network/components/object-type/useObjectTypePropertyTableState";
import { ObjectTypeDetailLogicPropertyTrialPanel } from "@/modules/knowledge-network/components/object-type/detail/ObjectTypeDetailLogicPropertyTrialPanel";
import { ObjectTypeDetailMetricTrialPanel } from "@/modules/knowledge-network/components/object-type/detail/ObjectTypeDetailMetricTrialPanel";
import { enrichDataPropertiesWithRowTotal } from "@/modules/knowledge-network/lib/enrich-data-properties";
import { buildSampleRowKey } from "@/modules/knowledge-network/lib/object-type-instance-identity";
import { isMetricLogicProperty } from "@/modules/knowledge-network/lib/object-type-trial-metrics";
import { buildActionTypeKindSelectOptions } from "@/modules/knowledge-network/constants/action-type-kinds";
import {
  deleteKnowledgeNetworkObjectType,
  getKnowledgeNetwork,
  getKnowledgeNetworkObjectTypeDetail,
  getObjectTypeSampleData,
  listKnowledgeNetworkActionTypes,
  listKnowledgeNetworkMetrics,
  listKnowledgeNetworkRelationTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkActionTypeRecord,
  KnowledgeNetworkMetricRecord,
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

function getLogicTypeLabel(type: ObjectTypeLogicProperty["type"], t: (key: string) => string) {
  if (type === "tool") {
    return t("knowledgeNetwork.objectTypeLogicAttributeTypeTool");
  }

  return t("knowledgeNetwork.objectTypeLogicAttributeTypeMetric");
}

function isMetricBoundLogicProperty(property: ObjectTypeLogicProperty) {
  return isMetricLogicProperty(property) && Boolean(property.dataSource?.id);
}

type ObjectTypeDetailTabKey = "overview" | "properties" | "data" | "related";
type ObjectTypeDataSectionKey = "instance" | "logic" | "metric";
type ObjectTypeRelatedSectionKey = "relations" | "metrics" | "actions";

const OBJECT_TYPE_DETAIL_TABS: ObjectTypeDetailTabKey[] = [
  "overview",
  "properties",
  "data",
  "related",
];

function parseObjectTypeDetailTab(value: string | null): ObjectTypeDetailTabKey {
  if (value && OBJECT_TYPE_DETAIL_TABS.includes(value as ObjectTypeDetailTabKey)) {
    return value as ObjectTypeDetailTabKey;
  }

  return "overview";
}

function parseObjectTypeDataSection(
  value: string | null,
  metricId: string | null,
): ObjectTypeDataSectionKey {
  if (value === "logic") {
    return "logic";
  }

  if (value === "metric" || (value === "trial" && metricId)) {
    return "metric";
  }

  if (value === "trial") {
    return "logic";
  }

  return "instance";
}

function parseObjectTypeRelatedSection(value: string | null): ObjectTypeRelatedSectionKey {
  if (value === "metrics" || value === "actions") {
    return value;
  }

  return "relations";
}

function getActionKindLabel(
  actionKind: KnowledgeNetworkActionTypeRecord["actionKind"],
  t: (key: string) => string,
) {
  const option = buildActionTypeKindSelectOptions(t).find((item) => item.value === actionKind);
  return option?.label ?? actionKind;
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

const PREVIEW_COLUMN_MIN_WIDTH = 120;
const PREVIEW_COLUMN_MAX_WIDTH = 260;
const PREVIEW_COLUMN_PADDING_WIDTH = 44;

function clampPreviewColumnWidth(width: number) {
  return Math.max(PREVIEW_COLUMN_MIN_WIDTH, Math.min(PREVIEW_COLUMN_MAX_WIDTH, width));
}

function estimatePreviewTextWidth(value: string | number | undefined) {
  const text = String(value ?? "");
  const textWidth = Array.from(text).reduce((width, char) => {
    return width + (char.charCodeAt(0) > 255 ? 16 : 8);
  }, 0);

  return textWidth + PREVIEW_COLUMN_PADDING_WIDTH;
}

export function ObjectTypeDetailScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { message, modal } = useAppServices();
  const { networkId = "", objectTypeId = "" } = useParams<{
    networkId: string;
    objectTypeId: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseObjectTypeDetailTab(searchParams.get("tab"));
  const selectedTrialMetricId = searchParams.get("metricId");
  const selectedLogicPropertyName = searchParams.get("logicProperty");
  const selectedSampleRowKey = searchParams.get("sampleRow");
  const dataSection =
    activeTab === "data"
      ? parseObjectTypeDataSection(searchParams.get("section"), selectedTrialMetricId)
      : "instance";
  const relatedSection =
    activeTab === "related"
      ? parseObjectTypeRelatedSection(searchParams.get("relatedSection"))
      : "relations";
  const [detail, setDetail] = useState<ObjectTypeDetail | null>(null);
  const [networkKnId, setNetworkKnId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyType, setPropertyType] = useState<"data" | "logic">("data");
  const [keyword, setKeyword] = useState("");
  const [preview, setPreview] = useState<ObjectTypeResourcePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewKeyword, setPreviewKeyword] = useState("");
  const [previewLoadedObjectTypeId, setPreviewLoadedObjectTypeId] = useState<string | null>(null);
  const [relatedRelations, setRelatedRelations] = useState<RelatedRelationRow[]>([]);
  const [relatedRelationsLoading, setRelatedRelationsLoading] = useState(false);
  const [relatedRelationsError, setRelatedRelationsError] = useState<string | null>(null);
  const [relatedRelationsLoadedObjectTypeId, setRelatedRelationsLoadedObjectTypeId] =
    useState<string | null>(null);
  const [relatedRelationsPage, setRelatedRelationsPage] = useState(1);
  const [relatedRelationsPageSize, setRelatedRelationsPageSize] = useState(10);
  const [relatedMetrics, setRelatedMetrics] = useState<KnowledgeNetworkMetricRecord[]>([]);
  const [relatedMetricsLoading, setRelatedMetricsLoading] = useState(false);
  const [relatedMetricsError, setRelatedMetricsError] = useState<string | null>(null);
  const [relatedMetricsLoadedObjectTypeId, setRelatedMetricsLoadedObjectTypeId] =
    useState<string | null>(null);
  const [relatedMetricsPage, setRelatedMetricsPage] = useState(1);
  const [relatedMetricsPageSize, setRelatedMetricsPageSize] = useState(10);
  const [relatedActions, setRelatedActions] = useState<KnowledgeNetworkActionTypeRecord[]>([]);
  const [relatedActionsLoading, setRelatedActionsLoading] = useState(false);
  const [relatedActionsError, setRelatedActionsError] = useState<string | null>(null);
  const [relatedActionsLoadedObjectTypeId, setRelatedActionsLoadedObjectTypeId] =
    useState<string | null>(null);
  const [relatedActionsPage, setRelatedActionsPage] = useState(1);
  const [relatedActionsPageSize, setRelatedActionsPageSize] = useState(10);
  const [resourceBuildTasks, setResourceBuildTasks] = useState<BuildTask[]>([]);
  const [resourceBuildTasksLoading, setResourceBuildTasksLoading] = useState(false);
  const [dataPage, setDataPage] = useState(1);
  const [dataPageSize, setDataPageSize] = useState(10);
  const [logicPage, setLogicPage] = useState(1);
  const [logicPageSize, setLogicPageSize] = useState(10);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);
  const [relatedKeyword, setRelatedKeyword] = useState("");
  const propertyTableState = useObjectTypePropertyTableState();

  const listPath = `/knowledge-network/workspace/${networkId}/object-types`;
  const detailPath = `/knowledge-network/workspace/${networkId}/object-types/${objectTypeId}/detail`;
  const locationState = location.state as ObjectTypeDetailLocationState | null;
  const returnPath =
    locationState?.knowledgeNetworkReturnTo?.startsWith(
      `/knowledge-network/workspace/${networkId}/`,
    )
      ? locationState.knowledgeNetworkReturnTo
      : listPath;

  const openMetricTrial = useCallback((metricId: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", "data");
      next.set("section", "metric");
      next.set("metricId", metricId);
      next.delete("logicProperty");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const openLogicPropertyTrial = useCallback(
    (logicPropertyName: string, sampleRowKey?: string | null) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("tab", "data");
        next.set("section", "logic");
        next.set("logicProperty", logicPropertyName);
        next.delete("metricId");

        if (sampleRowKey) {
          next.set("sampleRow", sampleRowKey);
        } else {
          next.delete("sampleRow");
        }

        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const openTab = useCallback(
    (tab: ObjectTypeDetailTabKey, params?: Record<string, string>) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);

        if (tab === "overview") {
          next.delete("tab");
          next.delete("section");
          next.delete("relatedSection");
          next.delete("metricId");
          next.delete("logicProperty");
          next.delete("sampleRow");
        } else {
          next.set("tab", tab);
        }

        if (tab !== "data") {
          next.delete("section");
          next.delete("metricId");
          next.delete("logicProperty");
          next.delete("sampleRow");
        }

        if (tab !== "related") {
          next.delete("relatedSection");
        }

        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value) {
              next.set(key, value);
            } else {
              next.delete(key);
            }
          });
        }

        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const openPropertiesTab = useCallback(
    (propertySegment: "data" | "logic" = "data") => {
      setPropertyType(propertySegment);
      openTab("properties");
    },
    [openTab],
  );

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
    if (!networkId) {
      setNetworkKnId(null);
      return;
    }

    let cancelled = false;

    void getKnowledgeNetwork(networkId)
      .then((record) => {
        if (!cancelled) {
          setNetworkKnId(record?.identifier ?? networkId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNetworkKnId(networkId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [networkId]);

  const shouldLoadPreview =
    activeTab === "data" &&
    (dataSection === "instance" || dataSection === "logic") &&
    Boolean(detail?.dataSource?.id);
  const shouldLoadRelatedRelations = Boolean(networkId && objectTypeId && detail);
  const shouldLoadRelatedMetrics = Boolean(networkId && objectTypeId && detail);
  const shouldLoadRelatedActions = Boolean(networkId && objectTypeId && detail);

  useEffect(() => {
    if (!shouldLoadPreview || !networkId || !objectTypeId) {
      if (!objectTypeId || !detail?.dataSource?.id) {
        setPreview(null);
        setPreviewError(null);
        setPreviewLoadedObjectTypeId(null);
      }
      setPreviewLoading(false);
      setPreviewKeyword("");
      return;
    }

    if (previewLoadedObjectTypeId === objectTypeId && preview) {
      return;
    }

    if (previewLoadedObjectTypeId && previewLoadedObjectTypeId !== objectTypeId) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoadedObjectTypeId(null);
      setPreviewKeyword("");
    }

    let cancelled = false;

    const loadPreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const result = await getObjectTypeSampleData(networkId, objectTypeId);
        if (!cancelled) {
          setPreview(result);
          setPreviewLoadedObjectTypeId(objectTypeId);
        }
      } catch (nextError) {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(extractRequestErrorMessage(nextError));
          setPreviewLoadedObjectTypeId(null);
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
    detail?.dataSource?.id,
    networkId,
    objectTypeId,
    preview,
    previewLoadedObjectTypeId,
    shouldLoadPreview,
  ]);

  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    setPreviewKeyword("");
    setPreviewLoadedObjectTypeId(null);
    setPreviewPage(1);
    setRelatedRelations([]);
    setRelatedRelationsError(null);
    setRelatedRelationsLoadedObjectTypeId(null);
    setRelatedRelationsPage(1);
    setRelatedMetrics([]);
    setRelatedMetricsError(null);
    setRelatedMetricsLoadedObjectTypeId(null);
    setRelatedMetricsPage(1);
    setRelatedActions([]);
    setRelatedActionsError(null);
    setRelatedActionsLoadedObjectTypeId(null);
    setRelatedActionsPage(1);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("tab");
      next.delete("section");
      next.delete("relatedSection");
      next.delete("metricId");
      next.delete("logicProperty");
      next.delete("sampleRow");
      return next;
    }, { replace: true });
    // Reset tab query only when the route object type changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit setSearchParams to avoid clearing tab on re-render
  }, [networkId, objectTypeId]);

  useEffect(() => {
    if (!shouldLoadRelatedMetrics || !networkId || !objectTypeId) {
      setRelatedMetricsLoading(false);
      return;
    }

    if (relatedMetricsLoadedObjectTypeId === objectTypeId) {
      return;
    }

    let cancelled = false;
    setRelatedMetricsLoading(true);
    setRelatedMetricsError(null);

    void listKnowledgeNetworkMetrics(networkId, {
      direction: "desc",
      limit: -1,
      offset: 0,
      scopeRef: objectTypeId,
      sort: "update_time",
    })
      .then((result) => {
        if (!cancelled) {
          setRelatedMetrics(result.entries);
          setRelatedMetricsLoadedObjectTypeId(objectTypeId);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setRelatedMetrics([]);
          setRelatedMetricsError(extractRequestErrorMessage(nextError));
          setRelatedMetricsLoadedObjectTypeId(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRelatedMetricsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    networkId,
    objectTypeId,
    relatedMetricsLoadedObjectTypeId,
    shouldLoadRelatedMetrics,
  ]);

  useEffect(() => {
    if (!shouldLoadRelatedActions || !networkId || !objectTypeId) {
      setRelatedActionsLoading(false);
      return;
    }

    if (relatedActionsLoadedObjectTypeId === objectTypeId) {
      return;
    }

    let cancelled = false;
    setRelatedActionsLoading(true);
    setRelatedActionsError(null);

    void listKnowledgeNetworkActionTypes(networkId)
      .then((items) => {
        if (!cancelled) {
          setRelatedActions(items.filter((item) => item.objectTypeId === objectTypeId));
          setRelatedActionsLoadedObjectTypeId(objectTypeId);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setRelatedActions([]);
          setRelatedActionsError(extractRequestErrorMessage(nextError));
          setRelatedActionsLoadedObjectTypeId(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRelatedActionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    networkId,
    objectTypeId,
    relatedActionsLoadedObjectTypeId,
    shouldLoadRelatedActions,
  ]);

  useEffect(() => {
    if (!shouldLoadRelatedRelations || !networkId || !objectTypeId) {
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
    relatedRelationsLoadedObjectTypeId,
    shouldLoadRelatedRelations,
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

  const filteredRelatedRelations = useMemo(() => {
    const normalized = relatedKeyword.trim().toLowerCase();
    if (!normalized) {
      return relatedRelations;
    }

    return relatedRelations.filter(
      (item) =>
        normalizedSearchText(item.name).includes(normalized) ||
        normalizedSearchText(item.oppositeObjectTypeName).includes(normalized),
    );
  }, [relatedKeyword, relatedRelations]);

  const filteredRelatedMetrics = useMemo(() => {
    const normalized = relatedKeyword.trim().toLowerCase();
    if (!normalized) {
      return relatedMetrics;
    }

    return relatedMetrics.filter((item) => normalizedSearchText(item.name).includes(normalized));
  }, [relatedKeyword, relatedMetrics]);

  const filteredRelatedActions = useMemo(() => {
    const normalized = relatedKeyword.trim().toLowerCase();
    if (!normalized) {
      return relatedActions;
    }

    return relatedActions.filter((item) => normalizedSearchText(item.name).includes(normalized));
  }, [relatedActions, relatedKeyword]);

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
    return filteredRelatedRelations.slice(start, start + relatedRelationsPageSize);
  }, [filteredRelatedRelations, relatedRelationsPage, relatedRelationsPageSize]);

  const pagedRelatedMetrics = useMemo(() => {
    const start = (relatedMetricsPage - 1) * relatedMetricsPageSize;
    return filteredRelatedMetrics.slice(start, start + relatedMetricsPageSize);
  }, [filteredRelatedMetrics, relatedMetricsPage, relatedMetricsPageSize]);

  const pagedRelatedActions = useMemo(() => {
    const start = (relatedActionsPage - 1) * relatedActionsPageSize;
    return filteredRelatedActions.slice(start, start + relatedActionsPageSize);
  }, [filteredRelatedActions, relatedActionsPage, relatedActionsPageSize]);

  const propertyTableVisibleColumnKeys = useMemo(
    () => ["index", ...propertyTableState.tableColumns.map((column) => column.key)],
    [propertyTableState.tableColumns],
  );

  const previewColumns: TableProps<Record<string, string | number>>["columns"] = useMemo(
    () =>
      (preview?.columns ?? []).map((column) => {
        const width = clampPreviewColumnWidth(
          Math.max(
            estimatePreviewTextWidth(column.title),
            estimatePreviewTextWidth(column.dataIndex),
            ...pagedPreviewRows.map((row) => estimatePreviewTextWidth(row[column.dataIndex])),
          ),
        );

        return {
          dataIndex: column.dataIndex,
          ellipsis: true,
          key: column.dataIndex,
          render: (value: string | number) => {
            const displayValue = value === "" || value == null ? "--" : String(value);

            return (
              <span className={styles.previewCellText} title={displayValue}>
                {displayValue}
              </span>
            );
          },
          title: (
            <span className={styles.previewHeaderText} title={column.title || column.dataIndex}>
              {column.title || column.dataIndex}
            </span>
          ),
          width,
        };
      }),
    [pagedPreviewRows, preview?.columns],
  );

  const previewTableScrollX = useMemo(
    () =>
      previewColumns.reduce((total, column) => {
        const width = typeof column.width === "number" ? column.width : PREVIEW_COLUMN_MIN_WIDTH;
        return total + width;
      }, 0),
    [previewColumns],
  );

  const confirmDelete = () => {
    if (!detail) {
      return;
    }

    void modal.confirm({
      title: t("knowledgeNetwork.objectTypeDeleteTitle"),
      content: t("knowledgeNetwork.objectTypeDeleteDescription", { name: detail.name }),
      cancelText: t("common.cancel"),
      centered: true,
      className: `${modalStyles.businessModal} ${modalStyles.resourceDeleteConfirmModal}`,
      okButtonProps: { danger: true, type: "primary" },
      okText: t("common.delete"),
      onOk: async () => {
        await deleteKnowledgeNetworkObjectType(networkId, detail.id);
        void message.success(t("common.success"));
        void navigate(listPath);
      },
      width: 520,
    });
  };

  const logicColumns: TableProps<ObjectTypeLogicProperty>["columns"] = useMemo(
    () => [
      {
        dataIndex: "name",
        ellipsis: true,
        key: "name",
        title: t("common.name"),
        width: 220,
      },
      {
        dataIndex: "displayName",
        ellipsis: true,
        key: "displayName",
        title: t("knowledgeNetwork.objectTypePropertyDisplayName"),
        render: (value: string) => value || "--",
        width: 220,
      },
      {
        dataIndex: "dataSource",
        key: "bindResource",
        render: (_value, record) => {
          if (!record.dataSource) {
            return "--";
          }

          return (
            <div className={styles.bindResourceCell}>
              <div className={styles.dataResource}>
                {record.dataSource.type === "metric" ? (
                  <span className={styles.resourceIconMetric}>M</span>
                ) : (
                  <span className={styles.resourceIconOperator}>T</span>
                )}
                <span className={styles.resourceName}>{record.dataSource.name || "--"}</span>
              </div>
            </div>
          );
        },
        title: t("knowledgeNetwork.objectTypeBindResource"),
        width: 320,
      },
      {
        dataIndex: "type",
        key: "type",
        render: (value: ObjectTypeLogicProperty["type"]) => getLogicTypeLabel(value, t),
        title: t("knowledgeNetwork.objectTypePropertyType"),
        width: 120,
      },
      {
        dataIndex: "comment",
        key: "comment",
        ellipsis: true,
        title: t("common.description"),
        render: (value?: string) => value || "--",
      },
      {
        key: "actions",
        render: (_value, record) => (
          <button
            className={styles.tableLink}
            onClick={() => {
              openLogicPropertyTrial(record.name);
            }}
            type="button"
          >
            {t("knowledgeNetwork.objectTypeDetailTrialAction")}
          </button>
        ),
        title: t("common.actions"),
        width: 100,
      },
    ],
    [openLogicPropertyTrial, t],
  );

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
  const dataPropertyCount = detail.dataProperties.length;
  const logicPropertyCount = detail.logicProperties.length;
  const objectTypePrimaryKeys = detail.primaryKeys;
  const objectTypeDisplayKey = detail.displayKey;

  const findLogicPropertyByMetricId = (metricId: string) =>
    detail.logicProperties.find(
      (property) => isMetricBoundLogicProperty(property) && property.dataSource?.id === metricId,
    ) ?? null;

  const handleTabChange = (nextTab: string) => {
    openTab(nextTab as ObjectTypeDetailTabKey);
  };

  const renderOverviewStatValue = (options: {
    error: string | null;
    loaded: boolean;
    loading: boolean;
    value: number;
  }) => {
    if (options.loaded) {
      return options.value;
    }

    if (options.error) {
      return (
        <Tooltip title={options.error}>
          <span className={styles.quickStatError}>
            {t("knowledgeNetwork.objectTypeDetailQuickStatsLoadFailed")}
          </span>
        </Tooltip>
      );
    }

    return <Spin size="small" />;
  };

  const overviewPanel = (
    <div className={styles.tabPanelOverview}>
      <div className={styles.overviewHero}>
        <section className={styles.overviewIdentity}>
          <div className={styles.summaryHead}>
            <span
              className={styles.objectIconSquare}
              style={{ backgroundColor: detail.color }}
            >
              {renderResourceIcon(detail.icon)}
            </span>
            <div className={styles.overviewIdentityMain}>
              <h3 className={styles.overviewSectionTitle}>
                {t("knowledgeNetwork.objectTypeDetailOverviewIdentityTitle")}
              </h3>
            </div>
          </div>
          <div className={styles.overviewMetaSections}>
            <dl className={styles.overviewMetaList}>
              <div className={`${styles.overviewMetaItem} ${styles.overviewMetaItemWide}`}>
                <dt>{t("knowledgeNetwork.descriptionField")}</dt>
                <dd className={styles.overviewDescriptionValue}>
                  {detail.description || t("knowledgeNetwork.noDescription")}
                </dd>
              </div>
              <div className={`${styles.overviewMetaItem} ${styles.overviewMetaItemWide}`}>
                <dt>{t("knowledgeNetwork.tags")}</dt>
                <dd>
                  {detail.tags.length > 0 ? (
                    <div className={styles.tagRow}>
                      {detail.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.placeholder}>{t("knowledgeNetwork.noTags")}</span>
                  )}
                </dd>
              </div>
            </dl>
            <dl className={styles.overviewMetaList}>
              <div className={styles.overviewMetaItem}>
                <dt>{t("common.id")}</dt>
                <dd>{detail.id}</dd>
              </div>
              <div className={styles.overviewMetaItem}>
                <dt>{t("knowledgeNetwork.objectTypeConceptGroups")}</dt>
                <dd>
                  {detail.conceptGroupIds.length > 0 ? (
                    <div className={styles.tagRow}>
                      {detail.conceptGroupIds.map((conceptGroupId, index) => (
                        <button
                          className={styles.conceptGroupLink}
                          key={conceptGroupId}
                          onClick={() => {
                            void navigate(
                              `/knowledge-network/workspace/${networkId}/concept-groups/${conceptGroupId}/detail`,
                              {
                                state: {
                                  knowledgeNetworkReturnTo: detailPath,
                                },
                              },
                            );
                          }}
                          type="button"
                        >
                          {detail.conceptGroupNames[index] || conceptGroupId}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.placeholder}>
                      {t("knowledgeNetwork.objectTypeNoConceptGroups")}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            <dl className={`${styles.overviewMetaList} ${styles.overviewMetaListAudit}`}>
              <div className={`${styles.overviewMetaItem} ${styles.overviewMetaItemAudit}`}>
                <dt>{t("knowledgeNetwork.modifier")}</dt>
                <dd>{detail.updaterName || "--"}</dd>
              </div>
              <div className={`${styles.overviewMetaItem} ${styles.overviewMetaItemAudit}`}>
                <dt>{t("common.updateTime")}</dt>
                <dd>{detail.updateTime || "--"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={styles.summaryDataSource}>
          <div className={styles.overviewCardHeader}>
            <h3 className={styles.overviewSectionTitle}>
              {t("knowledgeNetwork.objectTypeBoundDataView")}
            </h3>
            {boundDataView ? (
              <button
                className={styles.cardHeaderLink}
                onClick={() => {
                  void navigate(`/data-directory/resource/${boundDataView.id}`);
                }}
                type="button"
              >
                {t("knowledgeNetwork.objectTypeViewDataResource")}
                <ArrowRightOutlined />
              </button>
            ) : null}
          </div>
          {boundDataView ? (
            <div className={styles.dataViewFields}>
              <div className={styles.dataViewField}>
                <span className={styles.dataViewLabel}>
                  {t("knowledgeNetwork.objectTypeDataViewName")}
                </span>
                <span className={styles.dataViewValue}>{boundDataView.name || "--"}</span>
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
        </section>
      </div>

      <section className={styles.overviewStatsSection}>
        <h3 className={styles.overviewSectionTitle}>
          {t("knowledgeNetwork.objectTypeDetailQuickStatsTitle")}
        </h3>
        <div className={styles.quickStatsGrid}>
          <button
            className={styles.quickStatButton}
            onClick={() => {
              openPropertiesTab("data");
            }}
            type="button"
          >
            <span className={styles.quickStatHeader}>
              <span className={styles.quickStatLabel}>
                {t("knowledgeNetwork.objectTypeDataProperty")}
              </span>
              <ArrowRightOutlined className={styles.quickStatArrow} />
            </span>
            <span className={styles.quickStatValue}>{dataPropertyCount}</span>
          </button>
          <button
            className={styles.quickStatButton}
            onClick={() => {
              openPropertiesTab("logic");
            }}
            type="button"
          >
            <span className={styles.quickStatHeader}>
              <span className={styles.quickStatLabel}>
                {t("knowledgeNetwork.objectTypeLogicProperty")}
              </span>
              <ArrowRightOutlined className={styles.quickStatArrow} />
            </span>
            <span className={styles.quickStatValue}>{logicPropertyCount}</span>
          </button>
          <button
            className={styles.quickStatButton}
            onClick={() => {
              openTab("related", { relatedSection: "metrics" });
            }}
            type="button"
          >
            <span className={styles.quickStatHeader}>
              <span className={styles.quickStatLabel}>
                {t("knowledgeNetwork.objectTypeDetailRelatedSectionMetrics")}
              </span>
              <ArrowRightOutlined className={styles.quickStatArrow} />
            </span>
            <span className={styles.quickStatValue}>
              {renderOverviewStatValue({
                error: relatedMetricsError,
                loaded: relatedMetricsLoadedObjectTypeId === objectTypeId,
                loading: relatedMetricsLoading,
                value: relatedMetrics.length,
              })}
            </span>
          </button>
          <button
            className={styles.quickStatButton}
            disabled={
              relatedActionsLoadedObjectTypeId === objectTypeId &&
              !relatedActionsLoading &&
              relatedActions.length === 0
            }
            onClick={() => {
              openTab("related", { relatedSection: "actions" });
            }}
            type="button"
          >
            <span className={styles.quickStatHeader}>
              <span className={styles.quickStatLabel}>
                {t("knowledgeNetwork.objectTypeDetailRelatedSectionActions")}
              </span>
              <ArrowRightOutlined className={styles.quickStatArrow} />
            </span>
            <span className={styles.quickStatValue}>
              {renderOverviewStatValue({
                error: relatedActionsError,
                loaded: relatedActionsLoadedObjectTypeId === objectTypeId,
                loading: relatedActionsLoading,
                value: relatedActions.length,
              })}
            </span>
          </button>
          <button
            className={styles.quickStatButton}
            onClick={() => {
              openTab("related", { relatedSection: "relations" });
            }}
            type="button"
          >
            <span className={styles.quickStatHeader}>
              <span className={styles.quickStatLabel}>
                {t("knowledgeNetwork.objectTypeDetailRelatedSectionRelations")}
              </span>
              <ArrowRightOutlined className={styles.quickStatArrow} />
            </span>
            <span className={styles.quickStatValue}>
              {renderOverviewStatValue({
                error: relatedRelationsError,
                loaded: relatedRelationsLoadedObjectTypeId === objectTypeId,
                loading: relatedRelationsLoading,
                value: relatedRelations.length,
              })}
            </span>
          </button>
        </div>
      </section>
    </div>
  );

  const relatedMetricColumns: TableProps<KnowledgeNetworkMetricRecord>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("common.name"),
      width: 260,
      render: (value: string, record) => (
        <button
          className={styles.tableLink}
          onClick={() => {
            void navigate(
              `/knowledge-network/workspace/${networkId}/metrics/${record.id}/detail`,
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
      dataIndex: "updateTime",
      key: "updateTime",
      title: t("common.updateTime"),
      width: 180,
      render: (value: string) => value || "--",
    },
    {
      key: "actions",
      title: t("common.actions"),
      width: 180,
      render: (_value, record) => (
        <div className={styles.rowActions}>
          <button
            className={styles.tableLink}
            onClick={() => {
              const boundProperty = findLogicPropertyByMetricId(record.id);
              if (boundProperty) {
                openLogicPropertyTrial(boundProperty.name);
                return;
              }

              openMetricTrial(record.id);
            }}
            type="button"
          >
            {t("knowledgeNetwork.objectTypeDetailTrialAction")}
          </button>
          <button
            className={styles.tableLink}
            onClick={() => {
              void navigate(
                `/knowledge-network/workspace/${networkId}/metrics/${record.id}/detail`,
                {
                  state: {
                    knowledgeNetworkReturnTo: detailPath,
                  },
                },
              );
            }}
            type="button"
          >
            {t("knowledgeNetwork.objectTypeDetailViewDetail")}
          </button>
        </div>
      ),
    },
  ];

  const relatedActionColumns: TableProps<KnowledgeNetworkActionTypeRecord>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("common.name"),
      width: 260,
      render: (value: string, record) => (
        <button
          className={styles.tableLink}
          onClick={() => {
            void navigate(
              `/knowledge-network/workspace/${networkId}/action-types/${record.id}/detail`,
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
      dataIndex: "actionKind",
      key: "actionKind",
      title: t("knowledgeNetwork.actionTypeKind"),
      width: 140,
      render: (value: KnowledgeNetworkActionTypeRecord["actionKind"]) =>
        getActionKindLabel(value, t),
    },
    {
      dataIndex: "updateTime",
      key: "updateTime",
      title: t("common.updateTime"),
      width: 180,
      render: (value: string) => value || "--",
    },
    {
      key: "actions",
      title: t("common.actions"),
      width: 120,
      render: (_value, record) => (
        <button
          className={styles.tableLink}
          onClick={() => {
            void navigate(
              `/knowledge-network/workspace/${networkId}/action-types/${record.id}/detail`,
              {
                state: {
                  knowledgeNetworkReturnTo: detailPath,
                },
              },
            );
          }}
          type="button"
        >
          {t("knowledgeNetwork.objectTypeDetailViewDetail")}
        </button>
      ),
    },
  ];

  const propertiesPanel = (
    <div className={styles.tabPanel}>
      <div className={styles.subSectionHeader}>
        <div className={styles.subSectionToolbarRow}>
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
            size="small"
            value={propertyType}
          />
          <div className={styles.subSectionToolbarActions}>
            <Input.Search
              allowClear
              onChange={(event) => {
                setKeyword(event.target.value);
                setDataPage(1);
                setLogicPage(1);
              }}
              onSearch={() => {
                setDataPage(1);
                setLogicPage(1);
              }}
              placeholder={t("knowledgeNetwork.objectTypeSearchProperty")}
              style={{ width: 280 }}
              value={keyword}
            />
            {propertyType === "data" ? (
              <ObjectTypePropertyTableColumnSettings
                tableState={propertyTableState}
                visibleColumnKeys={propertyTableVisibleColumnKeys}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.tabPanelContent}>
        {propertyType === "data" ? (
          <>
            {filteredDataProperties.length === 0 ? (
              <Empty description={t("knowledgeNetwork.objectTypePropertyEmpty")} />
            ) : (
              <>
                <ObjectTypePropertyTable
                  properties={pagedDataProperties}
                  rowIndexOffset={(dataPage - 1) * dataPageSize}
                  showToolbar={false}
                  tableState={propertyTableState}
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
      </div>
    </div>
  );

  const dataSectionSubtitle =
    dataSection === "instance"
      ? t("knowledgeNetwork.objectTypeDataQueryMetaSummary", {
          count: filteredPreviewRows.length,
          name: preview?.name || detail.name,
        })
      : null;

  const relatedSectionSubtitle =
    relatedSection === "relations"
      ? t("knowledgeNetwork.objectTypeRelatedRelationsDescription")
      : relatedSection === "metrics"
        ? t("knowledgeNetwork.objectTypeDetailRelatedMetricsDescription")
        : t("knowledgeNetwork.objectTypeDetailRelatedActionsDescription");

  const dataPanel = (
    <div className={styles.tabPanel}>
      <div className={styles.subSectionHeader}>
        <div className={styles.subSectionToolbarRow}>
          <Segmented
            onChange={(value) => {
              const nextSection = value as ObjectTypeDataSectionKey;
              setPreviewPage(1);
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.set("tab", "data");

                if (nextSection === "instance") {
                  next.delete("section");
                  next.delete("metricId");
                  next.delete("logicProperty");
                  next.delete("sampleRow");
                } else {
                  next.set("section", nextSection);

                  if (nextSection === "logic") {
                    next.delete("metricId");
                  } else {
                    next.delete("logicProperty");
                  }
                }

                return next;
              }, { replace: true });
            }}
            options={[
              {
                label: t("knowledgeNetwork.objectTypeDetailDataSectionInstance"),
                value: "instance",
              },
              {
                label: t("knowledgeNetwork.objectTypeDetailDataSectionLogic"),
                value: "logic",
              },
              {
                label: t("knowledgeNetwork.objectTypeDetailDataSectionMetric"),
                value: "metric",
              },
            ]}
            size="small"
            value={dataSection}
          />
          <div className={styles.subSectionToolbarActions}>
            {dataSection === "instance" ? (
              <>
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
                {selectedSampleRowKey ? (
                  <button
                    className={styles.cardHeaderLink}
                    onClick={() => {
                      setSearchParams((current) => {
                        const next = new URLSearchParams(current);
                        next.set("tab", "data");
                        next.set("section", "logic");
                        next.set("sampleRow", selectedSampleRowKey);

                        if (selectedLogicPropertyName) {
                          next.set("logicProperty", selectedLogicPropertyName);
                        }

                        return next;
                      }, { replace: true });
                    }}
                    type="button"
                  >
                    {t("knowledgeNetwork.objectTypeDetailUseSampleForLogicTrial")}
                    <ArrowRightOutlined />
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        {dataSectionSubtitle ? (
          <p className={styles.subSectionSubtitle}>{dataSectionSubtitle}</p>
        ) : null}
      </div>

      <div className={styles.tabPanelContent}>
        {dataSection === "instance" ? (
          <>
            {!boundDataView ? (
              <Empty description={t("knowledgeNetwork.objectTypeBoundDataViewEmpty")} />
            ) : previewError ? (
              <Alert message={previewError} showIcon type="error" />
            ) : previewLoading ? (
              <div className={styles.loadingState}>
                <Spin />
              </div>
            ) : preview && previewColumns.length > 0 ? (
              <>
                <Table<Record<string, string | number>>
                  className={styles.previewTable}
                  columns={previewColumns}
                  dataSource={pagedPreviewRows.map((row, index) => {
                    const rowIndex = (previewPage - 1) * previewPageSize + index;
                    return {
                      ...row,
                      key: buildSampleRowKey(row, objectTypePrimaryKeys, rowIndex),
                    };
                  })}
                  locale={{
                    emptyText: (
                      <Empty description={t("knowledgeNetwork.objectTypeDataQueryEmpty")} />
                    ),
                  }}
                  pagination={false}
                  rowSelection={{
                    onChange: (selectedRowKeys) => {
                      const nextKey = selectedRowKeys[0];
                      setSearchParams((current) => {
                        const next = new URLSearchParams(current);
                        next.set("tab", "data");

                        if (typeof nextKey === "string" && nextKey) {
                          next.set("sampleRow", nextKey);
                        } else {
                          next.delete("sampleRow");
                        }

                        return next;
                      }, { replace: true });
                    },
                    selectedRowKeys: selectedSampleRowKey ? [selectedSampleRowKey] : [],
                    type: "radio",
                  }}
                  scroll={{ x: previewTableScrollX }}
                  size="small"
                  tableLayout="fixed"
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
          </>
        ) : null}

        {dataSection === "logic" ? (
          <ObjectTypeDetailLogicPropertyTrialPanel
            dataProperties={detail.dataProperties}
            displayKey={objectTypeDisplayKey}
            highlightedLogicPropertyName={selectedLogicPropertyName}
            initialSelectedRowKeys={selectedSampleRowKey ? [selectedSampleRowKey] : []}
            knId={networkKnId ?? networkId}
            logicProperties={detail.logicProperties}
            networkId={networkId}
            objectTypeId={objectTypeId}
            preview={preview}
            previewLoading={previewLoading}
            primaryKeys={objectTypePrimaryKeys}
            onSelectedRowKeysChange={(rowKeys) => {
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.set("tab", "data");
                next.set("section", "logic");

                if (rowKeys.length === 1) {
                  const sampleRow = rowKeys[0];
                  if (sampleRow !== undefined) {
                    next.set("sampleRow", sampleRow);
                  }
                } else {
                  next.delete("sampleRow");
                }

                return next;
              }, { replace: true });
            }}
          />
        ) : null}

        {dataSection === "metric" ? (
          <ObjectTypeDetailMetricTrialPanel
            dataProperties={detail.dataProperties}
            loading={relatedMetricsLoading}
            logicProperties={detail.logicProperties}
            metrics={relatedMetrics}
            networkId={networkId}
            objectTypeId={objectTypeId}
            objectTypeName={detail.name}
            onSelectMetricId={(metricId) => {
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.set("tab", "data");
                next.set("section", "metric");
                next.set("metricId", metricId);
                return next;
              }, { replace: true });
            }}
            selectedMetricId={selectedTrialMetricId}
          />
        ) : null}
      </div>
    </div>
  );

  const relatedPanel = (
    <div className={styles.tabPanel}>
      <div className={styles.subSectionHeader}>
        <div className={styles.subSectionToolbarRow}>
          <Segmented
            onChange={(value) => {
              const nextSection = value as ObjectTypeRelatedSectionKey;
              setRelatedKeyword("");
              setRelatedRelationsPage(1);
              setRelatedMetricsPage(1);
              setRelatedActionsPage(1);
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.set("tab", "related");

                if (nextSection === "relations") {
                  next.delete("relatedSection");
                } else {
                  next.set("relatedSection", nextSection);
                }

                return next;
              }, { replace: true });
            }}
            options={[
              {
                label: t("knowledgeNetwork.objectTypeDetailRelatedSectionRelations"),
                value: "relations",
              },
              {
                label: t("knowledgeNetwork.objectTypeDetailRelatedSectionMetrics"),
                value: "metrics",
              },
              {
                label: t("knowledgeNetwork.objectTypeDetailRelatedSectionActions"),
                value: "actions",
              },
            ]}
            size="small"
            value={relatedSection}
          />
          <div className={styles.subSectionToolbarActions}>
            <Input.Search
              allowClear
              onChange={(event) => {
                setRelatedKeyword(event.target.value);
                setRelatedRelationsPage(1);
                setRelatedMetricsPage(1);
                setRelatedActionsPage(1);
              }}
              placeholder={t("knowledgeNetwork.objectTypeDetailSearchRelated")}
              style={{ width: 280 }}
              value={relatedKeyword}
            />
          </div>
        </div>
        <p className={styles.subSectionSubtitle}>{relatedSectionSubtitle}</p>
      </div>

      <div className={styles.tabPanelContent}>
        {relatedSection === "relations" ? (
          <>
            {relatedRelationsError ? (
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
                {filteredRelatedRelations.length > relatedRelationsPageSize ? (
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
                      total={filteredRelatedRelations.length}
                    />
                  </div>
                ) : null}
              </>
            )}
          </>
        ) : null}

        {relatedSection === "metrics" ? (
          <>
            {relatedMetricsError ? (
              <Alert message={relatedMetricsError} showIcon type="error" />
            ) : (
              <>
                <Table<KnowledgeNetworkMetricRecord>
                  columns={relatedMetricColumns}
                  dataSource={pagedRelatedMetrics}
                  loading={relatedMetricsLoading}
                  locale={{
                    emptyText: (
                      <Empty description={t("knowledgeNetwork.objectTypeDetailRelatedMetricsEmpty")} />
                    ),
                  }}
                  pagination={false}
                  rowKey="id"
                  scroll={{ x: 760 }}
                  size="small"
                />
                {filteredRelatedMetrics.length > relatedMetricsPageSize ? (
                  <div className={styles.paginationBar}>
                    <TablePaginationBar
                      current={relatedMetricsPage}
                      onChange={(nextPage, nextPageSize) => {
                        setRelatedMetricsPage(nextPage);
                        setRelatedMetricsPageSize(nextPageSize);
                      }}
                      pageSize={relatedMetricsPageSize}
                      showSizeChanger
                      showTotal={(total) => t("common.total", { total })}
                      total={filteredRelatedMetrics.length}
                    />
                  </div>
                ) : null}
              </>
            )}
          </>
        ) : null}

        {relatedSection === "actions" ? (
          <>
            {relatedActionsError ? (
              <Alert message={relatedActionsError} showIcon type="error" />
            ) : (
              <>
                <Table<KnowledgeNetworkActionTypeRecord>
                  columns={relatedActionColumns}
                  dataSource={pagedRelatedActions}
                  loading={relatedActionsLoading}
                  locale={{
                    emptyText: (
                      <Empty description={t("knowledgeNetwork.objectTypeDetailRelatedActionsEmpty")} />
                    ),
                  }}
                  pagination={false}
                  rowKey="id"
                  scroll={{ x: 760 }}
                  size="small"
                />
                {filteredRelatedActions.length > relatedActionsPageSize ? (
                  <div className={styles.paginationBar}>
                    <TablePaginationBar
                      current={relatedActionsPage}
                      onChange={(nextPage, nextPageSize) => {
                        setRelatedActionsPage(nextPage);
                        setRelatedActionsPageSize(nextPageSize);
                      }}
                      pageSize={relatedActionsPageSize}
                      showSizeChanger
                      showTotal={(total) => t("common.total", { total })}
                      total={filteredRelatedActions.length}
                    />
                  </div>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );

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
        <section className={styles.tabCard}>
          <Tabs
            activeKey={activeTab}
            items={[
              {
                children: overviewPanel,
                key: "overview",
                label: t("knowledgeNetwork.objectTypeDetailTabOverview"),
              },
              {
                children: propertiesPanel,
                key: "properties",
                label: t("knowledgeNetwork.objectTypeDetailTabProperties"),
              },
              {
                children: dataPanel,
                key: "data",
                label: t("knowledgeNetwork.objectTypeDetailTabData"),
              },
              {
                children: relatedPanel,
                key: "related",
                label: t("knowledgeNetwork.objectTypeDetailTabRelated"),
              },
            ]}
            onChange={handleTabChange}
          />
        </section>
      </div>
    </KnowledgeNetworkResourceConfigShell>
  );
}
