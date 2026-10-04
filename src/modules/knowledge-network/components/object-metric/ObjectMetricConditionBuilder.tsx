/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApartmentOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Input, InputNumber, Select } from "antd";

import type {
  ObjectMetricConditionV1,
  ObjectMetricOperandV1,
} from "@/modules/knowledge-network/types/object-metric";
import {
  normalizeObjectMetricConditionValueType,
  objectMetricComparisonOperatorsForType,
} from "@/modules/knowledge-network/lib/object-metric-condition-operators";
import type { ObjectMetricExpressionPropertyOption } from "./ObjectMetricExpressionEditor";

import styles from "./ObjectMetricConditionBuilder.module.css";

type Props = {
  allowedBooleanOperators?: string[];
  allowedComparisonOperators?: string[];
  depth?: number;
  onChange: (value: ObjectMetricConditionV1 | undefined) => void;
  properties: ObjectMetricExpressionPropertyOption[];
  value?: ObjectMetricConditionV1;
};

type ComparisonOperator = Extract<
  ObjectMetricConditionV1,
  { node_type: "predicate" }
>["comparison_operator"];

const unaryOperators = new Set([
  "is_empty",
  "is_not_empty",
  "is_null",
  "is_not_null",
  "is_true",
  "is_false",
]);
const rangeOperators = new Set(["between", "not_between"]);
const membershipOperators = new Set(["in", "not_in"]);

const comparisonLabels: Record<ComparisonOperator, string> = {
  after: "晚于",
  after_or_equal: "不早于",
  before: "早于",
  before_or_equal: "不晚于",
  between: "介于",
  contains: "包含",
  ends_with: "结尾是",
  eq: "等于",
  gt: "大于",
  gte: "大于等于",
  in: "属于",
  is_empty: "为空",
  is_false: "为假",
  is_not_empty: "不为空",
  is_not_null: "不是空值",
  is_null: "是空值",
  is_true: "为真",
  lt: "小于",
  lte: "小于等于",
  neq: "不等于",
  not_between: "不介于",
  not_contains: "不包含",
  not_in: "不属于",
  starts_with: "开头是",
};

function literalOperand(valueType: string, value?: unknown): ObjectMetricOperandV1 {
  return { source: "literal", value, value_type: valueType };
}

function propertyValueType(
  operand: ObjectMetricOperandV1,
  properties: ObjectMetricExpressionPropertyOption[],
) {
  if (operand.source !== "property") return "string";
  return normalizeObjectMetricConditionValueType(
    properties.find(
      (item) =>
        item.objectTypeId === operand.property_ref.object_type_id &&
        item.propertyName === operand.property_ref.property_name,
    )?.propertyType,
  );
}

function comparisonOptions(valueType: string, allowed?: string[]) {
  return objectMetricComparisonOperatorsForType(valueType, allowed).map((value) => ({
    label: comparisonLabels[value],
    value,
  }));
}

function firstComparisonOperator(valueType: string, allowed?: string[]): ComparisonOperator {
  return objectMetricComparisonOperatorsForType(valueType, allowed)[0] ?? "eq";
}

function predicate(properties: ObjectMetricExpressionPropertyOption[]): ObjectMetricConditionV1 {
  return {
    comparison_operator: "eq",
    left: {
      property_ref: {
        object_type_id: properties[0]?.objectTypeId ?? "",
        property_name: "",
      },
      source: "property",
    },
    node_type: "predicate",
    right: [literalOperand("string")],
  };
}

function propertyKey(option: ObjectMetricExpressionPropertyOption) {
  return JSON.stringify([option.objectTypeId, option.propertyName]);
}

function PropertySelect({
  onChange,
  operand,
  properties,
}: {
  onChange: (value: ObjectMetricOperandV1) => void;
  operand: ObjectMetricOperandV1;
  properties: ObjectMetricExpressionPropertyOption[];
}) {
  const ref = operand.source === "property" ? operand.property_ref : undefined;
  return (
    <Select
      aria-label="判断字段"
      className={styles.fieldSelect}
      onChange={(encoded) => {
        const [objectTypeId, propertyName] = JSON.parse(encoded) as [string, string];
        onChange({
          property_ref: { object_type_id: objectTypeId, property_name: propertyName },
          source: "property",
        });
      }}
      options={properties.map((item) => ({ label: item.label, value: propertyKey(item) }))}
      placeholder="选择判断字段"
      showSearch
      value={
        ref?.property_name ? JSON.stringify([ref.object_type_id, ref.property_name]) : undefined
      }
    />
  );
}

