import { Alert, Descriptions, Drawer, Empty, Spin, Tag } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  getSkill,
  getSkillManagementContent,
  getSkillMarket,
} from "@/modules/execution-factory/services/skill.service";
import type { SkillContentResult, SkillRecord, SkillStatus } from "@/modules/execution-factory/types/skill";

import styles from "./ToolboxDetailDrawer.module.css";

type SkillDetailDrawerProps = {
  marketMode?: boolean;
  onClose: () => void;
  onEdit?: (skillId: string) => void;
  onOpenHistory?: (skillId: string) => void;
  open: boolean;
  skillId: string | null;
};

const statusColorMap: Record<SkillStatus, string> = {
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

export function SkillDetailDrawer({
  marketMode = false,
  onClose,
  onEdit,
  onOpenHistory,
  open,
  skillId,
}: SkillDetailDrawerProps) {
  const { t } = useTranslation();
  const [record, setRecord] = useState<SkillRecord | null>(null);
  const [content, setContent] = useState<SkillContentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !skillId) {
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);
      setRecord(null);
      setContent(null);

      try {
        const skillRecord = marketMode
          ? await getSkillMarket(skillId)
          : await getSkill(skillId);
        setRecord(skillRecord);

        if (!marketMode) {
          setContent(await getSkillManagementContent(skillId));
        }
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [marketMode, open, skillId]);

  return (
    <Drawer
      destroyOnClose
      extra={
        !marketMode && skillId ? (
          <div style={{ display: "flex", gap: 8 }}>
            <PermissionGate permissions="execution-factory:skill:edit">
              <AppButton onClick={() => onEdit?.(skillId)} type="link">
                {t("common.edit")}
              </AppButton>
            </PermissionGate>
            <PermissionGate permissions="execution-factory:skill:view">
              <AppButton onClick={() => onOpenHistory?.(skillId)} type="link">
                {t("executionFactory.skillHistoryTitle")}
              </AppButton>
            </PermissionGate>
          </div>
        ) : null
      }
      onClose={onClose}
      open={open}
      title={
        marketMode
          ? t("executionFactory.skillMarketDetailTitle")
          : t("executionFactory.skillDetailTitle")
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
                {t(`executionFactory.skillStatuses.${record.status}`)}
              </Tag>
            </div>
            <div className={styles.summaryMeta}>
              <span>{record.skillId}</span>
              {record.version ? <span>{record.version}</span> : null}
            </div>
          </section>
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("common.basicInfo")}</h3>
            <Descriptions
              bordered
              column={1}
              items={[
                {
                  key: "category",
                  label: t("executionFactory.category"),
                  children: record.categoryName ?? record.category ?? "-",
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
          {!marketMode && content ? (
            <section className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>{t("executionFactory.skillContentTitle")}</h3>
              {content.content ? (
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{content.content}</pre>
              ) : (
                <Empty description={t("executionFactory.skillContentEmpty")} />
              )}
              {content.files && content.files.length > 0 ? (
                <div className={styles.toolList} style={{ marginTop: 12 }}>
                  {content.files.map((file) => (
                    <div className={styles.toolItem} key={file}>
                      <div className={styles.toolName}>{file}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
