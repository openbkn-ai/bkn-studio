/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Spin } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import listStyles from "./ResourceListPanel.module.css";
import styles from "./ResourceGraphExplorer.module.css";

type Props = {
  emptyContent: ReactNode;
  items: KnowledgeNetworkObjectTypeRecord[];
  loading: boolean;
  onPageChange: (page: number) => void;
  onSelect: (record: KnowledgeNetworkObjectTypeRecord) => void;
  page: number;
  pageSize: number;
  resourceCountLabel: string;
  resourceCounts: Record<string, number | null>;
  selectedId: string;
  totalCount: number;
};

export function ObjectTypeGraphSidebar({
  emptyContent,
  items,
  loading,
  onPageChange,
  onSelect,
  page,
  pageSize,
  resourceCountLabel,
  resourceCounts,
  selectedId,
  totalCount,
}: Props) {
  const { t } = useTranslation();
  return (
    <aside className={styles.objectSidebar}>
      <div className={styles.objectSidebarHeader}>
        <strong>{t("knowledgeNetwork.objectTypes")}</strong>
        <span>{totalCount}</span>
      </div>
      <div className={styles.objectListArea}>
        <Spin spinning={loading}>
          <div className={styles.objectList}>
            {items.map((item) => (
              <button
                className={`${styles.objectButton} ${
                  item.id === selectedId ? styles.objectButtonSelected : ""
                }`}
                key={item.id}
                onClick={() => onSelect(item)}
                type="button"
              >
                <span
                  className={listStyles.objectIconSquare}
                  style={{ backgroundColor: item.color || "#1677ff" }}
                >
                  {renderResourceIcon(item.icon)}
                </span>
                <span className={styles.objectButtonName}>{item.name}</span>
                <span
                  aria-label={
                    typeof resourceCounts[item.id] === "number"
                      ? `${item.name} ${resourceCountLabel} ${resourceCounts[item.id]}`
                      : undefined
                  }
                  className={styles.objectResourceCount}
                  title={
                    typeof resourceCounts[item.id] === "number"
                      ? `${resourceCountLabel} ${resourceCounts[item.id]}`
                      : undefined
                  }
                >
                  {resourceCounts[item.id] === undefined
                    ? "…"
                    : resourceCounts[item.id] === null
                      ? "—"
                      : resourceCounts[item.id]}
                </span>
              </button>
            ))}
            {!loading && items.length === 0 ? emptyContent : null}
          </div>
        </Spin>
      </div>
      {totalCount > pageSize ? (
        <div className={styles.objectPagination}>
          <TablePaginationBar
            current={page}
            onChange={(nextPage) => onPageChange(nextPage)}
            pageSize={pageSize}
            showLessItems
            showSizeChanger={false}
            total={totalCount}
          />
        </div>
      ) : null}
    </aside>
  );
}
