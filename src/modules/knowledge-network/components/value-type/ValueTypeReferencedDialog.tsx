/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { AppButton } from "@/framework/ui/common/AppButton";
import type { ValueTypeReference } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ValueTypeReferencedDialog.module.css";

const PREFIX = "knowledgeNetwork.valueTypes.referenced";

export type ValueTypeReferencedRefusal = {
  /** A delete, or an update that changed the base type. */
  action: "delete" | "update";
  name: string;
  references: ValueTypeReference[];
};

/** Lists the data properties that still name a value type, each linked to its object type. */
export function ValueTypeReferencedDialog({
  networkId,
  onClose,
  refusal,
}: {
  networkId: string;
  onClose: () => void;
  refusal: ValueTypeReferencedRefusal;
}) {
  const { t } = useTranslation();
  const workspace = `/knowledge-network/workspace/${encodeURIComponent(networkId)}`;

  const columns: ColumnsType<ValueTypeReference> = [
    {
      key: "objectType",
      render: (_, row) => (
        <span>
          <Link
            onClick={onClose}
            to={`${workspace}/object-types/${encodeURIComponent(row.objectTypeId)}/detail`}
          >
            {row.objectTypeName}
          </Link>{" "}
          <span className={styles.mono}>{row.objectTypeId}</span>
        </span>
      ),
      title: t(`${PREFIX}.columnObjectType`),
    },
    {
      dataIndex: "property",
      key: "property",
      render: (property: string) => <span className={styles.mono}>{property}</span>,
      title: t(`${PREFIX}.columnProperty`),
    },
    {
      dataIndex: "propertyType",
      key: "propertyType",
      title: t(`${PREFIX}.columnPropertyType`),
    },
  ];

  return (
    <Modal
      footer={
        <AppButton onClick={onClose} type="primary">
          {t(`${PREFIX}.ok`)}
        </AppButton>
      }
      onCancel={onClose}
      open
      title={t(`${PREFIX}.${refusal.action}Title`, { name: refusal.name })}
      width={640}
    >
      <Typography.Paragraph className={styles.description}>
        {t(`${PREFIX}.${refusal.action}Description`)}
      </Typography.Paragraph>
      <Table<ValueTypeReference>
        columns={columns}
        dataSource={refusal.references}
        pagination={false}
        rowKey={(row) => `${row.objectTypeId}/${row.property}`}
        scroll={{ x: 520 }}
        size="small"
      />
    </Modal>
  );
}
