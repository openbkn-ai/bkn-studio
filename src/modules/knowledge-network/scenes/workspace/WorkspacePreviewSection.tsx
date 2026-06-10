import { PlusOutlined } from "@ant-design/icons";
import { Empty, Spin } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { AppButton } from "@/framework/ui/common/AppButton";
import { KnowledgeNetworkPreviewCanvas } from "@/modules/knowledge-network/components/preview/KnowledgeNetworkPreviewCanvas";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import { buildModelingPreviewGraph } from "@/modules/knowledge-network/utils/build-modeling-preview-graph";

import styles from "./WorkspacePreviewSection.module.css";

type WorkspacePreviewSectionProps = {
  loading?: boolean;
  networkId: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  relationTypes: KnowledgeNetworkRelationTypeRecord[];
};

export function WorkspacePreviewSection({
  loading = false,
  networkId,
  objectTypes,
  relationTypes,
}: WorkspacePreviewSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const previewGraph = useMemo(
    () => buildModelingPreviewGraph(objectTypes, relationTypes),
    [objectTypes, relationTypes],
  );

  return (
    <section className={styles.previewSection}>
      <div className={styles.previewHeader}>
        <div className={styles.previewHeading}>
          <h2 className={styles.previewTitle}>{t("knowledgeNetwork.workspacePreviewModeling")}</h2>
          <p className={styles.previewDescription}>{t("knowledgeNetwork.previewDescription")}</p>
        </div>
        {previewGraph.nodes.length > 0 ? (
          <div className={styles.previewStats}>
            <span className={styles.previewStatItem}>
              <span className={styles.previewStatDot} />
              {t("knowledgeNetwork.previewNodeCount", { count: previewGraph.nodes.length })}
            </span>
            <span className={styles.previewStatItem}>
              <span className={`${styles.previewStatDot} ${styles.previewStatDotEdge}`} />
              {t("knowledgeNetwork.previewEdgeCount", { count: previewGraph.edges.length })}
            </span>
          </div>
        ) : null}
      </div>

      <Spin spinning={loading} wrapperClassName={styles.previewSpinWrap}>
        {previewGraph.nodes.length === 0 && !loading ? (
          <div className={styles.emptyPanel}>
            <Empty description={t("knowledgeNetwork.previewEmpty")}>
              <AppButton
                icon={<PlusOutlined />}
                onClick={() => {
                  void navigate(
                    `/knowledge-network/workspace/${networkId}/object-types/create`,
                  );
                }}
                type="primary"
              >
                {t("knowledgeNetwork.previewCreateObjectType")}
              </AppButton>
            </Empty>
          </div>
        ) : (
          <div className={styles.previewCanvasWrap}>
            <KnowledgeNetworkPreviewCanvas graph={previewGraph} />
          </div>
        )}
      </Spin>
    </section>
  );
}
