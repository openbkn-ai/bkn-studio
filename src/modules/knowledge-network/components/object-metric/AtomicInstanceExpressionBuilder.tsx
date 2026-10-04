/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE in the project root for details.
 */

import { DeleteOutlined, PlusOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { Button, Input, InputNumber, Radio, Select, Tag, Tooltip } from "antd";
import { useEffect, useMemo } from "react";

import type { ObjectMetricExpressionPropertyOption } from "@/modules/knowledge-network/components/object-metric/ObjectMetricExpressionEditor";
import { objectMetricPropertyExpression } from "@/modules/knowledge-network/components/object-metric/object-metric-model";
import {
  acceptedTypesForArgument,
  compatibleProperties,
  defaultLiteralForArgument,
  expressionValueType,
  formatObjectMetricExpression,
  functionArgumentAt,
  normalizeExpressionValueType,
  objectMetricFunctionDefinitions,
  type ExpressionValueType,
  type FunctionArgumentDefinition,
  type ObjectMetricFunctionDefinition,
} from "@/modules/knowledge-network/components/object-metric/object-metric-expression-registry";
import type { ObjectMetricExpressionV1 } from "@/modules/knowledge-network/types/object-metric";

import styles from "./AtomicInstanceExpressionBuilder.module.css";

type BasicExpressionMode = "binary" | "direct" | "function";

const binaryOperators = [
  { label: "＋", value: "add" },
  { label: "−", value: "subtract" },
  { label: "×", value: "multiply" },
  { label: "÷", value: "divide" },
  { label: "%", value: "modulo" },
] as const;

const valueTypeLabels: Record<ExpressionValueType, string> = {
  boolean: "布尔",
  date: "日期",
  datetime: "日期时间",
  decimal: "数值",
  duration: "持续时长",
  int64: "整数",
  string: "文本",
};

function basicModeOf(value: ObjectMetricExpressionV1): BasicExpressionMode {
  if (value.node_type === "binary") return "binary";
  if (value.node_type === "call") return "function";
  return "direct";
}

function propertyKey(option: ObjectMetricExpressionPropertyOption) {
  return JSON.stringify([option.objectTypeId, option.propertyName]);
}

function emptyPropertyOperand(
  properties: ObjectMetricExpressionPropertyOption[],
  acceptedTypes?: ExpressionValueType[],
): ObjectMetricExpressionV1 {
  const property = compatibleProperties(properties, acceptedTypes)[0];
  return objectMetricPropertyExpression(
    property?.objectTypeId ?? properties[0]?.objectTypeId ?? "",
    "",
    property?.propertyType,
  );
}

function numericConstant(value = 0, valueType: "decimal" | "int64" = "decimal") {
  return { node_type: "literal" as const, value, value_type: valueType };
}

function firstPropertyExpression(
  value: ObjectMetricExpressionV1,
): ObjectMetricExpressionV1 | undefined {
  if (value.node_type === "property") return value;
  if (value.node_type === "unary") return firstPropertyExpression(value.left);
  if (value.node_type === "binary") {
    return firstPropertyExpression(value.left) ?? firstPropertyExpression(value.right);
  }
  if (value.node_type === "call") {
    for (const argument of value.arguments) {
      const property = firstPropertyExpression(argument);
      if (property) return property;
    }
  }
  return undefined;
}

const numberConvertibleTypes: ExpressionValueType[] = ["string", "int64", "decimal"];

function numberCastOperand(
  properties: ObjectMetricExpressionPropertyOption[],
): ObjectMetricExpressionV1 {
  const stringProperty = compatibleProperties(properties, ["string"])[0];
  return {
    arguments: [
      emptyPropertyOperand(stringProperty ? [stringProperty] : properties, numberConvertibleTypes),
    ],
    function: "to_number",
    node_type: "call",
  };
}

function isNumberCastExpression(
  value: ObjectMetricExpressionV1,
): value is Extract<ObjectMetricExpressionV1, { node_type: "call" }> {
  return value.node_type === "call" && value.function === "to_number";
}

function defaultArgument(
  definition: FunctionArgumentDefinition,
  properties: ObjectMetricExpressionPropertyOption[],
  firstType?: ExpressionValueType,
) {
  if (definition.literalOnly) return defaultLiteralForArgument(definition, firstType);
  const acceptedTypes = acceptedTypesForArgument(definition, firstType);
  return emptyPropertyOperand(properties, acceptedTypes);
}

function createFunctionExpression(
  definition: ObjectMetricFunctionDefinition,
  properties: ObjectMetricExpressionPropertyOption[],
  preferredProperty?: ObjectMetricExpressionV1,
): ObjectMetricExpressionV1 {
  const firstDefinition = functionArgumentAt(definition, 0);
  const firstAccepted = acceptedTypesForArgument(firstDefinition);
  const preferredType = expressionValueType(preferredProperty, properties);
  const firstArgument =
    !firstDefinition.literalOnly &&
    preferredProperty?.node_type === "property" &&
    (!firstAccepted || (preferredType && firstAccepted.includes(preferredType)))
      ? preferredProperty
      : defaultArgument(firstDefinition, properties);
  const firstType = expressionValueType(firstArgument, properties);
  return {
    arguments: Array.from({ length: definition.arguments.length }, (_, index) =>
      index === 0
        ? firstArgument
        : defaultArgument(functionArgumentAt(definition, index), properties, firstType),
    ),
    function: definition.value,
    node_type: "call",
  };
}

function LiteralValueControl({
  definition,
  onChange,
  value,
}: {
  definition?: FunctionArgumentDefinition;
  onChange: (next: ObjectMetricExpressionV1) => void;
  value: Extract<ObjectMetricExpressionV1, { node_type: "literal" }>;
}) {
  if (definition?.choices?.length) {
    return (
      <Select
        aria-label={definition.label}
        className={styles.valueControl}
        onChange={(next) => onChange({ node_type: "literal", value: next, value_type: "string" })}
        options={definition.choices}
        value={typeof value.value === "string" ? value.value : (definition.choices[0]?.value ?? "")}
      />
    );
  }
  if (["decimal", "duration", "int64"].includes(value.value_type)) {
    return (
      <InputNumber
        aria-label={definition?.label ?? "固定值"}
        className={styles.valueControl}
        max={definition?.numericMaximum}
        min={definition?.numericMinimum}
        onChange={(next) => onChange({ ...value, value: next ?? 0 })}
        precision={value.value_type === "int64" ? 0 : undefined}
        value={Number(value.value ?? 0)}
      />
    );
  }
  if (value.value_type === "boolean") {
    return (
      <Select
        aria-label={definition?.label ?? "固定值"}
        className={styles.valueControl}
        onChange={(next) => onChange({ ...value, value: next })}
        options={[
          { label: "是", value: true },
          { label: "否", value: false },
        ]}
        value={Boolean(value.value)}
      />
    );
  }
  return (
    <Input
      aria-label={definition?.label ?? "固定值"}
      className={styles.valueControl}
      onChange={(event) => onChange({ ...value, value: event.target.value })}
      placeholder={value.value_type === "date" ? "YYYY-MM-DD" : "输入固定值"}
      type={
        value.value_type === "date"
          ? "date"
          : value.value_type === "datetime"
            ? "datetime-local"
            : "text"
      }
      value={typeof value.value === "string" ? value.value : ""}
    />
  );
}

function BasicOperandEditor({
  acceptedTypes,
  allowLiteral = true,
  allowNumberConversion = false,
  argument,
  definition,
  onChange,
  properties,
}: {
  acceptedTypes?: ExpressionValueType[];
  allowLiteral?: boolean;
  allowNumberConversion?: boolean;
  argument: ObjectMetricExpressionV1;
  definition?: FunctionArgumentDefinition;
  onChange: (next: ObjectMetricExpressionV1) => void;
  properties: ObjectMetricExpressionPropertyOption[];
}) {
  const availableProperties = compatibleProperties(properties, acceptedTypes);
  const numberConvertibleProperties = compatibleProperties(properties, numberConvertibleTypes);
  const literalOnly = Boolean(definition?.literalOnly);
  const isLiteral = argument.node_type === "literal";
  const isNumberCast = isNumberCastExpression(argument);
  const selectedType = isLiteral
    ? normalizeExpressionValueType(argument.value_type)
    : (acceptedTypes?.[0] ?? "decimal");
  const literalArgument = isLiteral
    ? argument
    : defaultLiteralForArgument(
        definition ?? {
          acceptedTypes: acceptedTypes ?? "any",
          description: "",
          key: "value",
          label: "固定值",
          required: false,
        },
        acceptedTypes?.[0],
      );
  const literalTypes = acceptedTypes?.length
    ? acceptedTypes
    : (["decimal", "int64", "string", "boolean", "date", "datetime", "duration"] as const);
  const selectedProperty =
    argument.node_type === "property"
      ? availableProperties.find(
          (item) =>
            item.objectTypeId === argument.property_ref.object_type_id &&
            item.propertyName === argument.property_ref.property_name,
        )
      : undefined;
  const convertedPropertyExpression = isNumberCast ? argument.arguments[0] : undefined;
  const convertedProperty =
    convertedPropertyExpression?.node_type === "property"
      ? numberConvertibleProperties.find(
          (item) =>
            item.objectTypeId === convertedPropertyExpression.property_ref.object_type_id &&
            item.propertyName === convertedPropertyExpression.property_ref.property_name,
        )
      : undefined;
  const selectedPropertyValue = selectedProperty ? propertyKey(selectedProperty) : undefined;
  const convertedPropertyValue = convertedProperty ? propertyKey(convertedProperty) : undefined;
  const selectedSource = isLiteral ? "literal" : isNumberCast ? "to_number" : "property";

  if (literalOnly) {
    return (
      <div className={styles.compactControl}>
        <LiteralValueControl definition={definition} onChange={onChange} value={literalArgument} />
      </div>
    );
  }

  return (
    <div className={styles.compactControl}>
      {allowLiteral ? (
        <Select
          aria-label={`${definition?.label ?? "计算值"}来源`}
          className={styles.sourceControl}
          onChange={(source) =>
            onChange(
              source === "property"
                ? emptyPropertyOperand(properties, acceptedTypes)
                : source === "to_number"
                  ? numberCastOperand(properties)
                  : defaultLiteralForArgument(
                      definition ?? {
                        acceptedTypes: acceptedTypes ?? "any",
                        description: "",
                        key: "value",
                        label: "固定值",
                        required: false,
                      },
                      acceptedTypes?.[0],
                    ),
            )
          }
          options={[
            { label: "对象属性", value: "property" },
            ...(allowNumberConversion ? [{ label: "文本转数值", value: "to_number" }] : []),
            { label: "固定值", value: "literal" },
          ]}
          value={selectedSource}
        />
      ) : null}
      {isNumberCast ? (
        <Select
          aria-label="转数值属性"
          className={styles.propertyControl}
          notFoundContent="没有可转换为数值的属性"
          onChange={(encoded) => {
            const [objectTypeId, propertyName] = JSON.parse(encoded) as [string, string];
            const property = numberConvertibleProperties.find(
              (item) => item.objectTypeId === objectTypeId && item.propertyName === propertyName,
            );
            onChange({
              ...argument,
              arguments: [
                objectMetricPropertyExpression(objectTypeId, propertyName, property?.propertyType),
              ],
            });
          }}
          options={numberConvertibleProperties.map((item) => ({
            label: item.label,
            value: propertyKey(item),
          }))}
          placeholder="选择文本或数值属性"
          showSearch
          value={convertedPropertyValue}
        />
      ) : argument.node_type === "property" ? (
        <Select
          aria-label={definition?.label ?? "对象属性"}
          className={styles.propertyControl}
          notFoundContent="没有符合类型要求的属性"
          onChange={(encoded) => {
            const [objectTypeId, propertyName] = JSON.parse(encoded) as [string, string];
            const property = availableProperties.find(
              (item) => item.objectTypeId === objectTypeId && item.propertyName === propertyName,
            );
            onChange(
              objectMetricPropertyExpression(objectTypeId, propertyName, property?.propertyType),
            );
          }}
          options={availableProperties.map((item) => ({
            label: item.label,
            value: propertyKey(item),
          }))}
          placeholder="选择对象属性"
          showSearch
          value={selectedPropertyValue}
        />
      ) : (
        <>
          {literalTypes.length > 1 ? (
            <Select
              aria-label="固定值类型"
              className={styles.typeControl}
              onChange={(next: ExpressionValueType) =>
                onChange({
                  node_type: "literal",
                  value:
                    next === "boolean"
                      ? false
                      : ["decimal", "duration", "int64"].includes(next)
                        ? 0
                        : "",
                  value_type: next,
                })
              }
              options={literalTypes.map((item) => ({ label: valueTypeLabels[item], value: item }))}
              value={selectedType}
            />
          ) : null}
          <LiteralValueControl
            definition={definition}
            onChange={onChange}
            value={literalArgument}
          />
        </>
      )}
    </div>
  );
}

function ParameterLabel({ definition }: { definition: FunctionArgumentDefinition }) {
  return (
    <div className={styles.parameterLabel}>
      <span>
        {definition.required ? <span className={styles.required}>*</span> : null}
        {definition.label}
      </span>
      <Tooltip title={definition.description}>
        <Button
          aria-label={`查看${definition.label}说明`}
          className={styles.helpButton}
          icon={<QuestionCircleOutlined />}
          size="small"
          type="text"
        />
      </Tooltip>
    </div>
  );
}

export function AtomicInstanceExpressionBuilder({
  allowedFunctions,
  allowedOperators,
  onChange,
  properties,
  value,
}: {
  allowedFunctions?: string[];
  allowedOperators?: string[];
  onChange: (value: ObjectMetricExpressionV1) => void;
  properties: ObjectMetricExpressionPropertyOption[];
  value: ObjectMetricExpressionV1;
}) {
  const basicMode = basicModeOf(value);
  const availableFunctions = useMemo(
    () =>
      objectMetricFunctionDefinitions.filter(
        (item) => !allowedFunctions || allowedFunctions.includes(item.value),
      ),
    [allowedFunctions],
  );
  const selectedFunction =
    (value.node_type === "call"
      ? availableFunctions.find((item) => item.value === value.function)
      : undefined) ??
    availableFunctions[0] ??
    objectMetricFunctionDefinitions[0];

  useEffect(() => {
    if (value.node_type === "literal" && properties.length) {
      onChange(emptyPropertyOperand(properties));
    }
  }, [onChange, properties, value]);

  const selectBasicMode = (nextMode: BasicExpressionMode) => {
    const preferredProperty = firstPropertyExpression(value);
    if (nextMode === "direct") {
      onChange(preferredProperty ?? emptyPropertyOperand(properties));
      return;
    }
    if (nextMode === "binary") {
      const preferredType = expressionValueType(preferredProperty, properties);
      const numericProperty =
        preferredProperty?.node_type === "property" &&
        (preferredType === "decimal" || preferredType === "int64")
          ? preferredProperty
          : undefined;
      onChange({
        left: numericProperty ?? emptyPropertyOperand(properties, ["int64", "decimal"]),
        node_type: "binary",
        operator: "subtract",
        right: numericConstant(),
      });
      return;
    }
    onChange(createFunctionExpression(selectedFunction, properties, preferredProperty));
  };

  const changeFunction = (functionName: string) => {
    const definition = availableFunctions.find((item) => item.value === functionName);
    if (!definition) return;
    onChange(createFunctionExpression(definition, properties, firstPropertyExpression(value)));
  };

  const functionArguments = value.node_type === "call" ? value.arguments : [];
  const firstArgumentType = expressionValueType(functionArguments[0], properties);
  const formula = formatObjectMetricExpression(value, properties);

  return (
    <div className={styles.builder}>
      <div className={styles.basicEditor}>
        <Radio.Group
          aria-label="基础计算方式"
          className={styles.modeGroup}
          onChange={(event) => selectBasicMode(event.target.value as BasicExpressionMode)}
          optionType="button"
          options={[
            { label: "直接取值", value: "direct" },
            { label: "四则运算", value: "binary" },
            { label: "函数计算", value: "function" },
          ]}
          value={basicMode}
        />

        {basicMode === "direct" ? (
          <div className={styles.parameterGrid}>
            <div className={styles.parameterRow}>
              <ParameterLabel
                definition={{
                  acceptedTypes: "any",
                  description: "选择当前对象类中作为指标返回值的数据属性。",
                  key: "property",
                  label: "取值属性",
                  required: true,
                }}
              />
              <BasicOperandEditor
                allowLiteral={false}
                argument={value}
                definition={{
                  acceptedTypes: "any",
                  description: "选择当前对象类中作为指标返回值的数据属性。",
                  key: "property",
                  label: "取值属性",
                  required: true,
                }}
                onChange={onChange}
                properties={properties}
              />
            </div>
          </div>
        ) : null}

        {basicMode === "binary" && value.node_type === "binary" ? (
          <div className={styles.parameterGrid}>
            <div className={styles.parameterRow}>
              <ParameterLabel
                definition={{
                  acceptedTypes: ["int64", "decimal"],
                  description: "选择运算符左侧的数值属性或固定值。",
                  key: "left",
                  label: "左侧值",
                  required: true,
                }}
              />
              <BasicOperandEditor
                acceptedTypes={["int64", "decimal"]}
                allowNumberConversion
                argument={value.left}
                onChange={(left) => onChange({ ...value, left })}
                properties={properties}
              />
            </div>
            <div className={styles.parameterRow}>
              <ParameterLabel
                definition={{
                  acceptedTypes: "any",
                  description: "选择加、减、乘、除或取模。",
                  key: "operator",
                  label: "运算符",
                  required: true,
                }}
              />
              <Select
                aria-label="运算符"
                className={styles.operatorControl}
                onChange={(operator) => onChange({ ...value, operator })}
                options={binaryOperators
                  .filter((item) => !allowedOperators || allowedOperators.includes(item.value))
                  .map((item) => ({ label: item.label, value: item.value }))}
                value={value.operator}
                virtual={false}
              />
            </div>
            <div className={styles.parameterRow}>
              <ParameterLabel
                definition={{
                  acceptedTypes: ["int64", "decimal"],
                  description: "选择运算符右侧的数值属性或固定值。",
                  key: "right",
                  label: "右侧值",
                  required: true,
                }}
              />
              <BasicOperandEditor
                acceptedTypes={["int64", "decimal"]}
                allowNumberConversion
                argument={value.right}
                onChange={(right) => onChange({ ...value, right })}
                properties={properties}
              />
            </div>
          </div>
        ) : null}

        {basicMode === "function" && value.node_type === "call" ? (
          <div className={styles.functionEditor}>
            <div className={styles.functionHeader}>
              <div>
                <div className={styles.functionLabel}>计算函数</div>
                <Select
                  aria-label="计算函数"
                  className={styles.functionSelect}
                  onChange={changeFunction}
                  options={availableFunctions.map((item) => ({
                    label: item.label,
                    value: item.value,
                  }))}
                  value={value.function}
                />
              </div>
              <div className={styles.functionSummary}>
                <Tag color="blue">{selectedFunction.label}</Tag>
                <span>{selectedFunction.description}</span>
              </div>
            </div>

            <div className={styles.parameterGrid}>
              {functionArguments.map((argument, index) => {
                const definition = functionArgumentAt(selectedFunction, index);
                const acceptedTypes = acceptedTypesForArgument(definition, firstArgumentType);
                const removable = index >= selectedFunction.minArguments;
                return (
                  <div className={styles.parameterRow} key={`${definition.key}-${index}`}>
                    <ParameterLabel definition={definition} />
                    <div className={styles.parameterControlRow}>
                      <BasicOperandEditor
                        acceptedTypes={acceptedTypes}
                        argument={argument}
                        definition={definition}
                        onChange={(next) => {
                          const nextArguments = value.arguments.map((item, itemIndex) =>
                            itemIndex === index ? next : item,
                          );
                          if (index === 0) {
                            const nextFirstType = expressionValueType(next, properties);
                            nextArguments.forEach((item, itemIndex) => {
                              const itemDefinition = functionArgumentAt(
                                selectedFunction,
                                itemIndex,
                              );
                              if (
                                itemIndex > 0 &&
                                itemDefinition.acceptedTypes === "same_as_first" &&
                                item.node_type === "literal" &&
                                nextFirstType
                              ) {
                                nextArguments[itemIndex] = defaultLiteralForArgument(
                                  itemDefinition,
                                  nextFirstType,
                                );
                              }
                            });
                          }
                          onChange({ ...value, arguments: nextArguments });
                        }}
                        properties={properties}
                      />
                      {removable ? (
                        <Button
                          aria-label={`删除${definition.label}`}
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() =>
                            onChange({
                              ...value,
                              arguments: value.arguments.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            })
                          }
                          type="text"
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {selectedFunction.variadicArgument &&
              (selectedFunction.maxArguments === undefined ||
                functionArguments.length < selectedFunction.maxArguments) ? (
                <Button
                  className={styles.addParameterButton}
                  icon={<PlusOutlined />}
                  onClick={() =>
                    onChange({
                      ...value,
                      arguments: [
                        ...value.arguments,
                        defaultLiteralForArgument(
                          selectedFunction.variadicArgument!,
                          firstArgumentType,
                        ),
                      ],
                    })
                  }
                  type="dashed"
                >
                  添加{selectedFunction.variadicArgument.label}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.previewBar} aria-live="polite">
        <span className={styles.previewLabel}>公式预览</span>
        <code>{formula}</code>
      </div>
    </div>
  );
}
