/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  LeftOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SendOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Result,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { isRequestForbidden, isRequestNotFound } from "@/framework/request/error-message";
import { ObjectMetricConditionBuilder } from "@/modules/knowledge-network/components/object-metric/ObjectMetricConditionBuilder";
import { AtomicInstanceExpressionBuilder } from "@/modules/knowledge-network/components/object-metric/AtomicInstanceExpressionBuilder";
import { ObjectMetricTrialDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer";
import {
  ObjectMetricExpressionEditor,
  type ObjectMetricExpressionPropertyOption,
} from "@/modules/knowledge-network/components/object-metric/ObjectMetricExpressionEditor";
import {
  createObjectMetricDefinitionV1,
  expressionLabel,
  expressionReferencesProperty,
  inferCompositeExpressionValueV1,
  replaceObjectMetricDependencyAliases,
} from "@/modules/knowledge-network/components/object-metric/object-metric-model";
import {
  expressionValueType,
  normalizeExpressionValueType,
  type ExpressionValueType,
} from "@/modules/knowledge-network/components/object-metric/object-metric-expression-registry";
import { objectMetricQueryCapabilities } from "@/modules/knowledge-network/lib/object-metric-query-capabilities";
import { presentObjectMetricValidationIssue } from "@/modules/knowledge-network/lib/object-metric-validation-presentation";
import { availableRelationTypesFrom } from "@/modules/knowledge-network/lib/object-metric-relation-path";
import {
  buildObjectMetricTimeWindow,
  DEFAULT_OBJECT_METRIC_TIMEZONE,
  objectMetricTimeWindowBusinessLabel,
  objectMetricTimeWindowPeriod,
  objectMetricTimeWindowSelection,
  type ObjectMetricTimeWindowSelection,
} from "@/modules/knowledge-network/lib/object-metric-time-window";
import {
  objectMetricUnitOptions,
  objectMetricUnitSelectionLocked,
  type ObjectMetricUnitQuantityKind,
} from "@/modules/knowledge-network/lib/object-metric-unit-catalog";
import { objectMetricFormErrorCount } from "@/modules/knowledge-network/lib/object-metric-form-validation";
import {
  generateObjectMetricAiIntent,
  type ObjectMetricAiIntent,
} from "@/modules/knowledge-network/services/object-metric-ai.service";
import {
  createObjectMetricDraftV1,
  getObjectMetricCapabilitiesV1,
  getObjectMetricV1,
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes,
  listObjectMetricsV1,
  previewObjectMetricV1,
  publishObjectMetricV1,
  trialObjectMetricDataV1,
  updateObjectMetricDraftV1,
  validateObjectMetricV1,
  validateObjectMetricVersionV1,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/object-type.service";
import type {
  ObjectMetricConditionV1,
  ObjectMetricCapabilitiesV1,
  ObjectMetricDefinitionV1,
  ObjectMetricDependencyV1,
  ObjectMetricExpressionV1,
  ObjectMetricObjectAlignmentV1,
  ObjectMetricOperandV1,
  ObjectMetricPreviewV1,
  ObjectMetricPropertyRefV1,
  ObjectMetricRecordV1,
  ObjectMetricRelationStepV1,
  ObjectMetricTypeV1,
  ObjectMetricValidationResultV1,
} from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectMetricFormScene.module.css";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import { useTranslation } from "react-i18next";

type UnitQuantityKind = ObjectMetricUnitQuantityKind;

const timeUnitOptions = [
  {
    get label() {
      return objectMetricText("mbd957bc497aa");
    },
    value: "minute",
  },
  {
    get label() {
      return objectMetricText("m3b6fefc50feb");
    },
    value: "hour",
  },
  {
    get label() {
      return objectMetricText("m85217f7aff77");
    },
    value: "day",
  },
  {
    get label() {
      return objectMetricText("m5c553ec3f6db");
    },
    value: "week",
  },
  {
    get label() {
      return objectMetricText("m1625179badc0");
    },
    value: "month",
  },
  {
    get label() {
      return objectMetricText("m4f1c54f507c9");
    },
    value: "quarter",
  },
  {
    get label() {
      return objectMetricText("m62ef900a8f5d");
    },
    value: "year",
  },
] as const;

const defaultMetricTimezone = DEFAULT_OBJECT_METRIC_TIMEZONE;

const rollingTimeUnitLabels: Record<NonNullable<FormValues["timeWindowUnit"]>, string> = {
  get day() {
    return objectMetricText("m49da61ceeea2");
  },
  get hour() {
    return objectMetricText("m3b6fefc50feb");
  },
  get minute() {
    return objectMetricText("mbd957bc497aa");
  },
  get month() {
    return objectMetricText("me5afd16c6a36");
  },
  get quarter() {
    return objectMetricText("mb5acf6b4d6a5");
  },
  get week() {
    return objectMetricText("m5c553ec3f6db");
  },
  get year() {
    return objectMetricText("m62ef900a8f5d");
  },
};

const physicalTypeOptions = [
  {
    get label() {
      return objectMetricText("m67e2bb6ef67b");
    },
    value: "int64",
  },
  {
    get label() {
      return objectMetricText("m75a7f49573c8");
    },
    value: "decimal",
  },
  {
    get label() {
      return objectMetricText("mc08142c140ff");
    },
    value: "boolean",
  },
  {
    get label() {
      return objectMetricText("mdd81861811e5");
    },
    value: "string",
  },
  {
    get label() {
      return objectMetricText("m70d0c1b33626");
    },
    value: "date",
  },
  {
    get label() {
      return objectMetricText("m6ac8b7718121");
    },
    value: "datetime",
  },
  {
    get label() {
      return objectMetricText("m3e777ea8f1e8");
    },
    value: "duration",
  },
] as const;

const roundingModeLabels: Record<NonNullable<FormValues["roundingMode"]>, string> = {
  get ceiling() {
    return objectMetricText("m2534ac6ed23d");
  },
  get floor() {
    return objectMetricText("m2db59b7b2c50");
  },
  get half_even() {
    return objectMetricText("m7d5873e080fb");
  },
  get half_up() {
    return objectMetricText("m9c09e447599c");
  },
  get truncate() {
    return objectMetricText("mb6f97fe55978");
  },
};

const physicalTypesBySemanticType: Record<
  ObjectMetricDefinitionV1["result_semantics"]["value"]["semantic_type"],
  ReadonlyArray<ObjectMetricDefinitionV1["result_semantics"]["value"]["physical_type"]>
> = {
  amount: ["decimal"],
  boolean: ["boolean"],
  category: ["string"],
  count: ["int64", "decimal"],
  date: ["date"],
  duration: ["duration"],
  measure: ["int64", "decimal", "duration"],
  percentage: ["decimal"],
  rank: ["int64"],
  ratio: ["decimal"],
  score: ["decimal"],
  timestamp: ["datetime"],
};

function supportsUnit(physicalType?: FormValues["physicalType"]) {
  return physicalType === "int64" || physicalType === "decimal" || physicalType === "duration";
}

function expressionWithDeclaredPropertyTypes(
  expression: ObjectMetricExpressionV1,
  properties: ObjectMetricExpressionPropertyOption[],
): ObjectMetricExpressionV1 {
  if (expression.node_type === "property") {
    const property = properties.find(
      (item) =>
        item.objectTypeId === expression.property_ref.object_type_id &&
        item.propertyName === expression.property_ref.property_name,
    );
    return {
      ...expression,
      value_type: property?.propertyType
        ? normalizeExpressionValueType(property.propertyType)
        : expression.value_type,
    };
  }
  if (expression.node_type === "call") {
    return {
      ...expression,
      arguments: expression.arguments.map((argument) =>
        expressionWithDeclaredPropertyTypes(argument, properties),
      ),
    };
  }
  if (expression.node_type === "unary") {
    return {
      ...expression,
      left: expressionWithDeclaredPropertyTypes(expression.left, properties),
    };
  }
  if (expression.node_type === "binary") {
    return {
      ...expression,
      left: expressionWithDeclaredPropertyTypes(expression.left, properties),
      right: expressionWithDeclaredPropertyTypes(expression.right, properties),
    };
  }
  return expression;
}

type FormValues = {
  aggregation:
    "identity" | "count_rows" | "count" | "count_distinct" | "sum" | "avg" | "min" | "max";
  analysisDimensions: string[];
  alignmentTimeKey?: string;
  baseMetric: string;
  calculationScope: "object_instance" | "object_set";
  code: string;
  description: string;
  eventTime?: string;
  fixedTimeRange?: [Dayjs, Dayjs];
  groupByDimensions: string[];
  grainPolicy?: "same_grain" | "rollup";
  grainWeekStart?: "monday" | "sunday";
  maximum?: number;
  minimum?: number;
  logicPropertyComment?: string;
  logicPropertyDisplayName?: string;
  logicPropertyEnabled?: boolean;
  logicPropertyName?: string;
  name: string;
  noDataPolicy: "zero" | "null" | "unavailable";
  primaryDependencyAlias?: string;
  physicalType: ObjectMetricDefinitionV1["result_semantics"]["value"]["physical_type"];
  precision?: number;
  quantityKind?: UnitQuantityKind;
  relationCountComparison?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  relationCountThreshold?: number;
  relationQuantifier?: "exists" | "not_exists" | "all" | "all_nonempty" | "count_compare";
  resultSetPolicy?: "intersection" | "preserve_primary_dependency";
  roundingMode?: "half_up" | "half_even" | "floor" | "ceiling" | "truncate";
  scale?: number;
  semanticType: ObjectMetricDefinitionV1["result_semantics"]["value"]["semantic_type"];
  timeDimensions: string[];
  timeAlignment?: "same_time_window" | "explicit_rollup";
  timeGranularity?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
  timeWindowLength?: number;
  timeWindowMode?: ObjectMetricTimeWindowSelection;
  timeWindowUnit?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
  timezone?: string;
  weekStart?: "monday" | "sunday";
  unitCode?: string;
  unitScaleFactor?: number;
  unitDenominatorCode?: string;
  unitDenominatorKind?: Exclude<UnitQuantityKind, "rate">;
  unitDenominatorSystem?: "UCUM" | "ISO_4217" | "registered";
  unitNumeratorCode?: string;
  unitNumeratorKind?: Exclude<UnitQuantityKind, "rate">;
  unitNumeratorSystem?: "UCUM" | "ISO_4217" | "registered";
  unitSystem?: "UCUM" | "ISO_4217" | "registered";
  nullPolicy?: "propagate" | "coalesce_zero";
  zeroDivisionPolicy?: "unavailable" | "null" | "zero";
};

const semanticTypeOptions: Array<{ label: string; value: FormValues["semanticType"] }> = [
  {
    get label() {
      return objectMetricText("m208d85fd9f3a");
    },
    value: "measure",
  },
  {
    get label() {
      return objectMetricText("m21179deb9a74");
    },
    value: "count",
  },
  {
    get label() {
      return objectMetricText("mffc624300de8");
    },
    value: "amount",
  },
  {
    get label() {
      return objectMetricText("m8a457b6b1337");
    },
    value: "ratio",
  },
  {
    get label() {
      return objectMetricText("m03af18e36797");
    },
    value: "percentage",
  },
  {
    get label() {
      return objectMetricText("m96fff2e26c8d");
    },
    value: "score",
  },
  {
    get label() {
      return objectMetricText("m6570a98f2850");
    },
    value: "rank",
  },
  {
    get label() {
      return objectMetricText("m2d1060334622");
    },
    value: "timestamp",
  },
  {
    get label() {
      return objectMetricText("m04a95e0654d3");
    },
    value: "duration",
  },
  {
    get label() {
      return objectMetricText("m70d0c1b33626");
    },
    value: "date",
  },
  {
    get label() {
      return objectMetricText("m20fcf2eb775f");
    },
    value: "category",
  },
  {
    get label() {
      return objectMetricText("mc08142c140ff");
    },
    value: "boolean",
  },
];

const calculationScopeLabels: Record<FormValues["calculationScope"], string> = {
  get object_instance() {
    return objectMetricText("mabe9d02781fc");
  },
  get object_set() {
    return objectMetricText("m9c51e86f9307");
  },
};

const metricTypeLabels: Record<ObjectMetricTypeV1, string> = {
  get atomic() {
    return objectMetricText("me5675ba4c2fd");
  },
  get composite() {
    return objectMetricText("m3e70c815f275");
  },
  get derived() {
    return objectMetricText("me88b222ae28a");
  },
};

const metricLifecycleStatusLabels: Record<ObjectMetricDefinitionV1["lifecycle"]["status"], string> =
  {
    get deprecated() {
      return objectMetricText("ma8c3698b5b8c");
    },
    get draft() {
      return objectMetricText("m2a2fd29bd27a");
    },
    get published() {
      return objectMetricText("md334724d6b2f");
    },
    get validated() {
      return objectMetricText("m1936eafc0c3c");
    },
  };

const aggregationLabels: Record<FormValues["aggregation"], string> = {
  get avg() {
    return objectMetricText("mdb7538b96322");
  },
  get count() {
    return objectMetricText("m3a6663a758c9");
  },
  get count_distinct() {
    return objectMetricText("m1e96cd1f49bf");
  },
  get count_rows() {
    return objectMetricText("m21179deb9a74");
  },
  get identity() {
    return objectMetricText("m9d001b97d59e");
  },
  get max() {
    return objectMetricText("m1e7a22820768");
  },
  get min() {
    return objectMetricText("mb2dcdcfabb6a");
  },
  get sum() {
    return objectMetricText("m2819237ddb01");
  },
};

const atomicAggregationGuidance: Record<FormValues["aggregation"], string> = {
  get avg() {
    return objectMetricText("m1afe51282ba8");
  },
  get count() {
    return objectMetricText("mfc9ae0b4bc74");
  },
  get count_distinct() {
    return objectMetricText("mc85054311533");
  },
  get count_rows() {
    return objectMetricText("mc4c20772d4a3");
  },
  get identity() {
    return objectMetricText("mca90417ebd86");
  },
  get max() {
    return objectMetricText("m84405156480f");
  },
  get min() {
    return objectMetricText("m673a5e2385de");
  },
  get sum() {
    return objectMetricText("md6f22f4bb383");
  },
};

const comparisonLabels: Record<
  Extract<ObjectMetricConditionV1, { node_type: "predicate" }>["comparison_operator"],
  string
> = {
  get after() {
    return objectMetricText("m05bf631daf34");
  },
  get after_or_equal() {
    return objectMetricText("m20e88f66687e");
  },
  get before() {
    return objectMetricText("mac3abc8a1900");
  },
  get before_or_equal() {
    return objectMetricText("m10981edc118a");
  },
  get between() {
    return objectMetricText("m2805cdf0df59");
  },
  get contains() {
    return objectMetricText("m107319b8b39d");
  },
  get ends_with() {
    return objectMetricText("me3131c75602a");
  },
  get eq() {
    return objectMetricText("m4bc69a0562ff");
  },
  get gt() {
    return objectMetricText("mb4614ab230a5");
  },
  get gte() {
    return objectMetricText("me1feef07d1b8");
  },
  get in() {
    return objectMetricText("m541d9758ac8d");
  },
  get is_empty() {
    return objectMetricText("m6f0db35f5cdb");
  },
  get is_false() {
    return objectMetricText("m0461a3b64d46");
  },
  get is_not_empty() {
    return objectMetricText("m1a160efcb337");
  },
  get is_not_null() {
    return objectMetricText("m35a1640c0161");
  },
  get is_null() {
    return objectMetricText("m56f9835c2cd7");
  },
  get is_true() {
    return objectMetricText("m463fb81cc157");
  },
  get lt() {
    return objectMetricText("ma39accd3595f");
  },
  get lte() {
    return objectMetricText("m035d78382d6f");
  },
  get neq() {
    return objectMetricText("m9678e3a7cb3c");
  },
  get not_between() {
    return objectMetricText("mbd1d591a5fe0");
  },
  get not_contains() {
    return objectMetricText("m5f60ffcf600a");
  },
  get not_in() {
    return objectMetricText("m346b5503cd87");
  },
  get starts_with() {
    return objectMetricText("mf35b23dcbbae");
  },
};

const relationQuantifierLabels: Record<NonNullable<FormValues["relationQuantifier"]>, string> = {
  get all() {
    return objectMetricText("m0807fecce6a6");
  },
  get all_nonempty() {
    return objectMetricText("m0d3c640ca7ca");
  },
  get count_compare() {
    return objectMetricText("m2ee2adf98ead");
  },
  get exists() {
    return objectMetricText("me16ed4de78a6");
  },
  get not_exists() {
    return objectMetricText("ma444f2c0f5f9");
  },
};

function isGeneratedMetricCode(code: string) {
  return /^m_[a-z0-9]{20,}$/i.test(code.trim());
}

function conditionSummary(
  condition: ObjectMetricConditionV1,
  propertyOptions: ObjectMetricExpressionPropertyOption[],
): string {
  if (condition.node_type === "group") {
    const children = condition.children.map((child) => conditionSummary(child, propertyOptions));
    if (condition.boolean_operator === "not")
      return objectMetricText("m971ba98c1c78", {
        p0: children.join(objectMetricText("ma22bdbe928cd")),
      });
    return children.join(
      condition.boolean_operator === "and"
        ? objectMetricText("ma22bdbe928cd")
        : objectMetricText("m60ab743988bb"),
    );
  }
  const operandLabel = (operand: ObjectMetricOperandV1) => {
    if (operand.source === "property") {
      return (
        propertyOptions.find(
          (item) =>
            item.objectTypeId === operand.property_ref.object_type_id &&
            item.propertyName === operand.property_ref.property_name,
        )?.label ?? operand.property_ref.property_name
      );
    }
    if (operand.value === "" || operand.value === undefined || operand.value === null) {
      return objectMetricText("m4b6f06b32354");
    }
    if (typeof operand.value === "string") return `“${operand.value}”`;
    if (typeof operand.value === "number" || typeof operand.value === "boolean") {
      return String(operand.value);
    }
    return JSON.stringify(operand.value) ?? objectMetricText("m4b6f06b32354");
  };
  const right = condition.right?.map(operandLabel).join("、");
  return [operandLabel(condition.left), comparisonLabels[condition.comparison_operator], right]
    .filter(Boolean)
    .join(" ");
}

function conditionIsComplete(condition?: ObjectMetricConditionV1): boolean {
  if (!condition) return false;
  if (condition.node_type === "group") {
    return condition.children.length > 0 && condition.children.every(conditionIsComplete);
  }
  if (condition.left.source !== "property" || !condition.left.property_ref.property_name.trim()) {
    return false;
  }
  if (
    ["is_empty", "is_not_empty", "is_null", "is_not_null", "is_true", "is_false"].includes(
      condition.comparison_operator,
    )
  ) {
    return true;
  }
  return Boolean(
    condition.right?.length &&
    condition.right.every((operand) =>
      operand.source === "property"
        ? Boolean(operand.property_ref.property_name.trim())
        : operand.value !== "" && operand.value !== undefined && operand.value !== null,
    ),
  );
}

function instanceValueSuggestion(
  expression: ObjectMetricExpressionV1,
  properties: ObjectMetricExpressionPropertyOption[],
  aggregation: FormValues["aggregation"] = "identity",
): Partial<FormValues> | undefined {
  if (aggregation === "count_rows" || aggregation === "count" || aggregation === "count_distinct") {
    return {
      noDataPolicy: "zero",
      physicalType: "int64",
      quantityKind: "count",
      semanticType: "count",
      unitCode: "1",
      unitScaleFactor: 1,
      unitSystem: "UCUM",
    };
  }
  const propertyType =
    aggregation === "avg" ? "decimal" : expressionValueType(expression, properties);
  if (!propertyType) return undefined;

  return valueSuggestionForPhysicalType(propertyType);
}

function valueSuggestionForPhysicalType(
  propertyType: ExpressionValueType,
): Partial<FormValues> | undefined {
  const withoutUnit = {
    quantityKind: undefined,
    unitCode: undefined,
    unitScaleFactor: undefined,
    unitSystem: undefined,
  };
  if (propertyType === "string") {
    return {
      ...withoutUnit,
      noDataPolicy: "null",
      physicalType: "string",
      semanticType: "category",
    };
  }
  if (propertyType === "boolean") {
    return {
      ...withoutUnit,
      noDataPolicy: "null",
      physicalType: "boolean",
      semanticType: "boolean",
    };
  }
  if (propertyType === "date") {
    return { ...withoutUnit, noDataPolicy: "null", physicalType: "date", semanticType: "date" };
  }
  if (propertyType === "datetime") {
    return {
      ...withoutUnit,
      noDataPolicy: "null",
      physicalType: "datetime",
      semanticType: "timestamp",
    };
  }
  if (propertyType === "duration") {
    return {
      noDataPolicy: "null",
      physicalType: "duration",
      quantityKind: "duration",
      semanticType: "duration",
      unitCode: undefined,
      unitScaleFactor: undefined,
      unitSystem: undefined,
    };
  }
  if (propertyType === "int64") {
    return { ...withoutUnit, noDataPolicy: "null", physicalType: "int64", semanticType: "measure" };
  }
  if (propertyType === "decimal") {
    return {
      ...withoutUnit,
      noDataPolicy: "null",
      physicalType: "decimal",
      precision: 18,
      roundingMode: "half_up",
      scale: 2,
      semanticType: "measure",
    };
  }
  return undefined;
}

function parseMetricType(value: string | null): ObjectMetricTypeV1 {
  return value === "derived" || value === "composite" ? value : "atomic";
}

function initialFormValues(metricType: ObjectMetricTypeV1): Partial<FormValues> {
  const isAtomic = metricType === "atomic";
  return {
    aggregation: "count_rows",
    analysisDimensions: [],
    calculationScope: "object_set",
    code: "",
    description: "",
    grainPolicy: "same_grain",
    groupByDimensions: [],
    logicPropertyEnabled: false,
    name: "",
    noDataPolicy: "zero",
    nullPolicy: "propagate",
    physicalType: isAtomic ? "int64" : "decimal",
    precision: isAtomic ? undefined : 18,
    quantityKind: isAtomic ? "count" : undefined,
    resultSetPolicy: "intersection",
    roundingMode: isAtomic ? undefined : "half_up",
    scale: isAtomic ? undefined : 2,
    semanticType: isAtomic ? "count" : "measure",
    timeAlignment: "same_time_window",
    timeDimensions: [],
    timeWindowMode: metricType === "derived" ? "unbounded" : undefined,
    unitCode: isAtomic ? "1" : undefined,
    unitScaleFactor: 1,
    unitSystem: isAtomic ? "UCUM" : undefined,
    zeroDivisionPolicy: "unavailable",
  };
}

function propertyRef(ownerObjectTypeId: string, propertyName: string): ObjectMetricPropertyRefV1 {
  return { object_type_id: ownerObjectTypeId, property_name: propertyName };
}

function propertyName(ref?: ObjectMetricPropertyRefV1) {
  return ref?.property_name;
}

function sanitizeAiCondition(
  condition: ObjectMetricConditionV1 | undefined,
  ownerObjectTypeId: string,
  allowedProperties: Set<string>,
): ObjectMetricConditionV1 | undefined {
  if (!condition || typeof condition !== "object") return undefined;
  if (condition.node_type === "group") {
    if (!Array.isArray(condition.children)) return undefined;
    const children = condition.children.flatMap((child) => {
      const next = sanitizeAiCondition(child, ownerObjectTypeId, allowedProperties);
      return next ? [next] : [];
    });
    if (!children.length) return undefined;
    return { ...condition, children };
  }
  if (
    condition.node_type !== "predicate" ||
    !condition.left ||
    condition.left.source !== "property" ||
    !condition.left.property_ref?.property_name ||
    !allowedProperties.has(condition.left.property_ref.property_name)
  ) {
    return undefined;
  }
  return {
    ...condition,
    left: {
      source: "property",
      property_ref: propertyRef(ownerObjectTypeId, condition.left.property_ref.property_name),
    },
  };
}

function sanitizeAiExpression(
  expression: ObjectMetricExpressionV1 | undefined,
  ownerObjectTypeId: string,
  allowedProperties: Set<string>,
  allowedDependencyAliases?: Set<string>,
): ObjectMetricExpressionV1 | undefined {
  if (!expression || typeof expression !== "object" || !("node_type" in expression)) {
    return undefined;
  }
  if (expression.node_type === "property") {
    if (!allowedProperties.has(expression.property_ref.property_name)) return undefined;
    return {
      ...expression,
      property_ref: propertyRef(ownerObjectTypeId, expression.property_ref.property_name),
    };
  }
  if (expression.node_type === "dependency") {
    return allowedDependencyAliases?.has(expression.dependency_alias) ? expression : undefined;
  }
  if (expression.node_type === "literal") return expression;
  if (expression.node_type === "unary") {
    const left = sanitizeAiExpression(
      expression.left,
      ownerObjectTypeId,
      allowedProperties,
      allowedDependencyAliases,
    );
    return left ? { ...expression, left } : undefined;
  }
  if (expression.node_type === "binary") {
    const left = sanitizeAiExpression(
      expression.left,
      ownerObjectTypeId,
      allowedProperties,
      allowedDependencyAliases,
    );
    const right = sanitizeAiExpression(
      expression.right,
      ownerObjectTypeId,
      allowedProperties,
      allowedDependencyAliases,
    );
    return left && right ? { ...expression, left, right } : undefined;
  }
  if (expression.node_type !== "call" || !Array.isArray(expression.arguments)) return undefined;
  const arguments_ = expression.arguments.flatMap((argument) => {
    const next = sanitizeAiExpression(
      argument,
      ownerObjectTypeId,
      allowedProperties,
      allowedDependencyAliases,
    );
    return next ? [next] : [];
  });
  return arguments_.length === expression.arguments.length
    ? { ...expression, arguments: arguments_ }
    : undefined;
}

function dependencyKey(metricId: string, version: number) {
  return `${metricId}@${version}`;
}

function parseDependencyKey(value?: string) {
  const [metric_id = "", version = "1"] = (value ?? "").split("@");
  return { metric_id, version: Number(version) || 1 };
}

function renameDependencyAlias(
  expression: ObjectMetricExpressionV1,
  previous: string,
  next: string,
): ObjectMetricExpressionV1 {
  if (expression.node_type === "dependency") {
    return expression.dependency_alias === previous
      ? { ...expression, dependency_alias: next }
      : expression;
  }
  if (expression.node_type === "binary") {
    return {
      ...expression,
      left: renameDependencyAlias(expression.left, previous, next),
      right: renameDependencyAlias(expression.right, previous, next),
    };
  }
  if (expression.node_type === "unary") {
    return { ...expression, left: renameDependencyAlias(expression.left, previous, next) };
  }
  if (expression.node_type === "call") {
    return {
      ...expression,
      arguments: expression.arguments.map((item) => renameDependencyAlias(item, previous, next)),
    };
  }
  return expression;
}

function expressionReferencesDependencyAlias(
  expression: ObjectMetricExpressionV1,
  alias: string,
): boolean {
  if (expression.node_type === "dependency") return expression.dependency_alias === alias;
  if (expression.node_type === "binary") {
    return (
      expressionReferencesDependencyAlias(expression.left, alias) ||
      expressionReferencesDependencyAlias(expression.right, alias)
    );
  }
  if (expression.node_type === "unary") {
    return expressionReferencesDependencyAlias(expression.left, alias);
  }
  if (expression.node_type === "call") {
    return expression.arguments.some((item) => expressionReferencesDependencyAlias(item, alias));
  }
  return false;
}

function defaultCompositeExpression(
  dependencies: ObjectMetricDependencyV1[],
): ObjectMetricExpressionV1 {
  if (dependencies.length < 2) {
    return { node_type: "literal", value: 0, value_type: "decimal" };
  }
  return {
    left: { dependency_alias: dependencies[0].alias, node_type: "dependency" },
    node_type: "binary",
    operator: "add",
    right: { dependency_alias: dependencies[1].alias, node_type: "dependency" },
  };
}

function dependencyFilterContext(
  mode: "inherit" | "remove_dimension_filter",
  current: ObjectMetricDependencyV1["evaluation_context"]["filter_context"],
  ownerObjectTypeId: string,
  defaultPropertyName: string,
): ObjectMetricDependencyV1["evaluation_context"]["filter_context"] {
  if (mode === "inherit") return { mode };
  return {
    dimension:
      "dimension" in current
        ? current.dimension
        : propertyRef(ownerObjectTypeId, defaultPropertyName),
    mode,
  };
}

function formValuesFromDefinition(definition: ObjectMetricDefinitionV1): Partial<FormValues> {
  const value = definition.result_semantics.value;
  const grain = definition.result_semantics.statistical_grain;
  const common: Partial<FormValues> = {
    analysisDimensions: definition.query_capabilities.analysis_dimensions.map(
      (item) => item.property_name,
    ),
    calculationScope: definition.calculation_scope,
    code: definition.code,
    description: definition.description,
    groupByDimensions: grain.group_by_dimensions.map((item) => item.property_name),
    grainWeekStart: grain.week_start,
    maximum: value.maximum,
    minimum: value.minimum,
    logicPropertyComment: definition.logic_property?.comment,
    logicPropertyDisplayName: definition.logic_property?.display_name,
    logicPropertyEnabled: Boolean(definition.logic_property),
    logicPropertyName: definition.logic_property?.property_name,
    name: definition.name,
    noDataPolicy: definition.result_semantics.no_data_policy,
    physicalType: value.physical_type,
    precision: value.precision,
    quantityKind: value.unit?.quantity_kind,
    roundingMode: value.rounding_mode,
    scale: value.scale,
    semanticType: value.semantic_type,
    timeDimensions: definition.query_capabilities.time_dimensions.map((item) => item.property_name),
    timeGranularity: grain.time_granularity,
    unitCode: value.unit?.code,
    unitScaleFactor: value.unit?.scale_factor,
    unitDenominatorCode: value.unit?.denominator?.code,
    unitDenominatorKind: value.unit?.denominator?.quantity_kind as Exclude<
      UnitQuantityKind,
      "rate"
    >,
    unitDenominatorSystem: value.unit?.denominator?.system,
    unitNumeratorCode: value.unit?.numerator?.code,
    unitNumeratorKind: value.unit?.numerator?.quantity_kind as Exclude<UnitQuantityKind, "rate">,
    unitNumeratorSystem: value.unit?.numerator?.system,
    unitSystem: value.unit?.system,
  };
  if (definition.specification.kind === "atomic") {
    common.aggregation = definition.specification.measure.aggregation;
  }
  if (definition.specification.kind === "derived") {
    const qualifiers = definition.specification.business_qualifiers;
    common.baseMetric = dependencyKey(
      definition.specification.base_metric.metric_id,
      definition.specification.base_metric.version,
    );
    common.eventTime = propertyName(qualifiers.event_time);
    common.relationCountComparison = qualifiers.relation_path?.count_comparison;
    common.relationCountThreshold = qualifiers.relation_path?.count_threshold;
    common.relationQuantifier = qualifiers.relation_path?.quantifier;
    common.fixedTimeRange =
      qualifiers.time_window?.mode === "fixed_range"
        ? [dayjs(qualifiers.time_window.start_at), dayjs(qualifiers.time_window.end_at)]
        : undefined;
    common.timeWindowLength =
      qualifiers.time_window?.mode === "rolling" ? qualifiers.time_window.length : undefined;
    common.timeWindowMode = objectMetricTimeWindowSelection(qualifiers.time_window) ?? "unbounded";
    common.timeWindowUnit =
      qualifiers.time_window?.mode === "rolling"
        ? qualifiers.time_window.unit
        : qualifiers.time_window?.mode === "calendar_period" ||
            qualifiers.time_window?.mode === "period_to_date"
          ? qualifiers.time_window.period
          : undefined;
    common.timezone =
      qualifiers.time_window?.mode === "rolling"
        ? qualifiers.time_window.timezone
        : qualifiers.time_window?.mode === "calendar_period" ||
            qualifiers.time_window?.mode === "period_to_date" ||
            qualifiers.time_window?.mode === "fixed_range"
          ? qualifiers.time_window.timezone
          : undefined;
    common.weekStart =
      qualifiers.time_window?.mode === "calendar_period" ||
      qualifiers.time_window?.mode === "period_to_date"
        ? qualifiers.time_window.week_start
        : undefined;
  }
  if (definition.specification.kind === "composite") {
    common.alignmentTimeKey = propertyName(definition.specification.alignment.time_key);
    common.grainPolicy = definition.specification.alignment.grain_policy;
    common.primaryDependencyAlias = definition.specification.alignment.primary_dependency_alias;
    common.resultSetPolicy = definition.specification.alignment.result_set_policy;
    common.timeAlignment = definition.specification.alignment.time_alignment;
    common.nullPolicy = definition.specification.null_policy;
    common.zeroDivisionPolicy = definition.specification.zero_division_policy;
  }
  return common;
}

function Section({
  children,
  title,
  tooltip,
}: {
  children: React.ReactNode;
  title: string;
  tooltip?: string;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>
        <h2>{title}</h2>
        {tooltip ? <HelpTooltip label={title} title={tooltip} /> : null}
      </div>
      {children}
    </section>
  );
}

function HelpTooltip({ label, title }: { label: string; title: string }) {
  return (
    <Tooltip title={title}>
      <Button
        aria-label={objectMetricText("mc55fe58f16e2", { p0: label })}
        className={styles.helpButton}
        icon={<QuestionCircleOutlined aria-hidden="true" />}
        size="small"
        type="text"
      />
    </Tooltip>
  );
}

export function ObjectMetricFormScene({ mode }: { mode: "create" | "edit" }) {
  useTranslation();
  const params = useParams<{ metricId: string; networkId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { message, runtimeConfig } = useAppServices();
  const networkId = params.networkId ?? "";
  const metricId = params.metricId;
  const requestedMetricType = parseMetricType(searchParams.get("metricType"));
  const requestedObjectTypeId = searchParams.get("objectTypeId") ?? "";
  const [form] = Form.useForm<FormValues>();
  const getFieldValue = <Key extends keyof FormValues>(name: Key): FormValues[Key] | undefined =>
    form.getFieldValue(name) as FormValues[Key] | undefined;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<ObjectMetricRecordV1>();
  const [loadError, setLoadError] = useState<"forbidden" | "not-found" | "unknown" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [relationTypes, setRelationTypes] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
  const [publishedMetrics, setPublishedMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [capabilities, setCapabilities] = useState<ObjectMetricCapabilitiesV1>();
  const [properties, setProperties] = useState<ObjectMetricExpressionPropertyOption[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [propertiesError, setPropertiesError] = useState(false);
  const [propertiesReloadKey, setPropertiesReloadKey] = useState(0);
  const [ownerObjectTypeDetail, setOwnerObjectTypeDetail] = useState<ObjectTypeDetail | null>();
  const [measureExpression, setMeasureExpression] = useState<ObjectMetricExpressionV1>({
    node_type: "literal",
    value: 0,
    value_type: "decimal",
  });
  const [atomicExpressionInteracted, setAtomicExpressionInteracted] = useState(false);
  const [businessCondition, setBusinessCondition] = useState<ObjectMetricConditionV1>();
  const [relatedCondition, setRelatedCondition] = useState<ObjectMetricConditionV1>();
  const [relationSteps, setRelationSteps] = useState<ObjectMetricRelationStepV1[]>([]);
  const [relatedProperties, setRelatedProperties] = useState<
    ObjectMetricExpressionPropertyOption[]
  >([]);
  const [dependencies, setDependencies] = useState<ObjectMetricDependencyV1[]>([]);
  const [compositeExpression, setCompositeExpression] = useState<ObjectMetricExpressionV1>({
    node_type: "literal",
    value: 0,
    value_type: "decimal",
  });
  const [formValidationIssueCount, setFormValidationIssueCount] = useState(0);
  const [validation, setValidation] = useState<ObjectMetricValidationResultV1>();
  const [preview, setPreview] = useState<ObjectMetricPreviewV1>();
  const [trialDefinition, setTrialDefinition] = useState<ObjectMetricDefinitionV1>();
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const aiAbortRef = useRef<AbortController | null>(null);
  const [aiConversation, setAiConversation] = useState<
    Array<{ content: string; id: string; role: "assistant" | "user"; tone?: "error" }>
  >([]);

  useEffect(
    () => () => {
      aiAbortRef.current?.abort();
    },
    [],
  );

  const definition = record?.definition;
  const metricType = definition?.metric_type ?? requestedMetricType;
  const ownerObjectTypeId = definition?.owner_object_type_id ?? requestedObjectTypeId;
  const ownerObjectType = objectTypes.find((item) => item.id === ownerObjectTypeId);
  const calculationScope = Form.useWatch("calculationScope", form);
  const aggregation = Form.useWatch("aggregation", form);
  const baseMetricKey = Form.useWatch("baseMetric", form);
  const timeGranularity = Form.useWatch("timeGranularity", form);
  const groupByDimensions = Form.useWatch("groupByDimensions", form);
  const logicPropertyEnabled = Form.useWatch("logicPropertyEnabled", form);
  const grainPolicy = Form.useWatch("grainPolicy", form);
  const relationCountComparison = Form.useWatch("relationCountComparison", form);
  const relationCountThreshold = Form.useWatch("relationCountThreshold", form);
  const relationQuantifier = Form.useWatch("relationQuantifier", form);
  const resultSetPolicy = Form.useWatch("resultSetPolicy", form);
  const eventTime = Form.useWatch("eventTime", form);
  const fixedTimeRange = Form.useWatch("fixedTimeRange", form);
  const timeWindowLength = Form.useWatch("timeWindowLength", form);
  const timeWindowMode = Form.useWatch("timeWindowMode", form);
  const timeWindowUnit = Form.useWatch("timeWindowUnit", form);
  const quantityKind = Form.useWatch("quantityKind", form);
  const physicalType = Form.useWatch("physicalType", form);
  const precision = Form.useWatch("precision", form);
  const roundingMode = Form.useWatch("roundingMode", form);
  const scale = Form.useWatch("scale", form);
  const semanticType = Form.useWatch("semanticType", form);
  const unitCode = Form.useWatch("unitCode", form);
  const unitScaleFactor = Form.useWatch("unitScaleFactor", form);
  const unitSystem = Form.useWatch("unitSystem", form);
  const hasCrossObjectDependency = dependencies.some(
    (dependency) => dependency.object_alignment.mode !== "same_object",
  );
  const clearUnsupportedCompositeTimeSeries = () => {
    form.setFieldsValue({
      alignmentTimeKey: undefined,
      grainWeekStart: undefined,
      timeGranularity: undefined,
    });
  };
  const outputShape =
    validation?.output_shape ??
    (calculationScope === "object_instance"
      ? "object_value"
      : timeGranularity
        ? "time_series"
        : (groupByDimensions?.length ?? 0) > 0
          ? "grouped"
          : "summary");
  // Older services may return `issues: null` for a successful validation. Treat it
  // as the empty collection so a server-side contract variation cannot crash the
  // authoring screen while a compatibility deployment is rolling out.
  const validationIssues = validation?.issues ?? [];
  const presentedValidationIssues = validationIssues.map((issue) =>
    presentObjectMetricValidationIssue(issue, { aggregation, calculationScope }),
  );
  const compatibleUnitOptions = objectMetricUnitOptions(semanticType, physicalType, {
    code: unitCode,
    quantityKind,
    scaleFactor: unitScaleFactor,
    system: unitSystem,
  });
  const unitSelectionLocked =
    objectMetricUnitSelectionLocked(semanticType) &&
    compatibleUnitOptions.length === 1 &&
    compatibleUnitOptions[0]?.code === unitCode;
  const requiresAtomicMeasureProperty =
    metricType === "atomic" && !(calculationScope === "object_set" && aggregation === "count_rows");
  const hasAtomicMeasureProperty = expressionReferencesProperty(measureExpression);
  const applyValueSuggestion = (
    suggestion: Partial<FormValues> | undefined,
    forceSemanticType = false,
  ) => {
    if (!suggestion?.physicalType) return;
    const currentPhysicalType = form.getFieldValue("physicalType") as
      FormValues["physicalType"] | undefined;
    const currentSemanticType = form.getFieldValue("semanticType") as
      FormValues["semanticType"] | undefined;
    const preservesCurrentContract =
      !forceSemanticType &&
      currentPhysicalType === suggestion.physicalType &&
      currentSemanticType &&
      physicalTypesBySemanticType[currentSemanticType].includes(suggestion.physicalType);
    if (preservesCurrentContract) {
      form.setFieldValue("physicalType", suggestion.physicalType);
      return;
    }
    form.setFieldsValue(suggestion);
  };
  const canBuildDefinition = () => {
    if (mode === "edit" && !record) return false;
    if (propertiesLoading || propertiesError) {
      void message.error(objectMetricText("m46b0bf3afbc9"));
      return false;
    }
    if (requiresAtomicMeasureProperty && !hasAtomicMeasureProperty) {
      void message.error(objectMetricText("mfef679ae00cd"));
      return false;
    }
    return true;
  };
  const updateMeasureExpression = (next: ObjectMetricExpressionV1) => {
    setMeasureExpression(next);
    if (metricType !== "atomic") return;
    const suggestion = instanceValueSuggestion(next, properties, aggregation);
    applyValueSuggestion(
      suggestion,
      aggregation === "count_rows" || aggregation === "count" || aggregation === "count_distinct",
    );
  };

  const propertyOptions = properties.map((item) => ({
    label: item.label,
    value: item.propertyName,
  }));
  const selectedBaseMetric = publishedMetrics.find(
    (item) =>
      dependencyKey(item.definition.id, item.definition.version) === baseMetricKey &&
      item.definition.metric_type === "atomic",
  );
  const compatibleAtomicMetrics = publishedMetrics.filter(
    (item) =>
      item.definition.lifecycle.status === "published" &&
      item.definition.metric_type === "atomic" &&
      item.definition.owner_object_type_id === ownerObjectTypeId,
  );
  const selectBaseMetric = (key: string) => {
    const base = compatibleAtomicMetrics.find(
      (item) => dependencyKey(item.definition.id, item.definition.version) === key,
    );
    if (!base) return;
    const previousKey = baseMetricKey;
    const value = base.definition.result_semantics.value;
    setBusinessCondition(undefined);
    setRelatedCondition(undefined);
    setRelationSteps([]);
    setValidation(undefined);
    setPreview(undefined);
    form.setFieldsValue({
      analysisDimensions: [],
      calculationScope: base.definition.calculation_scope,
      eventTime: undefined,
      fixedTimeRange: undefined,
      grainWeekStart: undefined,
      groupByDimensions: [],
      maximum: value.maximum,
      minimum: value.minimum,
      noDataPolicy: base.definition.result_semantics.no_data_policy,
      physicalType: value.physical_type,
      precision: value.precision,
      quantityKind: value.unit?.quantity_kind,
      relationCountComparison: undefined,
      relationCountThreshold: undefined,
      relationQuantifier: undefined,
      roundingMode: value.rounding_mode,
      scale: value.scale,
      semanticType: value.semantic_type,
      timeDimensions: [],
      timeGranularity: undefined,
      timeWindowLength: undefined,
      timeWindowMode: "unbounded",
      timeWindowUnit: undefined,
      timezone: undefined,
      unitCode: value.unit?.code,
      unitDenominatorCode: value.unit?.denominator?.code,
      unitDenominatorKind: value.unit?.denominator?.quantity_kind as Exclude<
        UnitQuantityKind,
        "rate"
      >,
      unitDenominatorSystem: value.unit?.denominator?.system,
      unitNumeratorCode: value.unit?.numerator?.code,
      unitNumeratorKind: value.unit?.numerator?.quantity_kind as Exclude<UnitQuantityKind, "rate">,
      unitNumeratorSystem: value.unit?.numerator?.system,
      unitScaleFactor: value.unit?.scale_factor,
      unitSystem: value.unit?.system,
      weekStart: undefined,
    });
    if (previousKey && previousKey !== key) {
      void message.info(objectMetricText("mb11572e529d2"));
    }
  };
  const updateCompositeExpression = (next: ObjectMetricExpressionV1) => {
    setCompositeExpression(next);
    const dependencyTypes = Object.fromEntries(
      dependencies.flatMap((dependency) => {
        const selected = publishedMetrics.find(
          (item) =>
            item.definition.id === dependency.metric_ref.metric_id &&
            item.definition.version === dependency.metric_ref.version,
        );
        return selected
          ? [[dependency.alias, selected.definition.result_semantics.value.physical_type] as const]
          : [];
      }),
    ) as Record<string, ExpressionValueType>;
    const nextPhysicalType = expressionValueType(next, [], dependencyTypes);
    if (nextPhysicalType) applyValueSuggestion(valueSuggestionForPhysicalType(nextPhysicalType));
  };
  const applyAiIntent = (intent: ObjectMetricAiIntent) => {
    const allowedProperties = new Set(properties.map((item) => item.propertyName));
    const commonValues: Partial<FormValues> = {
      name: intent.name?.trim() || undefined,
      code: record ? undefined : intent.code?.trim() || undefined,
      description: intent.description?.trim() || undefined,
      calculationScope: metricType === "derived" ? undefined : intent.calculation_scope,
    };

    if (metricType === "atomic" && intent.atomic) {
      const nextAggregation = intent.atomic.aggregation ?? getFieldValue("aggregation");
      const nextExpression =
        sanitizeAiExpression(intent.atomic.expression, ownerObjectTypeId, allowedProperties) ??
        (intent.atomic.property_name && allowedProperties.has(intent.atomic.property_name)
          ? {
              node_type: "property" as const,
              property_ref: propertyRef(ownerObjectTypeId, intent.atomic.property_name),
            }
          : undefined);
      if (nextAggregation) commonValues.aggregation = nextAggregation;
      if (nextExpression) {
        setMeasureExpression(nextExpression);
        setAtomicExpressionInteracted(true);
        applyValueSuggestion(
          instanceValueSuggestion(nextExpression, properties, nextAggregation),
          nextAggregation === "count_rows" ||
            nextAggregation === "count" ||
            nextAggregation === "count_distinct",
        );
      }
    }

    if (metricType === "derived" && intent.derived) {
      const requestedVersion = intent.derived.base_metric_version;
      const base = compatibleAtomicMetrics.find(
        (item) =>
          (intent.derived?.base_metric_id
            ? item.definition.id === intent.derived.base_metric_id
            : item.definition.name === intent.derived?.base_metric_name) &&
          (!requestedVersion || item.definition.version === requestedVersion),
      );
      if (base) {
        const key = dependencyKey(base.definition.id, base.definition.version);
        commonValues.baseMetric = key;
        selectBaseMetric(key);
      }
      setBusinessCondition(
        sanitizeAiCondition(intent.derived.filters, ownerObjectTypeId, allowedProperties),
      );
      if (intent.derived.event_time && allowedProperties.has(intent.derived.event_time)) {
        commonValues.eventTime = intent.derived.event_time;
      }
      commonValues.timeWindowMode = intent.derived.time_window_mode;
      commonValues.timeWindowLength = intent.derived.time_window_length;
      commonValues.timeWindowUnit = intent.derived.time_window_unit;
    }

    if (metricType === "composite" && intent.composite) {
      const nextDependencies: ObjectMetricDependencyV1[] = (
        intent.composite.dependencies ?? []
      ).flatMap((requested) => {
        const selected = publishedMetrics.find(
          (item) =>
            (requested.metric_id
              ? item.definition.id === requested.metric_id
              : item.definition.name === requested.metric_name) &&
            (!requested.version || item.definition.version === requested.version) &&
            item.definition.owner_object_type_id === ownerObjectTypeId &&
            item.definition.calculation_scope ===
              (intent.calculation_scope ?? getFieldValue("calculationScope")),
        );
        if (!selected || !/^[a-z][a-z0-9_]*$/i.test(requested.alias)) return [];
        return [
          {
            alias: requested.alias,
            evaluation_context: { filter_context: { mode: "inherit" }, window: "inherited" },
            metric_ref: {
              metric_id: selected.definition.id,
              version: selected.definition.version,
            },
            object_alignment: { deduplication: "none", mode: "same_object" },
          },
        ];
      });
      if (nextDependencies.length) {
        setDependencies(nextDependencies);
        const nextExpression = sanitizeAiExpression(
          intent.composite.expression,
          ownerObjectTypeId,
          allowedProperties,
          new Set(nextDependencies.map((item) => item.alias)),
        );
        setCompositeExpression(nextExpression ?? defaultCompositeExpression(nextDependencies));
      }
    }

    const result = intent.result;
    if (result) {
      commonValues.noDataPolicy = result.no_data_policy;
      commonValues.physicalType = result.physical_type;
      commonValues.semanticType = result.semantic_type;
      commonValues.unitCode = result.unit_code;
      commonValues.unitSystem = result.unit_system;
      commonValues.quantityKind = result.quantity_kind;
      commonValues.unitScaleFactor = result.unit_code ? 1 : undefined;
      if (result.physical_type === "decimal") {
        commonValues.precision = 18;
        commonValues.scale = 2;
        commonValues.roundingMode = "half_up";
      }
    }

    const validPropertyList = (items?: string[]) =>
      items?.filter((item) => allowedProperties.has(item));
    if (intent.query) {
      commonValues.analysisDimensions = validPropertyList(intent.query.analysis_dimensions);
      commonValues.groupByDimensions = validPropertyList(intent.query.group_by_dimensions);
      commonValues.timeDimensions = validPropertyList(intent.query.time_dimensions);
      commonValues.timeGranularity = intent.query.time_granularity;
    }
    if (
      intent.logic_property &&
      (intent.calculation_scope ?? getFieldValue("calculationScope")) === "object_instance"
    ) {
      commonValues.logicPropertyEnabled = intent.logic_property.enabled;
      commonValues.logicPropertyName = intent.logic_property.property_name;
      commonValues.logicPropertyDisplayName = intent.logic_property.display_name;
      commonValues.logicPropertyComment = intent.logic_property.comment;
    }

    form.setFieldsValue(
      Object.fromEntries(Object.entries(commonValues).filter(([, value]) => value !== undefined)),
    );
    setFormValidationIssueCount(0);
    setValidation(undefined);
    setPreview(undefined);
  };

  const generateWithAi = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || aiGenerating) return;
    const turnId = `${Date.now()}`;
    setAiConversation((current) => [
      ...current,
      { content: prompt, id: `${turnId}-user`, role: "user" },
    ]);
    setAiPrompt("");
    setAiGenerating(true);
    const controller = new AbortController();
    aiAbortRef.current = controller;
    try {
      const tokenProvider = {
        getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
        refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
      };
      const intent = await generateObjectMetricAiIntent({
        context: {
          metricType,
          objectType: { id: ownerObjectTypeId, name: ownerObjectName },
          properties: properties.map((item) => ({
            label: item.label,
            name: item.propertyName,
            type: item.propertyType,
          })),
          publishedMetrics: publishedMetrics.map((item) => ({
            id: item.definition.id,
            name: item.definition.name,
            objectTypeId: item.definition.owner_object_type_id,
            scope: item.definition.calculation_scope,
            type: item.definition.metric_type,
            version: item.definition.version,
          })),
        },
        env: {
          base: typeof window === "undefined" ? "" : window.location.origin,
          knId: networkId,
          token: tokenProvider.getToken(),
        },
        prompt: objectMetricText("m0fa83749ec68", {
          p0: aiConversation.length
            ? objectMetricText("mb86e7d4fc5e1", {
                p0: aiConversation
                  .map((item) =>
                    objectMetricText("m3c4b7d4493c1", {
                      p0:
                        item.role === "user"
                          ? objectMetricText("m0d0e1a86b3aa")
                          : objectMetricText("me5ce5f6da7bd"),
                      p1: item.content,
                    }),
                  )
                  .join("\n"),
              })
            : "",
          p1: JSON.stringify(form.getFieldsValue(true)),
          p2: prompt,
        }),
        signal: controller.signal,
        tokenProvider,
      });
      if (controller.signal.aborted) return;
      applyAiIntent(intent);
      const notes = intent.notes?.filter(Boolean) ?? [];
      setAiConversation((current) => [
        ...current,
        {
          content: notes.length
            ? objectMetricText("m277d595bb888", { p0: notes.join("；") })
            : objectMetricText("mae87f64d5821"),
          id: `${turnId}-assistant`,
          role: "assistant",
        },
      ]);
    } catch (error) {
      if (controller.signal.aborted) {
        setAiConversation((current) => [
          ...current,
          {
            content: objectMetricText("m6f5dab617253"),
            id: `${turnId}-stopped`,
            role: "assistant",
          },
        ]);
        return;
      }
      setAiConversation((current) => [
        ...current,
        {
          content: error instanceof Error ? error.message : objectMetricText("mf6977fb2dfc0"),
          id: `${turnId}-error`,
          role: "assistant",
          tone: "error",
        },
      ]);
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
        setAiGenerating(false);
      }
    }
  };

  const stopAiGeneration = () => {
    aiAbortRef.current?.abort();
  };
  const derivedAnalysisNames = new Set(
    selectedBaseMetric?.definition.query_capabilities.analysis_dimensions.map(
      (item) => item.property_name,
    ) ?? [],
  );
  const derivedTimeNames = new Set(
    selectedBaseMetric?.definition.query_capabilities.time_dimensions.map(
      (item) => item.property_name,
    ) ?? [],
  );
  const resultPropertyOptions =
    metricType === "derived"
      ? propertyOptions.filter((item) => derivedAnalysisNames.has(item.value))
      : propertyOptions;
  const fixedGroupBy = new Set(groupByDimensions ?? []);
  const analysisPropertyOptions = resultPropertyOptions.filter(
    (item) => !fixedGroupBy.has(item.value),
  );
  const timePropertyOptions = properties
    .filter(
      (item) =>
        ["date", "datetime", "timestamp"].includes(item.propertyType ?? "") &&
        (metricType !== "derived" || derivedTimeNames.has(item.propertyName)),
    )
    .map((item) => ({ label: item.label, value: item.propertyName }));
  const selectedBaseDefinition = selectedBaseMetric?.definition;
  const selectedBaseAggregation =
    selectedBaseDefinition?.specification.kind === "atomic"
      ? selectedBaseDefinition.specification.measure.aggregation
      : undefined;
  const selectedBaseValue = selectedBaseDefinition?.result_semantics.value;
  const effectiveCalculationScope =
    metricType === "derived"
      ? (selectedBaseDefinition?.calculation_scope ?? calculationScope)
      : calculationScope;
  const canConfigureFixedResultGrain =
    metricType === "composite"
      ? calculationScope !== "object_instance"
      : metricType === "derived" && selectedBaseDefinition?.calculation_scope === "object_set";
  const relationPathLabel = relationSteps
    .map(
      (step) =>
        relationTypes.find((item) => item.id === step.relation_type_id)?.name ??
        step.relation_type_id,
    )
    .filter(Boolean)
    .join(" → ");
  const lastRelationStep = relationSteps.at(-1);
  const relationContinuationSourceObjectTypeId =
    lastRelationStep?.target_object_type_id || ownerObjectTypeId;
  const relationPreviousObjectTypeId = relationSteps.length
    ? relationSteps.length === 1
      ? ownerObjectTypeId
      : relationSteps.at(-2)?.target_object_type_id
    : undefined;
  const availableRelationContinuations = relationContinuationSourceObjectTypeId
    ? availableRelationTypesFrom(
        relationTypes,
        relationContinuationSourceObjectTypeId,
        relationPreviousObjectTypeId,
        lastRelationStep?.relation_type_id,
      )
    : [];
  const canAddRelationStep = relationSteps.length
    ? Boolean(lastRelationStep?.target_object_type_id && availableRelationContinuations.length > 0)
    : availableRelationContinuations.length > 0;
  const timeWindowPeriod = objectMetricTimeWindowPeriod(timeWindowMode);
  const timeWindowOptions: Array<{ label: string; value: ObjectMetricTimeWindowSelection }> = [
    { label: objectMetricText("mdc429a1d5381"), value: "unbounded" },
    { label: objectMetricText("m55f2da7177ff"), value: "rolling" },
    { label: objectMetricText("mb4c6c3eb0bce"), value: "current_week" },
    { label: objectMetricText("m0eeecd26f2ba"), value: "current_month" },
    { label: objectMetricText("mf142ffeef6d8"), value: "current_quarter" },
    { label: objectMetricText("m78ebb7f81db5"), value: "current_year" },
    { label: objectMetricText("mc708147495a5"), value: "fixed_range" },
  ];
  if (timeWindowMode && (timeWindowMode.startsWith("full_") || timeWindowMode === "current_day")) {
    timeWindowOptions.push({
      label: objectMetricText("md54367b76201", {
        p0:
          objectMetricTimeWindowBusinessLabel(timeWindowMode) ?? objectMetricText("m5a1f6f428efd"),
      }),
      value: timeWindowMode,
    });
  }
  const timeWindowLabel = (() => {
    if (!timeWindowMode || timeWindowMode === "unbounded") return undefined;
    const timeProperty = timePropertyOptions.find((item) => item.value === eventTime)?.label;
    const prefix = timeProperty
      ? objectMetricText("mf145846aa1ef", { p0: timeProperty })
      : objectMetricText("me0386bb310d5");
    if (timeWindowMode === "rolling") {
      const rollingUnit = timeWindowUnit
        ? rollingTimeUnitLabels[timeWindowUnit]
        : objectMetricText("m99bd7c9bcd7f");
      return objectMetricText("mb57a559179e5", {
        p0: prefix,
        p1: timeWindowLength ?? 30,
        p2: rollingUnit,
      });
    }
    if (timeWindowMode === "fixed_range") {
      return fixedTimeRange?.[0] && fixedTimeRange[1]
        ? objectMetricText("mf412ae95d897", {
            p0: prefix,
            p1: fixedTimeRange[0].format("YYYY-MM-DD HH:mm"),
            p2: fixedTimeRange[1].format("YYYY-MM-DD HH:mm"),
          })
        : undefined;
    }
    const periodLabel = objectMetricTimeWindowBusinessLabel(timeWindowMode);
    return periodLabel
      ? objectMetricText("mb0da3e3a8637", { p0: prefix, p1: periodLabel })
      : undefined;
  })();
  const hasCompleteBusinessCondition = conditionIsComplete(businessCondition);
  const hasCompleteRelationQualifier = Boolean(
    relationSteps.length > 0 &&
    relationSteps.every((step) => step.relation_type_id && step.target_object_type_id) &&
    relationQuantifier &&
    (relationQuantifier !== "count_compare" ||
      (relationCountComparison !== undefined && relationCountThreshold !== undefined)),
  );
  const hasLegacyRelationRule = Boolean(relationQuantifier && relationQuantifier !== "exists");
  const hasCompleteTimeWindow = Boolean(
    timeWindowMode &&
    timeWindowMode !== "unbounded" &&
    eventTime &&
    (timeWindowMode === "rolling"
      ? timeWindowLength && timeWindowUnit
      : timeWindowMode === "fixed_range"
        ? fixedTimeRange?.[0] &&
          fixedTimeRange[1] &&
          fixedTimeRange[0].valueOf() < fixedTimeRange[1].valueOf()
        : timeWindowPeriod),
  );
  const derivedQualifierSummaries = [
    hasCompleteBusinessCondition && businessCondition
      ? conditionSummary(businessCondition, properties)
      : undefined,
    hasCompleteRelationQualifier && relationQuantifier
      ? `${relationPathLabel || objectMetricText("m3db87a44ae00")}：${
          relationQuantifier === "exists"
            ? relatedCondition
              ? objectMetricText("md0c927ca64d6")
              : objectMetricText("m69087851bfff")
            : relationQuantifierLabels[relationQuantifier]
        }`
      : undefined,
    hasCompleteTimeWindow ? timeWindowLabel : undefined,
    canConfigureFixedResultGrain && groupByDimensions?.length
      ? objectMetricText("m9092ce372dbc", {
          p0: groupByDimensions
            .map((name) => propertyOptions.find((item) => item.value === name)?.label ?? name)
            .join("、"),
        })
      : undefined,
    canConfigureFixedResultGrain && timeGranularity && eventTime
      ? objectMetricText("m9d4f4092586c", {
          p0:
            timeUnitOptions.find((item) => item.value === timeGranularity)?.label ??
            timeGranularity,
        })
      : undefined,
  ].filter((item): item is string => Boolean(item));
  const hasDerivedQualifier = derivedQualifierSummaries.length > 0;
  const dependencyMetricOptionLabel = (record: ObjectMetricRecordV1) => {
    const definition = record.definition;
    const objectName =
      definition.owner_object_type_id === ownerObjectTypeId
        ? objectMetricText("m19fb5855ae0c")
        : (objectTypes.find((item) => item.id === definition.owner_object_type_id)?.name ??
          objectMetricText("m1b6beda9eeba"));
    return `${definition.name} · v${definition.version} · ${metricTypeLabels[definition.metric_type]} · ${objectName} · ${metricLifecycleStatusLabels[definition.lifecycle.status]}`;
  };
  const publishedOptions = publishedMetrics
    .filter(
      ({ definition: item }) =>
        item.lifecycle.status === "published" &&
        (!calculationScope ||
          (item.owner_object_type_id === ownerObjectTypeId
            ? item.calculation_scope === calculationScope
            : item.calculation_scope === "object_instance")),
    )
    .map((record) => ({
      label: dependencyMetricOptionLabel(record),
      value: dependencyKey(record.definition.id, record.definition.version),
    }));
  const selectedDependencyMetric = (dependency: ObjectMetricDependencyV1) =>
    publishedMetrics.find(
      (item) =>
        item.definition.id === dependency.metric_ref.metric_id &&
        item.definition.version === dependency.metric_ref.version,
    );
  const publishedOptionKeys = new Set(publishedOptions.map((item) => item.value));
  const dependencyOptions = [
    ...publishedOptions,
    ...dependencies.flatMap((dependency) => {
      if (!dependency.metric_ref.metric_id) return [];
      const value = dependencyKey(dependency.metric_ref.metric_id, dependency.metric_ref.version);
      if (publishedOptionKeys.has(value)) return [];
      const selected = selectedDependencyMetric(dependency);
      return [
        {
          disabled: true,
          label: selected
            ? dependencyMetricOptionLabel(selected)
            : objectMetricText("m82b3a1701feb", { p0: dependency.metric_ref.version }),
          value,
        },
      ];
    }),
  ];
  const dependencyMetricLabels = Object.fromEntries(
    dependencies.flatMap((dependency) => {
      const selected = selectedDependencyMetric(dependency);
      return selected ? [[dependency.alias, selected.definition.name]] : [];
    }),
  );
  const compositeBusinessFormula = expressionLabel(
    replaceObjectMetricDependencyAliases(compositeExpression, dependencyMetricLabels),
  );
  const compositeAlignmentSummaries = dependencies.flatMap((dependency) => {
    const selected = selectedDependencyMetric(dependency);
    if (!selected) return [];
    const metricName = selected.definition.name;
    const objectName =
      objectTypes.find((item) => item.id === selected.definition.owner_object_type_id)?.name ??
      objectMetricText("m1b6beda9eeba");
    const objectAlignment =
      dependency.object_alignment.mode === "same_object"
        ? objectMetricText("mc403e419e200", { p0: metricName })
        : dependency.object_alignment.mode === "related_object_set"
          ? objectMetricText("mab25bebbaef4", { p0: metricName, p1: objectName })
          : objectMetricText("m86aee4662324", { p0: metricName, p1: objectName });
    const windowAlignment =
      dependency.evaluation_context.window === "inherited"
        ? objectMetricText("m3872d2043ce5")
        : dependency.evaluation_context.window === "rolling"
          ? objectMetricText("m29017178bfa2")
          : objectMetricText("m358d86334bfb");
    return [`${objectAlignment}；${windowAlignment}`];
  });
  const dependencyAlignmentOptions = (
    dependency: ObjectMetricDependencyV1,
  ): Array<{ label: string; value: ObjectMetricObjectAlignmentV1["mode"] }> => {
    const selected = publishedMetrics.find(
      (item) =>
        item.definition.id === dependency.metric_ref.metric_id &&
        item.definition.version === dependency.metric_ref.version,
    );
    if (selected?.definition.owner_object_type_id === ownerObjectTypeId) {
      return [{ label: objectMetricText("m5949366ca6b4"), value: "same_object" as const }];
    }
    return calculationScope === "object_set"
      ? [
          { label: objectMetricText("m48173d9369fe"), value: "related_object_set" as const },
          { label: objectMetricText("m73cf37095088"), value: "related_object" as const },
        ]
      : [{ label: objectMetricText("m73cf37095088"), value: "related_object" as const }];
  };

  useEffect(() => {
    if (!networkId) return;
    let active = true;
    setLoadError(null);
    if (mode === "edit") setRecord(undefined);
    if (mode === "edit" && !metricId) {
      setLoadError("not-found");
      setLoading(false);
      return;
    }
    if (mode === "create") {
      form.setFieldsValue(initialFormValues(requestedMetricType));
      if (requestedMetricType === "atomic") {
        setMeasureExpression({
          node_type: "property",
          property_ref: propertyRef(requestedObjectTypeId, ""),
        });
      }
    }
    void (async () => {
      setLoading(true);
      try {
        const [objects, relations, metrics, registry] = await Promise.all([
          listKnowledgeNetworkObjectTypes(networkId).catch(() => []),
          listKnowledgeNetworkRelationTypes(networkId).catch(() => []),
          listObjectMetricsV1(networkId, { limit: 500, status: "published" }),
          getObjectMetricCapabilitiesV1(),
        ]);
        if (!active) return;
        setObjectTypes(objects);
        setRelationTypes(relations);
        setCapabilities(registry);
        let metricCatalog = metrics.entries;
        let nextRecord: ObjectMetricRecordV1 | undefined;
        if (mode === "edit" && metricId) {
          nextRecord = await getObjectMetricV1(networkId, metricId, undefined, {
            skipErrorToast: true,
          });
          if (["published", "deprecated"].includes(nextRecord.definition.lifecycle.status)) {
            void message.info(objectMetricText("m345e77bf06f8"));
            void navigate(
              `/knowledge-network/workspace/${networkId}/metrics/${nextRecord.definition.id}/detail`,
              { replace: true },
            );
            return;
          }
          if (!active) return;
          setRecord(nextRecord);
          form.setFieldsValue(formValuesFromDefinition(nextRecord.definition));
          if (nextRecord.definition.specification.kind === "atomic") {
            setMeasureExpression(
              nextRecord.definition.specification.measure.expression ?? {
                node_type: "literal",
                value: 0,
                value_type: "decimal",
              },
            );
          } else if (nextRecord.definition.specification.kind === "derived") {
            setBusinessCondition(nextRecord.definition.specification.business_qualifiers.filters);
            setRelatedCondition(
              nextRecord.definition.specification.business_qualifiers.relation_path
                ?.related_filters,
            );
            setRelationSteps(
              nextRecord.definition.specification.business_qualifiers.relation_path?.steps ?? [],
            );
          } else {
            setDependencies(nextRecord.definition.specification.dependencies);
            setCompositeExpression(nextRecord.definition.specification.expression);
          }
        }
        if (nextRecord) {
          const specification = nextRecord.definition.specification;
          const referencedMetrics =
            specification.kind === "derived"
              ? [specification.base_metric]
              : specification.kind === "composite"
                ? specification.dependencies.map((item) => item.metric_ref)
                : [];
          const loadedKeys = new Set(
            metricCatalog.map((item) => dependencyKey(item.definition.id, item.definition.version)),
          );
          const missingReferences = referencedMetrics.filter(
            (reference, index, references) =>
              Boolean(reference.metric_id) &&
              !loadedKeys.has(dependencyKey(reference.metric_id, reference.version)) &&
              references.findIndex(
                (item) =>
                  item.metric_id === reference.metric_id && item.version === reference.version,
              ) === index,
          );
          const resolvedReferences = await Promise.all(
            missingReferences.map((reference) =>
              getObjectMetricV1(networkId, reference.metric_id, reference.version).catch(
                () => undefined,
              ),
            ),
          );
          metricCatalog = [
            ...metricCatalog,
            ...resolvedReferences.filter((item): item is ObjectMetricRecordV1 => Boolean(item)),
          ];
        }
        if (active) setPublishedMetrics(metricCatalog);
      } catch (error) {
        if (active) {
          setLoadError(
            isRequestForbidden(error)
              ? "forbidden"
              : isRequestNotFound(error)
                ? "not-found"
                : "unknown",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    form,
    message,
    metricId,
    mode,
    navigate,
    networkId,
    requestedMetricType,
    requestedObjectTypeId,
    reloadKey,
  ]);

  useEffect(() => {
    if (!networkId || !ownerObjectTypeId) return;
    let active = true;
    setPropertiesLoading(true);
    setPropertiesError(false);
    setProperties([]);
    void (async () => {
      const detail = await getKnowledgeNetworkObjectTypeDetail(networkId, ownerObjectTypeId).catch(
        () => null,
      );
      if (!active) return;
      if (!detail) {
        setPropertiesError(true);
        setPropertiesLoading(false);
        return;
      }
      const items = (detail.dataProperties ?? []).map((item) => ({
        label: `${item.displayName || item.name} · ${item.name}`,
        objectTypeId: ownerObjectTypeId,
        propertyName: item.name,
        propertyType: item.type,
      }));
      setProperties(items);
      setOwnerObjectTypeDetail(detail);
      setPropertiesLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [networkId, ownerObjectTypeId, propertiesReloadKey]);

  useEffect(() => {
    if (
      metricType !== "composite" ||
      dependencies.length < 2 ||
      compositeExpression.node_type !== "literal"
    ) {
      return;
    }
    setCompositeExpression(defaultCompositeExpression(dependencies));
  }, [compositeExpression.node_type, dependencies, metricType]);

  useEffect(() => {
    if (metricType !== "composite") return;
    const dependencyValues = Object.fromEntries(
      dependencies.flatMap((dependency) => {
        const metric = publishedMetrics.find(
          (item) =>
            item.definition.id === dependency.metric_ref.metric_id &&
            item.definition.version === dependency.metric_ref.version,
        );
        return metric
          ? [[dependency.alias, metric.definition.result_semantics.value] as const]
          : [];
      }),
    );
    const inferred = inferCompositeExpressionValueV1(compositeExpression, dependencyValues);
    if (!inferred.physicalType) return;

    const currentSemanticType = form.getFieldValue("semanticType") as
      FormValues["semanticType"] | undefined;
    const inferredSemanticType = inferred.unit
      ? inferred.unit.quantity_kind === "count"
        ? "count"
        : inferred.unit.quantity_kind === "currency"
          ? "amount"
          : inferred.unit.quantity_kind === "duration"
            ? "duration"
            : currentSemanticType
      : inferred.unitKnown && inferred.physicalType === "decimal"
        ? "ratio"
        : currentSemanticType;
    const compatibleSemanticType =
      inferredSemanticType &&
      physicalTypesBySemanticType[inferredSemanticType].includes(inferred.physicalType)
        ? inferredSemanticType
        : "measure";
    const unit = inferred.unitKnown
      ? (inferred.unit ??
        (compatibleSemanticType === "ratio"
          ? {
              code: "1",
              quantity_kind: "dimensionless" as const,
              scale_factor: 1,
              system: "UCUM" as const,
            }
          : undefined))
      : undefined;
    form.setFieldsValue({
      physicalType: inferred.physicalType,
      precision: inferred.physicalType === "decimal" ? 18 : undefined,
      quantityKind: unit?.quantity_kind,
      roundingMode: inferred.physicalType === "decimal" ? "half_up" : undefined,
      scale: inferred.physicalType === "decimal" ? 2 : undefined,
      semanticType: compatibleSemanticType,
      unitCode: unit?.code,
      unitScaleFactor: unit?.scale_factor ?? 1,
      unitSystem: unit?.system,
    });
  }, [compositeExpression, dependencies, form, metricType, publishedMetrics]);

  useEffect(() => {
    if (metricType !== "derived" || !selectedBaseDefinition) return;
    const value = selectedBaseDefinition.result_semantics.value;
    form.setFieldsValue({
      calculationScope: selectedBaseDefinition.calculation_scope,
      maximum: value.maximum,
      minimum: value.minimum,
      physicalType: value.physical_type,
      precision: value.precision,
      quantityKind: value.unit?.quantity_kind,
      roundingMode: value.rounding_mode,
      scale: value.scale,
      semanticType: value.semantic_type,
      unitCode: value.unit?.code,
      unitDenominatorCode: value.unit?.denominator?.code,
      unitDenominatorKind: value.unit?.denominator?.quantity_kind as Exclude<
        UnitQuantityKind,
        "rate"
      >,
      unitDenominatorSystem: value.unit?.denominator?.system,
      unitNumeratorCode: value.unit?.numerator?.code,
      unitNumeratorKind: value.unit?.numerator?.quantity_kind as Exclude<UnitQuantityKind, "rate">,
      unitNumeratorSystem: value.unit?.numerator?.system,
      unitScaleFactor: value.unit?.scale_factor,
      unitSystem: value.unit?.system,
    });
  }, [form, metricType, selectedBaseDefinition]);

  useEffect(() => {
    if (relationSteps.length && !relationQuantifier) {
      form.setFieldValue("relationQuantifier", "exists");
    }
  }, [form, relationQuantifier, relationSteps.length]);

  useEffect(() => {
    if (metricType !== "derived" || calculationScope !== "object_instance") return;
    if (!timeGranularity && !(groupByDimensions?.length ?? 0)) return;
    form.setFieldsValue({
      eventTime: timeWindowMode && timeWindowMode !== "unbounded" ? eventTime : undefined,
      grainWeekStart: undefined,
      groupByDimensions: [],
      timeGranularity: undefined,
    });
    setValidation(undefined);
    setPreview(undefined);
  }, [
    calculationScope,
    eventTime,
    form,
    groupByDimensions,
    metricType,
    timeGranularity,
    timeWindowMode,
  ]);

  useEffect(() => {
    const relatedObjectTypeId = relationSteps.at(-1)?.target_object_type_id;
    if (!networkId || !relatedObjectTypeId) {
      setRelatedProperties([]);
      return;
    }
    let active = true;
    void getKnowledgeNetworkObjectTypeDetail(networkId, relatedObjectTypeId)
      .then((detail) => {
        if (!active) return;
        setRelatedProperties(
          (detail?.dataProperties ?? []).map((item) => ({
            label: `${item.displayName || item.name} · ${item.name}`,
            objectTypeId: relatedObjectTypeId,
            propertyName: item.name,
            propertyType: item.type,
          })),
        );
      })
      .catch(() => {
        if (active) setRelatedProperties([]);
      });
    return () => {
      active = false;
    };
  }, [networkId, relationSteps]);

  const buildDefinition = async (): Promise<ObjectMetricDefinitionV1> => {
    const values = await form.validateFields();
    const next = structuredClone(
      record?.definition ?? createObjectMetricDefinitionV1(metricType, ownerObjectTypeId),
    );
    const inheritedDerivedScope =
      metricType === "derived" ? selectedBaseDefinition?.calculation_scope : undefined;
    const nextCalculationScope = inheritedDerivedScope ?? values.calculationScope;
    const supportsFixedResultGrain =
      metricType !== "atomic" && nextCalculationScope !== "object_instance";
    next.name = values.name.trim();
    next.code = values.code?.trim() ?? "";
    next.description = values.description.trim();
    next.calculation_scope = nextCalculationScope;
    next.result_semantics = {
      no_data_policy: values.noDataPolicy,
      // 第一版不向业务用户开放不完整结果。任何数据源或分区执行失败时，
      // 都拒绝返回可能被误认为完整统计值的部分结果。
      partial_data_policy: "reject",
      statistical_grain: {
        group_by_dimensions: supportsFixedResultGrain
          ? (values.groupByDimensions ?? []).map((name) => propertyRef(ownerObjectTypeId, name))
          : [],
        time_granularity: supportsFixedResultGrain ? values.timeGranularity : undefined,
        timezone:
          !supportsFixedResultGrain || !values.timeGranularity ? undefined : defaultMetricTimezone,
        week_start:
          !supportsFixedResultGrain || values.timeGranularity !== "week" ? undefined : "monday",
      },
      value:
        metricType === "derived" && selectedBaseValue
          ? structuredClone(selectedBaseValue)
          : {
              maximum: values.maximum,
              minimum: values.minimum,
              physical_type: values.physicalType,
              precision: values.physicalType === "decimal" ? values.precision : undefined,
              rounding_mode: values.physicalType === "decimal" ? values.roundingMode : undefined,
              scale: values.physicalType === "decimal" ? values.scale : undefined,
              semantic_type: values.semanticType,
              unit:
                values.unitCode && values.unitSystem && values.quantityKind
                  ? {
                      code: values.unitCode,
                      numerator:
                        values.quantityKind === "rate" &&
                        values.unitNumeratorCode &&
                        values.unitNumeratorKind &&
                        values.unitNumeratorSystem
                          ? {
                              code: values.unitNumeratorCode,
                              quantity_kind: values.unitNumeratorKind,
                              scale_factor: 1,
                              system: values.unitNumeratorSystem,
                            }
                          : undefined,
                      denominator:
                        values.quantityKind === "rate" &&
                        values.unitDenominatorCode &&
                        values.unitDenominatorKind &&
                        values.unitDenominatorSystem
                          ? {
                              code: values.unitDenominatorCode,
                              quantity_kind: values.unitDenominatorKind,
                              scale_factor: 1,
                              system: values.unitDenominatorSystem,
                            }
                          : undefined,
                      quantity_kind: values.quantityKind,
                      scale_factor: values.unitScaleFactor ?? 1,
                      system: values.unitSystem,
                    }
                  : undefined,
            },
    };
    next.query_capabilities = objectMetricQueryCapabilities(
      ownerObjectTypeId,
      values.analysisDimensions,
      values.timeDimensions,
    );
    next.logic_property =
      nextCalculationScope === "object_instance" && values.logicPropertyEnabled
        ? {
            comment: values.logicPropertyComment?.trim() || undefined,
            display_name: values.logicPropertyDisplayName?.trim() ?? "",
            property_name: values.logicPropertyName?.trim() ?? "",
          }
        : undefined;
    if (metricType === "atomic") {
      next.specification = {
        kind: "atomic",
        measure: {
          aggregation:
            values.calculationScope === "object_instance" ? "identity" : values.aggregation,
          expression:
            values.aggregation === "count_rows" && values.calculationScope === "object_set"
              ? undefined
              : expressionWithDeclaredPropertyTypes(measureExpression, properties),
        },
      };
    } else if (metricType === "derived") {
      const timeWindow = buildObjectMetricTimeWindow({
        endAt: values.fixedTimeRange?.[1].valueOf(),
        length: values.timeWindowLength,
        selection: values.timeWindowMode,
        startAt: values.fixedTimeRange?.[0].valueOf(),
        timezone: defaultMetricTimezone,
        unit: values.timeWindowUnit,
        weekStart: "monday",
      });
      next.specification = {
        base_metric: parseDependencyKey(values.baseMetric),
        business_qualifiers: {
          event_time:
            values.eventTime && (timeWindow || (supportsFixedResultGrain && values.timeGranularity))
              ? propertyRef(ownerObjectTypeId, values.eventTime)
              : undefined,
          filters: businessCondition,
          relation_path:
            relationSteps.length && values.relationQuantifier
              ? {
                  alias: "business_relation",
                  cardinality_policy: "distinct_root",
                  count_comparison:
                    values.relationQuantifier === "count_compare"
                      ? values.relationCountComparison
                      : undefined,
                  count_threshold:
                    values.relationQuantifier === "count_compare"
                      ? values.relationCountThreshold
                      : undefined,
                  purpose: "qualify_root",
                  quantifier: values.relationQuantifier,
                  related_filters: relatedCondition,
                  steps: relationSteps,
                }
              : undefined,
          time_window: timeWindow,
        },
        kind: "derived",
      };
    } else {
      next.specification = {
        alignment: {
          grain_policy: values.grainPolicy ?? "same_grain",
          group_by_dimensions: next.result_semantics.statistical_grain.group_by_dimensions,
          primary_dependency_alias:
            values.resultSetPolicy === "preserve_primary_dependency"
              ? values.primaryDependencyAlias
              : undefined,
          result_owner_object_type_id: ownerObjectTypeId,
          result_set_policy: values.resultSetPolicy ?? "intersection",
          time_alignment: values.timeAlignment ?? "same_time_window",
          time_key: values.alignmentTimeKey
            ? propertyRef(ownerObjectTypeId, values.alignmentTimeKey)
            : undefined,
        },
        dependencies: dependencies.map((dependency) => {
          const windowSpec = dependency.evaluation_context.window_spec;
          const normalizedWindowSpec = (() => {
            if (!windowSpec || windowSpec.mode === "unbounded") return windowSpec;
            if (windowSpec.mode === "rolling") {
              return { ...windowSpec, timezone: defaultMetricTimezone };
            }
            if (windowSpec.mode === "fixed_range") {
              return { ...windowSpec, timezone: defaultMetricTimezone };
            }
            return {
              ...windowSpec,
              timezone: defaultMetricTimezone,
              week_start: windowSpec.period === "week" ? ("monday" as const) : undefined,
            };
          })();
          return {
            ...dependency,
            evaluation_context: {
              ...dependency.evaluation_context,
              window_spec: normalizedWindowSpec,
            },
            rollup_aggregation:
              dependency.object_alignment.mode === "same_object" &&
              (values.grainPolicy ?? "same_grain") === "same_grain"
                ? undefined
                : dependency.rollup_aggregation,
          };
        }),
        expression: compositeExpression,
        kind: "composite",
        null_policy: values.nullPolicy ?? "propagate",
        zero_division_policy: values.zeroDivisionPolicy ?? "unavailable",
      };
    }
    return next;
  };

  const buildCompleteDefinition = async (): Promise<ObjectMetricDefinitionV1 | undefined> => {
    try {
      const next = await buildDefinition();
      setFormValidationIssueCount(0);
      return next;
    } catch (error) {
      const issueCount = objectMetricFormErrorCount(error);
      if (!issueCount) throw error;
      setFormValidationIssueCount(issueCount);
      setValidation(undefined);
      return undefined;
    }
  };

  const save = async () => {
    if (!canBuildDefinition()) return undefined;
    const next = await buildCompleteDefinition();
    if (!next) return undefined;
    setSaving(true);
    try {
      const saved = record
        ? await updateObjectMetricDraftV1(networkId, record.definition.id, next)
        : await createObjectMetricDraftV1(networkId, next);
      if (saved) {
        setRecord(saved);
        void message.success(objectMetricText("med6341cbd511"));
        if (!record) {
          void navigate(
            `/knowledge-network/workspace/${networkId}/metrics/${saved.definition.id}/edit`,
            { replace: true },
          );
        }
      }
      return saved;
    } finally {
      setSaving(false);
    }
  };

  const validate = async () => {
    if (!canBuildDefinition()) return;
    setValidation(undefined);
    const next = await buildCompleteDefinition();
    if (!next) return;
    const result = await validateObjectMetricV1(networkId, next);
    setValidation(result);
    if (!result.valid) return;
    const saved = record
      ? await updateObjectMetricDraftV1(networkId, record.definition.id, next)
      : await createObjectMetricDraftV1(networkId, next);
    if (!saved) return;
    const validated = await validateObjectMetricVersionV1(
      networkId,
      saved.definition.id,
      saved.definition.version,
    );
    if (validated) {
      setRecord(validated);
      form.setFieldsValue(formValuesFromDefinition(validated.definition));
      if (!record) {
        void navigate(
          `/knowledge-network/workspace/${networkId}/metrics/${validated.definition.id}/edit`,
          { replace: true },
        );
      }
    }
    void message.success(objectMetricText("mb98ac5ead1a7"));
  };

  const openPreview = async () => {
    if (!canBuildDefinition()) return;
    const next = await buildCompleteDefinition();
    if (!next) return;
    setPreview(await previewObjectMetricV1(networkId, next));
  };

  const openTrial = async () => {
    if (!canBuildDefinition()) return;
    setValidation(undefined);
    const next = await buildCompleteDefinition();
    if (!next) return;
    const result = await validateObjectMetricV1(networkId, next);
    setValidation(result);
    if (!result.valid) return;
    setTrialDefinition(next);
  };

  const publish = async () => {
    setValidation(undefined);
    const saved = await save();
    if (!saved) return;
    const result = await validateObjectMetricV1(networkId, saved.definition);
    setValidation(result);
    if (!result.valid) return;
    const validated = await validateObjectMetricVersionV1(
      networkId,
      saved.definition.id,
      saved.definition.version,
    );
    await publishObjectMetricV1(
      networkId,
      validated?.definition.id ?? saved.definition.id,
      validated?.definition.version ?? saved.definition.version,
    );
    void message.success(objectMetricText("mbf73c8faca59"));
    void navigate(
      `/knowledge-network/workspace/${networkId}/metrics/${saved.definition.id}/detail`,
      { state: { justPublished: true } },
    );
  };

  if (loading)
    return (
      <div className={styles.page}>
        <Spin />
      </div>
    );
  if (mode === "edit" && !record) {
    return (
      <Result
        status={loadError === "forbidden" ? "403" : loadError === "not-found" ? "404" : "error"}
        title={
          loadError === "forbidden"
            ? objectMetricText("m2a9ed8385cd1")
            : loadError === "not-found"
              ? objectMetricText("mcbc612fb7c63")
              : objectMetricText("mb453a743a203")
        }
        subTitle={objectMetricText("m40f0ad99f292")}
        extra={
          <Space>
            <Button
              onClick={() => void navigate(`/knowledge-network/workspace/${networkId}/metrics`)}
            >
              {objectMetricText("m8d8251782181")}
            </Button>
            {loadError === "unknown" ? (
              <Button onClick={() => setReloadKey((value) => value + 1)} type="primary">
                {objectMetricText("mb8784c8dd563")}
              </Button>
            ) : null}
          </Space>
        }
      />
    );
  }
  if (!ownerObjectTypeId) {
    return (
      <Result
        status="warning"
        title={objectMetricText("m31ec9738ea7b")}
        subTitle={objectMetricText("mbe1539a3daff")}
        extra={
          <Button
            onClick={() => void navigate(`/knowledge-network/workspace/${networkId}/metrics`)}
            type="primary"
          >
            {objectMetricText("mcdfb4fd1b61d")}
          </Button>
        }
      />
    );
  }

  const metricTypeNames = {
    atomic: objectMetricText("me5675ba4c2fd"),
    composite: objectMetricText("m3e70c815f275"),
    derived: objectMetricText("me88b222ae28a"),
  };
  const ownerObjectName = ownerObjectType?.name ?? ownerObjectTypeId;
  const outputNames = {
    grouped: objectMetricText("m63a570e277c4"),
    object_value: objectMetricText("m63b7464d2a3f"),
    summary: objectMetricText("m887c0bab2e93"),
    time_series: objectMetricText("m523d11919689"),
  };
  const aiExamples =
    metricType === "atomic"
      ? [
          objectMetricText("maa59dfb26df4"),
          objectMetricText("me73d061bf548"),
          objectMetricText("m7ba5278750dc"),
        ]
      : metricType === "derived"
        ? [
            objectMetricText("m26c1d6f2523b"),
            objectMetricText("m8552028074d2"),
            objectMetricText("m9bdb41d25a11"),
          ]
        : [
            objectMetricText("m1d08faa33bfc"),
            objectMetricText("mf84b7b21ea55"),
            objectMetricText("me6c97a7d8a7c"),
          ];
  const aiGenerationSucceeded = aiConversation.some(
    (item) =>
      item.role === "assistant" && item.content.startsWith(objectMetricText("m93b79e40a429")),
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Button
          aria-label={objectMetricText("mcdfb4fd1b61d")}
          className={styles.backButton}
          icon={<LeftOutlined />}
          onClick={() => void navigate(`/knowledge-network/workspace/${networkId}/metrics`)}
          type="text"
        />
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>
            {record ? objectMetricText("m051836569928") : objectMetricText("m50ef2f4cf6a4")}
            {metricTypeNames[metricType]} · {ownerObjectName}
          </h1>
          <p className={styles.subtitle}>
            {metricType === "atomic"
              ? objectMetricText("m8a16c5f40c99")
              : objectMetricText("mb3ad01d53b9e")}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button icon={<ThunderboltOutlined />} onClick={() => setAiOpen(true)} type="primary">
            {objectMetricText("m7714c1cdc14a")}
          </Button>
        </div>
      </header>
      <div className={styles.body}>
        {propertiesError ? (
          <Alert
            description={objectMetricText("m8345f4c73446")}
            message={objectMetricText("m2b3e9803192c")}
            showIcon
            type="error"
            action={
              <Button onClick={() => setPropertiesReloadKey((value) => value + 1)} size="small">
                {objectMetricText("mb8784c8dd563")}
              </Button>
            }
          />
        ) : null}
        <Form
          className={styles.form}
          form={form}
          layout="vertical"
          onValuesChange={() => {
            setFormValidationIssueCount(0);
            setValidation(undefined);
            setPreview(undefined);
          }}
        >
          <Section title={objectMetricText("m15b0d75b1662")}>
            <div className={styles.grid2}>
              <Form.Item
                label={objectMetricText("m5fadf5e3e6a9")}
                name="name"
                rules={[{ required: true, message: objectMetricText("m4f3aafd2922b") }]}
              >
                <Input
                  maxLength={128}
                  placeholder={
                    metricType === "atomic"
                      ? calculationScope === "object_instance"
                        ? objectMetricText("m999909534bc6")
                        : objectMetricText("m10563427d63a")
                      : objectMetricText("m826f8d73782b")
                  }
                />
              </Form.Item>
              <Form.Item
                label={objectMetricText("m13700a34d7b3")}
                name="code"
                rules={[
                  {
                    pattern: /^[a-z][a-z0-9_]*$/,
                    message: objectMetricText("mb9eeaa34688d"),
                  },
                ]}
                tooltip={
                  metricType === "atomic"
                    ? objectMetricText("m50b12a6c63da")
                    : objectMetricText("m0ed0e30a33ce")
                }
              >
                <Input
                  autoComplete="off"
                  disabled={Boolean(record)}
                  placeholder={
                    metricType === "atomic"
                      ? calculationScope === "object_instance"
                        ? objectMetricText("m46cb4578ccda")
                        : objectMetricText("m9b146d55919f")
                      : objectMetricText("m4587b84e64ae")
                  }
                  spellCheck={false}
                />
              </Form.Item>
              <Form.Item
                className={styles.full}
                extra={metricType === "atomic" ? objectMetricText("m38858a833aef") : undefined}
                label={objectMetricText("m419eb90613fd")}
                name="description"
                rules={[{ required: true, message: objectMetricText("mf741bb6e021d") }]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder={
                    metricType === "atomic"
                      ? objectMetricText("md965eea2b982")
                      : objectMetricText("m1ed87cf29094")
                  }
                />
              </Form.Item>
            </div>
          </Section>

          <Section
            title={
              metricType === "derived"
                ? objectMetricText("me9820e0a2bfa")
                : objectMetricText("ma7d66d99c5ec")
            }
            tooltip={metricType === "derived" ? objectMetricText("m46b0eb4ce947") : undefined}
          >
            {metricType === "derived" ? (
              <>
                <Form.Item
                  label={objectMetricText("m4919ba2e9c0b")}
                  name="baseMetric"
                  rules={[{ required: true, message: objectMetricText("m9c96505c8b76") }]}
                >
                  <Select
                    notFoundContent={
                      compatibleAtomicMetrics.length
                        ? objectMetricText("mdeb8a04abe26")
                        : objectMetricText("m9d00ceba9472")
                    }
                    onChange={selectBaseMetric}
                    optionFilterProp="label"
                    options={compatibleAtomicMetrics.map(({ definition: item }) => ({
                      label: `${item.name} · v${item.version}`,
                      value: dependencyKey(item.id, item.version),
                    }))}
                    placeholder={objectMetricText("m49d82b057932")}
                    showSearch
                  />
                </Form.Item>
                <Form.Item hidden name="calculationScope">
                  <Input />
                </Form.Item>
                {!compatibleAtomicMetrics.length ? (
                  <Alert
                    description={objectMetricText("maaf65e7dd687")}
                    message={objectMetricText("md47b8b9dc87e")}
                    showIcon
                    type="info"
                  />
                ) : null}
                {selectedBaseDefinition && selectedBaseValue ? (
                  <div className={styles.inheritedContract}>
                    <div className={styles.inheritedContractHeader}>
                      <div>
                        <strong>{selectedBaseDefinition.name}</strong>
                        <span>
                          {objectMetricText("m6a342183b1b0")}
                          {selectedBaseDefinition.version}
                        </span>
                      </div>
                      {!isGeneratedMetricCode(selectedBaseDefinition.code) ? (
                        <Tag>{selectedBaseDefinition.code}</Tag>
                      ) : null}
                    </div>
                    <div className={styles.inheritedContractGrid}>
                      <div>
                        <span>{objectMetricText("m9d1c9c0a1780")}</span>
                        <strong>
                          {calculationScopeLabels[selectedBaseDefinition.calculation_scope]}
                        </strong>
                      </div>
                      <div>
                        <span>{objectMetricText("mf4b24b147909")}</span>
                        <strong>
                          {selectedBaseAggregation
                            ? aggregationLabels[selectedBaseAggregation]
                            : objectMetricText("m10de36a7014d")}
                        </strong>
                      </div>
                      <div>
                        <span>{objectMetricText("m6551b12a8b84")}</span>
                        <strong>
                          {semanticTypeOptions.find(
                            (item) => item.value === selectedBaseValue.semantic_type,
                          )?.label ?? selectedBaseValue.semantic_type}
                        </strong>
                      </div>
                      <div>
                        <span>{objectMetricText("m80b19d68b149")}</span>
                        <strong>
                          {selectedBaseValue.unit?.code ?? objectMetricText("m3be9bf13138e")}
                        </strong>
                      </div>
                    </div>
                    <p>
                      {selectedBaseDefinition.calculation_scope === "object_instance"
                        ? objectMetricText("mb11260bc678c")
                        : objectMetricText("m50cbde258a05")}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <Form.Item
                  className={styles.scopeField}
                  label={objectMetricText("ma923e53ba2d5")}
                  name="calculationScope"
                  tooltip={
                    metricType === "atomic"
                      ? objectMetricText("m9fd8d792ab65")
                      : objectMetricText("mb8d096f57bc7")
                  }
                >
                  <Radio.Group
                    className={styles.scopeGroup}
                    onChange={(event) => {
                      if (metricType === "composite") {
                        setDependencies((current) => {
                          const next: ObjectMetricDependencyV1[] = current.flatMap((dependency) => {
                            const selected = publishedMetrics.find(
                              (item) =>
                                item.definition.id === dependency.metric_ref.metric_id &&
                                item.definition.version === dependency.metric_ref.version,
                            );
                            if (!selected) return [];
                            const sameObject =
                              selected.definition.owner_object_type_id === ownerObjectTypeId;
                            if (
                              (sameObject &&
                                selected.definition.calculation_scope !== event.target.value) ||
                              (!sameObject &&
                                selected.definition.calculation_scope !== "object_instance")
                            ) {
                              return [];
                            }
                            const mode: ObjectMetricObjectAlignmentV1["mode"] = sameObject
                              ? "same_object"
                              : event.target.value === "object_set"
                                ? "related_object_set"
                                : "related_object";
                            return [
                              {
                                ...dependency,
                                object_alignment: {
                                  ...dependency.object_alignment,
                                  deduplication: sameObject ? "none" : "by_object_identity",
                                  mode,
                                  relation_path: sameObject
                                    ? undefined
                                    : dependency.object_alignment.relation_path,
                                  relationship_cardinality: sameObject
                                    ? undefined
                                    : mode === "related_object_set"
                                      ? "one_to_many"
                                      : "many_to_one",
                                },
                                rollup_aggregation:
                                  mode === "related_object_set" || grainPolicy === "rollup"
                                    ? (dependency.rollup_aggregation ?? "sum")
                                    : undefined,
                              },
                            ];
                          });
                          if (next.length !== current.length) {
                            setCompositeExpression(defaultCompositeExpression(next));
                            form.setFieldValue("primaryDependencyAlias", undefined);
                            void message.info(
                              objectMetricText("m20c6463a2da7", {
                                p0: current.length - next.length,
                              }),
                            );
                          }
                          return next;
                        });
                      }
                      if (event.target.value === "object_instance") {
                        form.setFieldsValue({
                          alignmentTimeKey: undefined,
                          grainPolicy: "same_grain",
                          groupByDimensions: [],
                          noDataPolicy: "null",
                          timeAlignment: "same_time_window",
                          timeGranularity: undefined,
                        });
                      }
                      if (metricType === "atomic") setAtomicExpressionInteracted(false);
                      if (metricType === "atomic" && event.target.value === "object_instance") {
                        form.setFieldsValue({
                          aggregation: "identity",
                          physicalType: undefined,
                          precision: undefined,
                          quantityKind: undefined,
                          roundingMode: undefined,
                          scale: undefined,
                          semanticType: undefined,
                          unitCode: undefined,
                          unitScaleFactor: undefined,
                          unitSystem: undefined,
                        });
                        if (measureExpression.node_type === "literal") {
                          setMeasureExpression({
                            node_type: "property",
                            property_ref: propertyRef(ownerObjectTypeId, ""),
                          });
                        }
                      } else if (
                        metricType === "atomic" &&
                        form.getFieldValue("aggregation") === "identity"
                      ) {
                        form.setFieldValue("aggregation", "count_rows");
                        form.setFieldsValue({
                          physicalType: "int64",
                          quantityKind: "count",
                          semanticType: "count",
                          unitCode: "1",
                          unitSystem: "UCUM",
                        });
                      }
                    }}
                  >
                    <Radio className={styles.scopeOption} value="object_instance">
                      <span className={styles.scopeOptionContent}>
                        <strong className={styles.scopeOptionTitle}>
                          {objectMetricText("mabe9d02781fc")}
                        </strong>
                        <span className={styles.scopeOptionDescription}>
                          {objectMetricText("mb96813e37eb9")}
                        </span>
                        <span className={styles.scopeOptionExample}>
                          {objectMetricText("m32d1a0eb2656")}
                        </span>
                      </span>
                    </Radio>
                    <Radio className={styles.scopeOption} value="object_set">
                      <span className={styles.scopeOptionContent}>
                        <strong className={styles.scopeOptionTitle}>
                          {objectMetricText("m9c51e86f9307")}
                        </strong>
                        <span className={styles.scopeOptionDescription}>
                          {metricType === "atomic"
                            ? objectMetricText("mce629b202a48")
                            : objectMetricText("ma093d92f2da5")}
                        </span>
                        <span className={styles.scopeOptionExample}>
                          {metricType === "atomic"
                            ? objectMetricText("me26cdf99b8a7")
                            : objectMetricText("m0dc2d63d582b")}
                        </span>
                      </span>
                    </Radio>
                  </Radio.Group>
                </Form.Item>
                <div className={styles.outputSummary}>
                  <span>
                    {metricType === "atomic"
                      ? objectMetricText("md16809473a31")
                      : objectMetricText("mac3b1f1a1611")}
                  </span>
                  <strong>{outputNames[outputShape]}</strong>
                </div>
              </>
            )}
          </Section>

          <Section
            title={
              metricType === "derived"
                ? objectMetricText("m79786328b3a7")
                : objectMetricText("maeb999515d25")
            }
            tooltip={
              metricType === "atomic"
                ? calculationScope === "object_instance"
                  ? objectMetricText("mf56efcaee393")
                  : objectMetricText("md4a65d30b01e")
                : metricType === "derived"
                  ? objectMetricText("md6af45998ee5")
                  : objectMetricText("m1c88a196f1e5")
            }
          >
            {metricType === "atomic" ? (
              <div className={styles.grid2}>
                {calculationScope !== "object_instance" ? (
                  <Form.Item
                    extra={aggregation ? atomicAggregationGuidance[aggregation] : undefined}
                    label={objectMetricText("mb17e03bc6bad")}
                    name="aggregation"
                    rules={[{ required: true, message: objectMetricText("mc2dcda28ea66") }]}
                    tooltip={objectMetricText("mfe11249e4b11")}
                  >
                    <Select
                      onChange={(aggregation: FormValues["aggregation"]) => {
                        const isCount =
                          aggregation === "count_rows" ||
                          aggregation === "count" ||
                          aggregation === "count_distinct";
                        applyValueSuggestion(
                          instanceValueSuggestion(measureExpression, properties, aggregation),
                          isCount,
                        );
                      }}
                      options={[
                        { label: objectMetricText("mc88821bc9355"), value: "count_rows" },
                        { label: objectMetricText("m42f96dcbed92"), value: "count" },
                        { label: objectMetricText("m92f727932d82"), value: "count_distinct" },
                        { label: objectMetricText("m4d3f0a6e432f"), value: "sum" },
                        { label: objectMetricText("m7b3b2b341884"), value: "avg" },
                        { label: objectMetricText("m7a2c98005c37"), value: "min" },
                        { label: objectMetricText("md856266eea4c"), value: "max" },
                      ].filter(
                        (item) =>
                          !capabilities ||
                          capabilities.aggregations.some((value) => value === item.value),
                      )}
                    />
                  </Form.Item>
                ) : null}
                {aggregation !== "count_rows" ? (
                  <div className={styles.full}>
                    <div className={styles.sectionTitle}>
                      <h3>
                        {calculationScope === "object_instance"
                          ? objectMetricText("mae25d81d750f")
                          : objectMetricText("m9935c5534c0d")}
                      </h3>
                      <HelpTooltip
                        label={
                          calculationScope === "object_instance"
                            ? objectMetricText("mae25d81d750f")
                            : objectMetricText("m9935c5534c0d")
                        }
                        title={
                          calculationScope === "object_instance"
                            ? objectMetricText("me490400910d6")
                            : objectMetricText("med64b62cd336")
                        }
                      />
                    </div>
                    <div className={styles.editorBox}>
                      {requiresAtomicMeasureProperty && propertiesLoading ? (
                        <Space size="small">
                          <Spin size="small" />
                          <span>{objectMetricText("mba3ef4c0763f")}</span>
                        </Space>
                      ) : requiresAtomicMeasureProperty && !properties.length ? (
                        <Alert
                          description={objectMetricText("m3276cb837889")}
                          message={objectMetricText("m6d93f88af148")}
                          showIcon
                          type="error"
                        />
                      ) : (
                        <AtomicInstanceExpressionBuilder
                          allowedFunctions={capabilities?.functions}
                          allowedOperators={capabilities?.expression_operators}
                          onChange={(next) => {
                            setAtomicExpressionInteracted(true);
                            updateMeasureExpression(next);
                          }}
                          properties={properties}
                          value={measureExpression}
                        />
                      )}
                    </div>
                    {requiresAtomicMeasureProperty && !hasAtomicMeasureProperty ? (
                      <Alert
                        className={styles.expressionIssue}
                        description={
                          atomicExpressionInteracted
                            ? objectMetricText("m360aa1f864e9")
                            : objectMetricText("mc7b974dcab96")
                        }
                        message={
                          atomicExpressionInteracted
                            ? objectMetricText("mef3f1cb3fcd8")
                            : objectMetricText("m1fd43c6f6310")
                        }
                        showIcon
                        type={atomicExpressionInteracted ? "warning" : "info"}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {metricType === "derived" ? (
              selectedBaseMetric ? (
                <div className={styles.derivedFlow}>
                  <Alert
                    className={styles.qualifierStatus}
                    description={
                      hasDerivedQualifier
                        ? objectMetricText("m04877d8ac4cb", {
                            p0: derivedQualifierSummaries.length,
                          })
                        : selectedBaseDefinition?.calculation_scope === "object_instance"
                          ? objectMetricText("m8fb551ae43b9")
                          : objectMetricText("m759cd4799d14")
                    }
                    message={
                      hasDerivedQualifier
                        ? objectMetricText("m6af7b015b79d")
                        : objectMetricText("m35375e17cc4f")
                    }
                    showIcon
                    type={hasDerivedQualifier ? "success" : "warning"}
                  />

                  <div className={styles.qualifierCard}>
                    <div className={styles.qualifierHeading}>
                      <span>1</span>
                      <div>
                        <h3>{objectMetricText("ma5e8d53d9876")}</h3>
                        <p>
                          {objectMetricText("m22bb45e08a49")}
                          {ownerObjectName}
                          {objectMetricText("m5e818337deeb")}
                        </p>
                      </div>
                      <Tag>{objectMetricText("m537352400c49")}</Tag>
                    </div>
                    <ObjectMetricConditionBuilder
                      allowedBooleanOperators={capabilities?.boolean_operators}
                      allowedComparisonOperators={capabilities?.comparison_operators}
                      onChange={setBusinessCondition}
                      properties={properties}
                      value={businessCondition}
                    />
                  </div>

                  <div className={styles.qualifierCard}>
                    <Form.Item hidden name="relationQuantifier">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="relationCountComparison">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="relationCountThreshold">
                      <InputNumber />
                    </Form.Item>
                    <div className={styles.qualifierHeading}>
                      <span>2</span>
                      <div>
                        <h3>{objectMetricText("m14abf2359755")}</h3>
                        <p>{objectMetricText("m4e5b4856e92a")}</p>
                      </div>
                      <Tag>{objectMetricText("m537352400c49")}</Tag>
                    </div>
                    {relationSteps.map((step, index) => {
                      const sourceObjectTypeId =
                        index === 0
                          ? ownerObjectTypeId
                          : relationSteps[index - 1].target_object_type_id;
                      const previousObjectTypeId =
                        index === 0
                          ? undefined
                          : index === 1
                            ? ownerObjectTypeId
                            : relationSteps[index - 2].target_object_type_id;
                      const available = availableRelationTypesFrom(
                        relationTypes,
                        sourceObjectTypeId,
                        previousObjectTypeId,
                        index === 0 ? undefined : relationSteps[index - 1].relation_type_id,
                      );
                      return (
                        <div
                          className={styles.relationStep}
                          key={`${step.relation_type_id}-${index}`}
                        >
                          <Tag>{index + 1}</Tag>
                          <Select
                            aria-label={objectMetricText("m74d1b07c2aa3", { p0: index + 1 })}
                            onChange={(relationTypeId) => {
                              const relation = relationTypes.find(
                                (item) => item.id === relationTypeId,
                              );
                              if (!relation) return;
                              const outgoing = relation.sourceObjectTypeId === sourceObjectTypeId;
                              const nextStep: ObjectMetricRelationStepV1 = {
                                direction: outgoing ? "outgoing" : "incoming",
                                relation_type_id: relation.id,
                                target_object_type_id: outgoing
                                  ? relation.targetObjectTypeId
                                  : relation.sourceObjectTypeId,
                              };
                              setRelationSteps((current) =>
                                current
                                  .map((item, itemIndex) => (itemIndex === index ? nextStep : item))
                                  .slice(0, index + 1),
                              );
                              setRelatedCondition(undefined);
                              form.setFieldsValue({
                                relationCountComparison: undefined,
                                relationCountThreshold: undefined,
                                relationQuantifier: "exists",
                              });
                            }}
                            options={available.map((item) => ({
                              label: item.name,
                              value: item.id,
                            }))}
                            placeholder={objectMetricText("m994d0853ef10")}
                            value={step.relation_type_id || undefined}
                          />
                          <span className={styles.relationTarget}>
                            →{" "}
                            {objectTypes.find((item) => item.id === step.target_object_type_id)
                              ?.name ?? objectMetricText("m5079d07a8554")}
                          </span>
                          <Button
                            aria-label={objectMetricText("md8db94640516", { p0: index + 1 })}
                            danger
                            icon={<DeleteOutlined aria-hidden="true" />}
                            onClick={() => {
                              setRelationSteps((current) => current.slice(0, index));
                              setRelatedCondition(undefined);
                              if (index === 0) {
                                form.setFieldsValue({
                                  relationCountComparison: undefined,
                                  relationCountThreshold: undefined,
                                  relationQuantifier: undefined,
                                });
                              }
                            }}
                            type="text"
                          />
                        </div>
                      );
                    })}
                    <Button
                      disabled={!canAddRelationStep}
                      icon={<PlusOutlined aria-hidden="true" />}
                      onClick={() =>
                        setRelationSteps((current) => [
                          ...current,
                          {
                            direction: "outgoing",
                            relation_type_id: "",
                            target_object_type_id: "",
                          },
                        ])
                      }
                      type="dashed"
                    >
                      {objectMetricText("m22c295f59271")}
                    </Button>
                    {lastRelationStep?.target_object_type_id && !canAddRelationStep ? (
                      <span className={styles.relationPathHint}>
                        {objectMetricText("m7c206c7867f0")}
                      </span>
                    ) : null}
                    {relationSteps.length && relatedProperties.length ? (
                      <div className={styles.relationConfiguration}>
                        {hasLegacyRelationRule && relationQuantifier ? (
                          <div className={styles.relationRuleSentence}>
                            <Tag>{objectMetricText("mf4fb8cc04dfb")}</Tag>
                            <span>
                              {objectMetricText("m4061607ab144")}
                              {relationQuantifierLabels[relationQuantifier]}
                              {objectMetricText("mdf286d746f86")}
                              <strong>
                                {objectTypes.find(
                                  (item) => item.id === relationSteps.at(-1)?.target_object_type_id,
                                )?.name ?? objectMetricText("mcc43dc69ae08")}
                              </strong>
                              。
                            </span>
                          </div>
                        ) : (
                          <p className={styles.relationAutomaticHint}>
                            {objectMetricText("mb6daf7c89039")}
                            {ownerObjectName}
                            {objectMetricText("m741f53ab3631")}
                          </p>
                        )}
                        {hasLegacyRelationRule && relationQuantifier ? (
                          <Alert
                            description={objectMetricText("mff9b85306df2")}
                            message={objectMetricText("mc5ece2837411", {
                              p0: relationQuantifierLabels[relationQuantifier],
                            })}
                            showIcon
                            type="info"
                          />
                        ) : null}
                        <ObjectMetricConditionBuilder
                          allowedBooleanOperators={capabilities?.boolean_operators}
                          allowedComparisonOperators={capabilities?.comparison_operators}
                          onChange={setRelatedCondition}
                          properties={relatedProperties}
                          value={relatedCondition}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.qualifierCard}>
                    <div className={styles.qualifierHeading}>
                      <span>3</span>
                      <div>
                        <h3>{objectMetricText("m07eb730af899")}</h3>
                        <p>{objectMetricText("me58563870371")}</p>
                      </div>
                      <Tag>{objectMetricText("m537352400c49")}</Tag>
                    </div>
                    <div className={styles.timeWindowGrid}>
                      <Form.Item label={objectMetricText("m80ee5ade8132")} name="timeWindowMode">
                        <Select
                          onChange={(mode: FormValues["timeWindowMode"]) => {
                            if (!mode || mode === "unbounded") {
                              form.setFieldsValue({
                                eventTime: timeGranularity ? eventTime : undefined,
                                fixedTimeRange: undefined,
                                timeWindowLength: undefined,
                                timeWindowUnit: undefined,
                                timezone: undefined,
                                weekStart: undefined,
                              });
                            } else {
                              const nextValues: Partial<FormValues> = {};
                              if (!eventTime && timePropertyOptions.length === 1) {
                                nextValues.eventTime = timePropertyOptions[0]?.value;
                              }
                              if (mode === "rolling") {
                                nextValues.fixedTimeRange = undefined;
                                nextValues.timeWindowLength = timeWindowLength ?? 30;
                                nextValues.timeWindowUnit = timeWindowUnit ?? "day";
                                nextValues.weekStart = undefined;
                              } else if (mode === "fixed_range") {
                                nextValues.timeWindowLength = undefined;
                                nextValues.timeWindowUnit = undefined;
                                nextValues.weekStart = undefined;
                              } else {
                                const period = objectMetricTimeWindowPeriod(mode);
                                nextValues.fixedTimeRange = undefined;
                                nextValues.timeWindowLength = undefined;
                                nextValues.timeWindowUnit = period;
                                nextValues.weekStart = period === "week" ? "monday" : undefined;
                              }
                              nextValues.timezone = defaultMetricTimezone;
                              form.setFieldsValue(nextValues);
                            }
                          }}
                          options={timeWindowOptions}
                          placeholder={objectMetricText("mdc429a1d5381")}
                        />
                      </Form.Item>
                      {(timeWindowMode && timeWindowMode !== "unbounded") || timeGranularity ? (
                        <Form.Item
                          label={
                            timeGranularity
                              ? objectMetricText("m7d5e7c7bcea6")
                              : objectMetricText("m499eb2a235de")
                          }
                          name="eventTime"
                          rules={[{ required: true, message: objectMetricText("m6c1dc7649906") }]}
                        >
                          <Select
                            options={timePropertyOptions}
                            placeholder={objectMetricText("m006ac9135d75")}
                          />
                        </Form.Item>
                      ) : null}
                      {timeWindowMode === "rolling" ? (
                        <Form.Item label={objectMetricText("mea12178e66cd")} required>
                          <div className={styles.rollingWindowControl}>
                            <span>{objectMetricText("m997a5e6e513f")}</span>
                            <Form.Item
                              name="timeWindowLength"
                              noStyle
                              rules={[
                                { required: true, message: objectMetricText("mbd4e7e999b6b") },
                              ]}
                            >
                              <InputNumber min={1} precision={0} />
                            </Form.Item>
                            <Form.Item
                              name="timeWindowUnit"
                              noStyle
                              rules={[
                                { required: true, message: objectMetricText("me389729df418") },
                              ]}
                            >
                              <Select options={[...timeUnitOptions]} />
                            </Form.Item>
                          </div>
                        </Form.Item>
                      ) : null}
                      {timeWindowMode === "fixed_range" ? (
                        <Form.Item
                          extra={objectMetricText("m5f42ef09875a")}
                          label={objectMetricText("mc95ff6b50078")}
                          name="fixedTimeRange"
                          rules={[{ required: true, message: objectMetricText("me28db81c3731") }]}
                        >
                          <DatePicker.RangePicker
                            format="YYYY-MM-DD HH:mm"
                            placeholder={[
                              objectMetricText("m6a9906c79f26"),
                              objectMetricText("mf50276449943"),
                            ]}
                            showTime
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                      ) : null}
                    </div>
                    {timeWindowMode && timeWindowMode !== "unbounded" ? (
                      <>
                        <div aria-live="polite" className={styles.timeWindowPreview}>
                          <span>{objectMetricText("ma17e39c40c62")}</span>
                          <strong>{timeWindowLabel ?? objectMetricText("m8c84513554d5")}</strong>
                          <small>
                            {objectMetricText("m122e141120bd")}
                            {timeWindowMode === "fixed_range"
                              ? objectMetricText("mea595b5cd6fb")
                              : objectMetricText("mca00485fdcfd")}
                            {timeWindowPeriod === "week" ? objectMetricText("mb47fc4bc3795") : ""}
                          </small>
                        </div>
                      </>
                    ) : null}
                    {((timeWindowMode && timeWindowMode !== "unbounded") || timeGranularity) &&
                    !timePropertyOptions.length ? (
                      <Alert
                        description={objectMetricText("medfc221d3390")}
                        message={objectMetricText("m7692663f41e1")}
                        showIcon
                        type="warning"
                      />
                    ) : null}
                  </div>

                  <div aria-live="polite" className={styles.definitionPreview}>
                    <div className={styles.definitionPreviewTitle}>
                      <strong>{objectMetricText("me566a8a69945")}</strong>
                      <span>{objectMetricText("mb8ee9bec6e3b")}</span>
                    </div>
                    <p>
                      {objectMetricText("m501e184c7e81")}
                      {selectedBaseDefinition?.name} v{selectedBaseDefinition?.version}”
                      {derivedQualifierSummaries.length
                        ? `，${derivedQualifierSummaries.join("；")}。`
                        : objectMetricText("m4d39fee53b2d")}
                    </p>
                    <p className={styles.technicalPreview}>
                      {objectMetricText("m55dc21e73831")}
                      {selectedBaseDefinition
                        ? calculationScopeLabels[selectedBaseDefinition.calculation_scope]
                        : "—"}
                      {objectMetricText("me13e2a0e8378")}
                      {selectedBaseAggregation
                        ? aggregationLabels[selectedBaseAggregation]
                        : objectMetricText("m10de36a7014d")}
                      {objectMetricText("m86aad48a82fb")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className={styles.guidedEmpty}>
                  <strong>{objectMetricText("m293a6721e7d0")}</strong>
                  <span>{objectMetricText("mf3a298338291")}</span>
                </div>
              )
            ) : null}

            {metricType === "composite" ? (
              <div className={styles.compositeFlow}>
                <div className={styles.qualifierCard}>
                  <div className={styles.qualifierHeading}>
                    <span>1</span>
                    <div>
                      <h3>{objectMetricText("m0c5f4f3ba24a")}</h3>
                      <p>{objectMetricText("m701146c5f12f")}</p>
                    </div>
                    <Tag
                      color={
                        dependencies.filter(selectedDependencyMetric).length >= 2
                          ? "success"
                          : "warning"
                      }
                    >
                      {objectMetricText("m4d26bc13c4df")}{" "}
                      {dependencies.filter(selectedDependencyMetric).length} / 2
                    </Tag>
                  </div>
                  {!publishedOptions.length ? (
                    <Alert
                      description={objectMetricText("m8ac5c335aec1")}
                      message={objectMetricText("m3e1ac4af86fd")}
                      showIcon
                      type="info"
                    />
                  ) : null}
                  {dependencies.map((dependency, index) => (
                    <div className={styles.dependencyRow} key={`${dependency.alias}-${index}`}>
                      <div className={styles.dependencyCardHeader}>
                        <div>
                          <span>
                            {objectMetricText("m776740486540")} {index + 1}
                          </span>
                          <strong>
                            {selectedDependencyMetric(dependency)?.definition.name ??
                              (dependency.metric_ref.metric_id
                                ? objectMetricText("ma651bcb613fe")
                                : objectMetricText("m0beef12b359d"))}
                          </strong>
                        </div>
                        <Button
                          aria-label={objectMetricText("m5e3791d6b67f", {
                            p0: dependency.alias || index + 1,
                          })}
                          danger
                          icon={<DeleteOutlined aria-hidden="true" />}
                          onClick={() => {
                            const referenced = expressionReferencesDependencyAlias(
                              compositeExpression,
                              dependency.alias,
                            );
                            setDependencies((current) => {
                              const next = current.filter((_, itemIndex) => itemIndex !== index);
                              if (referenced)
                                setCompositeExpression(defaultCompositeExpression(next));
                              return next;
                            });
                            if (getFieldValue("primaryDependencyAlias") === dependency.alias) {
                              form.setFieldValue("primaryDependencyAlias", undefined);
                            }
                            if (referenced) {
                              void message.info(objectMetricText("m21302c2230d1"));
                            }
                          }}
                          type="text"
                        />
                      </div>
                      <div className={styles.dependencyPrimaryFields}>
                        <label>
                          <span>{objectMetricText("ma6ace5b29ab9")}</span>
                          <Select
                            aria-label={objectMetricText("m40f7639b7cc9", { p0: index + 1 })}
                            onChange={(key) => {
                              const metricRef = parseDependencyKey(key);
                              const selectedMetric = publishedMetrics.find(
                                (item) =>
                                  item.definition.id === metricRef.metric_id &&
                                  item.definition.version === metricRef.version,
                              );
                              const sameObject =
                                selectedMetric?.definition.owner_object_type_id ===
                                ownerObjectTypeId;
                              const relatedMode =
                                calculationScope === "object_set"
                                  ? "related_object_set"
                                  : "related_object";
                              if (!sameObject) clearUnsupportedCompositeTimeSeries();
                              setDependencies((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        evaluation_context: {
                                          filter_context: { mode: "inherit" },
                                          window: "inherited",
                                        },
                                        metric_ref: metricRef,
                                        object_alignment: {
                                          deduplication: sameObject ? "none" : "by_object_identity",
                                          mode: sameObject ? "same_object" : relatedMode,
                                          relation_path: undefined,
                                          relationship_cardinality: sameObject
                                            ? undefined
                                            : relatedMode === "related_object_set"
                                              ? "one_to_many"
                                              : "many_to_one",
                                        },
                                        rollup_aggregation:
                                          (!sameObject && relatedMode === "related_object_set") ||
                                          grainPolicy === "rollup"
                                            ? "sum"
                                            : undefined,
                                      }
                                    : item,
                                ),
                              );
                            }}
                            optionFilterProp="label"
                            options={dependencyOptions}
                            placeholder={objectMetricText("m600842604da9")}
                            showSearch
                            value={
                              dependency.metric_ref.metric_id
                                ? dependencyKey(
                                    dependency.metric_ref.metric_id,
                                    dependency.metric_ref.version,
                                  )
                                : undefined
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {objectMetricText("m5de7f5e9ae00")}
                            <HelpTooltip
                              label={objectMetricText("m5de7f5e9ae00")}
                              title={objectMetricText("mad039f6c54a0")}
                            />
                          </span>
                          <Input
                            aria-label={objectMetricText("mf213f7f2f151", { p0: index + 1 })}
                            autoComplete="off"
                            onChange={(event) => {
                              const nextAlias = event.target.value;
                              const previousAlias = dependency.alias;
                              setDependencies((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, alias: nextAlias } : item,
                                ),
                              );
                              setCompositeExpression((current) =>
                                renameDependencyAlias(current, previousAlias, nextAlias),
                              );
                              if (getFieldValue("primaryDependencyAlias") === previousAlias) {
                                form.setFieldValue("primaryDependencyAlias", nextAlias);
                              }
                            }}
                            placeholder={objectMetricText("m236e81cac728")}
                            spellCheck={false}
                            value={dependency.alias}
                          />
                        </label>
                      </div>
                      {dependency.metric_ref.metric_id && !selectedDependencyMetric(dependency) ? (
                        <Alert
                          description={objectMetricText("m75c02af034c3")}
                          message={objectMetricText("m47caacfdb9f4")}
                          showIcon
                          type="error"
                        />
                      ) : null}
                      {selectedDependencyMetric(dependency) ? (
                        <div className={styles.dependencyContract}>
                          <div>
                            <span>{objectMetricText("mf36b90ed2a53")}</span>
                            <strong>
                              {objectTypes.find(
                                (item) =>
                                  item.id ===
                                  selectedDependencyMetric(dependency)?.definition
                                    .owner_object_type_id,
                              )?.name ?? objectMetricText("m19fb5855ae0c")}
                            </strong>
                          </div>
                          <div>
                            <span>{objectMetricText("m9d1c9c0a1780")}</span>
                            <strong>
                              {
                                calculationScopeLabels[
                                  selectedDependencyMetric(dependency)!.definition.calculation_scope
                                ]
                              }
                            </strong>
                          </div>
                          <div>
                            <span>{objectMetricText("m6551b12a8b84")}</span>
                            <strong>
                              {semanticTypeOptions.find(
                                (item) =>
                                  item.value ===
                                  selectedDependencyMetric(dependency)!.definition.result_semantics
                                    .value.semantic_type,
                              )?.label ?? objectMetricText("m2ba10dda19be")}
                            </strong>
                          </div>
                          <div>
                            <span>{objectMetricText("m80b19d68b149")}</span>
                            <strong>
                              {selectedDependencyMetric(dependency)!.definition.result_semantics
                                .value.unit?.code ?? objectMetricText("m3be9bf13138e")}
                            </strong>
                          </div>
                        </div>
                      ) : null}
                      {selectedDependencyMetric(dependency) ? (
                        <div className={styles.dependencyAlignmentSection}>
                          <div className={styles.dependencySubheading}>
                            <strong>{objectMetricText("m0fe7b9870d3e")}</strong>
                            <span>
                              {dependency.object_alignment.mode === "same_object"
                                ? objectMetricText("mb867bbb4c8db")
                                : objectMetricText("mb8778ccfb2a5")}
                            </span>
                          </div>
                          {dependency.object_alignment.mode === "same_object" ? (
                            <Alert
                              description={objectMetricText("md4f7dea4bd2d")}
                              message={objectMetricText("m5b51529d42f5")}
                              showIcon
                              type="success"
                            />
                          ) : (
                            <div className={styles.dependencyAlignmentChoice}>
                              <label>
                                <span>{objectMetricText("mc815120c6337")}</span>
                                <Select
                                  aria-label={objectMetricText("mdc57eff09546", { p0: index + 1 })}
                                  onChange={(mode: ObjectMetricObjectAlignmentV1["mode"]) => {
                                    if (mode !== "same_object")
                                      clearUnsupportedCompositeTimeSeries();
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              object_alignment: {
                                                ...item.object_alignment,
                                                deduplication:
                                                  mode === "same_object"
                                                    ? "none"
                                                    : "by_object_identity",
                                                mode,
                                                relation_path:
                                                  mode === "same_object"
                                                    ? undefined
                                                    : item.object_alignment.relation_path,
                                                relationship_cardinality:
                                                  mode === "same_object"
                                                    ? undefined
                                                    : mode === "related_object_set"
                                                      ? "one_to_many"
                                                      : "many_to_one",
                                              },
                                              rollup_aggregation:
                                                mode === "related_object_set" ||
                                                grainPolicy === "rollup"
                                                  ? (item.rollup_aggregation ?? "sum")
                                                  : undefined,
                                            }
                                          : item,
                                      ),
                                    );
                                  }}
                                  options={dependencyAlignmentOptions(dependency)}
                                  value={dependency.object_alignment.mode}
                                />
                              </label>
                              <Button
                                disabled={Boolean(
                                  dependency.object_alignment.relation_path?.length &&
                                  !dependency.object_alignment.relation_path.at(-1)
                                    ?.target_object_type_id,
                                )}
                                onClick={() =>
                                  setDependencies((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            object_alignment: {
                                              ...item.object_alignment,
                                              relation_path: [
                                                ...(item.object_alignment.relation_path ?? []),
                                                {
                                                  direction: "outgoing",
                                                  relation_type_id: "",
                                                  target_object_type_id: "",
                                                },
                                              ],
                                            },
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              >
                                {dependency.object_alignment.relation_path?.length
                                  ? objectMetricText("m471205a52beb", {
                                      p0: dependency.object_alignment.relation_path.length,
                                    })
                                  : objectMetricText("m342e100bad1e")}
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : null}
                      {dependency.object_alignment.mode !== "same_object" ? (
                        <div className={styles.dependencyPath}>
                          {(dependency.object_alignment.relation_path ?? []).map(
                            (step, stepIndex) => {
                              const sourceObjectTypeId =
                                stepIndex === 0
                                  ? ownerObjectTypeId
                                  : dependency.object_alignment.relation_path?.[stepIndex - 1]
                                      ?.target_object_type_id;
                              const available = relationTypes.filter(
                                (item) =>
                                  item.sourceObjectTypeId === sourceObjectTypeId ||
                                  item.targetObjectTypeId === sourceObjectTypeId,
                              );
                              return (
                                <Space key={`${stepIndex}-${step.relation_type_id}`} wrap>
                                  <Tag>{stepIndex + 1}</Tag>
                                  <Select
                                    onChange={(relationTypeId) => {
                                      const relation = relationTypes.find(
                                        (item) => item.id === relationTypeId,
                                      );
                                      if (!relation || !sourceObjectTypeId) return;
                                      const outgoing =
                                        relation.sourceObjectTypeId === sourceObjectTypeId;
                                      const nextStep: ObjectMetricRelationStepV1 = {
                                        direction: outgoing ? "outgoing" : "incoming",
                                        relation_type_id: relation.id,
                                        target_object_type_id: outgoing
                                          ? relation.targetObjectTypeId
                                          : relation.sourceObjectTypeId,
                                      };
                                      setDependencies((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                object_alignment: {
                                                  ...item.object_alignment,
                                                  relation_path: [
                                                    ...(item.object_alignment.relation_path ?? [])
                                                      .slice(0, stepIndex)
                                                      .map((existing) => existing),
                                                    nextStep,
                                                  ],
                                                },
                                              }
                                            : item,
                                        ),
                                      );
                                    }}
                                    options={available.map((item) => ({
                                      label: item.name,
                                      value: item.id,
                                    }))}
                                    placeholder={objectMetricText("m54a43c83f3d5")}
                                    value={step.relation_type_id || undefined}
                                    style={{ minWidth: 260 }}
                                  />
                                  <span>
                                    →{" "}
                                    {objectTypes.find(
                                      (item) => item.id === step.target_object_type_id,
                                    )?.name ?? step.target_object_type_id}
                                  </span>
                                  <Button
                                    aria-label={objectMetricText("m1fb65fe93c19", {
                                      p0: dependency.alias || index + 1,
                                      p1: stepIndex + 1,
                                    })}
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() =>
                                      setDependencies((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                object_alignment: {
                                                  ...item.object_alignment,
                                                  relation_path:
                                                    item.object_alignment.relation_path?.slice(
                                                      0,
                                                      stepIndex,
                                                    ),
                                                },
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    type="text"
                                  />
                                </Space>
                              );
                            },
                          )}
                          <span className={styles.sectionHint}>
                            {objectMetricText("mffa9c68eaa1d")}
                            {objectTypes.find(
                              (item) =>
                                item.id ===
                                selectedDependencyMetric(dependency)?.definition
                                  .owner_object_type_id,
                            )?.name ?? objectMetricText("ma18f086e3882")}
                          </span>
                        </div>
                      ) : null}
                      {selectedDependencyMetric(dependency) ? (
                        <div className={styles.dependencyTimeSection}>
                          <div className={styles.dependencySubheading}>
                            <strong>{objectMetricText("m84ea70c602bf")}</strong>
                            <span>{objectMetricText("md851e8f8e71b")}</span>
                          </div>
                          <label>
                            <span>{objectMetricText("ma757a2b18321")}</span>
                            <Select
                              aria-label={objectMetricText("m081318fd4fcd", { p0: index + 1 })}
                              onChange={(window) =>
                                setDependencies((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          evaluation_context: {
                                            ...item.evaluation_context,
                                            window,
                                            window_spec:
                                              window === "rolling"
                                                ? {
                                                    length: 1,
                                                    mode: "rolling",
                                                    timezone: defaultMetricTimezone,
                                                    unit: "day",
                                                  }
                                                : window === "calendar_to_date"
                                                  ? {
                                                      mode: "period_to_date",
                                                      period: "month",
                                                      timezone: defaultMetricTimezone,
                                                    }
                                                  : undefined,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              options={[
                                { label: objectMetricText("m1ac40aa12a05"), value: "inherited" },
                                { label: objectMetricText("m55f2da7177ff"), value: "rolling" },
                                {
                                  label: objectMetricText("mf1715ddd00d8"),
                                  value: "calendar_to_date",
                                },
                              ]}
                              value={dependency.evaluation_context.window}
                            />
                          </label>
                        </div>
                      ) : null}
                      {selectedDependencyMetric(dependency) ? (
                        <details className={styles.dependencyAdvanced}>
                          <summary>{objectMetricText("mee9a5fef6416")}</summary>
                          <p>{objectMetricText("m2b04df4b8e31")}</p>
                          <div className={styles.dependencyContext}>
                            {dependency.object_alignment.mode !== "same_object" ? (
                              <>
                                <span className={styles.sectionHint}>
                                  {objectMetricText("m2b8a7ee8d986")}
                                </span>
                                <Select
                                  onChange={(relationship_cardinality) =>
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              object_alignment: {
                                                ...item.object_alignment,
                                                relationship_cardinality,
                                              },
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  options={
                                    dependency.object_alignment.mode === "related_object"
                                      ? [
                                          {
                                            label: objectMetricText("m0cc998eed7dd"),
                                            value: "one_to_one",
                                          },
                                          {
                                            label: objectMetricText("m90e4a2a6f194"),
                                            value: "many_to_one",
                                          },
                                        ]
                                      : [
                                          {
                                            label: objectMetricText("me019a8f8bfc7"),
                                            value: "one_to_many",
                                          },
                                          {
                                            label: objectMetricText("mb50a3fb1df3a"),
                                            value: "many_to_many",
                                          },
                                        ]
                                  }
                                  value={dependency.object_alignment.relationship_cardinality}
                                  style={{ width: 130 }}
                                />
                                <span className={styles.sectionHint}>
                                  {objectMetricText("m0488af93b4dc")}
                                </span>
                                <Select
                                  disabled={
                                    dependency.object_alignment.mode === "related_object_set"
                                  }
                                  onChange={(deduplication) =>
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              object_alignment: {
                                                ...item.object_alignment,
                                                deduplication,
                                              },
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  options={[
                                    { label: objectMetricText("m670ec25af841"), value: "none" },
                                    {
                                      label: objectMetricText("m3ed9651ecb2d"),
                                      value: "by_object_identity",
                                    },
                                  ]}
                                  value={dependency.object_alignment.deduplication}
                                  style={{ width: 170 }}
                                />
                              </>
                            ) : null}
                            {dependency.object_alignment.mode === "related_object_set" ||
                            grainPolicy === "rollup" ? (
                              <>
                                <span className={styles.sectionHint}>
                                  {objectMetricText("m03a815e81997")}
                                </span>
                                <Select
                                  onChange={(rollup_aggregation) =>
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, rollup_aggregation }
                                          : item,
                                      ),
                                    )
                                  }
                                  options={[
                                    { label: objectMetricText("m2819237ddb01"), value: "sum" },
                                    { label: objectMetricText("mdb7538b96322"), value: "avg" },
                                    { label: objectMetricText("mb2dcdcfabb6a"), value: "min" },
                                    { label: objectMetricText("m1e7a22820768"), value: "max" },
                                    { label: objectMetricText("m21179deb9a74"), value: "count" },
                                    {
                                      label: objectMetricText("m1e96cd1f49bf"),
                                      value: "count_distinct",
                                    },
                                  ]}
                                  placeholder={objectMetricText("m1263b1820b3e")}
                                  value={dependency.rollup_aggregation}
                                  style={{ width: 170 }}
                                />
                              </>
                            ) : null}
                            {dependency.evaluation_context.window === "rolling" &&
                            dependency.evaluation_context.window_spec?.mode === "rolling" ? (
                              <>
                                <span className={styles.sectionHint}>
                                  {objectMetricText("mac004ae1635a")}
                                </span>
                                <InputNumber
                                  min={1}
                                  onChange={(length) =>
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index &&
                                        item.evaluation_context.window_spec?.mode === "rolling"
                                          ? {
                                              ...item,
                                              evaluation_context: {
                                                ...item.evaluation_context,
                                                window_spec: {
                                                  ...item.evaluation_context.window_spec,
                                                  length: length ?? 1,
                                                },
                                              },
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  value={dependency.evaluation_context.window_spec.length}
                                />
                                <Select
                                  onChange={(unit) =>
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index &&
                                        item.evaluation_context.window_spec?.mode === "rolling"
                                          ? {
                                              ...item,
                                              evaluation_context: {
                                                ...item.evaluation_context,
                                                window_spec: {
                                                  ...item.evaluation_context.window_spec,
                                                  unit,
                                                },
                                              },
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  options={[...timeUnitOptions]}
                                  value={dependency.evaluation_context.window_spec.unit}
                                  style={{ width: 120 }}
                                />
                              </>
                            ) : null}
                            {dependency.evaluation_context.window === "calendar_to_date" &&
                            dependency.evaluation_context.window_spec?.mode === "period_to_date" ? (
                              <>
                                <span className={styles.sectionHint}>
                                  {objectMetricText("mac21fba0bb58")}
                                </span>
                                <Select
                                  onChange={(period) =>
                                    setDependencies((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index &&
                                        item.evaluation_context.window_spec?.mode ===
                                          "period_to_date"
                                          ? {
                                              ...item,
                                              evaluation_context: {
                                                ...item.evaluation_context,
                                                window_spec: {
                                                  ...item.evaluation_context.window_spec,
                                                  period,
                                                  week_start:
                                                    period === "week" ? "monday" : undefined,
                                                  timezone: defaultMetricTimezone,
                                                },
                                              },
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  options={timeUnitOptions.filter(
                                    (item) => !["minute", "hour"].includes(item.value),
                                  )}
                                  value={dependency.evaluation_context.window_spec.period}
                                  style={{ width: 120 }}
                                />
                              </>
                            ) : null}
                            <span className={styles.sectionHint}>
                              {objectMetricText("mc660f4d82b0f")}
                            </span>
                            <Select
                              onChange={(mode) =>
                                setDependencies((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          evaluation_context: {
                                            ...item.evaluation_context,
                                            filter_context: dependencyFilterContext(
                                              mode,
                                              item.evaluation_context.filter_context,
                                              ownerObjectTypeId,
                                              properties[0]?.propertyName ?? "",
                                            ),
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              options={[
                                { label: objectMetricText("m16cb1eb3e3d5"), value: "inherit" },
                                {
                                  label: objectMetricText("m00895a6fb076"),
                                  value: "remove_dimension_filter",
                                },
                              ]}
                              value={dependency.evaluation_context.filter_context.mode}
                              style={{ minWidth: 180 }}
                            />
                            {dependency.evaluation_context.filter_context.mode !== "inherit" ? (
                              <Select
                                onChange={(name) =>
                                  setDependencies((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            evaluation_context: {
                                              ...item.evaluation_context,
                                              filter_context: {
                                                ...item.evaluation_context.filter_context,
                                                dimension: propertyRef(ownerObjectTypeId, name),
                                              },
                                            },
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                options={propertyOptions}
                                placeholder={objectMetricText("mb081a851d6b8")}
                                value={
                                  dependency.evaluation_context.filter_context.dimension
                                    ?.property_name
                                }
                                style={{ minWidth: 180 }}
                              />
                            ) : null}
                            <span className={styles.sectionHint}>
                              {objectMetricText("mf41e7d3a2201")}
                            </span>
                            <InputNumber
                              onChange={(amount) =>
                                setDependencies((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          evaluation_context: {
                                            ...item.evaluation_context,
                                            time_shift:
                                              amount === null
                                                ? undefined
                                                : {
                                                    amount,
                                                    unit:
                                                      item.evaluation_context.time_shift?.unit ??
                                                      "day",
                                                  },
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={objectMetricText("m6962484cdf55")}
                              value={dependency.evaluation_context.time_shift?.amount}
                            />
                            <Select
                              disabled={!dependency.evaluation_context.time_shift}
                              onChange={(unit) =>
                                setDependencies((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index && item.evaluation_context.time_shift
                                      ? {
                                          ...item,
                                          evaluation_context: {
                                            ...item.evaluation_context,
                                            time_shift: {
                                              ...item.evaluation_context.time_shift,
                                              unit,
                                            },
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                              options={timeUnitOptions.filter(
                                (item) => !["minute", "hour"].includes(item.value),
                              )}
                              value={dependency.evaluation_context.time_shift?.unit}
                              style={{ width: 120 }}
                            />
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ))}
                  <Button
                    disabled={!publishedOptions.length}
                    icon={<PlusOutlined aria-hidden="true" />}
                    onClick={() => {
                      setDependencies((current) => {
                        let suffix = current.length + 1;
                        while (current.some((item) => item.alias === `metric_${suffix}`))
                          suffix += 1;
                        return [
                          ...current,
                          {
                            alias: `metric_${suffix}`,
                            evaluation_context: {
                              filter_context: { mode: "inherit" },
                              window: "inherited",
                            },
                            metric_ref: { metric_id: "", version: 1 },
                            object_alignment: {
                              deduplication: "none",
                              mode: "same_object",
                            },
                          },
                        ];
                      });
                    }}
                    type="dashed"
                  >
                    {objectMetricText("m638fd5c260e8")}
                  </Button>
                </div>

                <div className={styles.qualifierCard}>
                  <div className={styles.qualifierHeading}>
                    <span>2</span>
                    <div>
                      <h3>{objectMetricText("m15f7fef3c17a")}</h3>
                      <p>{objectMetricText("m9222ea568c49")}</p>
                    </div>
                  </div>
                  {dependencies.filter(selectedDependencyMetric).length >= 2 ? (
                    <div className={styles.editorBox}>
                      <ObjectMetricExpressionEditor
                        allowedFunctions={capabilities?.functions}
                        allowedOperators={capabilities?.expression_operators}
                        dependencyAliases={dependencies
                          .filter(selectedDependencyMetric)
                          .map((item) => item.alias)
                          .filter(Boolean)}
                        onChange={updateCompositeExpression}
                        properties={[]}
                        value={compositeExpression}
                      />
                      <div className={styles.formulaPreview} aria-live="polite">
                        <span>{objectMetricText("me1126763a0f0")}</span>
                        <strong>{compositeBusinessFormula}</strong>
                        <small>
                          {objectMetricText("m95ebb042c769")}
                          {expressionLabel(compositeExpression)}
                        </small>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.guidedEmpty}>
                      <strong>
                        {objectMetricText("m4726cde51412")}{" "}
                        {2 - dependencies.filter(selectedDependencyMetric).length}{" "}
                        {objectMetricText("mac9b54d372b2")}
                      </strong>
                      <span>{objectMetricText("m3c2ba68b72ac")}</span>
                    </div>
                  )}
                </div>

                <div className={styles.qualifierCard}>
                  <div className={styles.qualifierHeading}>
                    <span>3</span>
                    <div>
                      <h3>{objectMetricText("m50b23b0dbf42")}</h3>
                      <p>{objectMetricText("m03b017610a64")}</p>
                    </div>
                  </div>
                  <div className={styles.alignmentSummary}>
                    <div>
                      <span>{objectMetricText("m761fc4d6cd1f")}</span>
                      <strong>
                        {grainPolicy === "rollup"
                          ? objectMetricText("m4d0093db94fa")
                          : objectMetricText("me06fb8926b0e")}
                      </strong>
                    </div>
                    <div>
                      <span>{objectMetricText("m8b6ff498515b")}</span>
                      <strong>
                        {getFieldValue("timeAlignment") === "explicit_rollup"
                          ? objectMetricText("m36d3ef52bba6")
                          : objectMetricText("m7cef526c5adc")}
                      </strong>
                    </div>
                    <div>
                      <span>{objectMetricText("meb37ea7105cf")}</span>
                      <strong>
                        {resultSetPolicy === "preserve_primary_dependency"
                          ? objectMetricText("mefd78ebd1cc1")
                          : objectMetricText("mfe2f6b20f741")}
                      </strong>
                    </div>
                  </div>
                  <details className={styles.resultAlignmentAdvanced}>
                    <summary>{objectMetricText("m6f7e8956fabc")}</summary>
                    <p>{objectMetricText("mcaee8de65f44")}</p>
                    <div className={styles.grid3}>
                      <Form.Item label={objectMetricText("m99f946c417dc")} name="grainPolicy">
                        <Select
                          onChange={(value) =>
                            setDependencies((current) =>
                              current.map((item) => ({
                                ...item,
                                rollup_aggregation:
                                  value === "rollup" ||
                                  item.object_alignment.mode === "related_object_set"
                                    ? (item.rollup_aggregation ?? "sum")
                                    : undefined,
                              })),
                            )
                          }
                          options={
                            calculationScope === "object_instance"
                              ? [{ label: objectMetricText("me06fb8926b0e"), value: "same_grain" }]
                              : [
                                  { label: objectMetricText("me06fb8926b0e"), value: "same_grain" },
                                  { label: objectMetricText("m4d0093db94fa"), value: "rollup" },
                                ]
                          }
                        />
                      </Form.Item>
                      <Form.Item label={objectMetricText("mfb94d5196639")} name="resultSetPolicy">
                        <Select
                          options={[
                            { label: objectMetricText("mfe2f6b20f741"), value: "intersection" },
                            {
                              label: objectMetricText("m73510991c005"),
                              value: "preserve_primary_dependency",
                            },
                          ]}
                        />
                      </Form.Item>
                      {resultSetPolicy === "preserve_primary_dependency" ? (
                        <Form.Item
                          label={objectMetricText("m1b7c44db1dec")}
                          name="primaryDependencyAlias"
                          rules={[{ required: true, message: objectMetricText("m784690665bf2") }]}
                        >
                          <Select
                            options={dependencies.filter(selectedDependencyMetric).map((item) => ({
                              label: selectedDependencyMetric(item)?.definition.name ?? item.alias,
                              value: item.alias,
                            }))}
                            placeholder={objectMetricText("m9d6942ee407f")}
                          />
                        </Form.Item>
                      ) : null}
                      <Form.Item label={objectMetricText("m1b06a052b577")} name="timeAlignment">
                        <Select
                          onChange={(value) => {
                            if (value === "explicit_rollup") {
                              form.setFieldValue("grainPolicy", "rollup");
                              setDependencies((current) =>
                                current.map((item) => ({
                                  ...item,
                                  rollup_aggregation: item.rollup_aggregation ?? "sum",
                                })),
                              );
                            }
                          }}
                          options={
                            calculationScope === "object_instance"
                              ? [
                                  {
                                    label: objectMetricText("m7cef526c5adc"),
                                    value: "same_time_window",
                                  },
                                ]
                              : [
                                  {
                                    label: objectMetricText("m7cef526c5adc"),
                                    value: "same_time_window",
                                  },
                                  {
                                    label: objectMetricText("m36d3ef52bba6"),
                                    value: "explicit_rollup",
                                  },
                                ]
                          }
                        />
                      </Form.Item>
                      <Form.Item label={objectMetricText("mea304362e984")} name="nullPolicy">
                        <Select
                          options={[
                            { label: objectMetricText("md3525beb73a9"), value: "propagate" },
                            { label: objectMetricText("m261cb066fc9e"), value: "coalesce_zero" },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item
                        label={objectMetricText("m9d04a114686f")}
                        name="zeroDivisionPolicy"
                      >
                        <Select
                          options={[
                            { label: objectMetricText("m931f0ed7e202"), value: "unavailable" },
                            { label: objectMetricText("mb5ec9d293722"), value: "null" },
                            { label: objectMetricText("m55a0eda285d4"), value: "zero" },
                          ]}
                        />
                      </Form.Item>
                    </div>
                  </details>
                </div>

                <div className={styles.definitionPreview} aria-live="polite">
                  <div className={styles.definitionPreviewTitle}>
                    <strong>{objectMetricText("ma425a081f382")}</strong>
                    <span>{objectMetricText("mb8ee9bec6e3b")}</span>
                  </div>
                  {dependencies.filter(selectedDependencyMetric).length >= 2 ? (
                    <>
                      <p>
                        {objectMetricText("m12404a0b6381")}
                        {ownerObjectType?.name ?? objectMetricText("m19fb5855ae0c")}
                        {objectMetricText("m8af2350cfd65")}
                        {calculationScope === "object_instance"
                          ? objectMetricText("mb358f0089f6c")
                          : objectMetricText("m9c51e86f9307")}
                        {objectMetricText("m0837b6d747fe")}
                        {compositeBusinessFormula}
                        {objectMetricText("m4fc7df62507c")}
                      </p>
                      {compositeAlignmentSummaries.map((summary, index) => (
                        <div className={styles.technicalPreview} key={`${index}-${summary}`}>
                          · {summary}
                        </div>
                      ))}
                    </>
                  ) : (
                    <p>{objectMetricText("m55ec8ea851e8")}</p>
                  )}
                </div>
              </div>
            ) : null}
          </Section>

          <Section
            title={
              effectiveCalculationScope === "object_instance"
                ? objectMetricText("mb5acb826a85a")
                : objectMetricText("m090a0f265f9d")
            }
            tooltip={
              metricType === "atomic"
                ? effectiveCalculationScope === "object_instance"
                  ? objectMetricText("md513f57f39b6")
                  : objectMetricText("m0bce011fd587")
                : effectiveCalculationScope === "object_instance"
                  ? objectMetricText("m2c827391ea37")
                  : metricType === "derived"
                    ? objectMetricText("md4d8ef322109")
                    : objectMetricText("m0bd634a1921c")
            }
          >
            <div className={styles.grid2}>
              {calculationScope === "object_instance" &&
              hasAtomicMeasureProperty &&
              (!physicalType || !semanticType) ? (
                <Alert
                  className={styles.full}
                  message={objectMetricText("m6b30bf1852ca")}
                  description={objectMetricText("mf15dd5b505db")}
                  showIcon
                  type="info"
                />
              ) : null}
              {canConfigureFixedResultGrain ? (
                <Form.Item
                  label={objectMetricText("m88459b43afb6")}
                  name="groupByDimensions"
                  tooltip={objectMetricText("m2f5a19addd3c")}
                >
                  <Select
                    mode="multiple"
                    onChange={(dimensions: string[]) => {
                      const selected = new Set(dimensions);
                      form.setFieldValue(
                        "analysisDimensions",
                        (getFieldValue("analysisDimensions") ?? []).filter(
                          (item) => !selected.has(item),
                        ),
                      );
                    }}
                    options={resultPropertyOptions}
                    placeholder={objectMetricText("m5f94b2e25902")}
                  />
                </Form.Item>
              ) : null}
              {canConfigureFixedResultGrain ? (
                <Form.Item
                  extra={
                    metricType === "composite" && hasCrossObjectDependency
                      ? objectMetricText("m1179dd9bf21e")
                      : undefined
                  }
                  label={objectMetricText("m7c27a3d92ed9")}
                  name="timeGranularity"
                  tooltip={objectMetricText("m74a6bbce62d4")}
                >
                  <Select
                    allowClear
                    disabled={metricType === "composite" && hasCrossObjectDependency}
                    onChange={(value: FormValues["timeGranularity"]) => {
                      if (!value) {
                        form.setFieldsValue({
                          alignmentTimeKey: undefined,
                          grainWeekStart: undefined,
                        });
                      }
                    }}
                    options={timeUnitOptions.filter(
                      (item) =>
                        !capabilities ||
                        capabilities.time_granularities.some((value) => value === item.value),
                    )}
                  />
                </Form.Item>
              ) : null}
              {metricType === "composite" && canConfigureFixedResultGrain && timeGranularity ? (
                <Form.Item
                  label={objectMetricText("m22e6e27580ff")}
                  name="alignmentTimeKey"
                  rules={[{ required: true, message: objectMetricText("ma3a6dfb20bbd") }]}
                  tooltip={objectMetricText("mfdc8bc1e7853")}
                >
                  <Select
                    options={timePropertyOptions}
                    placeholder={objectMetricText("me02a91a80be0")}
                  />
                </Form.Item>
              ) : null}
              {metricType === "derived" ? (
                selectedBaseDefinition && selectedBaseValue ? (
                  <>
                    <div className={styles.inheritedResultSummary}>
                      <div>
                        <span>{objectMetricText("m53510be9d473")}</span>
                        <strong>
                          {semanticTypeOptions.find(
                            (item) => item.value === selectedBaseValue.semantic_type,
                          )?.label ?? selectedBaseValue.semantic_type}
                        </strong>
                      </div>
                      <div>
                        <span>{objectMetricText("m8410f1c133ee")}</span>
                        <strong>
                          {physicalTypeOptions.find(
                            (item) => item.value === selectedBaseValue.physical_type,
                          )?.label ?? selectedBaseValue.physical_type}
                        </strong>
                      </div>
                      <div>
                        <span>{objectMetricText("m4664320a75fc")}</span>
                        <strong>
                          {selectedBaseValue.unit?.code ?? objectMetricText("m3be9bf13138e")}
                        </strong>
                      </div>
                      <p>{objectMetricText("mb0592ef95e17")}</p>
                    </div>
                    <Form.Item hidden name="physicalType">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="semanticType">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="precision">
                      <InputNumber />
                    </Form.Item>
                    <Form.Item hidden name="scale">
                      <InputNumber />
                    </Form.Item>
                    <Form.Item hidden name="roundingMode">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitCode">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitSystem">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="quantityKind">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitScaleFactor">
                      <InputNumber />
                    </Form.Item>
                    <Form.Item hidden name="minimum">
                      <InputNumber />
                    </Form.Item>
                    <Form.Item hidden name="maximum">
                      <InputNumber />
                    </Form.Item>
                    <Form.Item hidden name="unitNumeratorSystem">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitNumeratorKind">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitNumeratorCode">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitDenominatorSystem">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitDenominatorKind">
                      <Input />
                    </Form.Item>
                    <Form.Item hidden name="unitDenominatorCode">
                      <Input />
                    </Form.Item>
                  </>
                ) : (
                  <div className={styles.inheritedValuePlaceholder}>
                    {objectMetricText("m42810b33a04f")}
                  </div>
                )
              ) : (
                <>
                  <Form.Item
                    name="physicalType"
                    hidden
                    rules={[{ required: true, message: objectMetricText("m551e3de491fa") }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    extra={
                      <div className={styles.inferredResultInline}>
                        <span>{objectMetricText("ma1e9cca0bdf3")}</span>
                        <strong>
                          {physicalTypeOptions.find((item) => item.value === physicalType)?.label ??
                            objectMetricText("m67a71e70110c")}
                        </strong>
                        <span>{objectMetricText("mfa92619fb598")}</span>
                        <Tooltip title={objectMetricText("mb31168a91f2a")}>
                          <Button
                            aria-label={objectMetricText("ma8ed40325903")}
                            className={styles.inlineHelpButton}
                            icon={<QuestionCircleOutlined />}
                            size="small"
                            type="text"
                          />
                        </Tooltip>
                      </div>
                    }
                    label={objectMetricText("m6551b12a8b84")}
                    name="semanticType"
                    rules={[{ required: true, message: objectMetricText("m7da337decf29") }]}
                    tooltip={
                      metricType === "atomic"
                        ? objectMetricText("m92736ba484af")
                        : objectMetricText("md031dc3c0654")
                    }
                  >
                    <Select
                      onChange={(semanticType: FormValues["semanticType"]) => {
                        if (semanticType === "count") {
                          form.setFieldsValue({
                            quantityKind: "count",
                            unitCode: "1",
                            unitScaleFactor: 1,
                            unitSystem: "UCUM",
                          });
                        } else if (semanticType === "amount") {
                          form.setFieldsValue({
                            precision: getFieldValue("precision") ?? 18,
                            quantityKind: "currency",
                            roundingMode: getFieldValue("roundingMode") ?? "half_up",
                            scale: getFieldValue("scale") ?? 2,
                            unitCode: "CNY",
                            unitScaleFactor: 1,
                            unitSystem: "ISO_4217",
                          });
                        } else if (semanticType === "percentage") {
                          form.setFieldsValue({
                            precision: getFieldValue("precision") ?? 18,
                            quantityKind: "dimensionless",
                            roundingMode: getFieldValue("roundingMode") ?? "half_up",
                            scale: getFieldValue("scale") ?? 2,
                            unitCode: "%",
                            unitScaleFactor: 1,
                            unitSystem: "UCUM",
                          });
                        } else if (semanticType === "ratio") {
                          form.setFieldsValue({
                            precision: getFieldValue("precision") ?? 18,
                            quantityKind: "dimensionless",
                            roundingMode: getFieldValue("roundingMode") ?? "half_up",
                            scale: getFieldValue("scale") ?? 4,
                            unitCode: "1",
                            unitScaleFactor: 1,
                            unitSystem: "UCUM",
                          });
                        } else if (semanticType === "timestamp") {
                          form.setFieldsValue({
                            noDataPolicy:
                              getFieldValue("noDataPolicy") === "zero"
                                ? "null"
                                : getFieldValue("noDataPolicy"),
                            quantityKind: undefined,
                            unitCode: undefined,
                            unitScaleFactor: undefined,
                            unitSystem: undefined,
                          });
                        } else if (semanticType === "duration") {
                          form.setFieldsValue({
                            quantityKind: "duration",
                            unitCode: "min",
                            unitScaleFactor: 1,
                            unitSystem: "UCUM",
                          });
                        } else if (semanticType === "date") {
                          form.setFieldsValue({
                            noDataPolicy:
                              getFieldValue("noDataPolicy") === "zero"
                                ? "null"
                                : getFieldValue("noDataPolicy"),
                            quantityKind: undefined,
                            unitCode: undefined,
                            unitScaleFactor: undefined,
                            unitSystem: undefined,
                          });
                        } else if (semanticType === "category") {
                          form.setFieldsValue({
                            noDataPolicy:
                              getFieldValue("noDataPolicy") === "zero"
                                ? "null"
                                : getFieldValue("noDataPolicy"),
                            quantityKind: undefined,
                            unitCode: undefined,
                            unitScaleFactor: undefined,
                            unitSystem: undefined,
                          });
                        } else if (semanticType === "boolean") {
                          form.setFieldsValue({
                            noDataPolicy:
                              getFieldValue("noDataPolicy") === "zero"
                                ? "null"
                                : getFieldValue("noDataPolicy"),
                            quantityKind: undefined,
                            unitCode: undefined,
                            unitScaleFactor: undefined,
                            unitSystem: undefined,
                          });
                        } else if (semanticType === "rank") {
                          form.setFieldsValue({
                            quantityKind: "dimensionless",
                            unitCode: "1",
                            unitScaleFactor: 1,
                            unitSystem: "UCUM",
                          });
                        } else if (semanticType === "score") {
                          form.setFieldsValue({
                            precision: getFieldValue("precision") ?? 18,
                            quantityKind: "dimensionless",
                            roundingMode: getFieldValue("roundingMode") ?? "half_up",
                            scale: getFieldValue("scale") ?? 2,
                            unitCode: "1",
                            unitScaleFactor: 1,
                            unitSystem: "UCUM",
                          });
                        } else if (semanticType === "measure") {
                          form.setFieldsValue({
                            quantityKind: undefined,
                            unitCode: undefined,
                            unitScaleFactor: undefined,
                            unitSystem: undefined,
                          });
                        }
                      }}
                      options={semanticTypeOptions.filter(
                        (item) =>
                          (!capabilities ||
                            capabilities.semantic_types.some((value) => value === item.value)) &&
                          (!physicalType ||
                            physicalTypesBySemanticType[item.value].includes(physicalType)) &&
                          (metricType !== "atomic" ||
                            !["count_rows", "count", "count_distinct"].includes(aggregation) ||
                            item.value === "count"),
                      )}
                    />
                  </Form.Item>
                  {physicalType === "decimal" ? (
                    <details className={styles.resultDetails}>
                      <summary>
                        <span>{objectMetricText("m553a32eccee9")}</span>
                        <span>
                          {precision ?? 18} {objectMetricText("m567d157e1d3e")} {scale ?? 2}{" "}
                          {objectMetricText("m9745fe3ebbc5")}
                          {` `}
                          {roundingMode
                            ? roundingModeLabels[roundingMode]
                            : objectMetricText("m9c09e447599c")}
                        </span>
                      </summary>
                      <div className={styles.detailsGrid}>
                        <Form.Item
                          label={objectMetricText("m408ce7a76a40")}
                          name="precision"
                          rules={[{ required: true, message: objectMetricText("m2df29e0c01f3") }]}
                        >
                          <InputNumber max={38} min={1} style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item
                          label={objectMetricText("m571bf00dfd42")}
                          name="scale"
                          rules={[{ required: true, message: objectMetricText("mf01e1f6563fb") }]}
                        >
                          <InputNumber
                            max={getFieldValue("precision") ?? 38}
                            min={0}
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                        <Form.Item
                          label={objectMetricText("med1beda86003")}
                          name="roundingMode"
                          rules={[{ required: true, message: objectMetricText("m4d97805ede61") }]}
                        >
                          <Select
                            options={[
                              { label: objectMetricText("m9c09e447599c"), value: "half_up" },
                              { label: objectMetricText("m7d5873e080fb"), value: "half_even" },
                              { label: objectMetricText("m2db59b7b2c50"), value: "floor" },
                              { label: objectMetricText("m2534ac6ed23d"), value: "ceiling" },
                              { label: objectMetricText("mb6f97fe55978"), value: "truncate" },
                            ]}
                          />
                        </Form.Item>
                      </div>
                    </details>
                  ) : null}
                  {supportsUnit(physicalType) ? (
                    <>
                      <Form.Item
                        extra={
                          unitSelectionLocked
                            ? objectMetricText("m845d2fc745c0")
                            : objectMetricText("m265856d5f0b9")
                        }
                        label={objectMetricText("m80b19d68b149")}
                        name="unitCode"
                        rules={[
                          {
                            required:
                              semanticType === "amount" ||
                              semanticType === "duration" ||
                              semanticType === "percentage",
                            message: objectMetricText("m023b684ab455"),
                          },
                        ]}
                        tooltip={
                          metricType === "atomic"
                            ? objectMetricText("m113b7aeb77f7")
                            : objectMetricText("m68fcd65be131")
                        }
                      >
                        <Select
                          allowClear={!unitSelectionLocked}
                          disabled={unitSelectionLocked}
                          onChange={(code?: string) => {
                            if (!code) {
                              form.setFieldsValue({
                                quantityKind: undefined,
                                unitScaleFactor: undefined,
                                unitSystem: undefined,
                              });
                              return;
                            }
                            const selectedUnit = compatibleUnitOptions.find(
                              (item) => item.code === code,
                            );
                            if (!selectedUnit) return;
                            form.setFieldsValue({
                              quantityKind: selectedUnit.quantityKind,
                              unitScaleFactor: selectedUnit.scaleFactor,
                              unitSystem: selectedUnit.system,
                            });
                          }}
                          optionFilterProp="label"
                          options={compatibleUnitOptions.map((item) => ({
                            label: item.label,
                            value: item.code,
                          }))}
                          placeholder={
                            semanticType === "amount"
                              ? objectMetricText("mdf1f09af43b6")
                              : semanticType === "duration"
                                ? objectMetricText("m531eb8c7fbe1")
                                : objectMetricText("m9c1dca226dde")
                          }
                          showSearch
                        />
                      </Form.Item>
                      <Form.Item hidden name="unitSystem">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="quantityKind">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="unitScaleFactor">
                        <InputNumber />
                      </Form.Item>
                    </>
                  ) : null}
                  {quantityKind === "rate" ? (
                    <>
                      <Form.Item hidden name="unitNumeratorSystem">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="unitNumeratorKind">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="unitNumeratorCode">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="unitDenominatorSystem">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="unitDenominatorKind">
                        <Input />
                      </Form.Item>
                      <Form.Item hidden name="unitDenominatorCode">
                        <Input />
                      </Form.Item>
                    </>
                  ) : null}
                  {physicalType === "int64" ||
                  physicalType === "decimal" ||
                  physicalType === "duration" ? (
                    <>
                      <Form.Item hidden name="minimum">
                        <InputNumber />
                      </Form.Item>
                      <Form.Item hidden name="maximum">
                        <InputNumber />
                      </Form.Item>
                    </>
                  ) : null}
                </>
              )}
              {metricType !== "derived" || selectedBaseDefinition ? (
                <>
                  <Form.Item
                    label={objectMetricText("mf0020b8d8097")}
                    name="noDataPolicy"
                    tooltip={objectMetricText("m049e6c0e0fa6")}
                  >
                    <Select
                      options={[
                        {
                          disabled: !supportsUnit(physicalType),
                          label: objectMetricText("m4ade446d35d9"),
                          value: "zero",
                        },
                        {
                          label: objectMetricText("m6ef515948e8b"),
                          value: "null",
                        },
                        {
                          label: objectMetricText("mb17b9571f302"),
                          value: "unavailable",
                        },
                      ]}
                    />
                  </Form.Item>
                  <div className={`${styles.full} ${styles.queryCapabilityHeader}`}>
                    <strong>
                      {metricType === "atomic"
                        ? objectMetricText("mf854bfeaec18")
                        : objectMetricText("m7dee984d9d2c")}
                    </strong>
                    <span>
                      {metricType === "atomic"
                        ? objectMetricText("m7f85f2218de2")
                        : effectiveCalculationScope === "object_instance"
                          ? objectMetricText("me9e05592e555")
                          : objectMetricText("m9b89526e6f75")}
                    </span>
                  </div>
                  <Form.Item
                    label={
                      metricType === "atomic"
                        ? objectMetricText("m983fa38f4f75")
                        : effectiveCalculationScope === "object_instance"
                          ? objectMetricText("m55ae2bf36da7")
                          : objectMetricText("m9a004b7a1da9")
                    }
                    name="analysisDimensions"
                    tooltip={
                      metricType === "atomic"
                        ? objectMetricText("m86bda0ca8446")
                        : objectMetricText("me7d9267aa381")
                    }
                  >
                    <Select
                      mode="multiple"
                      options={analysisPropertyOptions}
                      placeholder={
                        metricType === "atomic"
                          ? objectMetricText("mb7e241925acf")
                          : objectMetricText("m0bd0ff9621b0")
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    label={
                      metricType === "atomic"
                        ? objectMetricText("m40e232fef99f")
                        : effectiveCalculationScope === "object_instance"
                          ? objectMetricText("md63d3a9bd7e3")
                          : objectMetricText("m40e232fef99f")
                    }
                    name="timeDimensions"
                    tooltip={
                      metricType === "atomic"
                        ? objectMetricText("m2fe2ec23e176")
                        : objectMetricText("m0e5e04ce2dd2")
                    }
                  >
                    <Select
                      mode="multiple"
                      notFoundContent={objectMetricText("m60d87d7f6f27")}
                      options={timePropertyOptions}
                      placeholder={
                        metricType === "atomic"
                          ? objectMetricText("mcc0196c65cfa")
                          : objectMetricText("mea90868b384a")
                      }
                    />
                  </Form.Item>
                  {effectiveCalculationScope === "object_instance" ? (
                    <div className={`${styles.full} ${styles.logicPropertyCard}`}>
                      <div className={styles.logicPropertyHeader}>
                        <div>
                          <strong>{objectMetricText("m315197671848")}</strong>
                          <span>
                            {objectMetricText("m356d91b99e17")}
                            {ownerObjectType?.name ?? objectMetricText("md4abcfbf9164")}
                            {objectMetricText("mdfbd0f596032")}
                          </span>
                        </div>
                        <Form.Item name="logicPropertyEnabled" noStyle valuePropName="checked">
                          <Switch
                            aria-label={objectMetricText("m315197671848")}
                            onChange={(checked) => {
                              if (!checked) return;
                              form.setFieldsValue({
                                logicPropertyDisplayName:
                                  getFieldValue("logicPropertyDisplayName") ||
                                  getFieldValue("name") ||
                                  undefined,
                                logicPropertyName:
                                  getFieldValue("logicPropertyName") ||
                                  getFieldValue("code") ||
                                  undefined,
                              });
                            }}
                          />
                        </Form.Item>
                      </div>
                      {logicPropertyEnabled ? (
                        <>
                          <Alert message={objectMetricText("mb85aba5c793c")} showIcon type="info" />
                          <div className={styles.logicPropertyFields}>
                            <Form.Item
                              label={objectMetricText("maac14899bd42")}
                              name="logicPropertyName"
                              rules={[
                                { required: true, message: objectMetricText("md93f0beda75d") },
                                {
                                  pattern: /^[a-z][a-z0-9_]*$/,
                                  message: objectMetricText("mb9eeaa34688d"),
                                },
                              ]}
                            >
                              <Input placeholder={objectMetricText("mcd56973f4ad0")} />
                            </Form.Item>
                            <Form.Item
                              label={objectMetricText("ma98585871c53")}
                              name="logicPropertyDisplayName"
                              rules={[
                                { required: true, message: objectMetricText("m90fc64da3e98") },
                              ]}
                            >
                              <Input placeholder={objectMetricText("m5dbc85bc1ad3")} />
                            </Form.Item>
                            <Form.Item
                              className={styles.full}
                              label={objectMetricText("m05e490686037")}
                              name="logicPropertyComment"
                            >
                              <Input.TextArea
                                maxLength={500}
                                placeholder={objectMetricText("md65e0329b5e8")}
                                rows={2}
                              />
                            </Form.Item>
                          </div>
                        </>
                      ) : (
                        <p className={styles.logicPropertyDisabledHint}>
                          {objectMetricText("m7ba5a8c5277e")}
                        </p>
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </Section>

          <Section
            title={objectMetricText("mc989f4dba768")}
            tooltip={
              metricType === "atomic"
                ? objectMetricText("mc54cb2885fba")
                : objectMetricText("m2f686d59fc10")
            }
          >
            <Space wrap>
              <Button onClick={() => void validate()}>
                {metricType === "atomic"
                  ? objectMetricText("m9b3caaa13a63")
                  : objectMetricText("mbbc80a0bad9b")}
              </Button>
              <Button onClick={() => void openTrial()}>{objectMetricText("m073728637a26")}</Button>
              <Button onClick={() => void openPreview()}>
                {metricType === "atomic"
                  ? objectMetricText("m3802a1523205")
                  : objectMetricText("m2ad170f9888f")}
              </Button>
            </Space>
            {formValidationIssueCount ? (
              <Alert
                className={styles.issues}
                description={objectMetricText("m64139c51e42a")}
                message={objectMetricText("m240dc0fcb0de", { p0: formValidationIssueCount })}
                showIcon
                type="error"
              />
            ) : validation ? (
              <Alert
                className={styles.issues}
                message={
                  validation.valid
                    ? objectMetricText("m00d84f955fd2")
                    : objectMetricText("m5ace8ec0965f", { p0: validationIssues.length })
                }
                type={validation.valid ? "success" : "error"}
                showIcon
                description={
                  validationIssues.length ? (
                    <ul className={styles.validationIssueList}>
                      {presentedValidationIssues.map((issue, index) => (
                        <li key={`${issue.location}-${issue.problem}-${index}`}>
                          <strong>{issue.location}</strong>
                          <span>{issue.problem}</span>
                          <span className={styles.validationSuggestion}>
                            {objectMetricText("mf99abae6107a")}
                            {issue.suggestion}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : undefined
                }
              />
            ) : null}
            <div className={styles.publishActions}>
              <Button loading={saving} onClick={() => void save()}>
                {objectMetricText("m5329e3f0ee46")}
              </Button>
              <Button loading={saving} onClick={() => void publish()} type="primary">
                {logicPropertyEnabled && effectiveCalculationScope === "object_instance"
                  ? objectMetricText("m029208c5ed8f")
                  : objectMetricText("m5c5fd681a047")}
              </Button>
            </div>
          </Section>
        </Form>
      </div>
      <Modal
        centered
        className={styles.aiDialog}
        footer={null}
        onCancel={() => {
          if (aiGenerating) stopAiGeneration();
          setAiOpen(false);
        }}
        open={aiOpen}
        title={
          <div className={styles.aiDialogTitle}>
            <span className={styles.aiDialogTitleIcon} aria-hidden="true">
              <ThunderboltOutlined />
            </span>
            <div>
              <strong>{objectMetricText("m1a09e582c302")}</strong>
              <span>
                {metricTypeNames[metricType]} · {ownerObjectName}
              </span>
            </div>
          </div>
        }
        width={640}
      >
        {!aiConversation.length && !aiGenerating ? (
          <p className={styles.aiDialogIntro}>{objectMetricText("madf4b42e777b")}</p>
        ) : (
          <div className={styles.aiConversation} aria-live="polite">
            {aiConversation.map((item) => (
              <div
                className={`${styles.aiMessage} ${
                  item.role === "user" ? styles.aiMessageUser : styles.aiMessageAssistant
                } ${item.tone === "error" ? styles.aiMessageError : ""}`}
                key={item.id}
              >
                {item.content}
              </div>
            ))}
            {aiGenerating ? (
              <div className={`${styles.aiMessage} ${styles.aiMessageAssistant}`}>
                <span className={styles.aiThinking}>
                  <i />
                  <i />
                  <i />
                </span>
                {objectMetricText("m800e5eb6c8b5")}
              </div>
            ) : null}
          </div>
        )}
        {aiGenerationSucceeded && !aiGenerating ? (
          <div className={styles.aiDialogResultActions}>
            <span>{objectMetricText("mf9494812edfd")}</span>
            <Button onClick={() => setAiOpen(false)} size="small">
              {objectMetricText("m406b2bdda3ce")}
            </Button>
          </div>
        ) : null}
        {!aiConversation.length ? (
          <div className={styles.aiDialogExamples}>
            <span>{objectMetricText("m0d53f08678d8")}</span>
            {aiExamples.map((example) => (
              <button key={example} onClick={() => setAiPrompt(example)} type="button">
                {example}
              </button>
            ))}
          </div>
        ) : null}
        <div className={styles.aiDialogComposer}>
          <Input.TextArea
            aria-label={objectMetricText("m15a3900b6bf9")}
            autoFocus
            autoSize={{ minRows: 2, maxRows: 5 }}
            disabled={aiGenerating}
            maxLength={1200}
            onChange={(event) => setAiPrompt(event.target.value)}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                void generateWithAi();
              }
            }}
            placeholder={objectMetricText("m7d7fca1df843")}
            value={aiPrompt}
          />
          <Button
            aria-label={objectMetricText("m24d9e58a6e44")}
            danger={aiGenerating}
            disabled={!aiGenerating && !aiPrompt.trim()}
            icon={aiGenerating ? <StopOutlined /> : <SendOutlined />}
            onClick={() => (aiGenerating ? stopAiGeneration() : void generateWithAi())}
            type={aiGenerating ? "default" : "primary"}
          >
            {aiGenerating ? objectMetricText("mca4d973c0b00") : objectMetricText("medecf0ae6e51")}
          </Button>
        </div>
        <p className={styles.aiDialogFootnote}>{objectMetricText("m1917adbea87f")}</p>
      </Modal>
      <Drawer
        onClose={() => setPreview(undefined)}
        open={Boolean(preview)}
        title={objectMetricText("mf712d3495e8f")}
        width={520}
      >
        {preview ? (
          <>
            <Alert
              message={
                preview.validation.valid
                  ? objectMetricText("m22fb195328e4")
                  : objectMetricText("m54742908207a")
              }
              type={preview.validation.valid ? "success" : "warning"}
              showIcon
            />
            <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(preview.output_schema, null, 2)}
            </pre>
          </>
        ) : null}
      </Drawer>
      {trialDefinition ? (
        <ObjectMetricTrialDrawer
          definition={trialDefinition}
          mode="draft"
          objectType={ownerObjectTypeDetail}
          onClose={() => setTrialDefinition(undefined)}
          onRun={(query) => trialObjectMetricDataV1(networkId, trialDefinition, query)}
          open
        />
      ) : null}
    </main>
  );
}
