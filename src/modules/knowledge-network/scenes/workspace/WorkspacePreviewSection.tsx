import { Card, Empty } from "antd";
import { useTranslation } from "react-i18next";

import type { KnowledgeNetworkPreviewGraph } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "../KnowledgeNetworkWorkspaceScene.module.css";

type WorkspacePreviewSectionProps = {
  previewGraph: KnowledgeNetworkPreviewGraph;
};

export function WorkspacePreviewSection({ previewGraph }: WorkspacePreviewSectionProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.sectionGrid}>
      <Card className={styles.panel} title={t("knowledgeNetwork.previewCanvas")}>
        {previewGraph.nodes.length === 0 ? (
          <Empty description={t("knowledgeNetwork.previewEmpty")} />
        ) : (
          <div className={styles.previewCanvas}>
            <div className={styles.previewNodes}>
              {previewGraph.nodes.map((node) => (
                <div className={styles.previewNode} key={node.id}>
                  <span
                    className={styles.previewNodeDot}
                    style={{ backgroundColor: node.color }}
                  />
                  <span>{node.name}</span>
                </div>
              ))}
            </div>
            <div className={styles.previewEdges}>
              {previewGraph.edges.map((edge) => (
                <div className={styles.previewEdge} key={edge.id}>
                  <strong>{edge.name || t("knowledgeNetwork.defaultEdgeName")}</strong>
                  <span>
                    {edge.sourceId} -&gt; {edge.targetId}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
