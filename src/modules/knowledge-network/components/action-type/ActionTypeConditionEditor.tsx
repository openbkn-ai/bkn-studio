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
import {
  asLeaf,
  hasLeafContent,
  isLogicalOperation,
  promoteLegacyActionCondition,
} from "@/modules/knowledge-network/utils/action-type-condition";

import styles from "./ActionTypeConditionEditor.module.css";

const VALUELESS_OPERATIONS = new Set<ActionTypeConditionOperation>(["exist", "not_exist"]);

type ConditionRowProps = {
  boundObjectTypeId?: string;
  hideObjectTypeSelect?: boolean;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  onChange: (next: ActionTypeCondition) => void;
  onRemove?: () => void;
  propertyOptions: RelationTypePropertyOption[];
  value: ActionTypeCondition;
};

function ConditionRow({
  boundObjectTypeId,
  hideObjectTypeSelect = false,
  objectTypes,
  onChange,
  onRemove,
  propertyOptions,
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
      {onRemove ? (
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

function rowHasDraftContent(cond?: ActionTypeCondition): boolean {
  if (!cond) {
    return false;
  }
  return Boolean(
    cond.field ||
      cond.operation ||
      cond.value !== undefined ||
      cond.objectTypeId ||
      hasLeafContent(cond),
  );
}

export function ActionTypeConditionEditor({
  boundObjectTypeId,
  hideObjectTypeSelect = false,
  objectTypes,
  propertyOptions,
  value,
  onChange,
}: ActionTypeConditionEditorProps) {
  const { t } = useTranslation();
  const normalized = useMemo(
    () => promoteLegacyActionCondition(value),
    [value],
  );
  const logicalOperation = isLogicalOperation(normalized?.operation)
    ? normalized.operation
    : undefined;
  const rows = useMemo(() => {
    if (logicalOperation) {
      const leaves = (normalized?.subConditions ?? []).map((item) =>
        asLeaf(item, boundObjectTypeId),
      );
      if (leaves.length > 0) {
        return leaves;
      }
    }
    if (normalized) {
      return [asLeaf(normalized, boundObjectTypeId)];
    }
    return [
      {
        objectTypeId: boundObjectTypeId,
        valueFrom: "const" as const,
      },
    ];
  }, [boundObjectTypeId, logicalOperation, normalized]);

  const emitRows = (nextRows: ActionTypeCondition[]) => {
    const draftRows = nextRows.filter(rowHasDraftContent);
    if (draftRows.length === 0) {
      onChange?.(null);
      return;
    }

    if (draftRows.length === 1 && !logicalOperation) {
      onChange?.(asLeaf(draftRows[0], boundObjectTypeId));
      return;
    }

    const op: "and" | "or" = logicalOperation ?? "and";
    onChange?.({
      objectTypeId: draftRows[0]?.objectTypeId || boundObjectTypeId,
      operation: op,
      subConditions: draftRows.map((item) => asLeaf(item, boundObjectTypeId)),
      valueFrom: "const",
    });
  };

  const handleAddRow = () => {
    emitRows([
      ...rows,
      {
        objectTypeId: rows[0]?.objectTypeId || boundObjectTypeId,
        valueFrom: "const",
      },
    ]);
  };

  const handleRowChange = (index: number, next: ActionTypeCondition) => {
    const nextRows = [...rows];
    nextRows[index] = next;
    emitRows(nextRows);
  };

  const handleRemoveRow = (index: number) => {
    emitRows(rows.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className={styles.conditionList}>
      {rows.map((item, index) => (
        <ConditionRow
          boundObjectTypeId={boundObjectTypeId}
          hideObjectTypeSelect={hideObjectTypeSelect}
          key={`condition-${index}`}
          objectTypes={objectTypes}
          onChange={(next) => handleRowChange(index, next)}
          onRemove={rows.length > 1 ? () => handleRemoveRow(index) : undefined}
          propertyOptions={propertyOptions}
          value={item}
        />
      ))}
      <AppButton
        className={styles.addConditionButton}
        disabled={!rows[0]?.objectTypeId && !boundObjectTypeId}
        icon={<PlusOutlined />}
        onClick={handleAddRow}
        type="dashed"
      >
        {t("knowledgeNetwork.actionTypeConditionAdd")}
      </AppButton>
    </div>
  );
}
