import { Table, Tooltip } from "antd";
import type { TableProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { FieldTypeIcon } from "@/modules/knowledge-network/components/object-type/data-attribute/FieldTypeIcon";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import {
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkObjectTypeRecord,
  ObjectTypeDetail,
  RelationTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./RelationTypeMappingConfigTable.module.css";

type DirectConfigRow = {
  key: string;
  rowType: "object" | "property";
  sourceName?: string;
  targetName?: string;
  typeLabel: string;
};

type DataViewConfigRow = {
  dataViewSourceName?: string;
  dataViewTargetName?: string;
  key: string;
  rowType: "object" | "property";
  sourceName?: string;
  targetName?: string;
};

type RelationTypeMappingConfigTableProps = {
  detail: RelationTypeDetail;
  networkId: string;
};

function resolvePropertyMeta(
  objectTypeDetail: ObjectTypeDetail | null,
  propertyName?: string,
) {
  if (!propertyName) {
    return null;
  }

  return objectTypeDetail?.dataProperties.find((item) => item.name === propertyName) ?? null;
}

function PropertyCell({
  emptyLabel,
  objectTypeDetail,
  propertyName,
}: {
  emptyLabel: string;
  objectTypeDetail: ObjectTypeDetail | null;
  propertyName?: string;
}) {
  if (!propertyName) {
    return <span className={styles.emptyValue}>{emptyLabel}</span>;
  }

  const property = resolvePropertyMeta(objectTypeDetail, propertyName);
  const displayName = property?.displayName || propertyName;

  return (
    <div className={styles.propertyCell} title={displayName}>
      <FieldTypeIcon type={property?.type} />
      <span className={styles.propertyName}>{displayName}</span>
    </div>
  );
}

function ObjectCell({
  emptyLabel,
  name,
  objectType,
}: {
  emptyLabel: string;
  name?: string;
  objectType?: KnowledgeNetworkObjectTypeRecord;
}) {
  if (!name) {
    return <span className={styles.emptyValue}>{emptyLabel}</span>;
  }

  return (
    <div className={styles.objectCell} title={name}>
      <span
        className={styles.objectIcon}
        style={{ backgroundColor: objectType?.color ?? "#5381DF" }}
      >
        {renderResourceIcon(objectType?.icon)}
      </span>
      <span className={styles.objectName}>{name}</span>
    </div>
  );
}

function PropertyNameCell({ name }: { name?: string }) {
  const { t } = useTranslation();

  if (!name) {
    return <span className={styles.emptyValue}>{t("knowledgeNetwork.relationTypeEmptyValue")}</span>;
  }

  return (
    <Tooltip title={name.length > 20 ? name : undefined}>
      <span className={styles.propertyName}>{name}</span>
    </Tooltip>
  );
}

export function RelationTypeMappingConfigTable({
  detail,
  networkId,
}: RelationTypeMappingConfigTableProps) {
  const { t } = useTranslation();
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [sourceObjectDetail, setSourceObjectDetail] = useState<ObjectTypeDetail | null>(null);
  const [targetObjectDetail, setTargetObjectDetail] = useState<ObjectTypeDetail | null>(null);

  useEffect(() => {
    void listKnowledgeNetworkObjectTypes(networkId).then(setObjectTypes);
  }, [networkId]);

  useEffect(() => {
    if (!detail.sourceObjectTypeId) {
      setSourceObjectDetail(null);
      return;
    }

    void getKnowledgeNetworkObjectTypeDetail(networkId, detail.sourceObjectTypeId).then(
      setSourceObjectDetail,
    );
  }, [detail.sourceObjectTypeId, networkId]);

  useEffect(() => {
    if (!detail.targetObjectTypeId) {
      setTargetObjectDetail(null);
      return;
    }

    void getKnowledgeNetworkObjectTypeDetail(networkId, detail.targetObjectTypeId).then(
      setTargetObjectDetail,
    );
  }, [detail.targetObjectTypeId, networkId]);

  const sourceObject = useMemo(
    () => objectTypes.find((item) => item.id === detail.sourceObjectTypeId),
    [detail.sourceObjectTypeId, objectTypes],
  );
  const targetObject = useMemo(
    () => objectTypes.find((item) => item.id === detail.targetObjectTypeId),
    [detail.targetObjectTypeId, objectTypes],
  );

  const emptyLabel = t("knowledgeNetwork.relationTypeEmptyValue");

  const directRows = useMemo<DirectConfigRow[]>(() => {
    const rows: DirectConfigRow[] = [
      {
        key: "object-row",
        rowType: "object",
        typeLabel: t("knowledgeNetwork.relationTypeMappingObjectRow"),
      },
    ];

    detail.propertyMappings.forEach((mapping, index) => {
      rows.push({
        key: `property-row-${index}`,
        rowType: "property",
        sourceName: mapping.sourcePropertyName,
        targetName: mapping.targetPropertyName,
        typeLabel: t("knowledgeNetwork.relationTypeMappingPropertyRow"),
      });
    });

    return rows;
  }, [detail.propertyMappings, t]);

  const dataViewRows = useMemo<DataViewConfigRow[]>(() => {
    const rows: DataViewConfigRow[] = [
      {
        key: "object-row",
        rowType: "object",
      },
    ];

    detail.dataViewMappings.forEach((mapping, index) => {
      rows.push({
        dataViewSourceName: mapping.dataViewSourcePropertyName,
        dataViewTargetName: mapping.dataViewTargetPropertyName,
        key: `property-row-${index}`,
        rowType: "property",
        sourceName: mapping.sourceObjectPropertyName,
        targetName: mapping.targetObjectPropertyName,
      });
    });

    return rows;
  }, [detail.dataViewMappings]);

  if (detail.mappingMode === "direct") {
    const columns: TableProps<DirectConfigRow>["columns"] = [
      {
        dataIndex: "typeLabel",
        key: "typeLabel",
        width: 100,
        render: (value: string) => <span className={styles.rowTypeLabel}>{value}</span>,
      },
      {
        dataIndex: "sourceName",
        key: "sourceName",
        title: t("knowledgeNetwork.relationTypeMappingSourcePoint"),
        width: 415,
        render: (value: string | undefined, row) =>
          row.rowType === "object" ? (
            <ObjectCell
              emptyLabel={emptyLabel}
              name={detail.sourceObjectTypeName}
              objectType={sourceObject}
            />
          ) : (
            <PropertyCell
              emptyLabel={emptyLabel}
              objectTypeDetail={sourceObjectDetail}
              propertyName={value}
            />
          ),
      },
      {
        dataIndex: "targetName",
        key: "targetName",
        title: t("knowledgeNetwork.relationTypeMappingTargetPoint"),
        width: 415,
        render: (value: string | undefined, row) =>
          row.rowType === "object" ? (
            <ObjectCell
              emptyLabel={emptyLabel}
              name={detail.targetObjectTypeName}
              objectType={targetObject}
            />
          ) : (
            <PropertyCell
              emptyLabel={emptyLabel}
              objectTypeDetail={targetObjectDetail}
              propertyName={value}
            />
          ),
      },
    ];

    return (
      <Table<DirectConfigRow>
        bordered
        className={styles.mappingTable}
        columns={columns}
        dataSource={directRows}
        locale={{ emptyText: t("knowledgeNetwork.relationTypePropertyMappingEmpty") }}
        pagination={false}
        rowKey="key"
        scroll={{ x: 960 }}
        size="small"
      />
    );
  }

  const dataViewColumns: TableProps<DataViewConfigRow>["columns"] = [
    {
      dataIndex: "sourceName",
      key: "sourceName",
      title: t("knowledgeNetwork.relationTypeMappingSourcePoint"),
      width: 215,
      render: (value: string | undefined, row) =>
        row.rowType === "object" ? (
          <ObjectCell
            emptyLabel={emptyLabel}
            name={detail.sourceObjectTypeName}
            objectType={sourceObject}
          />
        ) : (
          <PropertyCell
            emptyLabel={emptyLabel}
            objectTypeDetail={sourceObjectDetail}
            propertyName={value}
          />
        ),
    },
    {
      dataIndex: "dataViewSourceName",
      key: "dataView",
      title: t("knowledgeNetwork.relationTypeDataViewColumn"),
      width: 400,
      render: (_value: string | undefined, row) => {
        if (row.rowType === "object") {
          const label =
            detail.backingDataSourceName || detail.backingDataSourceId || emptyLabel;
          return <PropertyNameCell name={label === emptyLabel ? undefined : label} />;
        }

        return (
          <div className={styles.dataViewCell}>
            <div className={styles.dataViewField}>
              <span className={styles.dataViewFieldLabel}>
                {t("knowledgeNetwork.relationTypeDataViewSourcePropertyLabel")}
              </span>
              <PropertyNameCell name={row.dataViewSourceName} />
            </div>
            <div className={styles.dataViewField}>
              <span
                className={`${styles.dataViewFieldLabel} ${styles.dataViewFieldLabelTarget}`}
              >
                {t("knowledgeNetwork.relationTypeDataViewTargetPropertyLabel")}
              </span>
              <PropertyNameCell name={row.dataViewTargetName} />
            </div>
          </div>
        );
      },
    },
    {
      dataIndex: "targetName",
      key: "targetName",
      title: t("knowledgeNetwork.relationTypeMappingTargetPoint"),
      width: 215,
      render: (value: string | undefined, row) =>
        row.rowType === "object" ? (
          <ObjectCell
            emptyLabel={emptyLabel}
            name={detail.targetObjectTypeName}
            objectType={targetObject}
          />
        ) : (
          <PropertyCell
            emptyLabel={emptyLabel}
            objectTypeDetail={targetObjectDetail}
            propertyName={value}
          />
        ),
    },
  ];

  return (
    <Table<DataViewConfigRow>
      bordered
      className={styles.mappingTable}
      columns={dataViewColumns}
      dataSource={dataViewRows}
      locale={{ emptyText: t("knowledgeNetwork.relationTypePropertyMappingEmpty") }}
      pagination={false}
      rowKey="key"
      scroll={{ x: 960 }}
      size="small"
    />
  );
}
