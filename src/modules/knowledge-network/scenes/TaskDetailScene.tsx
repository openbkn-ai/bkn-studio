/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ClockCircleOutlined } from "@ant-design/icons";
import { Alert, Input, Select, Spin, Table } from "antd";
import type { TableProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import { TaskStateTag, getTaskStateLabel } from "@/modules/knowledge-network/components/task/TaskStateTag";
import {
  deleteKnowledgeNetworkTask,
  getKnowledgeNetworkTask,
  getKnowledgeNetworkTaskDetail,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkTaskChildRecord,
  KnowledgeNetworkTaskJobType,
  KnowledgeNetworkTaskRecord,
  KnowledgeNetworkTaskState,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ConceptGroupDetailScene.module.css";

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

function getConceptTypeLabel(value: string, t: (key: string) => string) {
  switch (value) {
    case "relation_type":
      return t("knowledgeNetwork.taskConceptRelationType");
    case "action_type":
      return t("knowledgeNetwork.taskConceptActionType");
    case "object_type":
    default:
      return t("knowledgeNetwork.taskConceptObjectType");
  }
}

export function TaskDetailScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { networkId = "", taskId = "" } = useParams<{
    networkId: string;
    taskId: string;
  }>();
  const [detail, setDetail] = useState<KnowledgeNetworkTaskRecord | null>(null);
  const [children, setChildren] = useState<KnowledgeNetworkTaskChildRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [conceptTypeFilter, setConceptTypeFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState<KnowledgeNetworkTaskState | "all">("all");

  const listPath = `/knowledge-network/workspace/${networkId}/tasks`;

  const loadData = useCallback(async () => {
    if (!networkId || !taskId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [taskResult, childResult] = await Promise.all([
        getKnowledgeNetworkTask(networkId, taskId),
        getKnowledgeNetworkTaskDetail(networkId, taskId),
      ]);

      if (!taskResult) {
        throw new Error(t("common.notFound"));
      }

      setDetail(taskResult);
      setChildren(childResult);
    } catch (nextError) {
      setError(extractRequestErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [networkId, taskId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const conceptTypeOptions = useMemo(() => {
    const values = new Set(children.map((item) => item.conceptType));
    return [...values].sort((left, right) => left.localeCompare(right));
  }, [children]);

  const filteredChildren = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return children.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.conceptName.toLowerCase().includes(normalizedKeyword) ||
        item.id.toLowerCase().includes(normalizedKeyword);
      const matchesConceptType =
        conceptTypeFilter === "all" || item.conceptType === conceptTypeFilter;
      const matchesState = stateFilter === "all" || item.state === stateFilter;
      return matchesKeyword && matchesConceptType && matchesState;
    });
  }, [children, conceptTypeFilter, keyword, stateFilter]);

  const confirmDelete = () => {
    if (!detail) {
      return;
    }

    void modal.confirm({
      title: t("knowledgeNetwork.taskDeleteTitle"),
      content: t("knowledgeNetwork.taskDeleteDescription", { name: detail.name }),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: async () => {
        await deleteKnowledgeNetworkTask(networkId, detail.id);
        void message.success(t("common.success"));
        void navigate(listPath);
      },
    });
  };

  const childColumns: TableProps<KnowledgeNetworkTaskChildRecord>["columns"] = [
    {
      dataIndex: "conceptType",
      key: "conceptType",
      title: t("knowledgeNetwork.taskChildType"),
      width: 140,
      render: (value: string) => getConceptTypeLabel(value, t),
    },
    {
      dataIndex: "conceptName",
      key: "conceptName",
      title: t("knowledgeNetwork.taskChildName"),
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
  ];

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spin />
      </div>
    );
  }

  if (error || !detail) {
    return <Alert message={error ?? t("common.notFound")} showIcon type="error" />;
  }

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        <AppButton danger onClick={confirmDelete}>
          {t("common.delete")}
        </AppButton>
      }
      onBack={() => {
        void navigate(listPath);
      }}
      subtitle={t("knowledgeNetwork.taskDetailDescription")}
      title={detail.name}
    >
      <div className={styles.page}>
        <section className={styles.summaryCard}>
          <div className={styles.summaryHead}>
            <span className={styles.summaryIcon} style={{ backgroundColor: "#722ed1" }}>
              <ClockCircleOutlined />
            </span>
            <div>
              <h2 className={styles.summaryTitle}>{detail.name}</h2>
              <p className={styles.summaryDescription}>
                {getJobTypeLabel(detail.jobType, t)}
              </p>
            </div>
          </div>
          <div className={styles.summaryStats}>
            <span>
              {t("knowledgeNetwork.taskState")}: <TaskStateTag state={detail.state} stateDetail={detail.stateDetail} />
            </span>
            <span>
              {t("knowledgeNetwork.taskDuration")}: {detail.duration}
            </span>
            <span>
              {t("knowledgeNetwork.taskStartTime")}: {detail.startTime}
            </span>
            <span>
              {t("knowledgeNetwork.taskFinishTime")}: {detail.finishTime}
            </span>
          </div>
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionToolbar}>
            <strong>{t("knowledgeNetwork.taskExecutionTitle")}</strong>
            <div className={styles.sectionToolbar}>
              <Input
                allowClear
                className={styles.searchInput}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={t("knowledgeNetwork.searchPlaceholder")}
                value={keyword}
              />
              <Select
                onChange={setConceptTypeFilter}
                options={[
                  { label: t("common.all"), value: "all" },
                  ...conceptTypeOptions.map((value) => ({
                    label: getConceptTypeLabel(value, t),
                    value,
                  })),
                ]}
                style={{ width: 160 }}
                value={conceptTypeFilter}
              />
              <Select
                onChange={(value) => setStateFilter(value)}
                options={[
                  { label: t("common.all"), value: "all" },
                  ...STATE_OPTIONS.map((value) => ({
                    label: getTaskStateLabel(value, t),
                    value,
                  })),
                ]}
                style={{ width: 140 }}
                value={stateFilter}
              />
            </div>
          </div>

          <Table
            columns={childColumns}
            dataSource={filteredChildren}
            pagination={false}
            rowKey="id"
            size="middle"
          />
        </section>
      </div>
    </KnowledgeNetworkResourceConfigShell>
  );
}
