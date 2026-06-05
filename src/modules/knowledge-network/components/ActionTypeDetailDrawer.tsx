import { Drawer, Tag } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getKnowledgeNetworkActionType } from "@/modules/knowledge-network/services/knowledge-network.service";
import type { KnowledgeNetworkActionTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ActionTypeDetailDrawer.module.css";

type ActionTypeDetailDrawerProps = {
  actionTypeId: string | null;
  networkId: string;
  onClose: () => void;
  open: boolean;
};

function getActionKindLabel(
  actionKind: KnowledgeNetworkActionTypeRecord["actionKind"],
  t: (key: string) => string,
) {
  switch (actionKind) {
    case "update":
      return t("knowledgeNetwork.actionTypeKindUpdate");
    case "delete":
      return t("knowledgeNetwork.actionTypeKindDelete");
    case "notify":
      return t("knowledgeNetwork.actionTypeKindNotify");
    case "create":
    default:
      return t("knowledgeNetwork.actionTypeKindCreate");
  }
}

export function ActionTypeDetailDrawer({
  actionTypeId,
  networkId,
  onClose,
  open,
}: ActionTypeDetailDrawerProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<KnowledgeNetworkActionTypeRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !actionTypeId) {
      return;
    }

    const loadData = async () => {
      setError(null);

      try {
        const result = await getKnowledgeNetworkActionType(networkId, actionTypeId);
        setDetail(result);
      } catch (nextError) {
        setError(extractRequestErrorMessage(nextError));
      }
    };

    void loadData();
  }, [actionTypeId, networkId, open]);

  return (
    <Drawer
      onClose={onClose}
      open={open}
      title={detail?.name ?? t("knowledgeNetwork.actionTypeDetailTitle")}
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
            <h4>{t("knowledgeNetwork.actionTypeBasicInfo")}</h4>
            <div className={styles.infoGrid}>
              <div>
                <span>{t("knowledgeNetwork.actionTypeKind")}</span>
                <strong>{getActionKindLabel(detail.actionKind, t)}</strong>
              </div>
              <div>
                <span>{t("knowledgeNetwork.updatedBy", { name: detail.updaterName })}</span>
                <strong>{detail.updateTime}</strong>
              </div>
            </div>
          </section>

          <section className={styles.detailPanel}>
            <h4>{t("knowledgeNetwork.actionTypeBinding")}</h4>
            <div className={styles.infoGrid}>
              <div>
                <span>{t("knowledgeNetwork.actionTypeObject")}</span>
                <strong>{detail.objectTypeName}</strong>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
