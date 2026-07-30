/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tag, Tooltip } from "antd";

import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";

type ResourceTagListProps = {
  maxVisible?: number;
  tags?: string[];
};

export function ResourceTagList({ maxVisible = 3, tags = [] }: ResourceTagListProps) {
  const visibleLimit = tags.length > maxVisible ? Math.max(maxVisible - 1, 1) : maxVisible;
  const visibleTags = tags.slice(0, visibleLimit);
  const hiddenCount = Math.max(tags.length - visibleTags.length, 0);

  return (
    <div className={styles.tableTags}>
      {visibleTags.map((tag) => (
        <Tag key={tag}>{tag}</Tag>
      ))}
      {hiddenCount > 0 ? (
        <Tooltip
          color="#fff"
          overlayClassName={styles.tableTagsTooltipOverlay}
          title={
            <div className={styles.tableTagsTooltip}>
              {tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          }
        >
          <Tag className={styles.tableTagsMore}>+{hiddenCount}</Tag>
        </Tooltip>
      ) : null}
    </div>
  );
}
