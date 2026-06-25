/** 领域业务知识网络（实验版）详情 —— 本体图谱 + 本体结构 / 数据绑定（真实后端）。 */

import {
  ArrowLeftOutlined,
  KeyOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Spin, Table, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { OntologyGraph } from "@/modules/knowledge-network-lab/components/OntologyGraph";
import { OntologyInspector } from "@/modules/knowledge-network-lab/components/OntologyInspector";
import { getDomainNetwork } from "@/modules/knowledge-network-lab/services/domain-networks.lab.service";
import type {
  DomainNetwork,
  EntityClass,
  RelationClass,
} from "@/modules/knowledge-network-lab/types/domain-network";
import {
  STATUS_META,
  entityOf,
  formatCount,
  formatTimeAgo,
} from "@/modules/knowledge-network-lab/utils/domain-network";

import styles from "./DomainNetworkLabDetailScene.module.css";

export function DomainNetworkLabDetailScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const { networkId } = useParams<{ networkId: string }>();

  const [network, setNetwork] = useState<DomainNetwork | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const record = networkId ? await getDomainNetwork(networkId) : null;
      setNetwork(record);
      setSelectedKey(null);
    } catch (caught) {
      setError(extractRequestErrorMessage(caught));
      setNetwork(null);
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={styles.center}>
        <Spin />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.center}>
        <Alert type="error" showIcon message={error} />
      </div>
    );
  }

  if (!network) {
    return (
      <div className={styles.center}>
        <Empty description={t("knowledgeNetworkLab.detail.notFound")}>
          <AppButton onClick={() => navigate("/knowledge-network-lab")}>
            {t("knowledgeNetworkLab.detail.back")}
          </AppButton>
        </Empty>
      </div>
    );
  }

  const status = STATUS_META[network.status];

  const onPrototypeAction = (key: string) =>
    message.info(t(`knowledgeNetworkLab.detail.action.${key}Hint`));

  const statCards = [
    { label: t("knowledgeNetworkLab.detail.statEntityClasses"), value: formatCount(network.stats.objectTypes) },
    { label: t("knowledgeNetworkLab.detail.statRelationClasses"), value: formatCount(network.stats.relationTypes) },
    { label: t("knowledgeNetworkLab.detail.statConceptGroups"), value: formatCount(network.stats.conceptGroups) },
    { label: t("knowledgeNetworkLab.detail.statMetrics"), value: formatCount(network.stats.metrics) },
  ];

  return (
    <section className={styles.page}>
      <button type="button" className={styles.backLink} onClick={() => navigate("/knowledge-network-lab")}>
        <ArrowLeftOutlined />
        {t("knowledgeNetworkLab.detail.backToList")}
      </button>

      <div className={styles.headerRow}>
        <div className={styles.headMain}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{network.name}</h2>
            <Tag color={status.color} bordered={false}>
              {t(status.labelKey)}
            </Tag>
            {network.domain ? (
              <Tag bordered={false} className={styles.domainTag}>
                {network.domain}
              </Tag>
            ) : null}
          </div>
          <div className={styles.sub}>
            <span className={styles.slugChip}>{network.slug}</span>
            {network.owner ? <span>{t("knowledgeNetworkLab.detail.owner", { owner: network.owner })}</span> : null}
            <span>{t("knowledgeNetworkLab.card.updatedAt", { time: formatTimeAgo(network.updatedAt, t) })}</span>
          </div>
        </div>
        <div className={styles.headActions}>
          <AppButton icon={<KeyOutlined />} onClick={() => onPrototypeAction("authz")}>
            {t("knowledgeNetworkLab.detail.action.authz")}
          </AppButton>
          <AppButton icon={<SettingOutlined />} onClick={() => onPrototypeAction("editOntology")}>
            {t("knowledgeNetworkLab.detail.action.editOntology")}
          </AppButton>
          <AppButton
            icon={<ThunderboltOutlined />}
            onClick={() => navigate(`/knowledge-network-lab/${network.id}/debug`)}
          >
            {t("knowledgeNetworkLab.detail.action.sandbox")}
          </AppButton>
        </div>
      </div>

      <div className={styles.statStrip}>
        {statCards.map((card) => (
          <div key={card.label} className={styles.statCard}>
            <div className={styles.statLabel}>{card.label}</div>
            <div className={styles.statValue}>{card.value}</div>
          </div>
        ))}
      </div>

      {network.entityClasses.length === 0 ? (
        <Alert type="info" showIcon message={t("knowledgeNetworkLab.detail.emptyOntology")} />
      ) : (
        <>
          <div className={styles.graphCard}>
            <div className={styles.graphHeader}>
              <h3 className={styles.sectionTitle}>
                {t("knowledgeNetworkLab.detail.ontologyGraph")}
                <span className={styles.sectionHint}>ontology graph</span>
              </h3>
              <span className={styles.graphHint}>{t("knowledgeNetworkLab.detail.graphLegend")}</span>
            </div>
            <div className={styles.graphLayout}>
              <div className={styles.graphCanvas}>
                <OntologyGraph network={network} selectedKey={selectedKey} onSelect={setSelectedKey} />
              </div>
              <aside className={styles.graphAside}>
                <OntologyInspector network={network} selectedKey={selectedKey} onSelect={setSelectedKey} />
              </aside>
            </div>
          </div>

          <Tabs
            defaultActiveKey="ontology"
            items={[
              {
                key: "ontology",
                label: t("knowledgeNetworkLab.detail.tabOntology"),
                children: <OntologyTables network={network} />,
              },
              {
                key: "binding",
                label: t("knowledgeNetworkLab.detail.tabBinding"),
                children: <BindingTable network={network} />,
              },
            ]}
          />
        </>
      )}
    </section>
  );
}

