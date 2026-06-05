import { Alert, Descriptions, Drawer, Empty, Spin, Tag } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  getToolbox,
  getToolboxMarket,
} from "@/modules/execution-factory/services/toolbox.service";
import type { ToolboxRecord, ToolboxStatus } from "@/modules/execution-factory/types/toolbox";

import styles from "./ToolboxDetailDrawer.module.css";

type ToolboxDetailDrawerProps = {
  boxId: string | null;
  marketMode?: boolean;
  onClose: () => void;
  open: boolean;
};

const statusColorMap: Record<ToolboxStatus, string> = {
  published: "green",
  offline: "default",
  unpublish: "blue",
};

function formatTimestamp(value?: number) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export function ToolboxDetailDrawer({
  boxId,
  marketMode = false,
  onClose,
  open,
}: ToolboxDetailDrawerProps) {
  const { t } = useTranslation();
  const [record, setRecord] = useState<ToolboxRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !boxId) {
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);
      setRecord(null);

      try {
        setRecord(
          marketMode ? await getToolboxMarket(boxId) : await getToolbox(boxId),
        );
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [boxId, marketMode, open]);

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      title={
        marketMode
          ? t("executionFactory.toolboxMarketDetailTitle")
          : t("executionFactory.toolboxDetailTitle")
      }
      width={760}
    >
      {loading ? <Spin /> : null}
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError && !record ? (
        <Empty description={t("common.notFound")} />
      ) : null}
      {!loading && !loadError && record ? (
        <div className={styles.drawerContent}>
          <section className={styles.summaryCard}>
            <h2 className={styles.summaryTitle}>{record.name}</h2>
            <p className={styles.summaryDescription}>{record.description || "-"}</p>
            <div className={styles.summaryStatus}>
              <Tag color={statusColorMap[record.status]}>
                {t(`executionFactory.toolboxStatuses.${record.status}`)}
              </Tag>
              {record.isInternal ? (
                <Tag>{t("executionFactory.internalTag")}</Tag>
              ) : null}
            </div>
            <div className={styles.summaryMeta}>
              <span>{record.boxId}</span>
              {record.serviceUrl ? <span>{record.serviceUrl}</span> : null}
            </div>
          </section>
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("common.basicInfo")}</h3>
            <Descriptions
              bordered
              column={1}
              items={[
                {
                  key: "boxId",
                  label: t("executionFactory.toolboxId"),
                  children: record.boxId,
                },
                {
                  key: "category",
                  label: t("executionFactory.category"),
                  children: record.categoryName ?? record.categoryType ?? "-",
                },
                {
                  key: "metadataType",
                  label: t("executionFactory.metadataType"),
                  children: record.metadataType ?? "-",
                },
                {
                  key: "createUser",
                  label: t("executionFactory.createUser"),
                  children: record.createUser ?? "-",
                },
                {
                  key: "updateTime",
                  label: t("executionFactory.updateTime"),
                  children: formatTimestamp(record.updateTime),
                },
              ]}
            />
          </section>
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("executionFactory.toolsSectionTitle")}</h3>
            {record.tools && record.tools.length > 0 ? (
              <div className={styles.toolList}>
                {record.tools.map((tool) => (
                  <div className={styles.toolItem} key={tool.toolId}>
                    <div>
                      <div className={styles.toolName}>{tool.name}</div>
                      <div className={styles.toolMeta}>{tool.toolId}</div>
                    </div>
                    <Tag>
                      {tool.status
                        ? t(`executionFactory.toolStatuses.${tool.status}`)
                        : "-"}
                    </Tag>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description={t("executionFactory.toolsEmpty")} />
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
