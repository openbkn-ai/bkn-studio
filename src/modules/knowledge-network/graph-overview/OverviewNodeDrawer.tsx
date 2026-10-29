/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Tag, Tooltip, Typography } from "antd";
import { useTranslation } from "react-i18next";

import { stringifyValue } from "@/modules/knowledge-network/lib/instance-label";

import styles from "./GraphOverviewPage.module.css";
import type { OverviewInstance, PropertyMeta } from "./overview.service";

/**
 * The stored properties to list, in the order the object type defines them. The backend returns
 * an instance's properties in no fixed order, so listing them as they come shuffles the rows from
 * one instance to the next. Properties the type does not define follow, by name.
 */
function drawerEntries(
  props: Record<string, unknown>,
  properties: readonly PropertyMeta[] = [],
): [string, unknown][] {
  const rank = new Map(properties.map((property, index) => [property.name, index]));
  return Object.entries(props)
    .filter(([key]) => !key.startsWith("_"))
    .sort(([a], [b]) => {
      const ra = rank.get(a) ?? Number.POSITIVE_INFINITY;
      const rb = rank.get(b) ?? Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      return a < b ? -1 : a > b ? 1 : 0;
    });
}

/** The selected instance in full: its type, name, id and stored properties. */
export function OverviewNodeDrawer({
  node,
  color,
  properties,
  onClose,
}: {
  node: OverviewInstance;
  color: string;
  /** The object type's properties, for their display names and order. */
  properties: readonly PropertyMeta[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const displayNames = new Map(
    properties.map((property) => [property.name, property.displayName ?? ""]),
  );
  const entries = drawerEntries(node.props, properties);
  const closeLabel = t("knowledgeNetwork.graphOverview.drawer.close");

  return (
    <aside
      aria-label={t("knowledgeNetwork.graphOverview.drawer.title")}
      className={styles.drawer}
      data-testid="graph-overview-drawer"
    >
      <div className={styles.drawerHeader}>
        <div className={styles.drawerTitle}>
          <Tag color={color}>{node.otName}</Tag>
          <span>{node.display}</span>
        </div>
        <Tooltip title={closeLabel}>
          <Button
            aria-label={closeLabel}
            icon={<CloseOutlined />}
            onClick={onClose}
            size="small"
            type="text"
          />
        </Tooltip>
      </div>
      <div className={styles.drawerBody}>
        <Typography.Paragraph style={{ fontSize: 12 }} type="secondary">
          {t("knowledgeNetwork.graphOverview.drawer.instanceId")}: <code>{node.id}</code>
        </Typography.Paragraph>
        {entries.length === 0 ? (
          <Empty
            description={t("knowledgeNetwork.graphOverview.drawer.empty")}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Descriptions
            bordered
            column={1}
            items={entries.map(([key, value]) => ({
              key,
              // The display name reads better; the id stays as the row's tooltip.
              label: <span title={key}>{displayNames.get(key) || key}</span>,
              children: <span style={{ wordBreak: "break-all" }}>{stringifyValue(value)}</span>,
            }))}
            size="small"
          />
        )}
      </div>
    </aside>
  );
}
