/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Input, Space } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import styles from "./WorkspaceResourceToolbar.module.css";

type WorkspaceResourceToolbarProps = {
  actions: ReactNode;
  hint?: string;
  keyword?: string;
  onKeywordChange?: (value: string) => void;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  searchPlaceholder?: string;
};

export function WorkspaceResourceToolbar({
  actions,
  hint,
  keyword,
  onKeywordChange,
  onRefresh,
  refreshDisabled,
  searchPlaceholder,
}: WorkspaceResourceToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <Space wrap>{actions}</Space>
      </div>
      <div className={styles.toolbarRight}>
        {onKeywordChange ? (
          <Input
            allowClear
            className={styles.searchInput}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder={searchPlaceholder ?? t("knowledgeNetwork.searchPlaceholder")}
            suffix={<SearchOutlined />}
            value={keyword}
          />
        ) : null}
        {onRefresh ? (
          <button
            className={styles.iconButton}
            disabled={refreshDisabled}
            onClick={onRefresh}
            type="button"
          >
            <ReloadOutlined />
          </button>
        ) : null}
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </div>
    </div>
  );
}
