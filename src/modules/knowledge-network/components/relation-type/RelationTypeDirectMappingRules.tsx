/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Table } from "antd";
import type { TableProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkObjectTypeRecord,
  RelationTypeMappingConfig,
  RelationTypePropertyMapping,
} from "@/modules/knowledge-network/types/knowledge-network";

import { createEmptyPropertyMapping } from "./mapping-utils";
import { RelationTypeObjectTypeSelect } from "./RelationTypeObjectTypeSelect";
import styles from "./RelationTypeDirectMappingRules.module.css";
import {
  RelationTypePropertySelect,
  type RelationTypePropertyOption,
} from "./RelationTypePropertySelect";

type MappingTableRow =
  | {
      key: string;
      rowType: "object";
      sourceValue?: string;
      targetValue?: string;
    }
  | {
      index: number;
      key: string;
      rowType: "property";
      sourceValue?: string;
      targetValue?: string;
    };

type RelationTypeDirectMappingRulesProps = {
  networkId: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  value: RelationTypeMappingConfig;
  onChange: (value: RelationTypeMappingConfig) => void;
};

function mapPropertyOptions(
  properties: Array<{ comment?: string; displayName: string; name: string; type: string }>,
): RelationTypePropertyOption[] {
  return properties.map((item) => ({
    comment: item.comment,
    displayName: item.displayName,
    label: item.displayName || item.name,
    name: item.name,
    type: item.type,
    value: item.name,
  }));
}

