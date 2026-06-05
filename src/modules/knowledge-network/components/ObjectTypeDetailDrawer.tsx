import { Drawer, Empty, Tag } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getKnowledgeNetworkObjectType } from "@/modules/knowledge-network/services/knowledge-network.service";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectTypeDetailDrawer.module.css";

type ObjectTypeDetailDrawerProps = {
  networkId: string;
  objectTypeId: string | null;
  onClose: () => void;
  open: boolean;
};

export function ObjectTypeDetailDrawer({
  networkId,
  objectTypeId,
  onClose,
  open,
}: ObjectTypeDetailDrawerProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<KnowledgeNetworkObjectTypeRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !objectTypeId) {
      return;
    }

    const loadData = async () => {
      setError(null);

      try {
        const result = await getKnowledgeNetworkObjectType(networkId, objectTypeId);
        setDetail(result);
      } catch (nextError) {
        setError(extractRequestErrorMessage(nextError));
      }
    };

    void loadData();
  }, [networkId, objectTypeId, open]);

  return (
    <Drawer
      onClose={onClose}
      open={open}
      title={detail?.name ?? t("knowledgeNetwork.objectTypeDetailTitle")}
      width={720}
    >
      {error ? <div>{error}</div> : null}
      {!error && detail ? (
        <div className={styles.drawerLayout}>
          <section className={styles.summaryCard}>
            <div className={styles.summaryHead}>
              <span
                className={styles.summaryDot}
                style={{ backgroundColor: detail.color }}
              />
              <div>
                <h3>{detail.name}</h3>
                <p>{detail.description || t("knowledgeNetwork.noDescription")}</p>
              </div>
            </div>
            <div className={styles.tagRow}>
              {detail.tags.length > 0 ? (
                detail.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)
              ) : (
                <span className={styles.placeholder}>
                  {t("knowledgeNetwork.noTags")}
                </span>
              )}
            </div>
          </section>

          <section className={styles.detailPanel}>
            <h4>{t("knowledgeNetwork.objectTypeBasicInfo")}</h4>
            <div className={styles.infoGrid}>
              <div>
                <span>{t("knowledgeNetwork.objectTypeIndexed")}</span>
                <strong>
                  {detail.hasIndex
                    ? t("knowledgeNetwork.objectTypeIndexed")
                    : t("knowledgeNetwork.objectTypeNotIndexed")}
                </strong>
              </div>
              <div>
                <span>{t("knowledgeNetwork.updatedBy", { name: detail.updaterName })}</span>
                <strong>{detail.updateTime}</strong>
              </div>
            </div>
          </section>

          <section className={styles.detailPanel}>
            <h4>{t("knowledgeNetwork.objectTypeConceptGroups")}</h4>
            {detail.conceptGroupNames.length > 0 ? (
              <div className={styles.tagRow}>
                {detail.conceptGroupNames.map((name) => (
                  <Tag key={name}>{name}</Tag>
                ))}
              </div>
            ) : (
              <Empty description={t("knowledgeNetwork.objectTypeNoConceptGroups")} />
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
