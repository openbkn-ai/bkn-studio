/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, InputNumber, Select } from "antd";
import type { FormInstance } from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/knowledge-network.service";
import { ActionTypeConditionEditor } from "@/modules/knowledge-network/components/action-type/ActionTypeConditionEditor";
import {
  getAvailableAggrOptionsForPropertyType,
  isMetricTimePropertyType,
  METRIC_ALL_AGGR_OPTIONS,
} from "@/modules/knowledge-network/constants/metric-aggregation";
import {
  METRIC_UNIT_TYPE_OPTIONS,
  resolveMetricUnitOptions,
} from "@/modules/knowledge-network/constants/metric-units";
import type {
  MetricAggregationAggr,
  MetricDefaultRangePolicy,
  MetricHavingOperator,
  MetricOrderDirection,
  MetricUnit,
  MetricUnitType,
  ObjectTypeDataProperty,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";

import styles from "./MetricCalculationEditor.module.css";

const HAVING_OPERATORS: MetricHavingOperator[] = [">", ">=", "<", "<=", "==", "!="];

const RANGE_POLICIES: MetricDefaultRangePolicy[] = [
  "last_1h",
  "last_24h",
  "calendar_day",
  "none",
];

type MetricCalculationEditorProps = {
  embedded?: boolean;
  form: FormInstance;
  networkId: string;
  objectTypeId?: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
};

function formatPropertyLabel(property: ObjectTypeDataProperty) {
  const label = property.displayName || property.name;
  return `${label} (${property.type || "unknown"})`;
}

function Subsection({
  children,
  embedded,
  title,
}: {
  children: ReactNode;
  embedded?: boolean;
  title: string;
}) {
  if (embedded) {
    return (
      <div className={styles.embeddedSubsection}>
        <h4 className={styles.subsectionTitle}>{title}</h4>
        {children}
      </div>
    );
  }

  return (
    <section className={styles.sectionCard}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

export function MetricCalculationEditor({
  embedded = false,
  form,
  networkId,
  objectTypeId,
  objectTypes,
}: MetricCalculationEditorProps) {
  const { t } = useTranslation();
  const [properties, setProperties] = useState<ObjectTypeDataProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const aggregationProperty = Form.useWatch(
    ["calculationFormula", "aggregation", "property"],
    form,
  ) as string | undefined;
  const unitType = Form.useWatch("unitType", form) as MetricUnitType | undefined;
  const unit = Form.useWatch("unit", form) as MetricUnit | undefined;
  const groupBy = Form.useWatch(["calculationFormula", "groupBy"], form) as string[] | undefined;
  const analysisDimensions = Form.useWatch(["calculationFormula", "analysisDimensions"], form) as
    | string[]
    | undefined;

  useEffect(() => {
    if (!objectTypeId || !networkId) {
      setProperties([]);
      return;
    }

    setLoadingProperties(true);
    void getKnowledgeNetworkObjectTypeDetail(networkId, objectTypeId)
      .then((detail) => {
        setProperties(detail?.dataProperties ?? []);
      })
      .finally(() => {
        setLoadingProperties(false);
      });
  }, [networkId, objectTypeId]);

  const timeProperties = useMemo(
    () => properties.filter((item) => isMetricTimePropertyType(item.type)),
    [properties],
  );
  const propertyOptions = useMemo(
    () =>
      properties.map((item) => ({
        label: item.displayName || item.name,
        value: item.name,
      })),
    [properties],
  );
  const groupBySet = useMemo(() => new Set(groupBy ?? []), [groupBy]);
  const analysisDimensionSet = useMemo(
    () => new Set(analysisDimensions ?? []),
    [analysisDimensions],
  );
  const groupByOptions = useMemo(
    () =>
      propertyOptions.map((item) => ({
        ...item,
        disabled: analysisDimensionSet.has(item.value),
      })),
    [analysisDimensionSet, propertyOptions],
  );
  const analysisDimensionOptions = useMemo(
    () =>
      propertyOptions.map((item) => ({
        ...item,
        disabled: groupBySet.has(item.value),
      })),
    [groupBySet, propertyOptions],
  );
  const availableUnitOptions = useMemo(
    () => resolveMetricUnitOptions(unitType, unit),
    [unit, unitType],
  );
  const aggregationPropertyOptions = useMemo(
    () =>
      properties.map((item) => ({
        label: formatPropertyLabel(item),
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

  const selectedProperty = properties.find((item) => item.name === aggregationProperty);
  const availableAggrOptions = useMemo(() => {
    if (!selectedProperty) {
      return METRIC_ALL_AGGR_OPTIONS;
    }

    return getAvailableAggrOptionsForPropertyType(selectedProperty.type);
  }, [selectedProperty]);
  const aggregationAggr = Form.useWatch(
    ["calculationFormula", "aggregation", "aggr"],
    form,
  ) as MetricAggregationAggr | undefined;

  useEffect(() => {
    if (!aggregationAggr || !selectedProperty) {
      return;
    }

    if (!availableAggrOptions.includes(aggregationAggr)) {
      form.setFieldValue(["calculationFormula", "aggregation", "aggr"], undefined);
    }
  }, [aggregationAggr, availableAggrOptions, form, selectedProperty]);

  const propertiesDisabled = properties.length === 0;
  const handleGroupByChange = (value: string[]) => {
    const nextGroupBySet = new Set(value);
    const nextAnalysisDimensions = (analysisDimensions ?? []).filter(
      (item) => !nextGroupBySet.has(item),
    );
    form.setFieldValue(["calculationFormula", "analysisDimensions"], nextAnalysisDimensions);
  };

  const handleAnalysisDimensionsChange = (value: string[]) => {
    const nextAnalysisDimensionSet = new Set(value);
    const nextGroupBy = (groupBy ?? []).filter((item) => !nextAnalysisDimensionSet.has(item));
    form.setFieldValue(["calculationFormula", "groupBy"], nextGroupBy);
  };

  return (
    <>
      <Subsection embedded={embedded} title={t("knowledgeNetwork.metricCalculationSection")}>
        <div className={styles.fieldGrid}>
          <Form.Item
            label={t("knowledgeNetwork.metricAggregationProperty")}
            name={["calculationFormula", "aggregation", "property"]}
            rules={[
              { message: t("knowledgeNetwork.metricAggregationPropertyRequired"), required: true },
            ]}
          >
            <Select
              disabled={propertiesDisabled}
              loading={loadingProperties}
              onChange={() => {
                form.setFieldValue(["calculationFormula", "aggregation", "aggr"], undefined);
              }}
              options={aggregationPropertyOptions}
              placeholder={t("knowledgeNetwork.metricAggregationPropertyPlaceholder")}
              showSearch
            />
          </Form.Item>

          <Form.Item label={t("knowledgeNetwork.metricUnitType")} name="unitType">
            <Select
              allowClear
              onChange={() => form.setFieldValue("unit", undefined)}
              optionFilterProp="label"
              options={METRIC_UNIT_TYPE_OPTIONS.map((value) => ({
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
              disabled={!unitType}
              optionFilterProp="label"
              options={availableUnitOptions.map((value) => ({
                label: t(`knowledgeNetwork.metricUnitOption.${value}`, { defaultValue: value }),
                value,
              }))}
              placeholder={t("knowledgeNetwork.metricUnitPlaceholder")}
              showSearch
            />
          </Form.Item>

          <Form.Item
            label={t("knowledgeNetwork.metricAggregationAggr")}
            name={["calculationFormula", "aggregation", "aggr"]}
            rules={[{ message: t("knowledgeNetwork.metricAggregationAggrRequired"), required: true }]}
          >
            <Select
              disabled={!aggregationProperty}
              options={availableAggrOptions.map((value) => ({
                label: t(`knowledgeNetwork.metricAggregationAggrOption.${value}`),
                value,
              }))}
              placeholder={t("knowledgeNetwork.pleaseSelect")}
            />
          </Form.Item>

          <Form.Item
            className={styles.fieldFull}
            label={t("knowledgeNetwork.metricFilterCondition")}
            name={["calculationFormula", "condition"]}
          >
            <ActionTypeConditionEditor
              boundObjectTypeId={objectTypeId}
              hideObjectTypeSelect
              objectTypes={objectTypes}
              propertyOptions={conditionPropertyOptions}
            />
          </Form.Item>

          <Form.Item
            className={styles.fieldFull}
            label={t("knowledgeNetwork.metricGroupBy")}
            name={["calculationFormula", "groupBy"]}
          >
            <Select
              allowClear
              disabled={propertiesDisabled}
              mode="multiple"
              onChange={handleGroupByChange}
              options={groupByOptions}
              placeholder={t("knowledgeNetwork.metricGroupByPlaceholder")}
            />
          </Form.Item>

          <Form.Item className={styles.fieldFull} label={t("knowledgeNetwork.metricOrderBy")}>
            <div className={styles.compactRow}>
              <Form.Item name={["calculationFormula", "orderBy", "property"]} noStyle>
                <Select
                  allowClear
                  disabled={propertiesDisabled}
                  options={propertyOptions}
                  placeholder={t("knowledgeNetwork.metricOrderByPropertyPlaceholder")}
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
                />
              </Form.Item>
            </div>
          </Form.Item>

          <Form.Item className={styles.fieldFull} label={t("knowledgeNetwork.metricHaving")}>
            <div className={styles.compactRowOperator}>
              <Form.Item name={["calculationFormula", "having", "operator"]} noStyle>
                <Select
                  allowClear
                  options={HAVING_OPERATORS.map((value) => ({ label: value, value }))}
                  placeholder={t("knowledgeNetwork.metricHavingOperatorPlaceholder")}
                />
              </Form.Item>
              <Form.Item name={["calculationFormula", "having", "value"]} noStyle>
                <InputNumber
                  placeholder={t("knowledgeNetwork.metricHavingValuePlaceholder")}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </div>
          </Form.Item>
        </div>
      </Subsection>

      <Subsection embedded={embedded} title={t("knowledgeNetwork.metricTimeDimensionSection")}>
        <div className={styles.fieldGrid}>
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
        </div>
      </Subsection>

      <Subsection embedded={embedded} title={t("knowledgeNetwork.metricAnalysisDimensionsSection")}>
        <Form.Item
          label={t("knowledgeNetwork.metricAnalysisDimensions")}
          name={["calculationFormula", "analysisDimensions"]}
        >
          <Select
            allowClear
            disabled={propertiesDisabled}
            mode="multiple"
            onChange={handleAnalysisDimensionsChange}
            options={analysisDimensionOptions}
            placeholder={t("knowledgeNetwork.metricAnalysisDimensionsPlaceholder")}
          />
        </Form.Item>
      </Subsection>
    </>
  );
}