/* ---------------- 本体结构表格 ---------------- */
function OntologyTables({ network }: { network: DomainNetwork }) {
  const { t } = useTranslation();

  const entityColumns: ColumnsType<EntityClass> = [
    {
      title: t("knowledgeNetworkLab.table.entityClass"),
      key: "name",
      render: (_, entity) => (
        <span className={styles.tblName}>
          <span className={styles.dot} style={{ background: entity.color }} />
          <span>{entity.name}</span>
          {entity.hub ? <span className={styles.hubTag}>{t("knowledgeNetworkLab.table.hub")}</span> : null}
        </span>
      ),
    },
    {
      title: t("knowledgeNetworkLab.table.props"),
      key: "props",
      width: 90,
      render: (_, entity) => entity.props.length,
    },
    {
      title: t("knowledgeNetworkLab.table.conceptGroups"),
      key: "groups",
      render: (_, entity) =>
        entity.conceptGroups.length > 0 ? (
          entity.conceptGroups.map((group) => (
            <Tag key={group} bordered={false}>
              {group}
            </Tag>
          ))
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
    {
      title: t("knowledgeNetworkLab.table.index"),
      key: "index",
      width: 120,
      render: (_, entity) =>
        entity.indexed ? (
          <Tag color="success" bordered={false}>
            {t("knowledgeNetworkLab.indexState.built")}
          </Tag>
        ) : (
          <span className={styles.muted}>{t("knowledgeNetworkLab.indexState.none")}</span>
        ),
    },
  ];

  const relationColumns: ColumnsType<RelationClass> = [
    {
      title: t("knowledgeNetworkLab.table.relation"),
      key: "name",
      render: (_, relation) => relation.name,
    },
    {
      title: t("knowledgeNetworkLab.table.path"),
      key: "path",
      render: (_, relation) => {
        const a = entityOf(network, relation.from);
        const b = entityOf(network, relation.to);
        return (
          <span className={styles.relPath}>
            <span className={styles.chip} style={{ "--nc": a?.color ?? "#999" } as CSSProperties}>
              {a?.name ?? relation.fromName}
            </span>
            <span className={styles.relArrow}>→</span>
            <span className={styles.chip} style={{ "--nc": b?.color ?? "#999" } as CSSProperties}>
              {b?.name ?? relation.toName}
            </span>
          </span>
        );
      },
    },
    {
      title: t("knowledgeNetworkLab.table.mapping"),
      key: "mapping",
      width: 120,
      render: (_, relation) => (
        <Tag bordered={false}>
          {relation.mappingMode === "resource"
            ? t("knowledgeNetworkLab.table.mappingResource")
            : t("knowledgeNetworkLab.table.mappingDirect")}
        </Tag>
      ),
    },
  ];

  return (
    <div className={styles.sectionGrid}>
      <div className={styles.sectionCard}>
        <div className={styles.sectionCardTitle}>
          {t("knowledgeNetworkLab.detail.entityClasses")}
          <span className={styles.badge}>{network.entityClasses.length}</span>
        </div>
        <Table
          rowKey="key"
          size="small"
          columns={entityColumns}
          dataSource={network.entityClasses}
          pagination={false}
        />
      </div>
      <div className={styles.sectionCard}>
        <div className={styles.sectionCardTitle}>
          {t("knowledgeNetworkLab.detail.relationClasses")}
          <span className={styles.badge}>{network.relationClasses.length}</span>
        </div>
        <Table
          rowKey="key"
          size="small"
          columns={relationColumns}
          dataSource={network.relationClasses}
          pagination={false}
        />
      </div>
    </div>
  );
}

/* ---------------- 数据绑定表格 ---------------- */
function BindingTable({ network }: { network: DomainNetwork }) {
  const { t } = useTranslation();

  const columns: ColumnsType<EntityClass> = [
    {
      title: t("knowledgeNetworkLab.table.entityClass"),
      key: "name",
      render: (_, entity) => (
        <span className={styles.tblName}>
          <span className={styles.dot} style={{ background: entity.color }} />
          <span>{entity.name}</span>
        </span>
      ),
    },
    {
      title: t("knowledgeNetworkLab.table.boundResource"),
      key: "resource",
      render: (_, entity) =>
        entity.boundResource ? (
          <span className={styles.resourceName}>{entity.boundResource.name}</span>
        ) : (
          <span className={styles.muted}>{t("knowledgeNetworkLab.table.noBind")}</span>
        ),
    },
    {
      title: t("knowledgeNetworkLab.table.indexState"),
      key: "indexState",
      width: 130,
      render: (_, entity) =>
        entity.indexed ? (
          <Tag color="success" bordered={false}>
            {t("knowledgeNetworkLab.indexState.built")}
          </Tag>
        ) : (
          <Tag bordered={false}>{t("knowledgeNetworkLab.indexState.none")}</Tag>
        ),
    },
  ];

  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionCardTitle}>
        {t("knowledgeNetworkLab.detail.bindingTitle")}
        <span className={styles.sectionHint}>{t("knowledgeNetworkLab.detail.bindingHint")}</span>
      </div>
      <Table
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={network.entityClasses}
        pagination={false}
      />
    </div>
  );
}
