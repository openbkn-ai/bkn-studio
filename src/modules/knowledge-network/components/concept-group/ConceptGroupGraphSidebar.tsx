/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AppstoreOutlined } from "@ant-design/icons";
import { Spin } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import type { ConceptGroupRecord } from "@/modules/knowledge-network/types/knowledge-network";

import listStyles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";
import styles from "@/modules/knowledge-network/components/shared/ResourceGraphExplorer.module.css";

type ConceptGroupGraphSidebarProps = {
  emptyContent: ReactNode;
  items: ConceptGroupRecord[];
  loading: boolean;
  onPageChange: (page: number, pageSize: number) => void;
  onSelect: (record: ConceptGroupRecord) => void;
  page: number;
  pageSize: number;
  selectedId: string;
  totalCount: number;
};

export function ConceptGroupGraphSidebar({
  emptyContent,
  items,
  loading,
  onPageChange,
  onSelect,
  page,
  pageSize,
  selectedId,
  totalCount,
}: ConceptGroupGraphSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className={styles.objectSidebar}>
      <div className={styles.objectSidebarHeader}>
        <strong>{t("knowledgeNetwork.conceptGroups")}</strong>
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
                  <AppstoreOutlined />
                </span>
                <span className={styles.objectButtonName}>{item.name}</span>
                <span
                  aria-label={`${item.name} ${t("knowledgeNetwork.conceptGroupGraphObjects")} ${item.objectTypesTotal}`}
                  className={styles.objectResourceCount}
                  title={`${t("knowledgeNetwork.conceptGroupGraphObjects")} ${item.objectTypesTotal}`}
                >
                  {item.objectTypesTotal}
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
            onChange={onPageChange}
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
