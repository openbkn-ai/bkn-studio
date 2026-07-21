/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/* eslint-disable react-refresh/only-export-components */

import { DownOutlined, createFromIconfontCN } from "@ant-design/icons";
import { Input, Popover } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import legacyIconList from "./resource-iconfont/dip-iconfont.json";
import "./resource-iconfont/inject-iconfont-svg";
import styles from "./ResourceIconSelect.module.css";

const { Search } = Input;

const ResourceIconFont = createFromIconfontCN();

type LegacyIconGlyph = {
  font_class: string;
  icon_id: string;
  name: string;
};

const ICON_PREFIX = legacyIconList.css_prefix_text;
const ICON_GLYPHS = legacyIconList.glyphs as LegacyIconGlyph[];

export type ResourceIconValue = string;

export const DEFAULT_RESOURCE_ICON = ICON_GLYPHS[0]
  ? `${ICON_PREFIX}${ICON_GLYPHS[0].font_class}`
  : "icon-yingyongguanli";

const COMPAT_ICON_TYPE_BY_VALUE: Record<string, string> = {
  appstore: "icon-yingyongguanli",
  database: "icon-shujuku",
  "deployment-unit": "icon-tubiaozhutu",
  hdd: "icon-fuwuqi",
  "share-alt": "icon-wangluo",
  shop: "icon-dianpu",
  team: "icon-huiyuan",
  user: "icon-user",
};

const ICON_TYPE_BY_FONT_CLASS = Object.fromEntries(
  ICON_GLYPHS.map((glyph) => [glyph.font_class, `${ICON_PREFIX}${glyph.font_class}`]),
) as Record<string, string>;

function resolveIconType(icon?: string) {
  const trimmed = icon?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (COMPAT_ICON_TYPE_BY_VALUE[trimmed]) {
    return COMPAT_ICON_TYPE_BY_VALUE[trimmed];
  }

  if (trimmed.startsWith("icon-")) {
    return trimmed;
  }

  if (ICON_TYPE_BY_FONT_CLASS[trimmed]) {
    return ICON_TYPE_BY_FONT_CLASS[trimmed];
  }

  return undefined;
}

export function renderResourceIcon(icon?: string, size = 16) {
  const type = resolveIconType(icon) ?? DEFAULT_RESOURCE_ICON;
  return <ResourceIconFont style={{ fontSize: size }} type={type} />;
}

export const RESOURCE_ICON_OPTIONS = ICON_GLYPHS.map((glyph) => ({
  label: glyph.name,
  value: `${ICON_PREFIX}${glyph.font_class}`,
}));

type ResourceIconSelectProps = {
  inModal?: boolean;
  onChange?: (value: string) => void;
  value?: string;
};

export function ResourceIconSelect({
  inModal = true,
  onChange,
  value,
}: ResourceIconSelectProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const filteredGlyphs = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return ICON_GLYPHS;
    }

    return ICON_GLYPHS.filter((glyph) =>
      glyph.name.toLowerCase().includes(normalizedKeyword),
    );
  }, [keyword]);

  const displayType = resolveIconType(value) ?? DEFAULT_RESOURCE_ICON;

  const emitIconChange = useCallback(
    (nextIcon: string) => {
      const normalized = resolveIconType(nextIcon) ?? DEFAULT_RESOURCE_ICON;
      const current = resolveIconType(value) ?? DEFAULT_RESOURCE_ICON;
      if (normalized === current) {
        return;
      }
      onChangeRef.current?.(normalized);
    },
    [value],
  );

  // Form.Item 的 onChange 引用不稳定；不要放进依赖，否则空值回填会反复触发更新环（React #185）。
  useEffect(() => {
    if (!value?.trim()) {
      if (displayType !== value) {
        onChangeRef.current?.(displayType);
      }
      return;
    }

    const resolved = resolveIconType(value);
    if (resolved && resolved !== value) {
      onChangeRef.current?.(resolved);
    }
  }, [displayType, value]);

  const getPopupContainer = useCallback(() => {
    if (inModal) {
      const modal = document.querySelector(".ant-modal-wrap");
      if (modal) {
        return modal as HTMLElement;
      }
    }

    return document.getElementById("root") ?? document.body;
  }, [inModal]);

  const popupRender = useCallback(
    () => (
      <div className={styles.panel} ref={containerRef} tabIndex={-1}>
        <Search
          allowClear
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="输入关键词筛选图标"
          style={{ marginBottom: 8 }}
          value={keyword}
        />
        <div className={styles.iconBox}>
          {filteredGlyphs.map((glyph) => {
            const iconType = `${ICON_PREFIX}${glyph.font_class}`;
            const selected = displayType === iconType;

            return (
              <button
                className={styles.iconItem}
                key={glyph.icon_id}
                onClick={() => {
                  emitIconChange(iconType);
                  setKeyword("");
                  setOpen(false);
                }}
                style={{ color: selected ? "#1677ff" : "#000" }}
                title={glyph.name}
                type="button"
              >
                <ResourceIconFont style={{ fontSize: 20 }} type={iconType} />
                <p className={styles.iconLabel}>{glyph.name}</p>
              </button>
            );
          })}
        </div>
      </div>
    ),
    [displayType, emitIconChange, filteredGlyphs, keyword],
  );

  return (
    <Popover
      content={open ? popupRender() : null}
      destroyOnHidden
      getPopupContainer={getPopupContainer}
      onOpenChange={setOpen}
      open={open}
      trigger="click"
    >
      <button className={styles.trigger} type="button">
        <span className={styles.prefixIcon}>
          <ResourceIconFont style={{ fontSize: 16 }} type={displayType} />
        </span>
        <DownOutlined className={styles.triggerIcon} />
      </button>
    </Popover>
  );
}
