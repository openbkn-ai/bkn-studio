/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Input, InputNumber, Select, Space } from "antd";
import { useEffect } from "react";

import {
  acceptedTypesForArgument,
  compatibleProperties,
  defaultLiteralForArgument,
  expressionValueType,
  functionArgumentAt,
  normalizeExpressionValueType,
  objectMetricFunctionDefinitions,
  type ExpressionValueType,
} from "@/modules/knowledge-network/components/object-metric/object-metric-expression-registry";
import type { ObjectMetricExpressionV1 } from "@/modules/knowledge-network/types/object-metric";

import styles from "./ObjectMetricExpressionEditor.module.css";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import { useTranslation } from "react-i18next";

function defaultArguments(
  count: number,
  properties: ObjectMetricExpressionPropertyOption[],
  requiresPropertyReference: boolean,
): ObjectMetricExpressionV1[] {
  return Array.from({ length: count }, () => ({
    ...(requiresPropertyReference && properties[0]
      ? {
          node_type: "property" as const,
          property_ref: {
            object_type_id: properties[0].objectTypeId,
            property_name: properties[0].propertyName,
          },
          value_type: properties[0].propertyType
            ? normalizeExpressionValueType(properties[0].propertyType)
            : undefined,
        }
      : { node_type: "literal" as const, value: 0, value_type: "decimal" }),
  }));
}

export type ObjectMetricExpressionPropertyOption = {
  label: string;
  objectTypeId: string;
  propertyName: string;
  propertyType?: string;
};

type Props = {
  acceptedPropertyTypes?: Parameters<typeof compatibleProperties>[1];
  allowedFunctions?: string[];
  allowedOperators?: string[];
  dependencyAliases?: string[];
  depth?: number;
  onChange: (value: ObjectMetricExpressionV1) => void;
  properties: ObjectMetricExpressionPropertyOption[];
  requiresPropertyReference?: boolean;
  value: ObjectMetricExpressionV1;
};

function propertyKey(option: ObjectMetricExpressionPropertyOption) {
  return JSON.stringify([option.objectTypeId, option.propertyName]);
}

function createNode(
  nodeType: ObjectMetricExpressionV1["node_type"],
  properties: ObjectMetricExpressionPropertyOption[],
  dependencies: string[],
  requiresPropertyReference: boolean,
): ObjectMetricExpressionV1 {
  const property = properties[0];
  switch (nodeType) {
    case "property":
      return {
        node_type: "property",
        property_ref: {
          object_type_id: property?.objectTypeId ?? "",
          property_name: property?.propertyName ?? "",
        },
        value_type: property?.propertyType
          ? normalizeExpressionValueType(property.propertyType)
          : undefined,
      };
    case "dependency":
      return { dependency_alias: dependencies[0] ?? "", node_type: "dependency" };
    case "literal":
      return { node_type: "literal", value: 0, value_type: "decimal" };
    case "call":
      return {
        arguments: defaultArguments(1, properties, requiresPropertyReference),
        function: "abs",
        node_type: "call",
      };
    case "unary":
      return {
        left: defaultArguments(1, properties, requiresPropertyReference)[0],
        node_type: "unary",
        operator: "negate",
      };
    case "binary":
      return {
        left: dependencies.length
          ? { dependency_alias: dependencies[0], node_type: "dependency" }
          : defaultArguments(1, properties, requiresPropertyReference)[0],
        node_type: "binary",
        operator: "add",
        right:
          dependencies.length > 1
            ? { dependency_alias: dependencies[1], node_type: "dependency" }
            : { node_type: "literal", value: 0, value_type: "decimal" },
      };
  }
}