export function RelationTypeDirectMappingRules({
  networkId,
  objectTypes,
  value,
  onChange,
}: RelationTypeDirectMappingRulesProps) {
  const { t } = useTranslation();
  const [sourcePropertyOptions, setSourcePropertyOptions] = useState<RelationTypePropertyOption[]>(
    [],
  );
  const [targetPropertyOptions, setTargetPropertyOptions] = useState<RelationTypePropertyOption[]>(
    [],
  );

  const updateMappingRules = (patch: Partial<RelationTypeMappingConfig>) => {
    onChange({
      ...value,
      ...patch,
    });
  };

  const loadPropertyOptions = useCallback(
    async (objectTypeId: string, target: "source" | "target") => {
      if (!objectTypeId) {
        if (target === "source") {
          setSourcePropertyOptions([]);
        } else {
          setTargetPropertyOptions([]);
        }
        return;
      }

      const detail = await getKnowledgeNetworkObjectTypeDetail(networkId, objectTypeId);
      const options = mapPropertyOptions(detail?.dataProperties ?? []);

      if (target === "source") {
        setSourcePropertyOptions(options);
      } else {
        setTargetPropertyOptions(options);
      }
    },
    [networkId],
  );

  useEffect(() => {
    void loadPropertyOptions(value.sourceObjectTypeId, "source");
  }, [loadPropertyOptions, value.sourceObjectTypeId]);

  useEffect(() => {
    void loadPropertyOptions(value.targetObjectTypeId, "target");
  }, [loadPropertyOptions, value.targetObjectTypeId]);

  const tableRows = useMemo<MappingTableRow[]>(() => {
    const rows: MappingTableRow[] = [
      {
        key: "object-row",
        rowType: "object",
        sourceValue: value.sourceObjectTypeId,
        targetValue: value.targetObjectTypeId,
      },
    ];

    value.propertyMappings.forEach((mapping, index) => {
      rows.push({
        index,
        key: `property-row-${index}`,
        rowType: "property",
        sourceValue: mapping.sourcePropertyName,
        targetValue: mapping.targetPropertyName,
      });
    });

    return rows;
  }, [value]);

  const handleSourceObjectChange = (nextSourceObjectTypeId: string) => {
    updateMappingRules({
      sourceObjectTypeId: nextSourceObjectTypeId,
      propertyMappings: value.propertyMappings.map((item) => ({
        ...item,
        sourcePropertyName: "",
      })),
    });
  };

  const handleTargetObjectChange = (nextTargetObjectTypeId: string) => {
    updateMappingRules({
      targetObjectTypeId: nextTargetObjectTypeId,
      propertyMappings: value.propertyMappings.map((item) => ({
        ...item,
        targetPropertyName: "",
      })),
    });
  };

  const handleClearObjects = () => {
    updateMappingRules({
      sourceObjectTypeId: "",
      targetObjectTypeId: "",
      propertyMappings: value.propertyMappings.map(() => createEmptyPropertyMapping()),
    });
  };

  const handlePropertyChange = (
    index: number,
    patch: Partial<RelationTypePropertyMapping>,
  ) => {
    updateMappingRules({
      propertyMappings: value.propertyMappings.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  };

  const handleDeleteRow = (row: MappingTableRow) => {
    if (row.rowType === "object") {
      handleClearObjects();
      return;
    }

    if (value.propertyMappings.length === 1) {
      handlePropertyChange(row.index, {
        sourcePropertyName: "",
        targetPropertyName: "",
      });
      return;
    }

    updateMappingRules({
      propertyMappings: value.propertyMappings.filter(
        (_item, itemIndex) => itemIndex !== row.index,
      ),
    });
  };

  const columns: TableProps<MappingTableRow>["columns"] = [
    {
      dataIndex: "rowType",
      key: "rowType",
      title: "",
      width: 100,
      render: (rowType: MappingTableRow["rowType"]) =>
        rowType === "object"
          ? t("knowledgeNetwork.relationTypeMappingObjectRow")
          : t("knowledgeNetwork.relationTypeMappingPropertyRow"),
    },
    {
      dataIndex: "sourceValue",
      key: "sourceValue",
      title: t("knowledgeNetwork.relationTypeMappingSourcePoint"),
      width: 415,
      render: (cellValue: string | undefined, row) =>
        row.rowType === "object" ? (
          <RelationTypeObjectTypeSelect
            objectTypes={objectTypes}
            onChange={(nextValue) => handleSourceObjectChange(nextValue ?? "")}
            placeholder={t("knowledgeNetwork.relationTypeSourceObjectPlaceholder")}
            value={cellValue || undefined}
          />
        ) : (
          <RelationTypePropertySelect
            disabled={!value.sourceObjectTypeId}
            fields={sourcePropertyOptions}
            onChange={(nextValue) =>
              handlePropertyChange(row.index, {
                sourcePropertyName: nextValue ?? "",
              })
            }
            placeholder={t("knowledgeNetwork.relationTypeMappingSourcePropertyPlaceholder")}
            value={cellValue || undefined}
          />
        ),
    },
    {
      dataIndex: "targetValue",
      key: "targetValue",
      title: t("knowledgeNetwork.relationTypeMappingTargetPoint"),
      width: 415,
      render: (cellValue: string | undefined, row) =>
        row.rowType === "object" ? (
          <RelationTypeObjectTypeSelect
            objectTypes={objectTypes}
            onChange={(nextValue) => handleTargetObjectChange(nextValue ?? "")}
            placeholder={t("knowledgeNetwork.relationTypeTargetObjectPlaceholder")}
            value={cellValue || undefined}
          />
        ) : (
          <RelationTypePropertySelect
            disabled={!value.targetObjectTypeId}
            fields={targetPropertyOptions}
            onChange={(nextValue) =>
              handlePropertyChange(row.index, {
                targetPropertyName: nextValue ?? "",
              })
            }
            placeholder={t("knowledgeNetwork.relationTypeMappingTargetPropertyPlaceholder")}
            value={cellValue || undefined}
          />
        ),
    },
    {
      align: "center",
      key: "actions",
      title: t("common.actions"),
      width: 70,
      render: (_value, row) => (
        <AppButton
          aria-label={t("common.delete")}
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteRow(row)}
          type="text"
        />
      ),
    },
  ];

  return (
    <div className={styles.root}>
      <Table<MappingTableRow>
        bordered
        className={styles.mappingTable}
        columns={columns}
        dataSource={tableRows}
        pagination={false}
        rowKey="key"
        scroll={{ x: 960 }}
        size="small"
      />
      <AppButton
        className={styles.addButton}
        icon={<PlusOutlined />}
        onClick={() => {
          updateMappingRules({
            propertyMappings: [...value.propertyMappings, createEmptyPropertyMapping()],
          });
        }}
        type="link"
      >
        {t("knowledgeNetwork.relationTypeAddPropertyMapping")}
      </AppButton>
    </div>
  );
}
