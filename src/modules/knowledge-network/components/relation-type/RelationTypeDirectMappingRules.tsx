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
  RelationTypeMappingConfig,
  RelationTypePropertyMapping,
} from "@/modules/knowledge-network/types/knowledge-network";

import { type RelationTypeMappingReaders, createEmptyPropertyMapping } from "./mapping-utils";
import styles from "./RelationTypeDirectMappingRules.module.css";
import {
  RelationTypePropertySelect,
  type RelationTypePropertyOption,
} from "./RelationTypePropertySelect";

type MappingTableRow = {
  index: number;
  key: string;
  sourceValue?: string;
  targetValue?: string;
};

/** The join field pairs of a direct relation; its ends are chosen above them. */
type RelationTypeDirectMappingRulesProps = {
  networkId: string;
  /** Reads properties and fields from elsewhere than the network, as a project's draft does. */
  readers?: RelationTypeMappingReaders;
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
  readers,
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

      const options = mapPropertyOptions(
        readers
          ? await readers.readObjectTypeProperties(objectTypeId)
          : ((await getKnowledgeNetworkObjectTypeDetail(networkId, objectTypeId))?.dataProperties ??
              []),
      );

      if (target === "source") {
        setSourcePropertyOptions(options);
      } else {
        setTargetPropertyOptions(options);
      }
    },
    [networkId, readers],
  );

  useEffect(() => {
    void loadPropertyOptions(value.sourceObjectTypeId, "source");
  }, [loadPropertyOptions, value.sourceObjectTypeId]);

  useEffect(() => {
    void loadPropertyOptions(value.targetObjectTypeId, "target");
  }, [loadPropertyOptions, value.targetObjectTypeId]);

  const tableRows = useMemo<MappingTableRow[]>(
    () =>
      value.propertyMappings.map((mapping, index) => ({
        index,
        key: `property-row-${index}`,
        sourceValue: mapping.sourcePropertyName,
        targetValue: mapping.targetPropertyName,
      })),
    [value],
  );

  const handlePropertyChange = (index: number, patch: Partial<RelationTypePropertyMapping>) => {
    updateMappingRules({
      propertyMappings: value.propertyMappings.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  };

  const handleDeleteRow = (row: MappingTableRow) => {
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
      dataIndex: "sourceValue",
      key: "sourceValue",
      title: t("knowledgeNetwork.relationTypeMappingSourcePoint"),
      render: (cellValue: string | undefined, row) => (
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
      render: (cellValue: string | undefined, row) => (
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
