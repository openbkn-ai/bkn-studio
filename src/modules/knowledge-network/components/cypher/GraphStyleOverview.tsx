/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { BgColorsOutlined } from "@ant-design/icons";
import { Popover, Radio, Select } from "antd";
import { useTranslation } from "react-i18next";

import { EDGE_COLOR, typeColors } from "@/modules/knowledge-network/cypher/graph-option";
import { useGraphStyle } from "@/modules/knowledge-network/cypher/graph-style-context";
import {
  STYLE_COLORS,
  setEdgeStyle,
  setNodeStyle,
  type NodeSize,
} from "@/modules/knowledge-network/cypher/graph-style";
import type { CypherGraph } from "@/modules/knowledge-network/cypher/graph-values";

import styles from "./CypherQueryScene.module.css";

function Swatches({ value, onChange }: { value?: string; onChange: (color?: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.swatches}>
      {STYLE_COLORS.map((color) => (
        <button
          aria-label={color}
          className={color === value ? `${styles.swatch} ${styles.swatchActive}` : styles.swatch}
          key={color}
          onClick={() => onChange(color)}
          style={{ background: color }}
          type="button"
        />
      ))}
      <button className={styles.swatchReset} onClick={() => onChange(undefined)} type="button">
        {t("knowledgeNetwork.cypherQuery.style.default")}
      </button>
    </div>
  );
}

/**
 * The graph's overview: how many nodes of each object type and how many edges of each
 * relationship, each row opening its style (color, size, caption), like Neo4j Browser's legend.
 */
export function GraphStyleOverview({ graph }: { graph: CypherGraph }) {
  const { t } = useTranslation();
  const { style, setStyle, properties } = useGraphStyle();
  const colors = typeColors(graph, style);

  const nodeTypes = new Map<
    string,
    { name: string; count: number; keys: string[]; computed: Set<string> }
  >();
  for (const node of graph.nodes) {
    const entry = nodeTypes.get(node.objectTypeId) ?? {
      name: node.objectTypeName,
      count: 0,
      keys: Object.keys(node.key),
      computed: new Set<string>(),
    };
    entry.count += 1;
    for (const name of Object.keys(node.computed ?? {})) entry.computed.add(name);
    nodeTypes.set(node.objectTypeId, entry);
  }
  const edgeTypes = new Map<string, number>();
  for (const edge of graph.edges) edgeTypes.set(edge.name, (edgeTypes.get(edge.name) ?? 0) + 1);

  return (
    <div className={styles.inspector}>
      <div className={styles.inspectorTitle}>
        {t("knowledgeNetwork.cypherQuery.graph.overview")}
      </div>
      {nodeTypes.size > 0 ? (
        <div className={styles.cellDetailTitle}>
          {t("knowledgeNetwork.cypherQuery.graph.nodeTypes")}
        </div>
      ) : null}
      {[...nodeTypes].map(([otId, entry]) => {
        const current = style.nodes[otId] ?? {};
        const captionOptions = [
          ...entry.keys.map((name) => ({ value: name, label: name })),
          ...[...entry.computed]
            .filter((name) => !entry.keys.includes(name))
            .map((name) => ({
              value: name,
              label: `${name} · ${t("knowledgeNetwork.cypherQuery.graph.computed")}`,
            })),
          ...(properties[otId] ?? [])
            .filter((property) => !entry.keys.includes(property.name))
            .map((property) => ({
              value: property.name,
              label: property.displayName
                ? `${property.name} · ${property.displayName}`
                : property.name,
            })),
        ];
        const editor = (
          <div className={styles.settings}>
            <div className={styles.settingItem}>
              <div className={styles.settingLabel}>
                {t("knowledgeNetwork.cypherQuery.style.color")}
              </div>
              <Swatches
                onChange={(color) => setStyle((value) => setNodeStyle(value, otId, { color }))}
                value={current.color}
              />
            </div>
            <div className={styles.settingItem}>
              <div className={styles.settingLabel}>
                {t("knowledgeNetwork.cypherQuery.style.size")}
              </div>
              <Radio.Group
                buttonStyle="solid"
                onChange={(event) =>
                  setStyle((value) =>
                    setNodeStyle(value, otId, { size: event.target.value as NodeSize }),
                  )
                }
                optionType="button"
                options={[
                  { value: "s", label: t("knowledgeNetwork.cypherQuery.style.small") },
                  { value: "m", label: t("knowledgeNetwork.cypherQuery.style.medium") },
                  { value: "l", label: t("knowledgeNetwork.cypherQuery.style.large") },
                ]}
                size="small"
                value={current.size ?? "m"}
              />
            </div>
            <div className={styles.settingItem}>
              <div className={styles.settingLabel}>
                {t("knowledgeNetwork.cypherQuery.style.caption")}
              </div>
              <Select
                allowClear
                classNames={{ popup: { root: styles.settingsPopup } }}
                onChange={(caption?: string) =>
                  setStyle((value) => setNodeStyle(value, otId, { caption }))
                }
                options={captionOptions}
                placeholder={t("knowledgeNetwork.cypherQuery.style.captionDefault")}
                showSearch
                size="small"
                style={{ width: "100%" }}
                value={current.caption}
              />
              <div className={styles.settingHint}>
                {t("knowledgeNetwork.cypherQuery.style.captionHint")}
              </div>
            </div>
          </div>
        );
        return (
          <Popover content={editor} key={otId} placement="left" trigger="click">
            <button
              className={styles.overviewRow}
              data-testid={`cypher-style-node-${otId}`}
              type="button"
            >
              <span className={styles.overviewName}>
                <span className={styles.overviewDot} style={{ background: colors.get(otId) }} />
                {entry.name}
                <BgColorsOutlined className={styles.overviewEdit} />
              </span>
              <span>{entry.count}</span>
            </button>
          </Popover>
        );
      })}
      {edgeTypes.size > 0 ? (
        <div className={styles.cellDetailTitle}>
          {t("knowledgeNetwork.cypherQuery.graph.edgeTypes")}
        </div>
      ) : null}
      {[...edgeTypes].map(([name, count]) => (
        <Popover
          content={
            <div className={styles.settings}>
              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  {t("knowledgeNetwork.cypherQuery.style.color")}
                </div>
                <Swatches
                  onChange={(color) => setStyle((value) => setEdgeStyle(value, name, color))}
                  value={style.edges[name]?.color}
                />
              </div>
            </div>
          }
          key={name}
          placement="left"
          trigger="click"
        >
          <button
            className={styles.overviewRow}
            data-testid={`cypher-style-edge-${name}`}
            type="button"
          >
            <span className={styles.overviewName}>
              <span
                className={styles.overviewLine}
                style={{ background: style.edges[name]?.color ?? EDGE_COLOR }}
              />
              {name}
              <BgColorsOutlined className={styles.overviewEdit} />
            </span>
            <span>{count}</span>
          </button>
        </Popover>
      ))}
      <div className={styles.muted}>{t("knowledgeNetwork.cypherQuery.graph.inspectorEmpty")}</div>
    </div>
  );
}
