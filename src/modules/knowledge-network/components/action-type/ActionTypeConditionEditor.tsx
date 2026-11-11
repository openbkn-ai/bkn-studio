/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApartmentOutlined, PlusOutlined } from "@ant-design/icons";
import { Input, Select } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import {
  buildGroupedConditionFieldOptions,
  findConditionProperty,
  getConditionOperationLabelKey,
  getConditionOperationsForFieldType,
  conditionNeedsArray,
  isConditionReferenceCompatible,
  resolveConditionOperation,
} from "@/modules/knowledge-network/constants/action-type-condition";
import { RelationTypeObjectTypeSelect } from "@/modules/knowledge-network/components/relation-type/RelationTypeObjectTypeSelect";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import type {
  ActionTypeCondition,
  ActionTypeConditionOperation,
  ActionTypeExecutionParameter,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ActionTypeConditionEditor.module.css";

const VALUELESS_OPERATIONS = new Set<ActionTypeConditionOperation>(["exist", "not_exist"]);
const LOGIC_OPERATIONS = new Set<ActionTypeConditionOperation>(["and", "or"]);

function isValuelessOperation(operation?: ActionTypeConditionOperation) {
  return operation !== undefined && VALUELESS_OPERATIONS.has(operation);
}

function createEmptyConditionRow(objectTypeId?: string): ActionTypeCondition {
  return {
    objectTypeId,
    valueFrom: "const",
  };
}

function createConditionGroup(objectTypeId?: string): ActionTypeCondition {
  return {
    objectTypeId,
    operation: "and",
    subConditions: [createEmptyConditionRow(objectTypeId), createEmptyConditionRow(objectTypeId)],
    valueFrom: "const",
  };
}

function isLogicCondition(condition: ActionTypeCondition) {
  return condition.operation !== undefined && LOGIC_OPERATIONS.has(condition.operation);
}

function hasConditionContent(condition: ActionTypeCondition): boolean {
  return Boolean(
    condition.field ||
    condition.operation ||
    condition.value !== undefined ||
    condition.subConditions?.some(hasConditionContent),
  );
}

type ConditionRowProps = {
  boundObjectTypeId?: string;
  hideObjectTypeSelect?: boolean;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  onChange: (next: ActionTypeCondition) => void;
  onRemove?: () => void;
  onAddGroup?: () => void;
  propertyOptions: RelationTypePropertyOption[];
  executionParameters: ActionTypeExecutionParameter[];
  showAddButton?: boolean;
  showAddGroupButton?: boolean;
  onAdd?: () => void;
  value: ActionTypeCondition;
};

function ConditionRow({
  boundObjectTypeId,
  hideObjectTypeSelect = false,
  objectTypes,
  onAdd,
  onAddGroup,
  onChange,
  onRemove,
  propertyOptions,
  executionParameters,
  showAddButton,
  showAddGroupButton,
  value,
}: ConditionRowProps) {
  const { t } = useTranslation();

  const selectableObjectTypes = useMemo(() => {
    if (!boundObjectTypeId) {
      return objectTypes;
    }

    return objectTypes.filter((item) => item.id === boundObjectTypeId);
  }, [boundObjectTypeId, objectTypes]);

  const objectTypeId = value.objectTypeId || boundObjectTypeId;
  const selectedProperty = findConditionProperty(propertyOptions, value.field);
  const fieldType = selectedProperty?.type;
  const fieldOptions = useMemo(
    () => buildGroupedConditionFieldOptions(propertyOptions),
    [propertyOptions],
  );

  const operationOptions = useMemo(
    () =>
      getConditionOperationsForFieldType(fieldType).map((operation) => ({
        label: t(getConditionOperationLabelKey(operation)),
        value: operation,
      })),
    [fieldType, t],
  );

  const currentOperation = value.operation;
  const needsValue = currentOperation ? !isValuelessOperation(currentOperation) : true;
  const valueFrom = value.valueFrom ?? "const";
  const referenceOptions =
    valueFrom === "property"
      ? propertyOptions
          .filter((item) => isConditionReferenceCompatible(fieldType, item.type, currentOperation))
          .map((item) => ({ label: item.displayName || item.name, value: item.name }))
      : executionParameters
          .filter(
            (item) =>
              item.name.trim() &&
              (item.valueFrom ?? "input") === "input" &&
              isConditionReferenceCompatible(fieldType, item.type, currentOperation),
          )
          .map((item) => ({ label: item.name, value: item.name }));

  const updateRow = (patch: Partial<ActionTypeCondition>) => {
    onChange({
      ...value,
      ...patch,
      objectTypeId: patch.objectTypeId ?? objectTypeId,
      valueFrom: patch.valueFrom ?? value.valueFrom ?? "const",
    });
  };

  const scalarValue = Array.isArray(value.value)
    ? value.value.join(",")
    : value.value === undefined || value.value === null
      ? ""
      : String(value.value);

  return (
    <div className={styles.conditionRow}>
      {!hideObjectTypeSelect ? (
        <div className={styles.objectTypeSelect}>
          <RelationTypeObjectTypeSelect
            allowClear={!boundObjectTypeId}
            disabled={Boolean(boundObjectTypeId)}
            objectTypes={selectableObjectTypes}
            onChange={(nextObjectTypeId) => {
              updateRow({
                field: undefined,
                objectTypeId: nextObjectTypeId,
                operation: undefined,
                value: undefined,
              });
            }}
            placeholder={t("knowledgeNetwork.actionTypeConditionObjectPlaceholder")}
            value={objectTypeId}
          />
        </div>
      ) : null}
      <div className={styles.fieldSelect}>
        <Select
          allowClear
          disabled={!objectTypeId}
          onChange={(nextField) => {
            const property = findConditionProperty(propertyOptions, nextField ?? undefined);
            updateRow({
              field: nextField ?? undefined,
              operation: resolveConditionOperation(property?.type, value.operation),
              value: undefined,
            });
          }}
          options={fieldOptions}
          placeholder={t("knowledgeNetwork.actionTypeConditionFieldPlaceholder")}
          showSearch
          value={value.field}
        />
      </div>
      <Select<ActionTypeConditionOperation>
        allowClear
        className={styles.operationSelect}
        disabled={!objectTypeId || !value.field}
        onChange={(nextOperation) => {
          updateRow({
            operation: resolveConditionOperation(fieldType, nextOperation ?? undefined),
            value: undefined,
            valueFrom: isValuelessOperation(nextOperation) ? "const" : valueFrom,
          });
        }}
        options={operationOptions}
        placeholder={t("knowledgeNetwork.actionTypeConditionOperationPlaceholder")}
        value={currentOperation}
      />
      {needsValue ? (
        <div className={styles.valueEditor}>
          <Select
            aria-label={t("knowledgeNetwork.actionTypeConditionValueSource")}
            className={styles.valueSource}
            disabled={!objectTypeId || !value.field}
            onChange={(nextValueFrom: NonNullable<ActionTypeCondition["valueFrom"]>) => {
              updateRow({ valueFrom: nextValueFrom, value: undefined });
            }}
            options={(["const", "property", "input"] as const).map((source) => ({
              label: t(
                {
                  const: "knowledgeNetwork.actionTypeExecutionValueFromConst",
                  property: "knowledgeNetwork.actionTypeExecutionValueFromProperty",
                  input: "knowledgeNetwork.actionTypeExecutionValueFromInput",
                }[source],
              ),
              value: source,
            }))}
            value={valueFrom}
          />
          {valueFrom === "const" ? (
            <Input
              className={styles.valueInput}
              disabled={!objectTypeId}
              onChange={(event) => {
                updateRow({ value: event.target.value || undefined });
              }}
              placeholder={t(
                conditionNeedsArray(currentOperation)
                  ? "knowledgeNetwork.actionTypeConditionArrayPlaceholder"
                  : "knowledgeNetwork.actionTypeConditionValueInputPlaceholder",
              )}
              value={scalarValue}
            />
          ) : (
            <Select
              allowClear
              aria-label={t(
                valueFrom === "property"
                  ? "knowledgeNetwork.actionTypeConditionPropertyPlaceholder"
                  : "knowledgeNetwork.actionTypeConditionParameterPlaceholder",
              )}
              className={styles.valueInput}
              disabled={!objectTypeId || !value.field}
              notFoundContent={t(
                valueFrom === "property"
                  ? "knowledgeNetwork.actionTypeConditionNoProperties"
                  : "knowledgeNetwork.actionTypeConditionNoParameters",
              )}
              onChange={(nextValue: string | undefined) => updateRow({ value: nextValue })}
              optionFilterProp="label"
              options={referenceOptions}
              placeholder={t(
                valueFrom === "property"
                  ? "knowledgeNetwork.actionTypeConditionPropertyPlaceholder"
                  : "knowledgeNetwork.actionTypeConditionParameterPlaceholder",
              )}
              showSearch
              value={typeof value.value === "string" ? value.value : undefined}
            />
          )}
        </div>
      ) : null}
      <div className={styles.rowActions}>
        {showAddButton ? (
          <AppButton
            aria-label={t("knowledgeNetwork.actionTypeConditionAdd")}
            className={styles.addButton}
            disabled={!objectTypeId}
            icon={<PlusOutlined />}
            onClick={onAdd}
          />
        ) : null}
        {showAddGroupButton ? (
          <AppButton
            aria-label={t("knowledgeNetwork.actionTypeConditionAddGroup")}
            className={styles.addButton}
            disabled={!objectTypeId}
            icon={<ApartmentOutlined />}
            onClick={onAddGroup}
          />
        ) : null}
        {onRemove ? (
          <AppButton className={styles.deleteButton} onClick={onRemove} type="text">
            {t("common.delete")}
          </AppButton>
        ) : null}
      </div>
    </div>
  );
}

type ActionTypeConditionEditorProps = {
  boundObjectTypeId?: string;
  hideObjectTypeSelect?: boolean;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  propertyOptions: RelationTypePropertyOption[];
  executionParameters?: ActionTypeExecutionParameter[];
  value?: ActionTypeCondition | null;
  onChange?: (value?: ActionTypeCondition | null) => void;
};

type ConditionRowsEditorProps = {
  boundObjectTypeId?: string;
  groupOperation: Extract<ActionTypeConditionOperation, "and" | "or">;
  hideObjectTypeSelect: boolean;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  onChange: (
    rows: ActionTypeCondition[],
    groupOperation?: Extract<ActionTypeConditionOperation, "and" | "or">,
  ) => void;
  onRemove?: () => void;
  propertyOptions: RelationTypePropertyOption[];
  executionParameters: ActionTypeExecutionParameter[];
  rows: ActionTypeCondition[];
  showGroupHeader: boolean;
};

function ConditionRowsEditor({
  boundObjectTypeId,
  groupOperation,
  hideObjectTypeSelect,
  objectTypes,
  onChange,
  onRemove,
  propertyOptions,
  executionParameters,
  rows,
  showGroupHeader,
}: ConditionRowsEditorProps) {
  const { t } = useTranslation();
  const visibleRows = rows.length > 0 ? rows : [createEmptyConditionRow(boundObjectTypeId)];

  const updateRow = (index: number, next: ActionTypeCondition) => {
    const nextRows = [...visibleRows];
    nextRows[index] = next;
    onChange(nextRows);
  };

  const addRow = () => {
    onChange([...visibleRows, createEmptyConditionRow(boundObjectTypeId)]);
  };

  const addGroup = () => {
    onChange([...visibleRows, createConditionGroup(boundObjectTypeId)]);
  };

  const removeRow = (index: number) => {
    onChange(visibleRows.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className={showGroupHeader ? styles.conditionGroup : styles.conditionList}>
      {showGroupHeader ? (
        <div className={styles.groupHeader}>
          <span className={styles.groupLabel}>
            {t("knowledgeNetwork.actionTypeConditionGroupLogic")}
          </span>
          <Select<Extract<ActionTypeConditionOperation, "and" | "or">>
            className={styles.groupSelect}
            onChange={(nextOperation) => onChange(visibleRows, nextOperation)}
            options={[
              { label: t("knowledgeNetwork.actionTypeConditionGroupAnd"), value: "and" },
              { label: t("knowledgeNetwork.actionTypeConditionGroupOr"), value: "or" },
            ]}
            style={{ width: 88 }}
            value={groupOperation}
          />
          {onRemove ? (
            <AppButton onClick={onRemove} type="text">
              {t("common.delete")}
            </AppButton>
          ) : null}
        </div>
      ) : null}
      {visibleRows.map((item, index) =>
        isLogicCondition(item) ? (
          <ConditionRowsEditor
            executionParameters={executionParameters}
            boundObjectTypeId={boundObjectTypeId}
            groupOperation={item.operation === "or" ? "or" : "and"}
            hideObjectTypeSelect={hideObjectTypeSelect}
            key={`condition-group-${index}`}
            objectTypes={objectTypes}
            onChange={(nextRows, nextGroupOperation) => {
              updateRow(index, {
                ...item,
                objectTypeId: item.objectTypeId || boundObjectTypeId,
                operation: nextGroupOperation ?? (item.operation === "or" ? "or" : "and"),
                subConditions: nextRows,
                valueFrom: "const",
              });
            }}
            onRemove={visibleRows.length > 1 ? () => removeRow(index) : undefined}
            propertyOptions={propertyOptions}
            rows={item.subConditions ?? []}
            showGroupHeader
          />
        ) : (
          <ConditionRow
            executionParameters={executionParameters}
            boundObjectTypeId={boundObjectTypeId}
            hideObjectTypeSelect={hideObjectTypeSelect}
            key={`condition-${index}`}
            objectTypes={objectTypes}
            onAdd={index === visibleRows.length - 1 ? addRow : undefined}
            onAddGroup={index === visibleRows.length - 1 ? addGroup : undefined}
            onChange={(next) => updateRow(index, next)}
            onRemove={visibleRows.length > 1 ? () => removeRow(index) : undefined}
            propertyOptions={propertyOptions}
            showAddButton={index === visibleRows.length - 1}
            showAddGroupButton={index === visibleRows.length - 1}
            value={item}
          />
        ),
      )}
    </div>
  );
}

export function ActionTypeConditionEditor({
  boundObjectTypeId,
  hideObjectTypeSelect = false,
  objectTypes,
  propertyOptions,
  executionParameters = [],
  value,
  onChange,
}: ActionTypeConditionEditorProps) {
  const rootCondition: ActionTypeCondition = value ?? {
    objectTypeId: boundObjectTypeId,
    valueFrom: "const",
  };
  const isLogicGroup = isLogicCondition(rootCondition);
  const conditionRows = isLogicGroup
    ? (rootCondition.subConditions ?? [])
    : [{ ...rootCondition, subConditions: undefined }, ...(rootCondition.subConditions ?? [])];
  const rows =
    conditionRows.length > 0 ? conditionRows : [createEmptyConditionRow(boundObjectTypeId)];
  const groupOperation: Extract<ActionTypeConditionOperation, "and" | "or"> =
    rootCondition.operation === "or" ? "or" : "and";

  const updateRows = (nextRows: ActionTypeCondition[], nextGroupOperation = groupOperation) => {
    const normalizedRows = nextRows.map((item) => ({
      ...item,
      objectTypeId: item.objectTypeId || boundObjectTypeId,
      value: isValuelessOperation(item.operation) ? undefined : item.value,
      valueFrom: isValuelessOperation(item.operation)
        ? ("const" as const)
        : (item.valueFrom ?? "const"),
    }));
    const contentRows = normalizedRows.filter(hasConditionContent);

    if (contentRows.length === 0 && normalizedRows.length <= 1) {
      onChange?.(null);
      return;
    }

    if (contentRows.length === 1 && normalizedRows.length <= 1) {
      onChange?.({
        ...contentRows[0],
        objectTypeId: contentRows[0].objectTypeId || boundObjectTypeId,
      });
      return;
    }

    onChange?.({
      objectTypeId: boundObjectTypeId,
      operation: nextGroupOperation,
      subConditions: normalizedRows,
      valueFrom: "const",
    });
  };

  return (
    <ConditionRowsEditor
      executionParameters={executionParameters}
      boundObjectTypeId={boundObjectTypeId}
      groupOperation={groupOperation}
      hideObjectTypeSelect={hideObjectTypeSelect}
      objectTypes={objectTypes}
      onChange={updateRows}
      propertyOptions={propertyOptions}
      rows={rows}
      showGroupHeader={rows.length > 1}
    />
  );
}