function literalText(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function literalValue(value: string, valueType: string) {
  if (valueType === "int64" || valueType === "decimal") {
    const number = Number(value);
    return value.trim() !== "" && Number.isFinite(number) ? number : value;
  }
  if (valueType === "boolean") return value === "true";
  return value;
}

function ValueEditor({
  expectedValueType,
  onChange,
  operand,
  properties,
}: {
  expectedValueType: string;
  onChange: (value: ObjectMetricOperandV1) => void;
  operand: ObjectMetricOperandV1;
  properties: ObjectMetricExpressionPropertyOption[];
}) {
  if (operand.source === "property") {
    const compatibleTypes = ["int64", "decimal"].includes(expectedValueType)
      ? new Set(["int64", "decimal"])
      : new Set([expectedValueType]);
    return (
      <div className={styles.propertyValue}>
        <PropertySelect
          onChange={onChange}
          operand={operand}
          properties={properties.filter((item) =>
            compatibleTypes.has(normalizeObjectMetricConditionValueType(item.propertyType)),
          )}
        />
        <Button onClick={() => onChange(literalOperand(expectedValueType))} size="small">
          改用固定值
        </Button>
      </div>
    );
  }

  if (expectedValueType === "int64" || expectedValueType === "decimal") {
    return (
      <InputNumber
        aria-label="判断值"
        className={styles.valueControl}
        onChange={(value) => onChange(literalOperand(expectedValueType, value ?? undefined))}
        placeholder="输入判断值"
        value={operand.value === undefined ? null : Number(operand.value)}
      />
    );
  }
  if (expectedValueType === "boolean") {
    return (
      <Select
        aria-label="判断值"
        className={styles.valueControl}
        onChange={(value) => onChange(literalOperand("boolean", value))}
        options={[
          { label: "是", value: true },
          { label: "否", value: false },
        ]}
        placeholder="选择判断值"
        value={typeof operand.value === "boolean" ? operand.value : undefined}
      />
    );
  }
  return (
    <Input
      aria-label="判断值"
      className={styles.valueControl}
      onChange={(event) => onChange(literalOperand(expectedValueType, event.target.value))}
      placeholder={expectedValueType === "string" ? "输入判断值" : "输入日期或时间"}
      value={literalText(operand.value)}
    />
  );
}

function MembershipEditor({
  expectedValueType,
  onChange,
  operands,
}: {
  expectedValueType: string;
  onChange: (value: ObjectMetricOperandV1[]) => void;
  operands: ObjectMetricOperandV1[];
}) {
  const values = operands
    .filter((operand) => operand.source === "literal")
    .map((operand) => literalText(operand.source === "literal" ? operand.value : undefined))
    .filter(Boolean);
  return (
    <Select
      aria-label="判断值"
      className={styles.valueControl}
      mode="tags"
      onChange={(nextValues) =>
        onChange(
          nextValues.map((value) =>
            literalOperand(expectedValueType, literalValue(value, expectedValueType)),
          ),
        )
      }
      open={false}
      placeholder="输入值后按回车，可添加多个"
      tokenSeparators={[","]}
      value={values}
    />
  );
}

function ConditionActions({
  canAddGroup,
  onAdd,
  onAddGroup,
}: {
  canAddGroup: boolean;
  onAdd: () => void;
  onAddGroup: () => void;
}) {
  return (
    <div className={styles.conditionActions}>
      <Button icon={<PlusOutlined aria-hidden="true" />} onClick={onAdd} size="small">
        添加条件
      </Button>
      {canAddGroup ? (
        <Button icon={<ApartmentOutlined aria-hidden="true" />} onClick={onAddGroup} size="small">
          添加条件组
        </Button>
      ) : null}
    </div>
  );
}

export function ObjectMetricConditionBuilder({
  allowedBooleanOperators,
  allowedComparisonOperators,
  depth = 0,
  onChange,
  properties,
  value,
}: Props) {
  if (!value) {
    return (
      <Button
        icon={<PlusOutlined aria-hidden="true" />}
        onClick={() => onChange(predicate(properties))}
        type="dashed"
      >
        添加业务条件
      </Button>
    );
  }

  if (value.node_type === "predicate") {
    const hasSelectedProperty =
      value.left.source === "property" && Boolean(value.left.property_ref.property_name);
    const leftValueType = propertyValueType(value.left, properties);
    const allowedOperators = objectMetricComparisonOperatorsForType(
      leftValueType,
      allowedComparisonOperators,
    );
    const currentOperator = allowedOperators.includes(value.comparison_operator)
      ? value.comparison_operator
      : firstComparisonOperator(leftValueType, allowedComparisonOperators);
    const rightCount = unaryOperators.has(currentOperator)
      ? 0
      : rangeOperators.has(currentOperator)
        ? 2
        : membershipOperators.has(currentOperator)
          ? Math.max(1, value.right?.length ?? 0)
          : 1;
    const right = Array.from(
      { length: rightCount },
      (_, index) => value.right?.[index] ?? literalOperand(leftValueType),
    );
    return (
      <div className={styles.conditionList}>
        <div className={styles.conditionRow}>
          <PropertySelect
            onChange={(left) => {
              const valueType = propertyValueType(left, properties);
              const nextOperator = objectMetricComparisonOperatorsForType(
                valueType,
                allowedComparisonOperators,
              ).includes(currentOperator)
                ? currentOperator
                : firstComparisonOperator(valueType, allowedComparisonOperators);
              onChange({
                ...value,
                comparison_operator: nextOperator,
                left,
                right: unaryOperators.has(nextOperator) ? undefined : [literalOperand(valueType)],
              });
            }}
            operand={value.left}
            properties={properties}
          />
          <Select
            aria-label="判断关系"
            className={styles.operationSelect}
            disabled={!hasSelectedProperty}
            onChange={(comparison_operator) =>
              onChange({
                ...value,
                comparison_operator,
                right: unaryOperators.has(comparison_operator)
                  ? undefined
                  : Array.from(
                      { length: rangeOperators.has(comparison_operator) ? 2 : 1 },
                      (_, index) => right[index] ?? literalOperand(leftValueType),
                    ),
              })
            }
            options={comparisonOptions(leftValueType, allowedComparisonOperators)}
            placeholder={hasSelectedProperty ? "选择判断关系" : "请先选择判断字段"}
            value={hasSelectedProperty ? currentOperator : undefined}
          />
          <div className={styles.valueArea}>
            {!hasSelectedProperty ? (
              <Input
                aria-label="判断值"
                className={styles.valueControl}
                disabled
                placeholder="请先选择判断字段"
              />
            ) : membershipOperators.has(currentOperator) ? (
              <MembershipEditor
                expectedValueType={leftValueType}
                onChange={(next) =>
                  onChange({ ...value, comparison_operator: currentOperator, right: next })
                }
                operands={right}
              />
            ) : (
              right.map((operand, index) => (
                <div className={styles.rangeValue} key={index}>
                  {index === 1 ? <span>至</span> : null}
                  <ValueEditor
                    expectedValueType={leftValueType}
                    onChange={(next) =>
                      onChange({
                        ...value,
                        comparison_operator: currentOperator,
                        right: right.map((item, itemIndex) => (itemIndex === index ? next : item)),
                      })
                    }
                    operand={operand}
                    properties={properties}
                  />
                </div>
              ))
            )}
          </div>
          <Button
            aria-label="删除条件"
            className={styles.deleteButton}
            danger
            icon={<DeleteOutlined aria-hidden="true" />}
            onClick={() => onChange(undefined)}
            type="text"
          />
        </div>
        {depth === 0 ? (
          <ConditionActions
            canAddGroup
            onAdd={() =>
              onChange({
                boolean_operator: "and",
                children: [value, predicate(properties)],
                node_type: "group",
              })
            }
            onAddGroup={() =>
              onChange({
                boolean_operator: "and",
                children: [
                  value,
                  {
                    boolean_operator: "and",
                    children: [predicate(properties), predicate(properties)],
                    node_type: "group",
                  },
                ],
                node_type: "group",
              })
            }
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${styles.conditionGroup} ${depth ? styles.nestedGroup : ""}`}>
      <div className={styles.groupHeader}>
        <span>条件关系</span>
        <Select
          aria-label="条件关系"
          className={styles.groupSelect}
          onChange={(boolean_operator) => {
            const children =
              boolean_operator === "not" ? value.children.slice(0, 1) : value.children;
            onChange({
              ...value,
              boolean_operator,
              children: children.length ? children : [predicate(properties)],
            });
          }}
          options={[
            { label: "且", value: "and" },
            { label: "或", value: "or" },
            { label: "非", value: "not" },
          ].filter(
            (item) => !allowedBooleanOperators || allowedBooleanOperators.includes(item.value),
          )}
          value={value.boolean_operator}
        />
        <Button
          aria-label="删除条件组"
          danger
          icon={<DeleteOutlined aria-hidden="true" />}
          onClick={() => onChange(undefined)}
          size="small"
          type="text"
        />
      </div>
      <div className={styles.groupChildren}>
        {value.children.map((child, index) => (
          <ObjectMetricConditionBuilder
            allowedBooleanOperators={allowedBooleanOperators}
            allowedComparisonOperators={allowedComparisonOperators}
            depth={depth + 1}
            key={index}
            onChange={(next) => {
              const children = next
                ? value.children.map((item, itemIndex) => (itemIndex === index ? next : item))
                : value.children.filter((_, itemIndex) => itemIndex !== index);
              onChange(children.length ? { ...value, children } : undefined);
            }}
            properties={properties}
            value={child}
          />
        ))}
      </div>
      {value.boolean_operator !== "not" ? (
        <ConditionActions
          canAddGroup={depth < 4}
          onAdd={() => onChange({ ...value, children: [...value.children, predicate(properties)] })}
          onAddGroup={() =>
            onChange({
              ...value,
              children: [
                ...value.children,
                {
                  boolean_operator: "and",
                  children: [predicate(properties), predicate(properties)],
                  node_type: "group",
                },
              ],
            })
          }
        />
      ) : null}
    </div>
  );
}