export function ObjectMetricExpressionEditor({
  acceptedPropertyTypes,
  allowedFunctions,
  allowedOperators,
  dependencyAliases = [],
  depth = 0,
  onChange,
  properties,
  requiresPropertyReference = false,
  value,
}: Props) {
  useTranslation();
  const isAtomicRoot = requiresPropertyReference && depth === 0;
  useEffect(() => {
    if (isAtomicRoot && value.node_type === "literal" && properties.length) {
      onChange(createNode("property", properties, dependencyAliases, true));
    }
  }, [dependencyAliases, isAtomicRoot, onChange, properties, value]);

  const availableProperties = compatibleProperties(properties, acceptedPropertyTypes);
  const availableFunctions = objectMetricFunctionDefinitions.filter(
    (item) => !allowedFunctions || allowedFunctions.includes(item.value),
  );
  const availableNodeTypes = [
    ...(availableProperties.length
      ? [{ label: objectMetricText("m1cded5b3fdf7"), value: "property" }]
      : []),
    ...(dependencyAliases.length
      ? [{ label: objectMetricText("ma6ace5b29ab9"), value: "dependency" }]
      : []),
    ...(!isAtomicRoot ? [{ label: objectMetricText("m7dc406c92803"), value: "literal" }] : []),
    { label: objectMetricText("m1832990660bb"), value: "call" },
    { label: objectMetricText("m266eedd2b0da"), value: "unary" },
    ...(depth < 5 ? [{ label: objectMetricText("me4b5641e465c"), value: "binary" }] : []),
  ];

  const nodeTypeSelect = (
    <Space size={6}>
      <span>
        {isAtomicRoot ? objectMetricText("m2b34dfff84ba") : objectMetricText("m57a1db52deb4")}
      </span>
      <Select
        aria-label={
          isAtomicRoot ? objectMetricText("m2b34dfff84ba") : objectMetricText("m57a1db52deb4")
        }
        onChange={(nodeType: ObjectMetricExpressionV1["node_type"]) =>
          onChange(
            createNode(nodeType, availableProperties, dependencyAliases, requiresPropertyReference),
          )
        }
        options={availableNodeTypes}
        value={value.node_type}
        style={{ width: 128 }}
      />
    </Space>
  );

  if (value.node_type === "property") {
    return (
      <Space wrap>
        {nodeTypeSelect}
        <Select
          aria-label={objectMetricText("mbf3eefd70d61")}
          onChange={(encoded) => {
            const [objectTypeId, propertyName] = JSON.parse(encoded) as [string, string];
            const property = availableProperties.find(
              (item) => item.objectTypeId === objectTypeId && item.propertyName === propertyName,
            );
            onChange({
              node_type: "property",
              property_ref: { object_type_id: objectTypeId, property_name: propertyName },
              value_type: property?.propertyType
                ? normalizeExpressionValueType(property.propertyType)
                : undefined,
            });
          }}
          options={availableProperties.map((item) => ({
            label: item.label,
            value: propertyKey(item),
          }))}
          placeholder={objectMetricText("mf7e136727d4d")}
          showSearch
          value={
            value.property_ref.object_type_id && value.property_ref.property_name
              ? JSON.stringify([
                  value.property_ref.object_type_id,
                  value.property_ref.property_name,
                ])
              : undefined
          }
          style={{ minWidth: 260 }}
        />
      </Space>
    );
  }

  if (value.node_type === "dependency") {
    return (
      <Space wrap>
        {nodeTypeSelect}
        <Select
          aria-label={objectMetricText("ma6ace5b29ab9")}
          onChange={(dependency_alias) => onChange({ dependency_alias, node_type: "dependency" })}
          options={dependencyAliases.map((alias) => ({ label: alias, value: alias }))}
          placeholder={objectMetricText("mf231bbdb00de")}
          value={value.dependency_alias || undefined}
          style={{ minWidth: 220 }}
        />
      </Space>
    );
  }

  if (value.node_type === "literal") {
    const allLiteralTypeOptions: Array<{ label: string; value: ExpressionValueType }> = [
      { label: objectMetricText("mc5500a58e0c5"), value: "decimal" },
      { label: objectMetricText("m67e2bb6ef67b"), value: "int64" },
      { label: objectMetricText("mdd81861811e5"), value: "string" },
      { label: objectMetricText("m8e607148f445"), value: "boolean" },
      { label: objectMetricText("m70d0c1b33626"), value: "date" },
      { label: objectMetricText("m6ac8b7718121"), value: "datetime" },
      { label: objectMetricText("m3e777ea8f1e8"), value: "duration" },
    ];
    const literalTypeOptions = allLiteralTypeOptions.filter(
      (item) => !acceptedPropertyTypes?.length || acceptedPropertyTypes.includes(item.value),
    );
    return (
      <Space wrap>
        {nodeTypeSelect}
        <Select
          aria-label={objectMetricText("m74a3e83eeee9")}
          onChange={(value_type) => onChange({ ...value, value_type })}
          options={literalTypeOptions}
          value={value.value_type}
          style={{ width: 100 }}
        />
        {value.value_type === "decimal" ||
        value.value_type === "int64" ||
        value.value_type === "duration" ? (
          <InputNumber
            aria-label={objectMetricText("m906bc76b812a")}
            onChange={(next) => onChange({ ...value, value: next ?? 0 })}
            value={Number(value.value ?? 0)}
          />
        ) : value.value_type === "boolean" ? (
          <Select
            aria-label={objectMetricText("m906bc76b812a")}
            onChange={(next) => onChange({ ...value, value: next })}
            options={[
              { label: objectMetricText("mb5141d3d19e9"), value: true },
              { label: objectMetricText("m0c70665b6eb6"), value: false },
            ]}
            value={Boolean(value.value)}
            style={{ width: 120 }}
          />
        ) : (
          <Input
            aria-label={objectMetricText("m906bc76b812a")}
            onChange={(event) => onChange({ ...value, value: event.target.value })}
            value={typeof value.value === "string" ? value.value : ""}
            style={{ width: 180 }}
          />
        )}
      </Space>
    );
  }

  if (value.node_type === "unary") {
    return (
      <div>
        <Space wrap>
          {nodeTypeSelect}
          <span>{objectMetricText("mee0a67eb1186")}</span>
        </Space>
        <div
          style={{
            borderLeft: "2px solid var(--color-border)",
            marginTop: 12,
            paddingLeft: 16,
          }}
        >
          <ObjectMetricExpressionEditor
            acceptedPropertyTypes={["int64", "decimal"]}
            allowedFunctions={allowedFunctions}
            allowedOperators={allowedOperators}
            dependencyAliases={dependencyAliases}
            depth={depth + 1}
            onChange={(left) => onChange({ ...value, left })}
            properties={properties}
            requiresPropertyReference={requiresPropertyReference}
            value={value.left}
          />
        </div>
      </div>
    );
  }

  if (value.node_type === "binary") {
    return (
      <div>
        <Space wrap>
          {nodeTypeSelect}
          <Select
            aria-label={objectMetricText("m6a4b1a3683a3")}
            onChange={(operator) => onChange({ ...value, operator })}
            options={[
              { label: objectMetricText("mf0f0327bc557"), value: "add" },
              { label: objectMetricText("mec2287dc7bf8"), value: "subtract" },
              { label: objectMetricText("md3ea6e17e3b5"), value: "multiply" },
              { label: objectMetricText("md213ae206e7e"), value: "divide" },
              { label: objectMetricText("md4417f86000a"), value: "modulo" },
            ].filter((item) => !allowedOperators || allowedOperators.includes(item.value))}
            value={value.operator}
            style={{ width: 100 }}
          />
        </Space>
        <div
          style={{
            borderLeft: "2px solid var(--color-border)",
            display: "grid",
            gap: 12,
            marginTop: 12,
            paddingLeft: 16,
          }}
        >
          <ObjectMetricExpressionEditor
            acceptedPropertyTypes={["int64", "decimal"]}
            allowedFunctions={allowedFunctions}
            allowedOperators={allowedOperators}
            dependencyAliases={dependencyAliases}
            depth={depth + 1}
            onChange={(left) => onChange({ ...value, left })}
            properties={properties}
            requiresPropertyReference={requiresPropertyReference}
            value={value.left}
          />
          <ObjectMetricExpressionEditor
            acceptedPropertyTypes={["int64", "decimal"]}
            allowedFunctions={allowedFunctions}
            allowedOperators={allowedOperators}
            dependencyAliases={dependencyAliases}
            depth={depth + 1}
            onChange={(right) => onChange({ ...value, right })}
            properties={properties}
            requiresPropertyReference={requiresPropertyReference}
            value={value.right}
          />
        </div>
      </div>
    );
  }

  const selectedFunction =
    availableFunctions.find((item) => item.value === value.function) ??
    availableFunctions[0] ??
    objectMetricFunctionDefinitions[0];
  const firstArgumentType = expressionValueType(value.arguments[0], properties);
  const canAddArgument =
    selectedFunction.maxArguments === undefined ||
    value.arguments.length < selectedFunction.maxArguments;
  const nextArgumentDefinition = functionArgumentAt(selectedFunction, value.arguments.length);

  return (
    <div className={styles.callEditor}>
      <Space wrap>
        {nodeTypeSelect}
        <Select
          aria-label={objectMetricText("m1832990660bb")}
          onChange={(func) => {
            const definition = objectMetricFunctionDefinitions.find((item) => item.value === func);
            if (!definition) return;
            const createArgument = (
              argument: (typeof definition.arguments)[number],
              expectedFirstType?: ExpressionValueType,
            ) => {
              if (argument.literalOnly) {
                return defaultLiteralForArgument(argument, expectedFirstType);
              }
              const acceptedTypes = acceptedTypesForArgument(argument, expectedFirstType);
              const candidates = compatibleProperties(properties, acceptedTypes);
              if (candidates[0]) {
                return createNode("property", candidates, dependencyAliases, true);
              }
              return defaultLiteralForArgument(argument, expectedFirstType);
            };
            const firstDefinition = functionArgumentAt(definition, 0);
            const firstArgument = createArgument(firstDefinition);
            const nextFirstType = expressionValueType(firstArgument, properties);
            const argumentsForFunction = definition.arguments.map((argument, index) =>
              index === 0 ? firstArgument : createArgument(argument, nextFirstType),
            );
            onChange({
              ...value,
              arguments: argumentsForFunction,
              function: func,
            });
          }}
          options={availableFunctions.map(({ label, value: functionName }) => ({
            label,
            value: functionName,
          }))}
          placeholder={objectMetricText("m8f410db7bc6a")}
          value={value.function}
          style={{ width: 220 }}
        />
      </Space>
      <div className={styles.functionDescription}>{selectedFunction.description}</div>
      <div className={styles.argumentList}>
        {value.arguments.map((argument, index) => {
          const argumentDefinition = functionArgumentAt(selectedFunction, index);
          const acceptedTypes = acceptedTypesForArgument(argumentDefinition, firstArgumentType);
          return (
            <div className={styles.argumentRow} key={`${argumentDefinition.key}-${index}`}>
              <div className={styles.argumentHeading}>
                <span>
                  {argumentDefinition.required ? <b>*</b> : null}
                  {argumentDefinition.label}
                </span>
                <small>{argumentDefinition.description}</small>
              </div>
              <div className={styles.argumentEditor}>
                <ObjectMetricExpressionEditor
                  acceptedPropertyTypes={acceptedTypes}
                  allowedFunctions={allowedFunctions}
                  allowedOperators={allowedOperators}
                  dependencyAliases={dependencyAliases}
                  depth={depth + 1}
                  onChange={(next) =>
                    onChange({
                      ...value,
                      arguments: value.arguments.map((item, itemIndex) =>
                        itemIndex === index ? next : item,
                      ),
                    })
                  }
                  properties={properties}
                  requiresPropertyReference={requiresPropertyReference}
                  value={argument}
                />
                <Button
                  aria-label={objectMetricText("mc0620a1380c9", { p0: argumentDefinition.label })}
                  disabled={index < selectedFunction.minArguments}
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    onChange({
                      ...value,
                      arguments: value.arguments.filter((_, itemIndex) => itemIndex !== index),
                    })
                  }
                  type="text"
                />
              </div>
            </div>
          );
        })}
        <Button
          disabled={!canAddArgument}
          icon={<PlusOutlined />}
          onClick={() =>
            onChange({
              ...value,
              arguments: [
                ...value.arguments,
                defaultLiteralForArgument(nextArgumentDefinition, firstArgumentType),
              ],
            })
          }
          type="dashed"
        >
          {objectMetricText("m7a8a11ead507")}
          {nextArgumentDefinition.label}
        </Button>
      </div>
    </div>
  );
}
