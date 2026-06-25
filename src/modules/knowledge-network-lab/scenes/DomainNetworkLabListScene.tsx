/** 领域业务知识网络（实验版）列表 —— 卡片浏览 + 搜索 + 状态过滤（真实后端）。 */

import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Empty, Input, Spin } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { DomainNetworkCard } from "@/modules/knowledge-network-lab/components/DomainNetworkCard";
import { listDomainNetworks } from "@/modules/knowledge-network-lab/services/domain-networks.lab.service";
import type { DomainNetworkSummary } from "@/modules/knowledge-network-lab/types/domain-network";

import styles from "./DomainNetworkLabListScene.module.css";

export function DomainNetworkLabListScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();

  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<DomainNetworkSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDomainNetworks({ keyword });
      setItems(result.records);
    } catch (caught) {
      setError(extractRequestErrorMessage(caught));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasFilter = keyword.trim().length > 0;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>
            {t("knowledgeNetworkLab.list.title")}
            <span className={styles.labBadge}>{t("knowledgeNetworkLab.labBadge")}</span>
          </h2>
          <p className={styles.subtitle}>{t("knowledgeNetworkLab.list.subtitle")}</p>
        </div>
        <div className={styles.actions}>
          <Input
            className={styles.search}
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("knowledgeNetworkLab.list.searchPlaceholder")}
            prefix={<SearchOutlined className={styles.searchIcon} />}
          />
          <AppButton
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => message.info(t("knowledgeNetworkLab.list.createHint"))}
          >
            {t("knowledgeNetworkLab.list.create")}
          </AppButton>
        </div>
      </header>

      {error ? <Alert type="error" showIcon message={error} className={styles.alert} /> : null}

      {loading ? (
        <div className={styles.center}>
          <Spin />
        </div>
      ) : items.length > 0 ? (
        <div className={styles.grid}>
          {items.map((network) => (
            <DomainNetworkCard
              key={network.id}
              network={network}
              onOpen={(record) => navigate(`/knowledge-network-lab/${record.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.center}>
          <Empty
            description={
              hasFilter
                ? t("knowledgeNetworkLab.list.emptyFiltered")
                : t("knowledgeNetworkLab.list.empty")
            }
          />
        </div>
      )}
    </section>
  );
}
