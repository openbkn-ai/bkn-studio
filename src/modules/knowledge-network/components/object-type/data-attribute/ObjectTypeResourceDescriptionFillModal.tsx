/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Modal, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  ObjectTypeDescriptionFillCandidate,
  ObjectTypeDescriptionFillStatus,
} from "./object-type-data-attribute-editor.utils";
import styles from "./ObjectTypeResourceDescriptionFillModal.module.css";

type ObjectTypeResourceDescriptionFillModalProps = {
  candidates: ObjectTypeDescriptionFillCandidate[];
  onCancel: () => void;
  onConfirm: (propertyNames: string[]) => void;
  open: boolean;
};

export function ObjectTypeResourceDescriptionFillModal({
  candidates,
  onCancel,
  onConfirm,
  open,
}: ObjectTypeResourceDescriptionFillModalProps) {
  const { t } = useTranslation();
  const [selectedPropertyNames, setSelectedPropertyNames] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedPropertyNames(
      candidates
        .filter((candidate) => candidate.status === "fillable")
        .map((candidate) => candidate.propertyName),
    );
  }, [candidates, open]);

  const summary = useMemo(
    () => ({
      fillable: candidates.filter((candidate) => candidate.status === "fillable").length,
      same: candidates.filter((candidate) => candidate.status === "same").length,
      skipped: candidates.filter(
        (candidate) => candidate.status === "missing" || candidate.status === "tooLong",
      ).length,
      updatable: candidates.filter((candidate) => candidate.status === "updatable").length,
    }),
    [candidates],
  );

  const isSelectable = (candidate: ObjectTypeDescriptionFillCandidate) =>
    candidate.status === "fillable" || candidate.status === "updatable";

  const renderStatus = (status: ObjectTypeDescriptionFillStatus) => {
    const config: Record<
      ObjectTypeDescriptionFillStatus,
      { color?: string; label: string }
    > = {
      fillable: {
        color: "blue",
        label: t("knowledgeNetwork.objectTypeDescriptionFillStatusFillable"),
      },
      missing: {
        label: t("knowledgeNetwork.objectTypeDescriptionFillStatusMissing"),
      },
      same: {
        color: "green",
        label: t("knowledgeNetwork.objectTypeDescriptionFillStatusSame"),
      },
      tooLong: {
        color: "red",
        label: t("knowledgeNetwork.objectTypeDescriptionFillStatusTooLong"),
      },
      updatable: {
        color: "orange",
        label: t("knowledgeNetwork.objectTypeDescriptionFillStatusUpdatable"),
      },
    };
    const item = config[status];
    return <Tag color={item.color}>{item.label}</Tag>;
  };

  const columns: TableColumnsType<ObjectTypeDescriptionFillCandidate> = [
    {
      dataIndex: "propertyDisplayName",
      render: (_, candidate) => (
        <div className={styles.identityCell}>
          <strong>{candidate.propertyDisplayName}</strong>
          <span>{candidate.propertyName}</span>
        </div>
      ),
      title: t("knowledgeNetwork.objectTypeDescriptionFillProperty"),
      width: 150,
    },
    {
      dataIndex: "sourceFieldDisplayName",
      render: (_, candidate) => (
        <div className={styles.identityCell}>
          <strong>{candidate.sourceFieldDisplayName}</strong>
          <span>{candidate.sourceFieldName}</span>
        </div>
      ),
      title: t("knowledgeNetwork.objectTypeDescriptionFillSourceField"),
      width: 150,
    },
    {
      dataIndex: "currentComment",
      render: (value: string) => (
        <div className={value ? styles.descriptionCell : styles.emptyDescription} title={value}>
          {value || "-"}
        </div>
      ),
      title: t("knowledgeNetwork.objectTypeDescriptionFillCurrent"),
      width: 190,
    },
    {
      dataIndex: "sourceComment",
      render: (value: string) => (
        <div className={value ? styles.descriptionCell : styles.emptyDescription} title={value}>
          {value || "-"}
        </div>
      ),
      title: t("knowledgeNetwork.objectTypeDescriptionFillSource"),
      width: 190,
    },
    {
      dataIndex: "status",
      render: renderStatus,
      title: t("knowledgeNetwork.objectTypeDescriptionFillStatus"),
      width: 112,
    },
  ];

  return (
    <Modal
      cancelText={t("common.cancel")}
      className={styles.modal}
      destroyOnHidden
      maskClosable={false}
      okButtonProps={{ disabled: selectedPropertyNames.length === 0 }}
      okText={t("knowledgeNetwork.objectTypeDescriptionFillConfirm")}
      onCancel={onCancel}
      onOk={() => onConfirm(selectedPropertyNames)}
      open={open}
      title={t("knowledgeNetwork.objectTypeDescriptionFillTitle")}
      width={980}
    >
      <Alert
        className={styles.hint}
        message={t("knowledgeNetwork.objectTypeDescriptionFillHint")}
        showIcon
        type="info"
      />

      <div className={styles.summary}>
        <span>
          {t("knowledgeNetwork.objectTypeDescriptionFillSummary", summary)}
        </span>
      </div>

      <Table<ObjectTypeDescriptionFillCandidate>
        columns={columns}
        dataSource={candidates}
        locale={{
          emptyText: t("knowledgeNetwork.objectTypeDescriptionFillEmpty"),
        }}
        pagination={false}
        rowKey="propertyName"
        rowSelection={{
          getCheckboxProps: (candidate) => ({ disabled: !isSelectable(candidate) }),
          onChange: (keys) => {
            const selectableNames = new Set(
              candidates.filter(isSelectable).map((candidate) => candidate.propertyName),
            );
            setSelectedPropertyNames(
              keys.map(String).filter((propertyName) => selectableNames.has(propertyName)),
            );
          },
          selectedRowKeys: selectedPropertyNames,
        }}
        scroll={{ y: 360 }}
        size="small"
      />
    </Modal>
  );
}
