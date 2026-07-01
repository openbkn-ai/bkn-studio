/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, DownOutlined, PlusOutlined } from "@ant-design/icons";
import { Table } from "antd";
import type { TableProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { ObjectTypeResourceSelectModal } from "@/modules/knowledge-network/components/object-type/data-attribute/ObjectTypeResourceSelectModal";
import {
  getKnowledgeNetworkObjectTypeDetail,
  listObjectTypeResourceFields,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkObjectTypeRecord,
  ObjectTypeDataSource,
  RelationTypeResourceRowMapping,
  RelationTypeMappingConfig,
} from "@/modules/knowledge-network/types/knowledge-network";

import { createEmptyResourceMapping } from "./mapping-utils";
import { RelationTypeObjectTypeSelect } from "./RelationTypeObjectTypeSelect";
import styles from "./RelationTypeResourceMappingRules.module.css";
import {
  RelationTypePropertySelect,
  type RelationTypePropertyOption,
} from "./RelationTypePropertySelect";

type ResourceTableRow =
  | {
      resourceValue?: string;
      key: string;
      rowType: "object";
      sourceValue?: string;
      targetValue?: string;
    }
  | {
      resourceSource?: string;
      resourceTarget?: string;
      index: number;
      key: string;
      rowType: "property";
      sourceValue?: string;
      targetValue?: string;
    };

type RelationTypeResourceMappingRulesProps = {
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

export function RelationTypeResourceMappingRules({
  networkId,
  objectTypes,
  value,
  onChange,
}: RelationTypeResourceMappingRulesProps) {
  const { t } = useTranslation();
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [sourcePropertyOptions, setSourcePropertyOptions] = useState<RelationTypePropertyOption[]>(
    [],
  );
  const [targetPropertyOptions, setTargetPropertyOptions] = useState<RelationTypePropertyOption[]>(
    [],
  );
  const [resourcePropertyOptions, setResourcePropertyOptions] = useState<
    RelationTypePropertyOption[]
  >([]);

  const updateMappingRules = (patch: Partial<RelationTypeMappingConfig>) => {
    onChange({
      ...value,
      ...patch,
    });
  };

  const loadPropertyOptions = async (objectTypeId: string, target: "source" | "target") => {
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
  };

  const loadResourcePropertyOptions = async (resourceId: string) => {
    if (!resourceId) {
      setResourcePropertyOptions([]);
      return;
    }

    const fields = await listObjectTypeResourceFields(networkId, resourceId);
    setResourcePropertyOptions(mapPropertyOptions(fields));
  };

  useEffect(() => {
    void loadPropertyOptions(value.sourceObjectTypeId, "source");
  }, [networkId, value.sourceObjectTypeId]);

  useEffect(() => {
    void loadPropertyOptions(value.targetObjectTypeId, "target");
  }, [networkId, value.targetObjectTypeId]);

  useEffect(() => {
    void loadResourcePropertyOptions(value.backingDataSourceId);
  }, [networkId, value.backingDataSourceId]);

  const tableRows = useMemo<ResourceTableRow[]>(() => {
    const rows: ResourceTableRow[] = [
      {
        resourceValue: value.backingDataSourceName || value.backingDataSourceId,
        key: "object-row",
        rowType: "object",
        sourceValue: value.sourceObjectTypeId,
        targetValue: value.targetObjectTypeId,
      },
    ];

    value.resourceMappings.forEach((mapping, index) => {
      rows.push({
        resourceSource: mapping.resourceSourcePropertyName,
        resourceTarget: mapping.resourceTargetPropertyName,
        index,
        key: `property-row-${index}`,
        rowType: "property",
        sourceValue: mapping.sourceObjectPropertyName,
        targetValue: mapping.targetObjectPropertyName,
      });
    });

    return rows;
  }, [value]);

  const clearResourceSideMappings = (
    mappings: RelationTypeResourceRowMapping[],
  ): RelationTypeResourceRowMapping[] =>
    mappings.map((item) => ({
      ...item,
      resourceSourcePropertyName: "",
      resourceTargetPropertyName: "",
    }));

  const handleSourceObjectChange = (nextSourceObjectTypeId: string) => {
    updateMappingRules({
      sourceObjectTypeId: nextSourceObjectTypeId,
      resourceMappings: value.resourceMappings.map((item) => ({
        ...item,
        sourceObjectPropertyName: "",
      })),
    });
  };

  const handleTargetObjectChange = (nextTargetObjectTypeId: string) => {
    updateMappingRules({
      targetObjectTypeId: nextTargetObjectTypeId,
      resourceMappings: value.resourceMappings.map((item) => ({
        ...item,
        targetObjectPropertyName: "",
      })),
    });
  };

  const handleResourceChange = (resource: ObjectTypeDataSource) => {
    updateMappingRules({
      backingDataSourceId: resource.id,
      backingDataSourceName: resource.name,
      resourceMappings: clearResourceSideMappings(value.resourceMappings),
    });
  };

  const handleClearObjects = () => {
    updateMappingRules({
      backingDataSourceId: "",
      backingDataSourceName: "",
      sourceObjectTypeId: "",
      targetObjectTypeId: "",
      resourceMappings: value.resourceMappings.map(() => createEmptyResourceMapping()),
    });
  };

  const handleResourceMappingChange = (
    index: number,
    patch: Partial<RelationTypeResourceRowMapping>,
  ) => {
    updateMappingRules({
      resourceMappings: value.resourceMappings.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  };

  const handleDeleteRow = (row: ResourceTableRow) => {
    if (row.rowType === "object") {
      handleClearObjects();
      return;
    }

    if (value.resourceMappings.length === 1) {
      handleResourceMappingChange(row.index, createEmptyResourceMapping());
      return;
    }

    updateMappingRules({
      resourceMappings: value.resourceMappings.filter(
        (_item, itemIndex) => itemIndex !== row.index,
      ),
    });
  };

  const columns: TableProps<ResourceTableRow>["columns"] = [
    {
      dataIndex: "sourceValue",
      key: "sourceValue",
      title: t("knowledgeNetwork.relationTypeMappingSourcePoint"),
      width: 215,
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
              handleResourceMappingChange(row.index, {
                sourceObjectPropertyName: nextValue ?? "",
              })
            }
            placeholder={t("knowledgeNetwork.relationTypeMappingSourcePropertyPlaceholder")}
            value={cellValue || undefined}
          />
        ),
    },
    {
      dataIndex: "resourceValue",
      key: "resourceValue",
      title: t("knowledgeNetwork.relationTypeResourceColumn"),
      width: 400,
      render: (cellValue: string | undefined, row) => {
        if (row.rowType === "object") {
          return (
            <button
              className={styles.resourcePicker}
              onClick={() => setResourceModalOpen(true)}
              type="button"
            >
              <span
                className={
                  cellValue ? styles.resourcePickerValue : styles.resourcePickerPlaceholder
                }
              >
                {cellValue || t("knowledgeNetwork.relationTypeChooseResource")}
              </span>
              <DownOutlined style={{ color: "#d9d9d9", fontSize: 12 }} />
            </button>
          );
        }

        return (
          <div className={styles.resourcePropertyPair}>
            <div className={styles.resourcePropertyPairItem}>
              <RelationTypePropertySelect
                disabled={!value.backingDataSourceId}
                fields={resourcePropertyOptions}
                onChange={(nextValue) =>
                  handleResourceMappingChange(row.index, {
                    resourceSourcePropertyName: nextValue ?? "",
                  })
                }
                placeholder={t("knowledgeNetwork.relationTypeResourceSourcePropertyPlaceholder")}
                value={row.resourceSource || undefined}
              />
            </div>
            <div className={styles.resourcePropertyPairItem}>
              <RelationTypePropertySelect
                disabled={!value.backingDataSourceId}
                fields={resourcePropertyOptions}
                onChange={(nextValue) =>
                  handleResourceMappingChange(row.index, {
                    resourceTargetPropertyName: nextValue ?? "",
                  })
                }
                placeholder={t("knowledgeNetwork.relationTypeResourceTargetPropertyPlaceholder")}
                value={row.resourceTarget || undefined}
              />
            </div>
          </div>
        );
      },
    },
    {
      dataIndex: "targetValue",
      key: "targetValue",
      title: t("knowledgeNetwork.relationTypeMappingTargetPoint"),
      width: 215,
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
              handleResourceMappingChange(row.index, {
                targetObjectPropertyName: nextValue ?? "",
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
      <Table<ResourceTableRow>
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
            resourceMappings: [...value.resourceMappings, createEmptyResourceMapping()],
          });
        }}
        type="link"
      >
        {t("knowledgeNetwork.relationTypeAddPropertyMapping")}
      </AppButton>

      <ObjectTypeResourceSelectModal
        networkId={networkId}
        onCancel={() => setResourceModalOpen(false)}
        onOk={(resource) => {
          handleResourceChange(resource);
          setResourceModalOpen(false);
        }}
        open={resourceModalOpen}
        selectedId={value.backingDataSourceId || undefined}
      />
    </div>
  );
}
