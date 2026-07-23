/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined } from "@ant-design/icons";
import { Input, Select } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import {
  buildGroupedConditionFieldOptions,
  findConditionProperty,
  getConditionOperationLabelKey,
  getConditionOperationsForFieldType,
  resolveConditionOperation,
} from "@/modules/knowledge-network/constants/action-type-condition";
import { RelationTypeObjectTypeSelect } from "@/modules/knowledge-network/components/relation-type/RelationTypeObjectTypeSelect";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import type {
  ActionTypeCondition,
  ActionTypeConditionOperation,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ActionTypeConditionEditor.module.css";

const VALUELESS_OPERATIONS = new Set<ActionTypeConditionOperation>(["exist", "not_exist"]);

type ConditionRowProps = {
  boundObjectTypeId?: string;
  hideObjectTypeSelect?: boolean;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  onChange: (next: ActionTypeCondition) => void;
  onRemove?: () => void;
  propertyOptions: RelationTypePropertyOption[];
  showAddButton?: boolean;
  onAdd?: () => void;
  value: ActionTypeCondition;
};

function ConditionRow({
  boundObjectTypeId,
  hideObjectTypeSelect = false,
  objectTypes,
  onAdd,
  onChange,
  onRemove,
  propertyOptions,
  showAddButton,
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
  const needsValue = currentOperation ? !VALUELESS_OPERATIONS.has(currentOperation) : true;

  const updateRow = (patch: Partial<ActionTypeCondition>) => {
    onChange({
      ...value,
      ...patch,
      objectTypeId: patch.objectTypeId ?? objectTypeId,
      valueFrom: "const",
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
          });
        }}
        options={operationOptions}
        placeholder={t("knowledgeNetwork.actionTypeConditionOperationPlaceholder")}
        value={currentOperation}
      />
      <Input
        className={styles.valueInput}
        disabled={!objectTypeId || !needsValue}
        onChange={(event) => {
          updateRow({ value: event.target.value || undefined });
        }}
        placeholder={t("knowledgeNetwork.actionTypeConditionValueInputPlaceholder")}
        value={scalarValue}
      />
      {showAddButton ? (
        <AppButton
          aria-label={t("knowledgeNetwork.actionTypeConditionAdd")}
          className={styles.addButton}
          disabled={!objectTypeId}
          icon={<PlusOutlined />}
          onClick={onAdd}
        />
      ) : onRemove ? (
        <AppButton className={styles.addButton} onClick={onRemove} type="text">
          {t("common.delete")}
        </AppButton>
      ) : (
        <span className={styles.addButton} />
      )}
    </div>
  );
}

type ActionTypeConditionEditorProps = {
  boundObjectTypeId?: string;
  hideObjectTypeSelect?: boolean;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  propertyOptions: RelationTypePropertyOption[];
  value?: ActionTypeCondition | null;
  onChange?: (value?: ActionTypeCondition | null) => void;
};

export function ActionTypeConditionEditor({
  boundObjectTypeId,
  hideObjectTypeSelect = false,
  objectTypes,
  propertyOptions,
  value,
  onChange,
}: ActionTypeConditionEditorProps) {
  const rootCondition: ActionTypeCondition = value ?? {
    objectTypeId: boundObjectTypeId,
    valueFrom: "const",
  };
  const subConditions = rootCondition.subConditions ?? [];

  const updateRoot = (next: ActionTypeCondition) => {
    const hasContent =
      next.field ||
      next.operation ||
      next.value !== undefined ||
      (next.subConditions?.length ?? 0) > 0;

    if (!hasContent && !next.objectTypeId) {
      onChange?.(null);
      return;
    }

    onChange?.({
      ...next,
      objectTypeId: next.objectTypeId || boundObjectTypeId,
      valueFrom: "const",
    });
  };

  const handleAddRow = () => {
    updateRoot({
      ...rootCondition,
      subConditions: [
        ...subConditions,
        { objectTypeId: rootCondition.objectTypeId || boundObjectTypeId, valueFrom: "const" },
      ],
    });
  };

  const handleSubConditionChange = (index: number, next: ActionTypeCondition) => {
    const nextSubConditions = [...subConditions];
    nextSubConditions[index] = next;
    updateRoot({
      ...rootCondition,
      subConditions: nextSubConditions,
    });
  };

  const handleRemoveSubCondition = (index: number) => {
    updateRoot({
      ...rootCondition,
      subConditions: subConditions.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  return (
    <div className={styles.conditionList}>
      <ConditionRow
        boundObjectTypeId={boundObjectTypeId}
        hideObjectTypeSelect={hideObjectTypeSelect}
        objectTypes={objectTypes}
        onAdd={handleAddRow}
        onChange={updateRoot}
        propertyOptions={propertyOptions}
        showAddButton
        value={rootCondition}
      />
      {subConditions.map((item, index) => (
        <ConditionRow
          boundObjectTypeId={boundObjectTypeId}
          hideObjectTypeSelect={hideObjectTypeSelect}
          key={`condition-${index}`}
          objectTypes={objectTypes}
          onChange={(next) => handleSubConditionChange(index, next)}
          onRemove={() => handleRemoveSubCondition(index)}
          propertyOptions={propertyOptions}
          value={item}
        />
      ))}
    </div>
  );
}
