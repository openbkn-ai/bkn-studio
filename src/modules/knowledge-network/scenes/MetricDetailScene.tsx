import { EditOutlined, LineChartOutlined } from "@ant-design/icons";
import { Alert, Descriptions, Spin, Tabs, Tag } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { MetricDataQueryPanel } from "@/modules/knowledge-network/components/metric/MetricDataQueryPanel";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import {
  deleteKnowledgeNetworkMetric,
  getKnowledgeNetworkMetric,
  listKnowledgeNetworkObjectTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkMetricRecord,
  KnowledgeNetworkMetricScopeType,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./MetricDetailScene.module.css";

function getScopeTypeLabel(
  value: KnowledgeNetworkMetricScopeType,
  t: (key: string) => string,
) {
  switch (value) {
    case "subgraph":
      return t("knowledgeNetwork.metricScopeSubgraph");
    case "object_type":
    default:
      return t("knowledgeNetwork.metricScopeObjectType");
  }
}

function formatPropertyList(values: string[] | undefined, emptyLabel: string) {
  if (!values || values.length === 0) {
    return emptyLabel;
  }

  return values.join(", ");
}

export function MetricDetailScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { metricId = "", networkId = "" } = useParams<{
    metricId: string;
    networkId: string;
  }>();
  const [detail, setDetail] = useState<KnowledgeNetworkMetricRecord | null>(null);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("info");

  const listPath = `/knowledge-network/workspace/${networkId}/metrics`;

  const loadData = async () => {
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
    } catch (nextError) {
      setError(extractRequestErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [metricId, networkId]);

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
        void navigate(listPath);
      },
      title: t("knowledgeNetwork.metricDeleteTitle"),
    });
  };

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

  const scopeRefName =
    detail.scopeType === "object_type"
      ? objectTypes.find((item) => item.id === detail.scopeRef)?.name ?? detail.scopeRef
      : detail.scopeRef;
  const formula = detail.calculationFormula;

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        <>
          <AppButton
            icon={<EditOutlined />}
            onClick={() => {
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
        void navigate(listPath);
      }}
      subtitle={t("knowledgeNetwork.metricDetailDescription")}
      title={detail.name}
    >
      <div className={styles.page}>
        <section className={styles.summaryCard}>
          <div className={styles.summaryHead}>
            <span className={styles.summaryIcon} style={{ backgroundColor: "#126ee3" }}>
              <LineChartOutlined />
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
          <div className={styles.summaryMeta}>
            <span>
              {t("common.id")}: {detail.id}
            </span>
            <span>{t("knowledgeNetwork.updatedBy", { name: detail.updaterName })}</span>
            <span>
              {t("common.updateTime")}: {detail.updateTime}
            </span>
          </div>
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
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label={t("knowledgeNetwork.metricType")}>
                {t("knowledgeNetwork.metricTypeAtomic")}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.metricScopeType")}>
                {getScopeTypeLabel(detail.scopeType, t)}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.metricScopeRef")}>
                {scopeRefName}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.metricUnitType")}>
                {detail.unitType
                  ? t(`knowledgeNetwork.metricUnitTypeOption.${detail.unitType}`)
                  : "--"}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.metricUnit")}>
                {detail.unit
                  ? t(`knowledgeNetwork.metricUnitOption.${detail.unit}`, { defaultValue: detail.unit })
                  : "--"}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.metricAggregationProperty")}>
                {formula.aggregation.property || "--"}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.metricAggregationAggr")}>
                {formula.aggregation.aggr
                  ? t(`knowledgeNetwork.metricAggregationAggrOption.${formula.aggregation.aggr}`)
                  : "--"}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.metricGroupBy")}>
                {formatPropertyList(formula.groupBy, t("knowledgeNetwork.noTags"))}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.metricAnalysisDimensions")}>
                {formatPropertyList(formula.analysisDimensions, t("knowledgeNetwork.noTags"))}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.metricTimeDimensionProperty")}>
                {detail.timeDimension?.property || "--"}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.metricDefaultRangePolicy")}>
                {detail.timeDimension?.defaultRangePolicy
                  ? t(
                      `knowledgeNetwork.metricDefaultRangePolicyOption.${detail.timeDimension.defaultRangePolicy}`,
                    )
                  : "--"}
              </Descriptions.Item>
            </Descriptions>
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
