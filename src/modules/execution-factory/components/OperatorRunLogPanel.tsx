import { Alert, Empty, Spin, Table, Tabs } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { listOperatorHistory } from "@/modules/execution-factory/services/operator.service";
import type {
  OperatorHistoryRecord,
  OperatorRunLogEntry,
} from "@/modules/execution-factory/types/operator";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";

type OperatorRunLogPanelProps = {
  operatorId?: string;
  sessionLogs?: OperatorRunLogEntry[];
};

function renderJson(value: unknown) {
  if (value === undefined || value === null) {
    return "-";
  }

  return JSON.stringify(value, null, 2);
}

export function OperatorRunLogPanel({
  operatorId,
  sessionLogs = [],
}: OperatorRunLogPanelProps) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<OperatorHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!operatorId) {
      setHistory([]);
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        setHistory(await listOperatorHistory(operatorId));
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
        setHistory([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [operatorId]);

  const historyTab = (
    <>
      {loading ? <Spin /> : null}
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError && history.length === 0 ? (
        <Empty description={t("executionFactory.operatorHistoryEmpty")} />
      ) : null}
      {!loading && !loadError && history.length ? (
        <Table
          columns={[
            {
              dataIndex: "version",
              key: "version",
              title: t("executionFactory.version"),
            },
            {
              dataIndex: "status",
              key: "status",
              render: (value?: string) =>
                value ? t(`executionFactory.statuses.${value}`) : "-",
              title: t("executionFactory.statusLabel"),
            },
            {
              dataIndex: "releaseUser",
              key: "releaseUser",
              title: t("executionFactory.releaseUser"),
            },
            {
              dataIndex: "releaseTime",
              key: "releaseTime",
              render: (value?: number) => formatExecutionUnitTime(value),
              title: t("executionFactory.releaseTime"),
            },
            {
              dataIndex: "updateTime",
              key: "updateTime",
              render: (value?: number) => formatExecutionUnitTime(value),
              title: t("executionFactory.updateTime"),
            },
          ]}
          dataSource={history.map((item) => ({ ...item, key: item.version }))}
          pagination={false}
          size="small"
        />
      ) : null}
    </>
  );

  const sessionTab =
    sessionLogs.length === 0 ? (
      <Empty description={t("executionFactory.runLogSessionEmpty")} />
    ) : (
      <Table
        columns={[
          {
            dataIndex: "timestamp",
            key: "timestamp",
            render: (value: number) => new Date(value).toLocaleString(),
            title: t("executionFactory.runLogTime"),
          },
          {
            dataIndex: "statusCode",
            key: "statusCode",
            title: t("executionFactory.runLogStatusCode"),
          },
          {
            dataIndex: "durationMs",
            key: "durationMs",
            render: (value?: number) => (value !== undefined ? `${value}ms` : "-"),
            title: t("executionFactory.runLogDuration"),
          },
          {
            dataIndex: "error",
            key: "error",
            title: t("executionFactory.runLogError"),
          },
          {
            dataIndex: "body",
            key: "body",
            render: (value: unknown) => (
              <pre style={{ margin: 0, maxWidth: 320, whiteSpace: "pre-wrap" }}>
                {renderJson(value)}
              </pre>
            ),
            title: t("executionFactory.runLogResponse"),
          },
        ]}
        dataSource={sessionLogs.map((item) => ({ ...item, key: item.id }))}
        pagination={false}
        size="small"
      />
    );

  return (
    <Tabs
      items={[
        {
          key: "history",
          label: t("executionFactory.runLogVersionTab"),
          children: historyTab,
        },
        {
          key: "session",
          label: t("executionFactory.runLogSessionTab"),
          children: sessionTab,
        },
      ]}
      size="small"
    />
  );
}
