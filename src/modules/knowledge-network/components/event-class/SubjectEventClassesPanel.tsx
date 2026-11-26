/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined } from "@ant-design/icons";
import { Empty, Table } from "antd";
import type { TableProps } from "antd";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { describeCheckSchedule } from "@/modules/knowledge-network/components/event-class/event-schedule";
import { formatTimestamp } from "@/modules/knowledge-network/services/shared/runtime";
import type { KnEventType } from "@/modules/knowledge-network/types/event-type";

import styles from "./SubjectEventClassesPanel.module.css";

type SubjectEventClassesPanelProps = {
  canCreate: boolean;
  eventTypes: readonly KnEventType[];
  keyword?: string;
  loading: boolean;
  onCreate: () => void;
  onOpen: (eventType: KnEventType) => void;
};

const PREFIX = "knowledgeNetwork.eventClasses.subject";

/** The event classes about an object type, listed on that object type. */
export function SubjectEventClassesPanel({
  canCreate,
  eventTypes,
  keyword = "",
  loading,
  onCreate,
  onOpen,
}: SubjectEventClassesPanelProps) {
  const { t } = useTranslation();
  const needle = keyword.trim().toLowerCase();
  const rows = needle
    ? eventTypes.filter(
        (item) =>
          item.name.toLowerCase().includes(needle) || item.code.toLowerCase().includes(needle),
      )
    : eventTypes;

  const columns: TableProps<KnEventType>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("common.name"),
      width: 240,
      render: (value: string, record) => (
        <button className={styles.link} onClick={() => onOpen(record)} title={value} type="button">
          {value || record.code}
        </button>
      ),
    },
    {
      dataIndex: "code",
      key: "code",
      title: t(`${PREFIX}.code`),
      width: 180,
      render: (value: string) => <code className={styles.code}>{value}</code>,
    },
    {
      dataIndex: "source",
      key: "source",
      title: t(`${PREFIX}.source`),
      width: 120,
      render: (value: KnEventType["source"]) => t(`knowledgeNetwork.eventClasses.source.${value}`),
    },
    {
      dataIndex: "severity",
      key: "severity",
      title: t(`${PREFIX}.severity`),
      width: 100,
      render: (value?: string) => value || "--",
    },
    {
      key: "schedule",
      title: t(`${PREFIX}.schedule`),
      width: 220,
      render: (_value, record) =>
        record.source === "rule" && record.check_schedule
          ? describeCheckSchedule(record.check_schedule, t)
          : "--",
    },
    {
      dataIndex: "next_check_at",
      key: "nextCheck",
      title: t(`${PREFIX}.nextCheck`),
      width: 180,
      render: (value?: number) => (value ? formatTimestamp(value) : "--"),
    },
  ];

  return (
    <div className={styles.panel}>
      {canCreate ? (
        <div className={styles.toolbar}>
          <AppButton icon={<PlusOutlined />} onClick={onCreate} size="small">
            {t("knowledgeNetwork.eventClasses.create")}
          </AppButton>
        </div>
      ) : null}
      <Table<KnEventType>
        columns={columns}
        dataSource={rows}
        loading={loading}
        locale={{ emptyText: <Empty description={t(`${PREFIX}.empty`)} /> }}
        pagination={rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
        rowKey="code"
        scroll={{ x: 1040 }}
        size="small"
      />
    </div>
  );
}
