/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, InputNumber, Select, Space } from "antd";
import type { FormInstance } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/knowledge-network.service";
import { ActionTypeConditionEditor } from "@/modules/knowledge-network/components/action-type/ActionTypeConditionEditor";
import type {
  MetricAggregationAggr,
  MetricDefaultRangePolicy,
  MetricHavingOperator,
  MetricOrderDirection,
  ObjectTypeDataProperty,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";

import styles from "./MetricCalculationEditor.module.css";

const NUMERIC_TYPES = ["int", "float", "double", "long", "number", "decimal"];
const TIME_TYPES = ["date", "datetime", "timestamp", "time"];

const AGGR_OPTIONS: MetricAggregationAggr[] = [
  "sum",
  "avg",
  "max",
  "min",
  "count",
  "count_distinct",
];

const HAVING_OPERATORS: MetricHavingOperator[] = [">", ">=", "<", "<=", "==", "!="];

const RANGE_POLICIES: MetricDefaultRangePolicy[] = [
  "last_1h",
  "last_24h",
  "calendar_day",
  "none",
];

type MetricCalculationEditorProps = {
  form: FormInstance;
  networkId: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  scopeRef?: string;
  scopeType?: string;
};

function isNumericProperty(property: ObjectTypeDataProperty) {
  const normalized = property.type.toLowerCase();
  return NUMERIC_TYPES.some((type) => normalized.includes(type));
}

function isTimeProperty(property: ObjectTypeDataProperty) {
  const normalized = property.type.toLowerCase();
  return TIME_TYPES.some((type) => normalized.includes(type));
}

function formatPropertyLabel(property: ObjectTypeDataProperty) {
  const label = property.displayName || property.name;
  return `${label} (${property.type || "unknown"})`;
}

export function MetricCalculationEditor({
  form,
  networkId,
  objectTypes,
  scopeRef,
  scopeType,
}: MetricCalculationEditorProps) {
  const { t } = useTranslation();
  const [properties, setProperties] = useState<ObjectTypeDataProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const aggregationProperty = Form.useWatch(
    ["calculationFormula", "aggregation", "property"],
    form,
  ) as string | undefined;

  useEffect(() => {
    if (scopeType !== "object_type" || !scopeRef || !networkId) {
      setProperties([]);
      return;
    }

    setLoadingProperties(true);
    void getKnowledgeNetworkObjectTypeDetail(networkId, scopeRef)
      .then((detail) => {
        setProperties(detail?.dataProperties ?? []);
      })
      .finally(() => {
        setLoadingProperties(false);
      });
  }, [networkId, scopeRef, scopeType]);

  const numericProperties = useMemo(
    () => properties.filter(isNumericProperty),
    [properties],
  );
  const timeProperties = useMemo(() => properties.filter(isTimeProperty), [properties]);
  const propertyOptions = useMemo(
    () =>
      properties.map((item) => ({
        label: item.displayName || item.name,
        value: item.name,
      })),
    [properties],
  );
  const conditionPropertyOptions = useMemo<RelationTypePropertyOption[]>(
    () =>
      properties.map((item) => ({
        comment: item.comment,
        displayName: item.displayName || item.name,
        label: item.displayName || item.name,
        name: item.name,
        type: item.type,
        value: item.name,
      })),
    [properties],
  );
  const numericPropertyOptions = useMemo(
    () =>
      numericProperties.map((item) => ({
        label: formatPropertyLabel(item),
        value: item.name,
      })),
    [numericProperties],
  );

  const selectedProperty = properties.find((item) => item.name === aggregationProperty);
  const availableAggrOptions = useMemo(() => {
    if (!selectedProperty) {
      return AGGR_OPTIONS;
    }

    return isNumericProperty(selectedProperty)
      ? AGGR_OPTIONS
      : (["count", "count_distinct"] as MetricAggregationAggr[]);
  }, [selectedProperty]);

  const propertiesDisabled = properties.length === 0;

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t("knowledgeNetwork.metricCalculationSection")}</h3>

      <Form.Item
        label={t("knowledgeNetwork.metricAggregationProperty")}
        name={["calculationFormula", "aggregation", "property"]}
        rules={[
          { message: t("knowledgeNetwork.metricAggregationPropertyRequired"), required: true },
        ]}
      >
        <Select
          disabled={numericPropertyOptions.length === 0}
          loading={loadingProperties}
          onChange={() => {
            form.setFieldValue(["calculationFormula", "aggregation", "aggr"], undefined);
          }}
          options={numericPropertyOptions}
          placeholder={t("knowledgeNetwork.metricAggregationPropertyPlaceholder")}
          showSearch
        />
      </Form.Item>

      <Form.Item
        label={t("knowledgeNetwork.metricAggregationAggr")}
        name={["calculationFormula", "aggregation", "aggr"]}
        rules={[{ message: t("knowledgeNetwork.metricAggregationAggrRequired"), required: true }]}
      >
        <Select
          options={availableAggrOptions.map((value) => ({
            label: t(`knowledgeNetwork.metricAggregationAggrOption.${value}`),
            value,
          }))}
          placeholder={t("knowledgeNetwork.pleaseSelect")}
        />
      </Form.Item>

      <Form.Item
        label={t("knowledgeNetwork.metricFilterCondition")}
        name={["calculationFormula", "condition"]}
      >
        <ActionTypeConditionEditor
          boundObjectTypeId={scopeType === "object_type" ? scopeRef : undefined}
          objectTypes={objectTypes}
          propertyOptions={conditionPropertyOptions}
        />
      </Form.Item>

      <Form.Item label={t("knowledgeNetwork.metricGroupBy")} name={["calculationFormula", "groupBy"]}>
        <Select
          allowClear
          disabled={propertiesDisabled}
          mode="multiple"
          options={propertyOptions}
          placeholder={t("knowledgeNetwork.metricGroupByPlaceholder")}
        />
      </Form.Item>

      <Form.Item label={t("knowledgeNetwork.metricOrderBy")}>
        <Space align="start" className={styles.inlineFieldGroup} wrap>
          <Form.Item name={["calculationFormula", "orderBy", "property"]} noStyle>
            <Select
              allowClear
              disabled={propertiesDisabled}
              options={propertyOptions}
              placeholder={t("knowledgeNetwork.metricOrderByPropertyPlaceholder")}
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item name={["calculationFormula", "orderBy", "direction"]} noStyle>
            <Select
              allowClear
              options={[
                { label: t("knowledgeNetwork.metricOrderAsc"), value: "asc" },
                { label: t("knowledgeNetwork.metricOrderDesc"), value: "desc" },
              ] satisfies Array<{ label: string; value: MetricOrderDirection }>}
              placeholder={t("knowledgeNetwork.pleaseSelect")}
              style={{ width: 100 }}
            />
          </Form.Item>
        </Space>
      </Form.Item>

      <Form.Item label={t("knowledgeNetwork.metricHaving")}>
        <Space align="start" className={styles.inlineFieldGroup} wrap>
          <Form.Item name={["calculationFormula", "having", "operator"]} noStyle>
            <Select
              allowClear
              options={HAVING_OPERATORS.map((value) => ({ label: value, value }))}
              placeholder={t("knowledgeNetwork.metricHavingOperatorPlaceholder")}
              style={{ width: 100 }}
            />
          </Form.Item>
          <Form.Item name={["calculationFormula", "having", "value"]} noStyle>
            <InputNumber
              placeholder={t("knowledgeNetwork.metricHavingValuePlaceholder")}
              style={{ width: 150 }}
            />
          </Form.Item>
        </Space>
      </Form.Item>

      <h3 className={styles.sectionTitle}>{t("knowledgeNetwork.metricTimeDimensionSection")}</h3>

      <Form.Item
        label={t("knowledgeNetwork.metricTimeDimensionProperty")}
        name={["timeDimension", "property"]}
      >
        <Select
          allowClear
          disabled={timeProperties.length === 0}
          loading={loadingProperties}
          options={timeProperties.map((item) => ({
            label: formatPropertyLabel(item),
            value: item.name,
          }))}
          placeholder={t("knowledgeNetwork.metricTimeDimensionPropertyPlaceholder")}
          showSearch
        />
      </Form.Item>

      <Form.Item
        label={t("knowledgeNetwork.metricDefaultRangePolicy")}
        name={["timeDimension", "defaultRangePolicy"]}
      >
        <Select
          allowClear
          options={RANGE_POLICIES.map((value) => ({
            label: t(`knowledgeNetwork.metricDefaultRangePolicyOption.${value}`),
            value,
          }))}
          placeholder={t("knowledgeNetwork.pleaseSelect")}
        />
      </Form.Item>

      <h3 className={styles.sectionTitle}>{t("knowledgeNetwork.metricAnalysisDimensionsSection")}</h3>

      <Form.Item
        label={t("knowledgeNetwork.metricAnalysisDimensions")}
        name={["calculationFormula", "analysisDimensions"]}
      >
        <Select
          allowClear
          disabled={propertiesDisabled}
          mode="multiple"
          options={propertyOptions}
          placeholder={t("knowledgeNetwork.metricAnalysisDimensionsPlaceholder")}
        />
      </Form.Item>
    </div>
  );
}
