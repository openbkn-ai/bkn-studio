import { Alert, Drawer, Empty, Spin, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import {
  getSkillReleaseHistory,
  publishSkillHistory,
  republishSkillHistory,
} from "@/modules/execution-factory/services/skill.service";
import type { SkillHistoryRecord } from "@/modules/execution-factory/types/skill";

import styles from "./ToolboxDetailDrawer.module.css";

type SkillHistoryDrawerProps = {
  onClose: () => void;
  onUpdated?: () => void;
  open: boolean;
  skillId: string | null;
};

function formatTimestamp(value?: number) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export function SkillHistoryDrawer({
  onClose,
  onUpdated,
  open,
  skillId,
}: SkillHistoryDrawerProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [items, setItems] = useState<SkillHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!skillId) {
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      setItems(await getSkillReleaseHistory(skillId));
    } catch (error) {
      setItems([]);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    if (!open || !skillId) {
      return;
    }

    void loadData();
  }, [loadData, open, skillId]);

  const handleRepublish = (record: SkillHistoryRecord) => {
    if (!skillId) {
      return;
    }

    void modal.confirm({
      title: t("executionFactory.skillHistoryRepublishConfirmTitle"),
      content: t("executionFactory.skillHistoryRepublishConfirmDescription", {
        version: record.version,
      }),
      okText: t("executionFactory.skillHistoryRepublish"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await republishSkillHistory(skillId, record.version);
        void message.success(t("common.success"));
        onUpdated?.();
        await loadData();
      },
    });
  };

  const handlePublish = (record: SkillHistoryRecord) => {
    if (!skillId) {
      return;
    }

    void modal.confirm({
      title: t("executionFactory.skillHistoryPublishConfirmTitle"),
      content: t("executionFactory.skillHistoryPublishConfirmDescription", {
        version: record.version,
      }),
      okText: t("executionFactory.publish"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await publishSkillHistory(skillId, record.version);
        void message.success(t("common.success"));
        onUpdated?.();
        await loadData();
      },
    });
  };

  const columns: ColumnsType<SkillHistoryRecord> = [
    {
      dataIndex: "version",
      title: t("executionFactory.version"),
    },
    {
      dataIndex: "status",
      title: t("common.status"),
      render: (value?: string) => {
        if (!value) {
          return "-";
        }

        const statusKey = `executionFactory.skillStatuses.${value}`;
        const label = t(statusKey);

        return <Tag>{label === statusKey ? value : label}</Tag>;
      },
    },
    {
      dataIndex: "releaseUser",
      title: t("executionFactory.releaseUser"),
      render: (value?: string) => value ?? "-",
    },
    {
      dataIndex: "releaseTime",
      title: t("executionFactory.releaseTime"),
      render: (value?: number) => formatTimestamp(value),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_, record) => (
        <div className={styles.toolList}>
          <PermissionGate permissions="execution-factory:skill:edit">
            <AppButton onClick={() => handleRepublish(record)} type="link">
              {t("executionFactory.skillHistoryRepublish")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="execution-factory:skill:publish">
            <AppButton onClick={() => handlePublish(record)} type="link">
              {t("executionFactory.skillHistoryPublish")}
            </AppButton>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      title={t("executionFactory.skillHistoryTitle")}
      width={820}
    >
      {loading ? <Spin /> : null}
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError && items.length === 0 ? (
        <Empty description={t("executionFactory.skillHistoryEmpty")} />
      ) : null}
      {!loading && !loadError && items.length > 0 ? (
        <AppTable columns={columns} dataSource={items} pagination={false} rowKey="version" />
      ) : null}
    </Drawer>
  );
}
