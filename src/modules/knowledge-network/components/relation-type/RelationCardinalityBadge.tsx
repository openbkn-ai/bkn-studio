/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tag, Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import type { RelationDeclarations } from "@/modules/knowledge-network/types/knowledge-network";
import {
  CARDINALITY_LABEL_KEYS,
  CARDINALITY_NOTATION,
} from "@/modules/knowledge-network/utils/relation-declarations";

import styles from "./RelationCardinalityBadge.module.css";
import { useRelationSentence } from "./use-relation-sentence";

const PREFIX = "knowledgeNetwork.relationDeclarations";

type RelationCardinalityBadgeProps = {
  declarations: RelationDeclarations | undefined;
  /** Also writes the cardinality out beside the badge, as a detail view does. */
  showLabel?: boolean;
  sourceName: string;
  targetName: string;
};

/**
 * A relation's cardinality as 1:1, 1:N, N:1 or N:N, from source to target, saying on hover what
 * it means. Nothing when the relation does not declare one.
 */
export function RelationCardinalityBadge({
  declarations,
  showLabel = false,
  sourceName,
  targetName,
}: RelationCardinalityBadgeProps) {
  const { t } = useTranslation();
  const sentence = useRelationSentence(declarations, { source: sourceName, target: targetName });
  const cardinality = declarations?.cardinality;
  if (!cardinality) {
    return null;
  }
  const label = t(`${PREFIX}.cardinalityOption.${CARDINALITY_LABEL_KEYS[cardinality]}`);
  const badge = (
    <Tooltip
      title={
        <span className={styles.tip}>
          <strong>{label}</strong>
          {sentence ? <span>{sentence}</span> : null}
        </span>
      }
    >
      <Tag aria-label={label} className={styles.badge} color="geekblue">
        {CARDINALITY_NOTATION[cardinality]}
      </Tag>
    </Tooltip>
  );
  return showLabel ? (
    <span className={styles.withLabel}>
      {badge}
      {label}
    </span>
  ) : (
    badge
  );
}
