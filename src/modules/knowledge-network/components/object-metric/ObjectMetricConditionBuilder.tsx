/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApartmentOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Input, InputNumber, Select } from "antd";
import {
  formatObjectMetricNumericInput,
  objectMetricAuthoringNumericValue,
} from "@/modules/knowledge-network/lib/object-metric-numeric";

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
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import { useTranslation } from "react-i18next";

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
      aria-label={objectMetricText("m327bdd799586")}
      className={styles.fieldSelect}
      onChange={(encoded) => {
        const [objectTypeId, propertyName] = JSON.parse(encoded) as [string, string];
        onChange({
          property_ref: { object_type_id: objectTypeId, property_name: propertyName },
          source: "property",
        });
      }}
      options={properties.map((item) => ({ label: item.label, value: propertyKey(item) }))}
      placeholder={objectMetricText("m583ee3c6383a")}
      showSearch
      value={
        ref?.property_name ? JSON.stringify([ref.object_type_id, ref.property_name]) : undefined
      }
    />
  );
}

function literalText(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value) ?? "";
}

function literalValue(value: string, valueType: string) {
  if (valueType === "int64" || valueType === "decimal") {
    return objectMetricAuthoringNumericValue(value) ?? value;
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
          {objectMetricText("me1d61932ef7e")}
        </Button>
      </div>
    );
  }

  if (expectedValueType === "int64" || expectedValueType === "decimal") {
    return (
      <InputNumber
        aria-label={objectMetricText("mb964a92285bc")}
        className={styles.valueControl}
        onChange={(value) =>
          onChange(
            literalOperand(
              expectedValueType,
              value === null ? undefined : objectMetricAuthoringNumericValue(value),
            ),
          )
        }
        placeholder={objectMetricText("m110e4c3fca51")}
        stringMode
        value={operand.value === undefined ? null : formatObjectMetricNumericInput(operand.value)}
      />
    );
  }
  if (expectedValueType === "boolean") {
    return (
      <Select
        aria-label={objectMetricText("mb964a92285bc")}
        className={styles.valueControl}
        onChange={(value) => onChange(literalOperand("boolean", value))}
        options={[
          { label: objectMetricText("mb5141d3d19e9"), value: true },
          { label: objectMetricText("m0c70665b6eb6"), value: false },
        ]}
        placeholder={objectMetricText("m954d224b10fa")}
        value={typeof operand.value === "boolean" ? operand.value : undefined}
      />
    );
  }
  return (
    <Input
      aria-label={objectMetricText("mb964a92285bc")}
      className={styles.valueControl}
      onChange={(event) => onChange(literalOperand(expectedValueType, event.target.value))}
      placeholder={
        expectedValueType === "string"
          ? objectMetricText("m110e4c3fca51")
          : objectMetricText("mad37b165ef82")
      }
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
      aria-label={objectMetricText("mb964a92285bc")}
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
      placeholder={objectMetricText("m75a3e4ef1cef")}
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
        {objectMetricText("m236878c0b380")}
      </Button>
      {canAddGroup ? (
        <Button icon={<ApartmentOutlined aria-hidden="true" />} onClick={onAddGroup} size="small">
          {objectMetricText("mcb35cc5b434f")}
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
  useTranslation();
  if (!value) {
    return (
      <Button
        icon={<PlusOutlined aria-hidden="true" />}
        onClick={() => onChange(predicate(properties))}
        type="dashed"
      >
        {objectMetricText("md0d748999bc8")}
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
            aria-label={objectMetricText("m898d2cd2c8e7")}
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
            placeholder={
              hasSelectedProperty
                ? objectMetricText("m8d4c581e57d5")
                : objectMetricText("m21fb1b3e9a3a")
            }
            value={hasSelectedProperty ? currentOperator : undefined}
          />
          <div className={styles.valueArea}>
            {!hasSelectedProperty ? (
              <Input
                aria-label={objectMetricText("mb964a92285bc")}
                className={styles.valueControl}
                disabled
                placeholder={objectMetricText("m21fb1b3e9a3a")}
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
                  {index === 1 ? <span>{objectMetricText("m65edbf9f1c67")}</span> : null}
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
            aria-label={objectMetricText("m96d7b159d24e")}
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
        <span>{objectMetricText("m5c81d40b1516")}</span>
        <Select
          aria-label={objectMetricText("m5c81d40b1516")}
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
            { label: objectMetricText("m9f00f6770f8c"), value: "and" },
            { label: objectMetricText("ma2123d69506f"), value: "or" },
            { label: objectMetricText("mf48551bc8b4d"), value: "not" },
          ].filter(
            (item) => !allowedBooleanOperators || allowedBooleanOperators.includes(item.value),
          )}
          value={value.boolean_operator}
        />
        <Button
          aria-label={objectMetricText("m7181350804ed")}
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
