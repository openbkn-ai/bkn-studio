/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ClockCircleOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Dropdown, Empty, Input, Pagination, Select, Table } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TaskStateTag, getTaskStateLabel } from "@/modules/knowledge-network/components/task/TaskStateTag";
import type {
  KnowledgeNetworkTaskJobType,
  KnowledgeNetworkTaskRecord,
  KnowledgeNetworkTaskState,
} from "@/modules/knowledge-network/types/knowledge-network";
import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";

type TaskListPanelProps = {
  networkId: string;
  onDelete: (taskId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  tasks: KnowledgeNetworkTaskRecord[];
};

const JOB_TYPE_OPTIONS: KnowledgeNetworkTaskJobType[] = ["full", "incremental"];
const STATE_OPTIONS: KnowledgeNetworkTaskState[] = [
  "pending",
  "running",
  "completed",
  "failed",
  "canceled",
];

function getJobTypeLabel(value: KnowledgeNetworkTaskJobType, t: (key: string) => string) {
  switch (value) {
    case "incremental":
      return t("knowledgeNetwork.taskJobTypeIncremental");
    case "full":
    default:
      return t("knowledgeNetwork.taskJobTypeFull");
  }
}

export function TaskListPanel({
  networkId,
  onDelete,
  onRefresh,
  tasks,
}: TaskListPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const [keyword, setKeyword] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState<KnowledgeNetworkTaskJobType | "all">("all");
  const [stateFilter, setStateFilter] = useState<KnowledgeNetworkTaskState | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const filteredTasks = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return tasks.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.id.toLowerCase().includes(normalizedKeyword);
      const matchesJobType = jobTypeFilter === "all" || item.jobType === jobTypeFilter;
      const matchesState = stateFilter === "all" || item.state === stateFilter;
      return matchesKeyword && matchesJobType && matchesState;
    });
  }, [jobTypeFilter, keyword, stateFilter, tasks]);

  const pagedTasks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, page, pageSize]);

  const confirmDelete = (record: KnowledgeNetworkTaskRecord) => {
    void modal.confirm({
      title: t("knowledgeNetwork.taskDeleteTitle"),
      content: t("knowledgeNetwork.taskDeleteDescription", { name: record.name }),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: async () => {
        await onDelete(record.id);
        void message.success(t("common.success"));
        await onRefresh();
      },
    });
  };

  const buildRowMenu = (record: KnowledgeNetworkTaskRecord): MenuProps["items"] => [
    {
      key: "detail",
      label: t("common.detail"),
      onClick: () => {
        void navigate(`/knowledge-network/workspace/${networkId}/tasks/${record.id}/detail`);
      },
    },
    { type: "divider" },
    {
      danger: true,
      key: "delete",
      label: t("common.delete"),
      onClick: () => confirmDelete(record),
    },
  ];

  const columns: TableProps<KnowledgeNetworkTaskRecord>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("knowledgeNetwork.taskName"),
      render: (value: string, record) => (
        <button
          className={styles.objectTitleBox}
          onClick={() => {
            void navigate(`/knowledge-network/workspace/${networkId}/tasks/${record.id}/detail`);
          }}
          type="button"
        >
          <span className={styles.objectIconSquare} style={{ backgroundColor: "#722ed1" }}>
            <ClockCircleOutlined />
          </span>
          <span className={styles.objectName}>{value}</span>
        </button>
      ),
    },
    {
      dataIndex: "jobType",
      key: "jobType",
      title: t("knowledgeNetwork.taskJobType"),
      width: 120,
      render: (value: KnowledgeNetworkTaskJobType) => getJobTypeLabel(value, t),
    },
    {
      dataIndex: "state",
      key: "state",
      title: t("knowledgeNetwork.taskState"),
      width: 120,
      render: (value: KnowledgeNetworkTaskState, record) => (
        <TaskStateTag state={value} stateDetail={record.stateDetail} />
      ),
    },
    {
      dataIndex: "duration",
      key: "duration",
      title: t("knowledgeNetwork.taskDuration"),
      width: 100,
    },
    {
      dataIndex: "startTime",
      key: "startTime",
      title: t("knowledgeNetwork.taskStartTime"),
      width: 180,
    },
    {
      dataIndex: "finishTime",
      key: "finishTime",
      title: t("knowledgeNetwork.taskFinishTime"),
      width: 180,
    },
    {
      fixed: "right",
      key: "actions",
      title: t("common.actions"),
      width: 72,
      render: (_, record) => (
        <Dropdown menu={{ items: buildRowMenu(record) }} trigger={["click"]}>
          <AppButton aria-label={t("common.actions")} icon={<EllipsisOutlined />} type="text" />
        </Dropdown>
      ),
    },
  ];

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      return;
    }

    void modal.confirm({
      title: t("knowledgeNetwork.taskDeleteTitle"),
      content: t("knowledgeNetwork.taskBatchDeleteDescription", {
        count: selectedRowKeys.length,
      }),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: async () => {
        await Promise.all(selectedRowKeys.map((taskId) => onDelete(taskId)));
        setSelectedRowKeys([]);
        void message.success(t("common.success"));
        await onRefresh();
      },
    });
  };

  const tableContent =
    filteredTasks.length === 0 ? (
      <div className={styles.emptyPanel}>
        <Empty description={t("knowledgeNetwork.emptyTasks")} />
      </div>
    ) : (
      <>
        <Table
          columns={columns}
          dataSource={pagedTasks}
          pagination={false}
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
          }}
          scroll={{ x: 1100 }}
          size="middle"
        />
        <div className={styles.paginationBar}>
          <Pagination
            current={page}
            onChange={(nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            }}
            pageSize={pageSize}
            showSizeChanger
            total={filteredTasks.length}
          />
        </div>
      </>
    );

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>{t("knowledgeNetwork.tasksTitle")}</h2>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <AppButton
            className={styles.toolbarButton}
            danger
            disabled={selectedRowKeys.length === 0}
            icon={<DeleteOutlined />}
            onClick={handleBatchDelete}
          >
            {t("common.delete")}
          </AppButton>
        </div>
        <div className={styles.toolbarRight}>
          <Input
            allowClear
            className={styles.searchInput}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder={t("knowledgeNetwork.searchPlaceholder")}
            prefix={<SearchOutlined className={styles.searchIcon} />}
            value={keyword}
          />
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>{t("knowledgeNetwork.taskJobType")}</span>
            <Select
              className={styles.filterSelect}
              onChange={(value) => {
                setJobTypeFilter(value);
                setPage(1);
              }}
              options={[
                { label: t("common.all"), value: "all" },
                ...JOB_TYPE_OPTIONS.map((value) => ({
                  label: getJobTypeLabel(value, t),
                  value,
                })),
              ]}
              value={jobTypeFilter}
            />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>{t("knowledgeNetwork.taskState")}</span>
            <Select
              className={styles.filterSelect}
              onChange={(value) => {
                setStateFilter(value);
                setPage(1);
              }}
              options={[
                { label: t("common.all"), value: "all" },
                ...STATE_OPTIONS.map((value) => ({
                  label: getTaskStateLabel(value, t),
                  value,
                })),
              ]}
              value={stateFilter}
            />
          </div>
          <AppButton
            aria-label={t("common.refresh")}
            className={styles.iconButton}
            icon={<ReloadOutlined />}
            onClick={() => void onRefresh()}
          />
          <AppButton
            className={styles.toolbarButton}
            icon={<PlusOutlined />}
            onClick={() => {
              void navigate(`/knowledge-network/workspace/${networkId}/tasks/create`);
            }}
            type="primary"
          >
            {t("common.create")}
          </AppButton>
        </div>
      </div>

      <div className={styles.tableCard}>{tableContent}</div>
    </section>
  );
}
