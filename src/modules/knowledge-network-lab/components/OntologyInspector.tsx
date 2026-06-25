/** 本体图谱右侧检查面板 —— 未选中时显示图例，选中实体类时显示属性 / 绑定资源 / 关系。 */

import { CloseOutlined, DeploymentUnitOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import { useTranslation } from "react-i18next";

import type { DomainNetwork } from "@/modules/knowledge-network-lab/types/domain-network";
import { entityOf, relationsOf } from "@/modules/knowledge-network-lab/utils/domain-network";

import styles from "./OntologyInspector.module.css";

type OntologyInspectorProps = {
  network: DomainNetwork;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
};

export function OntologyInspector({ network, selectedKey, onSelect }: OntologyInspectorProps) {
  const { t } = useTranslation();
  const entity = entityOf(network, selectedKey);

  if (!entity) {
    return (
      <div className={styles.empty}>
        <div className={styles.hint}>
          <DeploymentUnitOutlined />
          <span>{t("knowledgeNetworkLab.detail.inspectorHint")}</span>
        </div>
        <div className={styles.legendTitle}>{t("knowledgeNetworkLab.detail.entityClasses")}</div>
        <div className={styles.legendList}>
          {network.entityClasses.map((item) => (
            <button
              key={item.key}
              type="button"
              className={styles.legendItem}
              onClick={() => onSelect(item.key)}
            >
              <span className={styles.dot} style={{ background: item.color }} />
              <span className={styles.legendName}>{item.name}</span>
              {item.indexed ? <span className={styles.legendIndexed} /> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const relations = relationsOf(network, entity.key);
  const bound = entity.boundResource;

  return (
    <div className={styles.inspect}>
      <div className={styles.head}>
        <span className={styles.headDot} style={{ background: entity.color }} />
        <div className={styles.headTitle}>
          <strong>{entity.name}</strong>
          <span>
            {entity.indexed
              ? t("knowledgeNetworkLab.indexState.built")
              : t("knowledgeNetworkLab.indexState.none")}
          </span>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label={t("knowledgeNetworkLab.detail.clearSelection")}
          onClick={() => onSelect(null)}
        >
          <CloseOutlined />
        </button>
      </div>

      {entity.conceptGroups.length > 0 ? (
        <div className={styles.groups}>
          {entity.conceptGroups.map((group) => (
            <Tag key={group} bordered={false}>
              {group}
            </Tag>
          ))}
        </div>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          {t("knowledgeNetworkLab.detail.properties")} <span>{entity.props.length}</span>
        </div>
        {entity.props.length > 0 ? (
          entity.props.map((prop) => (
            <div key={prop.name} className={styles.propRow}>
              <code>
                {prop.name}
                {prop.pk ? <span className={styles.pk}>PK</span> : null}
                {prop.indexed ? <span className={styles.idx}>IDX</span> : null}
              </code>
              <span className={styles.propType}>{prop.type}</span>
            </div>
          ))
        ) : (
          <div className={styles.muted}>{t("knowledgeNetworkLab.detail.noProps")}</div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t("knowledgeNetworkLab.detail.boundResource")}</div>
        {bound ? (
          <div className={styles.bindCard}>
            <span className={styles.bindName}>{bound.name}</span>
            <span className={styles.bindMeta}>
              <Tag color={bound.indexed ? "success" : "default"} bordered={false}>
                {bound.indexed
                  ? t("knowledgeNetworkLab.indexState.built")
                  : t("knowledgeNetworkLab.indexState.none")}
              </Tag>
            </span>
          </div>
        ) : (
          <div className={styles.bindNone}>{t("knowledgeNetworkLab.detail.bindNone")}</div>
        )}
      </section>

      {relations.length > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            {t("knowledgeNetworkLab.detail.relations")} <span>{relations.length}</span>
          </div>
          {relations.map((relation) => {
            const out = relation.from === entity.key;
            const other = entityOf(network, out ? relation.to : relation.from);
            return (
              <div key={relation.key} className={styles.relRow}>
                <span className={styles.relVerb}>{relation.name}</span>
                <span className={styles.relArrow}>{out ? "→" : "←"}</span>
                <span className={styles.relTarget}>
                  <span className={styles.dot} style={{ background: other ? other.color : "#999" }} />
                  {other ? other.name : out ? relation.toName : relation.fromName}
                </span>
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
