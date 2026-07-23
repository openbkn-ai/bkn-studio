/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { EditOutlined, LineChartOutlined } from "@ant-design/icons";
import { Alert, Descriptions, Spin, Tabs, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { MetricDataQueryPanel } from "@/modules/knowledge-network/components/metric/MetricDataQueryPanel";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import type { MetricDetailSceneProps } from "@/modules/knowledge-network/contracts/scenes";
import { useResolvedUpdaterName } from "@/modules/knowledge-network/hooks/useAccountDirectory";
import {
  deleteKnowledgeNetworkMetric,
  getKnowledgeNetworkMetric,
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import type {
  KnowledgeNetworkMetricRecord,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  formatMetricUnitLabel,
  formatMetricUnitTypeLabel,
  resolveMetricBoundObjectTypeName,
} from "@/modules/knowledge-network/utils/metric-display";
import {
  formatSemanticConditionLabel,
  formatSemanticOrderByLabel,
  formatSemanticPropertyList,
  resolvePropertyDisplayName,
  toMetricPropertyOptions,
} from "@/modules/knowledge-network/utils/metric-property-display";

import styles from "./MetricDetailScene.module.css";

export function MetricDetailScene({
  metricId: metricIdProp,
  networkId: networkIdProp,
  onBack,
  onDeleteSuccess,
  onEdit,
}: MetricDetailSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const params = useParams<{
    metricId: string;
    networkId: string;
  }>();
  const metricId = metricIdProp ?? params.metricId ?? "";
  const networkId = networkIdProp ?? params.networkId ?? "";
  const [detail, setDetail] = useState<KnowledgeNetworkMetricRecord | null>(null);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<RelationTypePropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("info");
  const resolvedUpdaterName = useResolvedUpdaterName(detail?.updaterName);

  const listPath = `/knowledge-network/workspace/${networkId}/metrics`;

  const loadData = useCallback(async () => {
    if (!networkId || !metricId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [metricResult, objectTypeResult] = await Promise.all([
        getKnowledgeNetworkMetric(networkId, metricId),
        listKnowledgeNetworkObjectTypes(networkId),
      ]);
      setDetail(metricResult);
      setObjectTypes(objectTypeResult);

      if (metricResult?.scopeType === "object_type" && metricResult.scopeRef) {
        const objectTypeDetail = await getKnowledgeNetworkObjectTypeDetail(
          networkId,
          metricResult.scopeRef,
        );
        setPropertyOptions(toMetricPropertyOptions(objectTypeDetail?.dataProperties ?? []));
      } else {
        setPropertyOptions([]);
      }
    } catch (nextError) {
      setError(extractRequestErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [metricId, networkId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const confirmDelete = () => {
    if (!detail) {
      return;
    }

    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t("knowledgeNetwork.metricDeleteDescription", { name: detail.name }),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: async () => {
        await deleteKnowledgeNetworkMetric(networkId, detail.id);
        void message.success(t("common.success"));
        if (onDeleteSuccess) {
          onDeleteSuccess();
          return;
        }

        void navigate(listPath);
      },
      title: t("knowledgeNetwork.metricDeleteTitle"),
    });
  };

  if (loading) {
    return (
      <KnowledgeNetworkResourceConfigShell
        onBack={() => {
          if (onBack) {
            onBack();
            return;
          }

          void navigate(listPath);
        }}
        subtitle={t("knowledgeNetwork.metricDetailDescription")}
        title={t("knowledgeNetwork.metricDetailTitle")}
      >
        <div className={styles.loadingState}>
          <Spin />
        </div>
      </KnowledgeNetworkResourceConfigShell>
    );
  }

  if (error || !detail) {
    return <Alert message={error ?? t("common.notFound")} showIcon type="error" />;
  }

  const boundObjectTypeName = resolveMetricBoundObjectTypeName(detail, objectTypes);
  const formula = detail.calculationFormula;

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        <>
          <AppButton
            icon={<EditOutlined />}
            onClick={() => {
              if (onEdit) {
                onEdit();
                return;
              }

              void navigate(`/knowledge-network/workspace/${networkId}/metrics/${metricId}/edit`);
            }}
          >
            {t("common.edit")}
          </AppButton>
          <AppButton danger onClick={confirmDelete}>
            {t("common.delete")}
          </AppButton>
        </>
      }
      onBack={() => {
        if (onBack) {
          onBack();
          return;
        }

        void navigate(listPath);
      }}
      subtitle={t("knowledgeNetwork.metricDetailDescription")}
      title={detail.name}
    >
      <div className={styles.page}>
        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("knowledgeNetwork.metricBasicInfo")}</h3>
          <Descriptions bordered className={styles.basicDescriptions} column={2} size="small">
            <Descriptions.Item label={t("knowledgeNetwork.metricName")} span={2}>
              <span className={styles.nameCell}>
                <span className={styles.summaryIcon} style={{ backgroundColor: "#126ee3" }}>
                  <LineChartOutlined />
                </span>
                <span>{detail.name}</span>
              </span>
            </Descriptions.Item>
            <Descriptions.Item label={t("knowledgeNetwork.descriptionField")} span={2}>
              {detail.description || (
                <span className={styles.placeholder}>{t("knowledgeNetwork.noDescription")}</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t("knowledgeNetwork.metricTags")} span={2}>
              {detail.tags.length > 0 ? (
                <div className={styles.tagRow}>
                  {detail.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              ) : (
                <span className={styles.placeholder}>{t("knowledgeNetwork.noTags")}</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t("common.id")}>{detail.id}</Descriptions.Item>
            <Descriptions.Item label={t("knowledgeNetwork.modifier")}>
              {resolvedUpdaterName}
            </Descriptions.Item>
            <Descriptions.Item label={t("common.updateTime")} span={2}>
              {detail.updateTime || "--"}
            </Descriptions.Item>
          </Descriptions>
        </section>

        <section className={styles.sectionCard}>
          <Tabs
            activeKey={activeTab}
            items={[
              { key: "info", label: t("knowledgeNetwork.metricInfoTab") },
              { key: "query", label: t("knowledgeNetwork.metricDataQuery") },
            ]}
            onChange={setActiveTab}
          />

          {activeTab === "info" ? (
            <div className={styles.infoSections}>
              <section className={styles.configBlock}>
                <h3 className={styles.sectionTitle}>{t("knowledgeNetwork.metricConfigSection")}</h3>
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label={t("knowledgeNetwork.metricBoundObjectType")}>
                    {boundObjectTypeName}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("knowledgeNetwork.metricType")}>
                    {t("knowledgeNetwork.metricTypeAtomic")}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("knowledgeNetwork.metricUnitType")}>
                    {formatMetricUnitTypeLabel(detail.unitType, t)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("knowledgeNetwork.metricUnit")}>
                    {formatMetricUnitLabel(detail.unit, t)}
                  </Descriptions.Item>
                </Descriptions>

                <h4 className={styles.subsectionTitle}>
                  {t("knowledgeNetwork.metricCalculationSection")}
                </h4>
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label={t("knowledgeNetwork.metricAggregationProperty")}>
                    {resolvePropertyDisplayName(formula.aggregation.property, propertyOptions)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("knowledgeNetwork.metricAggregationAggr")}>
                    {formula.aggregation.aggr
                      ? t(`knowledgeNetwork.metricAggregationAggrOption.${formula.aggregation.aggr}`)
                      : "--"}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("knowledgeNetwork.metricFilterCondition")} span={2}>
                    {formatSemanticConditionLabel(
                      formula.condition,
                      propertyOptions,
                      t,
                      "--",
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("knowledgeNetwork.metricGroupBy")}>
                    {formatSemanticPropertyList(formula.groupBy, propertyOptions)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("knowledgeNetwork.metricOrderBy")}>
                    {formatSemanticOrderByLabel(
                      formula.orderBy?.property,
                      formula.orderBy?.direction,
                      propertyOptions,
                      t,
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("knowledgeNetwork.metricHaving")} span={2}>
                    {formula.having?.operator
                      ? `${formula.having.operator} ${formula.having.value ?? ""}`.trim()
                      : "--"}
                  </Descriptions.Item>
                </Descriptions>

                <h4 className={styles.subsectionTitle}>
                  {t("knowledgeNetwork.metricTimeDimensionSection")}
                </h4>
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label={t("knowledgeNetwork.metricTimeDimensionProperty")}>
                    {resolvePropertyDisplayName(detail.timeDimension?.property, propertyOptions)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("knowledgeNetwork.metricDefaultRangePolicy")}>
                    {detail.timeDimension?.defaultRangePolicy
                      ? t(
                          `knowledgeNetwork.metricDefaultRangePolicyOption.${detail.timeDimension.defaultRangePolicy}`,
                        )
                      : "--"}
                  </Descriptions.Item>
                </Descriptions>

                <h4 className={styles.subsectionTitle}>
                  {t("knowledgeNetwork.metricAnalysisDimensionsSection")}
                </h4>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label={t("knowledgeNetwork.metricAnalysisDimensions")}>
                    {formatSemanticPropertyList(formula.analysisDimensions, propertyOptions)}
                  </Descriptions.Item>
                </Descriptions>
              </section>
            </div>
          ) : (
            <MetricDataQueryPanel
              embedded
              metricId={detail.id}
              metricName={detail.name}
              networkId={networkId}
            />
          )}
        </section>
      </div>
    </KnowledgeNetworkResourceConfigShell>
  );
}
