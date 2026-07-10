/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

import { DownOutlined, RightOutlined } from "@ant-design/icons";
import { Input, Tooltip, Tree } from "antd";
import type { TreeProps } from "antd";

import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./BusinessTreePanel.module.css";

// Standard business tree template:
// - BusinessTreePanel: left tree shell with title, actions, search, empty state and footer
// - BusinessTree: standard Ant Tree wrapper with shared straight-corner enterprise styling
// Business modules should keep only node-specific hierarchy/icon/selection refinements locally.

type BusinessTreePanelProps = {
  actionsClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
  className?: string;
  collapsed?: boolean;
  collapsedIcon?: ReactNode;
  empty?: ReactNode;
  expandAriaLabel?: string;
  footer?: ReactNode;
  headerClassName?: string;
  headerActions?: ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  scrollBody?: boolean;
  title: ReactNode;
  titleClassName?: string;
  treeScrollClassName?: string;
  onExpandPanel?: () => void;
  onSearchChange?: (value: string) => void;
};

type BusinessTreeProps<T extends object = object> = TreeProps<T> & {
  className?: string;
};

export function BusinessTreePanel({
  actionsClassName,
  bodyClassName,
  children,
  className,
  collapsed = false,
  collapsedIcon,
  empty,
  expandAriaLabel = "expand",
  footer,
  headerClassName,
  headerActions,
  searchPlaceholder,
  searchValue,
  scrollBody = true,
  title,
  titleClassName,
  treeScrollClassName,
  onExpandPanel,
  onSearchChange,
}: BusinessTreePanelProps) {
  if (collapsed) {
    return (
      <aside className={[styles.panel, styles.panelCollapsed, className].filter(Boolean).join(" ")}>
        <div className={styles.collapsedHead}>
          {collapsedIcon ? <Tooltip title={title}><span className={styles.collapsedIcon}>{collapsedIcon}</span></Tooltip> : null}
          <AppButton
            aria-label={expandAriaLabel}
            className={styles.collapseBtn}
            icon={<RightOutlined />}
            onClick={onExpandPanel}
          />
        </div>
      </aside>
    );
  }

  return (
    <aside className={[styles.panel, className].filter(Boolean).join(" ")}>
      <div className={[styles.head, headerClassName].filter(Boolean).join(" ")}>
        <span className={[styles.headTitle, titleClassName].filter(Boolean).join(" ")}>{title}</span>
        {headerActions ? (
          <div className={[styles.headActions, actionsClassName].filter(Boolean).join(" ")}>{headerActions}</div>
        ) : null}
      </div>

      {typeof onSearchChange === "function" ? (
        <Input
          allowClear
          className={styles.search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          value={searchValue}
        />
      ) : null}

      <div className={[styles.body, bodyClassName].filter(Boolean).join(" ")}>
        {empty ? (
          <div className={styles.empty}>{empty}</div>
        ) : !scrollBody ? (
          children
        ) : (
          <div className={[styles.scroll, treeScrollClassName].filter(Boolean).join(" ")}>
            {children}
          </div>
        )}
      </div>

      {footer ? <div className={styles.foot}>{footer}</div> : null}
    </aside>
  );
}

export function BusinessTree<T extends object = object>({
  blockNode = true,
  className,
  switcherIcon,
  ...restProps
}: BusinessTreeProps<T>) {
  return (
    <Tree<T>
      {...restProps}
      blockNode={blockNode}
      className={[styles.tree, className].filter(Boolean).join(" ")}
      switcherIcon={switcherIcon ?? <DownOutlined className={styles.switcherIcon} />}
    />
  );
}
