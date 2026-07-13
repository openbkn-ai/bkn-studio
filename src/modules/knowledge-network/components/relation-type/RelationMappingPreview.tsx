/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApartmentOutlined,
  DatabaseOutlined,
  LinkOutlined,
  NodeIndexOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";

import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./RelationMappingPreview.module.css";

type RelationMappingPreviewProps = {
  bridgeLabel: string;
  mappingMode: "direct" | "resource";
  sourceObject?: KnowledgeNetworkObjectTypeRecord;
  targetObject?: KnowledgeNetworkObjectTypeRecord;
};

export function RelationMappingPreview({
  bridgeLabel,
  mappingMode,
  sourceObject,
  targetObject,
}: RelationMappingPreviewProps) {
  return (
    <div aria-hidden className={styles.previewBox}>
      <div className={styles.previewCanvas}>
        <PreviewObjectNode fallbackIcon={<ApartmentOutlined />} object={sourceObject} />
        <span className={styles.previewLink} />
        <span className={styles.previewBridgeNode}>
          <span
            className={`${styles.previewBridge} ${
              mappingMode === "resource" ? styles.previewBridgeResource : ""
            }`}
          >
            {mappingMode === "resource" ? <DatabaseOutlined /> : <LinkOutlined />}
          </span>
          <span className={styles.previewBridgeLabel}>{bridgeLabel}</span>
        </span>
        <span className={styles.previewLink} />
        <PreviewObjectNode fallbackIcon={<NodeIndexOutlined />} object={targetObject} />
      </div>
    </div>
  );
}

type PreviewObjectNodeProps = {
  fallbackIcon: ReactNode;
  object?: KnowledgeNetworkObjectTypeRecord;
};

function PreviewObjectNode({ fallbackIcon, object }: PreviewObjectNodeProps) {
  return (
    <div className={styles.previewNode}>
      <span
        className={styles.previewNodeIcon}
        style={{
          backgroundColor: object?.color ? object.color : "#3A93FF",
        }}
      >
        {object?.icon ? renderResourceIcon(object.icon) : fallbackIcon}
      </span>
      {object ? <span className={styles.previewNodeLabel}>{object.name}</span> : null}
    </div>
  );
}
