/**
 * 本体图谱卡片 —— 图谱 + 右侧检查面板，自带选中态与空态。概述/预览复用。
 *
 * 不传 objectTypes/relationTypes 时自行按 networkId 拉取（概述页用），
 * 传入则直接使用（预览页已加载，避免重复请求）。
 */

import { DeploymentUnitOutlined } from "@ant-design/icons";
import { Empty, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { OntologyGraphView } from "@/modules/knowledge-network/components/preview/OntologyGraphView";
import { OntologyInspectorPanel } from "@/modules/knowledge-network/components/preview/OntologyInspectorPanel";
import {
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import { buildModelingPreviewGraph } from "@/modules/knowledge-network/utils/build-modeling-preview-graph";

import styles from "./OntologyGraphCard.module.css";

type OntologyGraphCardProps = {
  networkId: string;
  objectTypes?: KnowledgeNetworkObjectTypeRecord[];
  relationTypes?: KnowledgeNetworkRelationTypeRecord[];
};

export function OntologyGraphCard({
  networkId,
  objectTypes: objectTypesProp,
  relationTypes: relationTypesProp,
}: OntologyGraphCardProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const controlled = objectTypesProp !== undefined && relationTypesProp !== undefined;
  const [fetchedObjectTypes, setFetchedObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [fetchedRelationTypes, setFetchedRelationTypes] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
  const [loading, setLoading] = useState(!controlled);

  useEffect(() => {
    if (controlled) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSelectedId(null);
    Promise.all([
      listKnowledgeNetworkObjectTypes(networkId),
      listKnowledgeNetworkRelationTypes(networkId),
    ])
      .then(([objects, relations]) => {
        if (!cancelled) {
          setFetchedObjectTypes(objects);
          setFetchedRelationTypes(relations);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedObjectTypes([]);
          setFetchedRelationTypes([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [controlled, networkId]);

  const objectTypes = controlled ? objectTypesProp : fetchedObjectTypes;
  const relationTypes = controlled ? relationTypesProp : fetchedRelationTypes;

  const graph = useMemo(
    () => buildModelingPreviewGraph(objectTypes, relationTypes),
    [objectTypes, relationTypes],
  );

  const indexedIds = useMemo(
    () => new Set(objectTypes.filter((item) => item.hasIndex).map((item) => item.id)),
    [objectTypes],
  );

  return (
    <div className={styles.graphCard}>
      <div className={styles.graphHeader}>
        <h3 className={styles.graphTitle}>
          {t("knowledgeNetwork.previewCanvas")}
          <span className={styles.graphTitleHint}>ontology graph</span>
        </h3>
        <span className={styles.graphLegend}>
          <DeploymentUnitOutlined />
          {t("knowledgeNetwork.previewGraphLegend")}
        </span>
      </div>

      {loading ? (
        <div className={styles.emptyPanel}>
          <Spin />
        </div>
      ) : graph.nodes.length === 0 ? (
        <div className={styles.emptyPanel}>
          <Empty description={t("knowledgeNetwork.previewEmpty")} />
        </div>
      ) : (
        <div className={styles.graphLayout}>
          <div className={styles.graphCanvas}>
            <OntologyGraphView
              graph={graph}
              indexedIds={indexedIds}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          <aside className={styles.graphAside}>
            <OntologyInspectorPanel
              networkId={networkId}
              objectTypes={objectTypes}
              relationTypes={relationTypes}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
