import { EnvironmentOutlined, UserOutlined } from "@ant-design/icons";

import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./RelationMappingPreview.module.css";

type RelationMappingPreviewProps = {
  propertyMappingCount: number;
  sourceObject?: KnowledgeNetworkObjectTypeRecord;
  targetObject?: KnowledgeNetworkObjectTypeRecord;
};

export function RelationMappingPreview({
  propertyMappingCount,
  sourceObject,
  targetObject,
}: RelationMappingPreviewProps) {
  const leftNodeCount = Math.max(1, Math.min(3, propertyMappingCount || 1));
  const rightNodeCount = Math.max(1, Math.min(2, propertyMappingCount || 1));

  return (
    <div aria-hidden className={styles.previewBox}>
      <div className={styles.previewCanvas}>
        <div className={styles.previewColumn}>
          {Array.from({ length: leftNodeCount }).map((_, index) => (
            <div className={styles.previewNode} key={`source-${index}`}>
              <span
                className={styles.previewNodeIcon}
                style={{
                  backgroundColor:
                    index === 0 && sourceObject?.color ? sourceObject.color : "#3A93FF",
                }}
              >
                {index === 0 && sourceObject?.icon ? (
                  renderResourceIcon(sourceObject.icon)
                ) : (
                  <EnvironmentOutlined />
                )}
              </span>
              {index === 0 && sourceObject ? (
                <span className={styles.previewNodeLabel}>{sourceObject.name}</span>
              ) : null}
            </div>
          ))}
        </div>

        <div className={styles.previewLinks}>
          {Array.from({ length: Math.max(leftNodeCount, rightNodeCount) }).map((_, index) => (
            <span className={styles.previewLink} key={`link-${index}`} />
          ))}
        </div>

        <div className={styles.previewColumn}>
          {Array.from({ length: rightNodeCount }).map((_, index) => (
            <div className={styles.previewNode} key={`target-${index}`}>
              <span
                className={styles.previewNodeIcon}
                style={{
                  backgroundColor:
                    index === 0 && targetObject?.color ? targetObject.color : "#3A93FF",
                }}
              >
                {index === 0 && targetObject?.icon ? (
                  renderResourceIcon(targetObject.icon)
                ) : (
                  <UserOutlined />
                )}
              </span>
              {index === 0 && targetObject ? (
                <span className={styles.previewNodeLabel}>{targetObject.name}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
