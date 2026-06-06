import { Alert, Drawer, Empty, Spin, Table } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { listOperatorHistory } from "@/modules/execution-factory/services/operator.service";
import type { OperatorHistoryRecord } from "@/modules/execution-factory/types/operator";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";

type OperatorHistoryDrawerProps = {
  onClose: () => void;
  open: boolean;
  operatorId: string | null;
  operatorName?: string;
};

export function OperatorHistoryDrawer({
  onClose,
  open,
  operatorId,
  operatorName,
}: OperatorHistoryDrawerProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<OperatorHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !operatorId) {
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        setItems(await listOperatorHistory(operatorId));
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, operatorId]);

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      title={t("executionFactory.operatorHistoryTitle", {
        name: operatorName ?? operatorId ?? "",
      })}
      width={720}
    >
      <p style={{ color: "rgba(0,0,0,0.45)", marginBottom: 16 }}>
        {t("executionFactory.operatorHistoryHint")}
      </p>
      {loading ? (
        <div style={{ padding: 48, textAlign: "center" }}>
          <Spin />
        </div>
      ) : null}
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError && items.length === 0 ? (
        <Empty description={t("executionFactory.operatorHistoryEmpty")} />
      ) : null}
      {!loading && !loadError && items.length > 0 ? (
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
              render: (value: string) => t(`executionFactory.statuses.${value}`),
              title: t("executionFactory.publishStatusFilter"),
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
          ]}
          dataSource={items.map((item) => ({ ...item, key: item.version }))}
          pagination={false}
          size="small"
        />
      ) : null}
    </Drawer>
  );
}
