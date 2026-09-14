/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Descriptions, Drawer, Empty, Tag, Typography } from "antd";
import { useTranslation } from "react-i18next";

import { stringifyValue, type GNode } from "@/modules/knowledge-network/services/graph-explorer.service";

export type NodeDrawerProps = {
  node: GNode | null;
  color: string;
  onClose: () => void;
};

export function NodeDrawer({ node, color, onClose }: NodeDrawerProps) {
  const { t } = useTranslation();
  const entries = node ? Object.entries(node.props).filter(([key]) => !key.startsWith("_")) : [];
  return (
    <Drawer
      open={node !== null}
      onClose={onClose}
      width={380}
      mask={false}
      title={
        <span>
          <Tag color={color} style={{ marginRight: 8 }}>
            {node?.otName}
          </Tag>
          {node?.display}
        </span>
      }
    >
      {node ? (
        <>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            {t("knowledgeNetwork.graphExplorer.drawer.instanceId")}: <code>{node.id}</code>
          </Typography.Paragraph>
          {entries.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("knowledgeNetwork.graphExplorer.drawer.empty")} />
          ) : (
            <Descriptions
              size="small"
              column={1}
              bordered
              items={entries.map(([key, value]) => ({ key, label: key, children: <span style={{ wordBreak: "break-all" }}>{stringifyValue(value)}</span> }))}
            />
          )}
        </>
      ) : null}
    </Drawer>
  );
}
