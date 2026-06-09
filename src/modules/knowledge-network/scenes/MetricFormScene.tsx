import { Alert, Form, Input, Select, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { MetricCalculationEditor } from "@/modules/knowledge-network/components/metric/MetricCalculationEditor";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import {
  ResourceTagsSelect,
  validateKnowledgeNetworkTags,
} from "@/modules/knowledge-network/components/shared/ResourceTagsSelect";
import {
  createKnowledgeNetworkMetric,
  getKnowledgeNetworkMetric,
  listKnowledgeNetworkObjectTypes,
  updateKnowledgeNetworkMetric,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkMetricMutationPayload,
  KnowledgeNetworkMetricScopeType,
  KnowledgeNetworkObjectTypeRecord,
  MetricUnit,
  MetricUnitType,
} from "@/modules/knowledge-network/types/knowledge-network";
import { createDefaultMetricCalculationFormula } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./MetricFormScene.module.css";

type MetricFormSceneProps = {
  mode: "create" | "edit";
};

const SCOPE_TYPE_OPTIONS: KnowledgeNetworkMetricScopeType[] = ["object_type", "subgraph"];

const UNIT_TYPE_OPTIONS: MetricUnitType[] = [
  "numUnit",
  "storeUnit",
  "percent",
  "transmissionRate",
  "timeUnit",
  "currencyUnit",
  "percentageUnit",
  "countUnit",
  "weightUnit",
  "ordinalRankUnit",
];

const UNIT_OPTIONS: MetricUnit[] = [
  "none",
  "K",
  "Mil",
  "Bil",
  "Tri",
  "times",
  "transaction",
  "piece",
  "item",
  "household",
  "man_day",
  "ton",
  "kg",
  "rank",
  "%",
  "‰",
  "CNY",
  "10K_CNY",
  "1M_CNY",
  "100M_CNY",
  "USD",
  "Fen",
  "Jiao",
  "ms",
  "s",
  "m",
  "h",
  "day",
  "week",
  "month",
  "year",
];

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

function resetScopeDependentFields(
  form: ReturnType<typeof Form.useForm<KnowledgeNetworkMetricMutationPayload>>[0],
) {
  form.setFieldsValue({
    calculationFormula: createDefaultMetricCalculationFormula(),
    timeDimension: {
      defaultRangePolicy: "last_24h",
      property: "",
    },
    unit: undefined,
    unitType: undefined,
  });
}

export function MetricFormScene({ mode }: MetricFormSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const { metricId = "", networkId = "" } = useParams<{
    metricId?: string;
    networkId: string;
  }>();
  const [form] = Form.useForm<KnowledgeNetworkMetricMutationPayload>();
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [pageTitle, setPageTitle] = useState(t("knowledgeNetwork.metricCreateTitle"));
  const scopeType = Form.useWatch("scopeType", form);
  const scopeRef = Form.useWatch("scopeRef", form);

  const listPath = `/knowledge-network/workspace/${networkId}/metrics`;

  const objectTypeOptions = useMemo(
    () => objectTypes.map((item) => ({ label: item.name, value: item.id })),
    [objectTypes],
  );

  useEffect(() => {
    const loadData = async () => {
      if (!networkId) {
        return;
      }

      setLoadError(null);

      try {
        const objectTypeResult = await listKnowledgeNetworkObjectTypes(networkId);
        setObjectTypes(objectTypeResult);

        if (mode === "edit" && metricId) {
          setLoading(true);
          const detail = await getKnowledgeNetworkMetric(networkId, metricId);
          if (!detail) {
            throw new Error(t("common.notFound"));
          }

          form.setFieldsValue({
            calculationFormula: detail.calculationFormula,
            description: detail.description,
            metricType: detail.metricType,
            name: detail.name,
            scopeRef: detail.scopeRef,
            scopeType: detail.scopeType,
            tags: detail.tags,
            timeDimension: detail.timeDimension,
            unit: detail.unit,
            unitType: detail.unitType,
          });
          setPageTitle(detail.name);
        } else {
          form.setFieldsValue({
            calculationFormula: createDefaultMetricCalculationFormula(),
            description: "",
            metricType: "atomic",
            name: "",
            scopeRef: objectTypeResult[0]?.id ?? "",
            scopeType: "object_type",
            tags: [],
            timeDimension: {
              defaultRangePolicy: "last_24h",
              property: "",
            },
          });
        }
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [form, metricId, mode, networkId, t]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (mode === "create") {
        await createKnowledgeNetworkMetric(networkId, values);
      } else if (metricId) {
        await updateKnowledgeNetworkMetric(networkId, metricId, values);
      }

      void message.success(t("common.success"));
      void navigate(listPath);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnitTypeChange = () => {
    form.setFieldValue("unit", undefined);
    form.setFieldValue(["calculationFormula", "aggregation", "property"], undefined);
    form.setFieldValue(["calculationFormula", "aggregation", "aggr"], undefined);
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spin />
      </div>
    );
  }

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        <AppButton loading={submitting} onClick={() => void handleSubmit()} type="primary">
          {t("common.save")}
        </AppButton>
      }
      onBack={() => {
        void navigate(listPath);
      }}
      subtitle={
        mode === "create"
          ? t("knowledgeNetwork.metricCreateDescription")
          : t("knowledgeNetwork.metricEditDescription")
      }
      title={mode === "create" ? t("knowledgeNetwork.metricCreateTitle") : pageTitle}
    >
      {loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      <div className={styles.formPanel}>
        <Form colon={false} form={form} layout="vertical">
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t("knowledgeNetwork.metricBasicInfo")}</h3>

            <Form.Item
              label={t("knowledgeNetwork.metricName")}
              name="name"
              rules={[
                { message: t("knowledgeNetwork.metricNameRequired"), required: true },
                { max: 40, message: t("knowledgeNetwork.objectTypeNameMaxLength") },
              ]}
            >
              <Input maxLength={40} placeholder={t("knowledgeNetwork.metricNamePlaceholder")} />
            </Form.Item>

            <Form.Item
              label={t("knowledgeNetwork.metricType")}
              name="metricType"
              rules={[{ message: t("knowledgeNetwork.metricTypeRequired"), required: true }]}
            >
              <Select
                disabled
                options={[{ label: t("knowledgeNetwork.metricTypeAtomic"), value: "atomic" }]}
                placeholder={t("knowledgeNetwork.pleaseSelect")}
              />
            </Form.Item>

            <Form.Item
              label={t("knowledgeNetwork.metricScopeType")}
              name="scopeType"
              rules={[{ message: t("knowledgeNetwork.metricScopeTypeRequired"), required: true }]}
            >
              <Select
                onChange={() => {
                  form.setFieldValue("scopeRef", undefined);
                  resetScopeDependentFields(form);
                }}
                options={SCOPE_TYPE_OPTIONS.map((value) => ({
                  label: getScopeTypeLabel(value, t),
                  value,
                }))}
                placeholder={t("knowledgeNetwork.pleaseSelect")}
              />
            </Form.Item>

            {scopeType === "object_type" ? (
              <Form.Item
                label={t("knowledgeNetwork.metricScopeRef")}
                name="scopeRef"
                rules={[{ message: t("knowledgeNetwork.metricScopeRefRequired"), required: true }]}
              >
                <Select
                  onChange={() => resetScopeDependentFields(form)}
                  optionFilterProp="label"
                  options={objectTypeOptions}
                  placeholder={t("knowledgeNetwork.metricScopeRefPlaceholder")}
                  showSearch
                />
              </Form.Item>
            ) : (
              <Form.Item
                label={t("knowledgeNetwork.metricScopeRef")}
                name="scopeRef"
                rules={[{ message: t("knowledgeNetwork.metricScopeRefRequired"), required: true }]}
              >
                <Input placeholder={t("knowledgeNetwork.metricSubgraphScopePlaceholder")} />
              </Form.Item>
            )}

            <Form.Item label={t("knowledgeNetwork.metricUnitType")} name="unitType">
              <Select
                allowClear
                onChange={handleUnitTypeChange}
                optionFilterProp="label"
                options={UNIT_TYPE_OPTIONS.map((value) => ({
                  label: t(`knowledgeNetwork.metricUnitTypeOption.${value}`),
                  value,
                }))}
                placeholder={t("knowledgeNetwork.metricUnitTypePlaceholder")}
                showSearch
              />
            </Form.Item>

            <Form.Item label={t("knowledgeNetwork.metricUnit")} name="unit">
              <Select
                allowClear
                optionFilterProp="label"
                options={UNIT_OPTIONS.map((value) => ({
                  label: t(`knowledgeNetwork.metricUnitOption.${value}`, { defaultValue: value }),
                  value,
                }))}
                placeholder={t("knowledgeNetwork.metricUnitPlaceholder")}
                showSearch
              />
            </Form.Item>

            <Form.Item
              label={t("common.tag")}
              name="tags"
              rules={[
                {
                  validator: (rule, value) => validateKnowledgeNetworkTags(t, rule, value),
                },
              ]}
            >
              <ResourceTagsSelect />
            </Form.Item>

            <Form.Item label={t("knowledgeNetwork.descriptionField")} name="description">
              <Input.TextArea
                placeholder={t("knowledgeNetwork.metricDescriptionPlaceholder")}
                rows={3}
              />
            </Form.Item>
          </section>

          <MetricCalculationEditor
            form={form}
            networkId={networkId}
            scopeRef={scopeRef}
            scopeType={scopeType}
          />
        </Form>
      </div>
    </KnowledgeNetworkResourceConfigShell>
  );
}
