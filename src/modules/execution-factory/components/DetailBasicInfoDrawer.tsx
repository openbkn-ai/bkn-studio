/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Drawer } from "antd";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { DetailMetaItem } from "@/modules/execution-factory/components/DetailMetaPanel";

type DetailBasicInfoDrawerProps = {
  items: DetailMetaItem[];
  onClose: () => void;
  open: boolean;
  title?: string;
};

const MONO_STACK =
  'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace)';

/** 值样式随 variant 变化：抽屉里用竖排列表比 bordered 表格好读。 */
function resolveValueStyle(variant?: DetailMetaItem["variant"]): CSSProperties {
  const base: CSSProperties = {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
  };

  switch (variant) {
    case "mono":
      return { ...base, fontFamily: MONO_STACK, fontSize: 13 };
    case "muted":
      return { ...base, color: "var(--color-text-secondary)" };
    case "accent":
      return { ...base, color: "var(--color-primary, inherit)" };
    case "strong":
      return { ...base, fontWeight: 600 };
    default:
      return base;
  }
}

/**
 * Unified "basic info" surface for execution-unit detail pages. Renders a
 * stacked label/value list (not a bordered table) so long ids/urls stay
 * readable inside the narrow drawer. Opened by a header button on every page.
 */
export function DetailBasicInfoDrawer({
  items,
  onClose,
  open,
  title,
}: DetailBasicInfoDrawerProps) {
  const { t } = useTranslation();

  return (
    <Drawer
      onClose={onClose}
      open={open}
      title={title ?? t("common.basicInfo")}
      width={480}
    >
      <dl style={{ margin: 0 }}>
        {items.map((item, index) => (
          <div
            key={item.key}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: index === 0 ? "0 0 12px" : "12px 0",
              borderBottom:
                index === items.length - 1
                  ? "none"
                  : "1px solid var(--color-divider)",
            }}
          >
            <dt
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--color-text-secondary)",
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </dt>
            <dd style={resolveValueStyle(item.variant)}>{item.value}</dd>
          </div>
        ))}
      </dl>
    </Drawer>
  );
}
