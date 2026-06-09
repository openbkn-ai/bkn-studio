import { DeleteOutlined, DownOutlined, PlusOutlined } from "@ant-design/icons";
import { Table } from "antd";
import type { TableProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { ObjectTypeDataViewSelectModal } from "@/modules/knowledge-network/components/object-type/data-attribute/ObjectTypeDataViewSelectModal";
import {
  getKnowledgeNetworkObjectTypeDetail,
  listObjectTypeDataViewFields,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkObjectTypeRecord,
  ObjectTypeDataSource,
  RelationTypeDataViewRowMapping,
  RelationTypeMappingConfig,
} from "@/modules/knowledge-network/types/knowledge-network";

import { createEmptyDataViewMapping } from "./mapping-utils";
import { RelationTypeObjectTypeSelect } from "./RelationTypeObjectTypeSelect";
import styles from "./RelationTypeDataViewMappingRules.module.css";
import {
  RelationTypePropertySelect,
  type RelationTypePropertyOption,
} from "./RelationTypePropertySelect";

type DataViewTableRow =
  | {
      dataViewValue?: string;
      key: string;
      rowType: "object";
      sourceValue?: string;
      targetValue?: string;
    }
  | {
      dataViewSource?: string;
      dataViewTarget?: string;
      index: number;
      key: string;
      rowType: "property";
      sourceValue?: string;
      targetValue?: string;
    };

type RelationTypeDataViewMappingRulesProps = {
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

export function RelationTypeDataViewMappingRules({
  networkId,
  objectTypes,
  value,
  onChange,
}: RelationTypeDataViewMappingRulesProps) {
  const { t } = useTranslation();
  const [dataViewModalOpen, setDataViewModalOpen] = useState(false);
  const [sourcePropertyOptions, setSourcePropertyOptions] = useState<RelationTypePropertyOption[]>(
    [],
  );
  const [targetPropertyOptions, setTargetPropertyOptions] = useState<RelationTypePropertyOption[]>(
    [],
  );
  const [dataViewPropertyOptions, setDataViewPropertyOptions] = useState<
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

  const loadDataViewPropertyOptions = async (dataViewId: string) => {
    if (!dataViewId) {
      setDataViewPropertyOptions([]);
      return;
    }

    const fields = await listObjectTypeDataViewFields(networkId, dataViewId);
    setDataViewPropertyOptions(mapPropertyOptions(fields));
  };

  useEffect(() => {
    void loadPropertyOptions(value.sourceObjectTypeId, "source");
  }, [networkId, value.sourceObjectTypeId]);

  useEffect(() => {
    void loadPropertyOptions(value.targetObjectTypeId, "target");
  }, [networkId, value.targetObjectTypeId]);

  useEffect(() => {
    void loadDataViewPropertyOptions(value.backingDataSourceId);
  }, [networkId, value.backingDataSourceId]);

  const tableRows = useMemo<DataViewTableRow[]>(() => {
    const rows: DataViewTableRow[] = [
      {
        dataViewValue: value.backingDataSourceName || value.backingDataSourceId,
        key: "object-row",
        rowType: "object",
        sourceValue: value.sourceObjectTypeId,
        targetValue: value.targetObjectTypeId,
      },
    ];

    value.dataViewMappings.forEach((mapping, index) => {
      rows.push({
        dataViewSource: mapping.dataViewSourcePropertyName,
        dataViewTarget: mapping.dataViewTargetPropertyName,
        index,
        key: `property-row-${index}`,
        rowType: "property",
        sourceValue: mapping.sourceObjectPropertyName,
        targetValue: mapping.targetObjectPropertyName,
      });
    });

    return rows;
  }, [value]);

  const clearDataViewSideMappings = (
    mappings: RelationTypeDataViewRowMapping[],
  ): RelationTypeDataViewRowMapping[] =>
    mappings.map((item) => ({
      ...item,
      dataViewSourcePropertyName: "",
      dataViewTargetPropertyName: "",
    }));

  const handleSourceObjectChange = (nextSourceObjectTypeId: string) => {
    updateMappingRules({
      sourceObjectTypeId: nextSourceObjectTypeId,
      dataViewMappings: value.dataViewMappings.map((item) => ({
        ...item,
        sourceObjectPropertyName: "",
      })),
    });
  };

  const handleTargetObjectChange = (nextTargetObjectTypeId: string) => {
    updateMappingRules({
      targetObjectTypeId: nextTargetObjectTypeId,
      dataViewMappings: value.dataViewMappings.map((item) => ({
        ...item,
        targetObjectPropertyName: "",
      })),
    });
  };

  const handleDataViewChange = (dataView: ObjectTypeDataSource) => {
    updateMappingRules({
      backingDataSourceId: dataView.id,
      backingDataSourceName: dataView.name,
      dataViewMappings: clearDataViewSideMappings(value.dataViewMappings),
    });
  };

  const handleClearObjects = () => {
    updateMappingRules({
      backingDataSourceId: "",
      backingDataSourceName: "",
      sourceObjectTypeId: "",
      targetObjectTypeId: "",
      dataViewMappings: value.dataViewMappings.map(() => createEmptyDataViewMapping()),
    });
  };

  const handleDataViewMappingChange = (
    index: number,
    patch: Partial<RelationTypeDataViewRowMapping>,
  ) => {
    updateMappingRules({
      dataViewMappings: value.dataViewMappings.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  };

  const handleDeleteRow = (row: DataViewTableRow) => {
    if (row.rowType === "object") {
      handleClearObjects();
      return;
    }

    if (value.dataViewMappings.length === 1) {
      handleDataViewMappingChange(row.index, createEmptyDataViewMapping());
      return;
    }

    updateMappingRules({
      dataViewMappings: value.dataViewMappings.filter(
        (_item, itemIndex) => itemIndex !== row.index,
      ),
    });
  };

  const columns: TableProps<DataViewTableRow>["columns"] = [
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
              handleDataViewMappingChange(row.index, {
                sourceObjectPropertyName: nextValue ?? "",
              })
            }
            placeholder={t("knowledgeNetwork.relationTypeMappingSourcePropertyPlaceholder")}
            value={cellValue || undefined}
          />
        ),
    },
    {
      dataIndex: "dataViewValue",
      key: "dataViewValue",
      title: t("knowledgeNetwork.relationTypeDataViewColumn"),
      width: 400,
      render: (cellValue: string | undefined, row) => {
        if (row.rowType === "object") {
          return (
            <button
              className={styles.dataViewPicker}
              onClick={() => setDataViewModalOpen(true)}
              type="button"
            >
              <span
                className={
                  cellValue ? styles.dataViewPickerValue : styles.dataViewPickerPlaceholder
                }
              >
                {cellValue || t("knowledgeNetwork.relationTypeChooseDataView")}
              </span>
              <DownOutlined style={{ color: "#d9d9d9", fontSize: 12 }} />
            </button>
          );
        }

        return (
          <div className={styles.dataViewPropertyPair}>
            <div className={styles.dataViewPropertyPairItem}>
              <RelationTypePropertySelect
                disabled={!value.backingDataSourceId}
                fields={dataViewPropertyOptions}
                onChange={(nextValue) =>
                  handleDataViewMappingChange(row.index, {
                    dataViewSourcePropertyName: nextValue ?? "",
                  })
                }
                placeholder={t("knowledgeNetwork.relationTypeDataViewSourcePropertyPlaceholder")}
                value={row.dataViewSource || undefined}
              />
            </div>
            <div className={styles.dataViewPropertyPairItem}>
              <RelationTypePropertySelect
                disabled={!value.backingDataSourceId}
                fields={dataViewPropertyOptions}
                onChange={(nextValue) =>
                  handleDataViewMappingChange(row.index, {
                    dataViewTargetPropertyName: nextValue ?? "",
                  })
                }
                placeholder={t("knowledgeNetwork.relationTypeDataViewTargetPropertyPlaceholder")}
                value={row.dataViewTarget || undefined}
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
              handleDataViewMappingChange(row.index, {
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
      <Table<DataViewTableRow>
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
            dataViewMappings: [...value.dataViewMappings, createEmptyDataViewMapping()],
          });
        }}
        type="link"
      >
        {t("knowledgeNetwork.relationTypeAddPropertyMapping")}
      </AppButton>

      <ObjectTypeDataViewSelectModal
        networkId={networkId}
        onCancel={() => setDataViewModalOpen(false)}
        onOk={(dataView) => {
          handleDataViewChange(dataView);
          setDataViewModalOpen(false);
        }}
        open={dataViewModalOpen}
        selectedId={value.backingDataSourceId || undefined}
      />
    </div>
  );
}
