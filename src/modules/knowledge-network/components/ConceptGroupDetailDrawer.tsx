import { Drawer, Empty, List, Tag, Tabs } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  getKnowledgeNetworkConceptGroup,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ConceptGroupDetail,
  ConceptGroupRelatedItem,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ConceptGroupDetailDrawer.module.css";

type ConceptGroupDetailDrawerProps = {
  groupId: string | null;
  networkId: string;
  onClose: () => void;
  open: boolean;
};

type RelatedTabKey = "object" | "relation" | "action";

export function ConceptGroupDetailDrawer({
  groupId,
  networkId,
  onClose,
  open,
}: ConceptGroupDetailDrawerProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<ConceptGroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<RelatedTabKey>("object");

  useEffect(() => {
    if (!open || !groupId) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await getKnowledgeNetworkConceptGroup(networkId, groupId);
        setDetail(result);
      } catch (nextError) {
        setError(extractRequestErrorMessage(nextError));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [groupId, networkId, open]);

  const currentItems = useMemo(() => {
    if (!detail) {
      return [] as ConceptGroupRelatedItem[];
    }

    if (activeTab === "relation") {
      return detail.relationTypes;
    }

    if (activeTab === "action") {
      return detail.actionTypes;
    }

    return detail.objectTypes;
  }, [activeTab, detail]);

  return (
    <Drawer
      onClose={onClose}
      open={open}
      title={detail?.name ?? t("knowledgeNetwork.conceptGroupDetailTitle")}
      width={840}
    >
      {error ? <div>{error}</div> : null}
      {!error && detail ? (
        <div className={styles.drawerLayout}>
          <section className={styles.summaryCard}>
            <div className={styles.summaryHead}>
              <span
                className={styles.summaryDot}
                style={{ backgroundColor: detail.color ?? "#1677ff" }}
              />
              <div>
                <h3>{detail.name}</h3>
                <p>{detail.description || t("knowledgeNetwork.noDescription")}</p>
              </div>
            </div>
            <div className={styles.tagRow}>
              {detail.tags && detail.tags.length > 0 ? (
                detail.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)
              ) : (
                <span className={styles.placeholder}>
                  {t("knowledgeNetwork.noTags")}
                </span>
              )}
            </div>
            <div className={styles.summaryStats}>
              <span>{t("knowledgeNetwork.objectTypes")} {detail.objectTypesTotal}</span>
              <span>{t("knowledgeNetwork.relationTypes")} {detail.relationTypesTotal}</span>
              <span>{t("knowledgeNetwork.actionTypes")} {detail.actionTypesTotal}</span>
            </div>
          </section>
          <section className={styles.detailPanel}>
            <Tabs
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key as RelatedTabKey)}
              items={[
                { key: "object", label: t("knowledgeNetwork.objectTypes") },
                { key: "relation", label: t("knowledgeNetwork.relationTypes") },
                { key: "action", label: t("knowledgeNetwork.actionTypes") },
              ]}
            />
            {loading ? (
              <div>{t("common.reload")}</div>
            ) : currentItems.length === 0 ? (
              <Empty description={t("knowledgeNetwork.conceptGroupMembersEmpty")} />
            ) : (
              <List
                dataSource={currentItems}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      description={item.description || t("knowledgeNetwork.noDescription")}
                      title={
                        <div className={styles.memberTitleRow}>
                          <span
                            className={styles.memberDot}
                            style={{ backgroundColor: item.color ?? "#1677ff" }}
                          />
                          <span>{item.name}</span>
                        </div>
                      }
                    />
                    <div className={styles.memberTags}>
                      {item.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                  </List.Item>
                )}
              />
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
