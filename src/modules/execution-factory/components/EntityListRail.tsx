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
 * 卡片右下角的小标签。抽成组件而不是导出类名，是为了让两个列表的出入参标签
 * 长得一模一样——各自在自己的 css module 里画一份时，两边的字号和底色会漂。
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
  /** 名字右侧的定宽徽标：HTTP 动词 / 函数语言。 */
  badge?: ReactNode;
  id: string;
  /** 停用态：名字压暗，不打开也看得出来。 */
  muted?: boolean;
  name: ReactNode;
  /** 不传就不画开关那一行（只读场景）。 */
  status?: {
    checked: boolean;
    disabled?: boolean;
    /** 开关右侧文案，不进权限门禁——只读用户也要看得到状态。 */
    label: ReactNode;
    /** 不传表示只展示状态、不给切换入口。 */
    onChange?: () => void;
  };
  /** 第二行右侧的小标签：in / out 计数、未保存等。 */
  tags?: ReactNode;
};

type EntityListRailProps = {
  activeId?: string | null;
  emptyText?: ReactNode;
  /** 固定底栏，不跟着列表滚（函数工作台的「新建函数」）。 */
  footer?: ReactNode;
  icon?: ReactNode;
  items: EntityListRailItem[];
  onSelect: (id: string) => void;
  onToggleSelect?: (id: string, checked: boolean) => void;
  search?: {
    onChange: (value: string) => void;
    placeholder?: string;
    value: string;
  };
  selectable?: boolean;
  selectedIds?: string[];
  /** 传了就把状态开关裹进权限门禁；状态文案不裹。 */
  statusPermission?: string;
  /** 已含计数的完整标题。 */
  title: ReactNode;
};

/**
 * 左侧实体列表栏。工具箱的 HTTP 工具列表和函数工作台的函数列表共用一套卡片，
 * 两边各画一份时同一个列表会长出两种样式（边框、行数、操作位都不一样）。
 *
 * 组件只管「列表」：标题、搜索、卡片、固定底栏。批量操作条不在这里——两个页面
 * 都把它放在列表区上方的全宽处，窄侧栏放不下会换行。
 */
export function EntityListRail({
  activeId,
  emptyText,
  footer,
  icon,
  items,
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
      onSelect(id);
    }
  };

  return (
    <div className={styles.rail}>
      <div className={styles.head}>
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

      <div className={styles.list} role="listbox">
        {items.length === 0 && emptyText ? (
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
              onClick={() => onSelect(item.id)}
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
