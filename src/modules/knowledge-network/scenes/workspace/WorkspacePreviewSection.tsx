import { DeploymentUnitOutlined, PlusOutlined, ThunderboltFilled } from "@ant-design/icons";
import { Empty, Spin } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { OntologyGraphView } from "@/modules/knowledge-network/components/preview/OntologyGraphView";
import { OntologyInspectorPanel } from "@/modules/knowledge-network/components/preview/OntologyInspectorPanel";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import { buildModelingPreviewGraph } from "@/modules/knowledge-network/utils/build-modeling-preview-graph";

import styles from "./WorkspacePreviewSection.module.css";

type WorkspacePreviewSectionProps = {
  detail?: KnowledgeNetworkRecord | null;
  loading?: boolean;
  networkId: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  relationTypes: KnowledgeNetworkRelationTypeRecord[];
};

export function WorkspacePreviewSection({
  detail,
  loading = false,
  networkId,
  objectTypes,
  relationTypes,
}: WorkspacePreviewSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const previewGraph = useMemo(
    () => buildModelingPreviewGraph(objectTypes, relationTypes),
    [objectTypes, relationTypes],
  );

  const indexedIds = useMemo(
    () => new Set(objectTypes.filter((item) => item.hasIndex).map((item) => item.id)),
    [objectTypes],
  );

  const stats = useMemo(
    () => [
      {
        key: "objectTypes",
        label: t("knowledgeNetwork.previewStatObjectTypes"),
        value: detail?.statistics.objectTypesTotal ?? objectTypes.length,
      },
      {
        key: "relationTypes",
        label: t("knowledgeNetwork.previewStatRelationTypes"),
        value: detail?.statistics.relationTypesTotal ?? relationTypes.length,
      },
      {
        key: "conceptGroups",
        label: t("knowledgeNetwork.previewStatConceptGroups"),
        value: detail?.statistics.conceptGroupsTotal ?? 0,
      },
      {
        key: "indexed",
        label: t("knowledgeNetwork.previewStatIndexed"),
        value: indexedIds.size,
      },
    ],
    [detail, objectTypes.length, relationTypes.length, indexedIds.size, t],
  );

  const hasGraph = previewGraph.nodes.length > 0;

  return (
    <section className={styles.previewSection}>
      <div className={styles.previewHeader}>
        <div className={styles.previewHeading}>
          <h2 className={styles.previewTitle}>{t("knowledgeNetwork.workspacePreviewModeling")}</h2>
          <p className={styles.previewDescription}>{t("knowledgeNetwork.previewDescription")}</p>
        </div>
        <button
          type="button"
          className={styles.experienceButton}
          onClick={() => message.info(t("knowledgeNetwork.previewExperienceHint"))}
        >
          <ThunderboltFilled />
          <span>{t("knowledgeNetwork.previewExperience")}</span>
        </button>
      </div>

      {hasGraph ? (
        <div className={styles.statStrip}>
          {stats.map((item) => (
            <div key={item.key} className={styles.statCard}>
              <div className={styles.statLabel}>{item.label}</div>
              <div className={styles.statValue}>{item.value.toLocaleString("en-US")}</div>
            </div>
          ))}
        </div>
      ) : null}

      <Spin spinning={loading} wrapperClassName={styles.previewSpinWrap}>
        {!hasGraph && !loading ? (
          <div className={styles.emptyPanel}>
            <Empty description={t("knowledgeNetwork.previewEmpty")}>
              <AppButton
                icon={<PlusOutlined />}
                onClick={() => {
                  void navigate(`/knowledge-network/workspace/${networkId}/object-types/create`);
                }}
                type="primary"
              >
                {t("knowledgeNetwork.previewCreateObjectType")}
              </AppButton>
            </Empty>
          </div>
        ) : (
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
            <div className={styles.graphLayout}>
              <div className={styles.graphCanvas}>
                <OntologyGraphView
                  graph={previewGraph}
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
          </div>
        )}
      </Spin>
    </section>
  );
}
