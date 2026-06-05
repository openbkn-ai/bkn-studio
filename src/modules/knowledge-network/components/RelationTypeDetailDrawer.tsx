import { Drawer, Tag } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getKnowledgeNetworkRelationType } from "@/modules/knowledge-network/services/knowledge-network.service";
import type { KnowledgeNetworkRelationTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./RelationTypeDetailDrawer.module.css";

type RelationTypeDetailDrawerProps = {
  networkId: string;
  onClose: () => void;
  open: boolean;
  relationTypeId: string | null;
};

export function RelationTypeDetailDrawer({
  networkId,
  onClose,
  open,
  relationTypeId,
}: RelationTypeDetailDrawerProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<KnowledgeNetworkRelationTypeRecord | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !relationTypeId) {
      return;
    }

    const loadData = async () => {
      setError(null);

      try {
        const result = await getKnowledgeNetworkRelationType(
          networkId,
          relationTypeId,
        );
        setDetail(result);
      } catch (nextError) {
        setError(extractRequestErrorMessage(nextError));
      }
    };

    void loadData();
  }, [networkId, open, relationTypeId]);

  return (
    <Drawer
      onClose={onClose}
      open={open}
      title={detail?.name ?? t("knowledgeNetwork.relationTypeDetailTitle")}
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
            <h4>{t("knowledgeNetwork.relationTypeBasicInfo")}</h4>
            <div className={styles.infoGrid}>
              <div>
                <span>{t("knowledgeNetwork.relationTypeMappingMode")}</span>
                <strong>
                  {detail.mappingMode === "direct"
                    ? t("knowledgeNetwork.relationTypeDirectMapping")
                    : t("knowledgeNetwork.relationTypeDataViewMapping")}
                </strong>
              </div>
              <div>
                <span>{t("knowledgeNetwork.updatedBy", { name: detail.updaterName })}</span>
                <strong>{detail.updateTime}</strong>
              </div>
            </div>
          </section>

          <section className={styles.detailPanel}>
            <h4>{t("knowledgeNetwork.relationTypeObjectLink")}</h4>
            <div className={styles.infoGrid}>
              <div>
                <span>{t("knowledgeNetwork.relationTypeSourceObject")}</span>
                <strong>{detail.sourceObjectTypeName}</strong>
              </div>
              <div>
                <span>{t("knowledgeNetwork.relationTypeTargetObject")}</span>
                <strong>{detail.targetObjectTypeName}</strong>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
