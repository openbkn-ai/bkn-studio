import { Modal, Transfer } from "antd";
import type { TransferProps } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ObjectTypeDataViewField } from "@/modules/knowledge-network/types/knowledge-network";

import { FieldTypeIcon } from "./FieldTypeIcon";
import styles from "./ObjectTypeDataAttributePickModal.module.css";

type ObjectTypeDataAttributePickModalProps = {
  fields: ObjectTypeDataViewField[];
  onCancel: () => void;
  onOk: (fieldNames: string[]) => void;
  open: boolean;
};

export function ObjectTypeDataAttributePickModal({
  fields,
  onCancel,
  onOk,
  open,
}: ObjectTypeDataAttributePickModalProps) {
  const { t } = useTranslation();
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTargetKeys([]);
      setSelectedKeys([]);
    }
  }, [open]);

  const handleChange: TransferProps["onChange"] = (nextTargetKeys) => {
    setTargetKeys(nextTargetKeys.map(String));
  };

  const handleSelectChange: TransferProps["onSelectChange"] = (
    sourceSelectedKeys,
    targetSelectedKeys,
  ) => {
    setSelectedKeys([...sourceSelectedKeys.map(String), ...targetSelectedKeys.map(String)]);

    if (sourceSelectedKeys.length > 0) {
      setTargetKeys((current) => [...current, ...sourceSelectedKeys.map(String)]);
      setSelectedKeys([]);
    }
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      className={styles.modal}
      maskClosable={false}
      okButtonProps={{ disabled: targetKeys.length === 0 }}
      okText={t("common.ok")}
      onCancel={onCancel}
      onOk={() => onOk(targetKeys)}
      open={open}
      title={t("knowledgeNetwork.objectTypePickAttributes")}
      width={740}
    >
      <Transfer
        dataSource={fields.map((item) => ({
          ...item,
          key: item.name,
          title: item.displayName,
        }))}
        filterOption={(inputValue, item) => {
          const searchText = inputValue.toLowerCase();
          return (
            item.displayName.toLowerCase().includes(searchText) ||
            item.name.toLowerCase().includes(searchText)
          );
        }}
        listStyle={{ height: 416, width: 336 }}
        onChange={handleChange}
        onSelectChange={handleSelectChange}
        oneWay
        render={(item) => (
          <div className={styles.transferItem}>
            <FieldTypeIcon type={item.type} />
            <div className={styles.itemContent}>
              <div className={styles.itemTitle}>{item.displayName}</div>
              <div className={styles.itemDesc}>{item.name}</div>
            </div>
          </div>
        )}
        selectedKeys={selectedKeys}
        showSearch
        targetKeys={targetKeys}
        titles={[
          t("knowledgeNetwork.objectTypeDataView"),
          <button
            className={styles.clearButton}
            key="clear"
            onClick={() => {
              setTargetKeys([]);
              setSelectedKeys([]);
            }}
            type="button"
          >
            {t("knowledgeNetwork.objectTypeClearAllProperties")}
          </button>,
        ]}
      />
    </Modal>
  );
}
