/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/* eslint-disable react-refresh/only-export-components */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Checkbox, Popover } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./DetailTableColumnSettingsButton.module.css";

export type DetailTableColumnDefinition = {
  key: string;
  labelKey: string;
  required?: boolean;
};

export type ColumnVisibilityPayload = Record<string, boolean>;

type SavedColumnConfig = {
  order: string[];
  visibility: ColumnVisibilityPayload;
};

type DetailTableColumnSettingsButtonProps = {
  columnOrder: string[];
  columns: DetailTableColumnDefinition[];
  onChange: (columnOrder: string[], visibility: ColumnVisibilityPayload) => void;
  storageScope: string;
  value: ColumnVisibilityPayload;
  visibleColumnKeys?: string[];
};

const STORAGE_PREFIX = "bkn-detail-table-columns:";

function isColumnVisibilityPayload(value: unknown): value is ColumnVisibilityPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "boolean")
  );
}

function isSavedColumnConfig(value: unknown): value is SavedColumnConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray((value as Partial<SavedColumnConfig>).order) &&
    (value as Partial<SavedColumnConfig>).order?.every((item) => typeof item === "string") ===
      true &&
    isColumnVisibilityPayload((value as Partial<SavedColumnConfig>).visibility)
  );
}

export function readDetailTableColumnConfig(scope: string): SavedColumnConfig | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${scope}`);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isSavedColumnConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDetailTableColumnConfig(scope: string, config: SavedColumnConfig) {
  localStorage.setItem(`${STORAGE_PREFIX}${scope}`, JSON.stringify(config));
}

export function getDisplayedColumns(
  columnOrder: string[],
  visibility: ColumnVisibilityPayload,
) {
  return columnOrder.filter((key) => visibility[key] !== false);
}

function mergeColumnOrder(order: string[], columns: DetailTableColumnDefinition[]) {
  const validKeys = new Set(columns.map((column) => column.key));
  const next = order.filter((key) => validKeys.has(key));
  for (const column of columns) {
    if (!next.includes(column.key)) {
      next.push(column.key);
    }
  }
  return next;
}

function isColumnVisible(key: string, visibility: ColumnVisibilityPayload) {
  return visibility[key] !== false;
}

export function DetailTableColumnSettingsButton({
  columnOrder,
  columns,
  onChange,
  storageScope,
  value,
}: DetailTableColumnSettingsButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>(columnOrder);
  const [draftVisibility, setDraftVisibility] = useState<ColumnVisibilityPayload>(value);

  const columnMap = useMemo(
    () => new Map(columns.map((column) => [column.key, column])),
    [columns],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftOrder(mergeColumnOrder(columnOrder, columns));
    setDraftVisibility(value);
  }, [columnOrder, columns, open, value]);

  const moveRow = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= draftOrder.length) {
      return;
    }
    const next = [...draftOrder];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    setDraftOrder(next);
  };

  const toggleVisibility = (key: string, checked: boolean) => {
    setDraftVisibility((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  const apply = () => {
    const order = getDisplayedColumns(
      mergeColumnOrder(draftOrder, columns),
      draftVisibility,
    );
    const visibility = Object.fromEntries(
      columns.map((column) => [column.key, isColumnVisible(column.key, draftVisibility)]),
    );

    writeDetailTableColumnConfig(storageScope, { order, visibility });
    onChange(order, visibility);
    setOpen(false);
  };

  const reset = () => {
    const defaultOrder = columns.map((column) => column.key);
    const visibility = Object.fromEntries(
      columns.map((column) => [column.key, true]),
    ) as ColumnVisibilityPayload;
    setDraftOrder(defaultOrder);
    setDraftVisibility(visibility);
  };

  const content = (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>{t("knowledgeNetwork.columnSettings")}</div>
      <ul className={styles.list}>
        {draftOrder.map((key, index) => {
          const column = columnMap.get(key);
          if (!column) {
            return null;
          }
          const checked = isColumnVisible(key, draftVisibility);
          return (
            <li className={styles.row} key={key}>
              <Checkbox
                checked={checked}
                disabled={column.required}
                onChange={(event) => toggleVisibility(key, event.target.checked)}
              />
              <span className={styles.rowLabel}>{t(column.labelKey)}</span>
              <span className={styles.rowActions}>
                <AppButton
                  aria-label={t("knowledgeNetwork.columnSettingsMoveUp")}
                  disabled={index === 0}
                  icon={<ArrowUpOutlined />}
                  onClick={() => moveRow(index, -1)}
                  size="small"
                  type="text"
                />
                <AppButton
                  aria-label={t("knowledgeNetwork.columnSettingsMoveDown")}
                  disabled={index === draftOrder.length - 1}
                  icon={<ArrowDownOutlined />}
                  onClick={() => moveRow(index, 1)}
                  size="small"
                  type="text"
                />
              </span>
            </li>
          );
        })}
      </ul>
      <div className={styles.footer}>
        <AppButton onClick={reset} size="small">
          {t("common.reset")}
        </AppButton>
        <AppButton onClick={apply} size="small" type="primary">
          {t("common.confirm")}
        </AppButton>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      onOpenChange={setOpen}
      open={open}
      placement="bottomRight"
      trigger="click"
    >
      <AppButton icon={<SettingOutlined />}>{t("knowledgeNetwork.columnSettings")}</AppButton>
    </Popover>
  );
}
