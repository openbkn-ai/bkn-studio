/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { SearchOutlined } from "@ant-design/icons";
import { Checkbox, Input, Switch } from "antd";
import type { KeyboardEvent, ReactNode } from "react";

import { PermissionGate } from "@/framework/permission/PermissionGate";

import styles from "./EntityListRail.module.css";

/**
 * Small tags at the lower right of cards. This is a component rather than an exported class so
 * input/output tags look identical in both lists; separate CSS-module implementations would drift in type size and fill.
 */
export function EntityListTag({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "warning";
}) {
  return (
    <span className={variant === "warning" ? `${styles.tag} ${styles.tagWarning}` : styles.tag}>
      {children}
    </span>
  );
}

export type EntityListRailItem = {
  /** Fixed-width badge to the right of the name: HTTP method or function language. */
  badge?: ReactNode;
  id: string;
  /** Disabled state dims the name so it is visible without opening the item. */
  muted?: boolean;
  name: ReactNode;
  /** Omit to hide the switch row in read-only views. */
  status?: {
    checked: boolean;
    disabled?: boolean;
    /** Label to the right of the switch; do not gate it because read-only users must see status. */
    label: ReactNode;
    /** Omit to display status without a toggle entry point. */
    onChange?: () => void;
  };
  /** Small tags on the right of the second row, such as input/output counts and unsaved state. */
  tags?: ReactNode;
};

type EntityListRailProps = {
  activeId?: string | null;
  /**
   * Custom list-area content for cases that cannot use flat cards, such as a hierarchical skill
   * file tree. When supplied, it replaces items while title, search, and footer remain shared.
   */
  children?: ReactNode;
  emptyText?: ReactNode;
  /** Fixed footer that does not scroll with the list, such as function workbench's Create Function. */
  footer?: ReactNode;
  /** inline places title and filter on one row when the right header has one row too, aligning their header dividers. */
  headLayout?: "inline" | "stacked";
  icon?: ReactNode;
  items?: EntityListRailItem[];
  onSelect?: (id: string) => void;
  onToggleSelect?: (id: string, checked: boolean) => void;
  search?: {
    onChange: (value: string) => void;
    placeholder?: string;
    value: string;
  };
  selectable?: boolean;
  selectedIds?: string[];
  /** When provided, wraps the status switch in a permission guard; the status label remains visible. */
  statusPermission?: string;
  /** Complete title including its count. */
  title: ReactNode;
};

/**
 * Left entity-list rail. HTTP-tool lists in toolboxes and function lists in the workbench share
 * one card design; separate implementations would give the same list different borders, row counts, and action placement.
 *
 * The component owns only the list: title, search, cards, and fixed footer. Bulk-action bars live
 * above the full-width list area in both pages because narrow rails would wrap them.
 */
export function EntityListRail({
  activeId,
  children,
  emptyText,
  footer,
  headLayout = "stacked",
  icon,
  items = [],
  onSelect,
  onToggleSelect,
  search,
  selectable = false,
  selectedIds = [],
  statusPermission,
  title,
}: EntityListRailProps) {
  const showCheckbox = selectable && Boolean(onToggleSelect);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(id);
    }
  };

  return (
    <div className={styles.rail}>
      <div
        className={
          headLayout === "inline" ? `${styles.head} ${styles.headInline}` : styles.head
        }
      >
        <div className={styles.title}>
          {icon}
          <span>{title}</span>
        </div>
        {search ? (
          <Input
            allowClear
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            prefix={<SearchOutlined />}
            value={search.value}
          />
        ) : null}
      </div>

      <div className={styles.list} role={children ? undefined : "listbox"}>
        {children}
        {!children && items.length === 0 && emptyText ? (
          <div className={styles.empty}>{emptyText}</div>
        ) : null}
        {items.map((item, index) => {
          const active = item.id === activeId;
          const statusSwitch = item.status?.onChange ? (
            <Switch
              checked={item.status.checked}
              disabled={item.status.disabled}
              onChange={item.status.onChange}
              onClick={(_, event) => event.stopPropagation()}
              size="small"
            />
          ) : null;

          return (
            <div
              aria-selected={active}
              className={`${styles.item} ${active ? styles.itemActive : ""} ${
                item.muted ? styles.itemMuted : ""
              }`}
              key={item.id}
              onClick={() => onSelect?.(item.id)}
              onKeyDown={(event) => handleKeyDown(event, item.id)}
              role="option"
              tabIndex={0}
            >
              <div className={styles.itemTop}>
                {showCheckbox ? (
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) => onToggleSelect?.(item.id, event.target.checked)}
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : null}
                <span className={styles.index}>{index + 1}</span>
                <span className={styles.name}>{item.name}</span>
                {item.badge}
              </div>
              {item.status || item.tags ? (
                <div className={styles.itemFooter}>
                  {item.status ? (
                    <span className={styles.status}>
                      {statusSwitch && statusPermission ? (
                        <PermissionGate permissions={statusPermission}>
                          {statusSwitch}
                        </PermissionGate>
                      ) : (
                        statusSwitch
                      )}
                      {item.status.label}
                    </span>
                  ) : null}
                  {item.tags ? <span className={styles.tags}>{item.tags}</span> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}
