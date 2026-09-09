/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ClearOutlined, CompressOutlined, DeleteOutlined, NodeIndexOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Divider, Popconfirm, Select, Space, Tag, Tooltip, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { GNode } from "@/modules/knowledge-network/services/graph-explorer.service";
import { LAYOUTS, SHAPES, type ExplorerLayout, type ExplorerShape } from "@/modules/knowledge-network/utils/graph-explorer-cache";

import styles from "./ExplorerToolbar.module.css";

export type ExplorerToolbarProps = {
  layout: ExplorerLayout;
  shape: ExplorerShape;
  nodeCount: number;
  edgeCount: number;
  /** Object types present on the canvas, for the label property picker. */
  canvasObjectTypes: { id: string; name: string }[];
  /** Object type id -> candidate label properties (object type definition first, canvas data as fallback). */
  propertyNamesByOt: Record<string, string[]>;
  labelByOt: Record<string, string>;
  pathStart: GNode | null;
  pathEnd: GNode | null;
  pathActive: boolean;
  busy: boolean;
  disabled: boolean;
  onLayoutChange: (layout: ExplorerLayout) => void;
  onShapeChange: (shape: ExplorerShape) => void;
  onLabelChange: (otId: string, property: string | null) => void;
  onRelayout: () => void;
  onFitView: () => void;
  onFindPath: () => void;
  onClearPath: () => void;
  onClearPathStart: () => void;
  onClearPathEnd: () => void;
  onClear: () => void;
  onClearCache: () => void;
};

export function ExplorerToolbar(props: ExplorerToolbarProps) {
  const { t } = useTranslation();
  const {
    layout,
    shape,
    nodeCount,
    edgeCount,
    canvasObjectTypes,
    propertyNamesByOt,
    labelByOt,
    pathStart,
    pathEnd,
    pathActive,
    busy,
    disabled,
    onLayoutChange,
    onShapeChange,
    onLabelChange,
    onRelayout,
    onFitView,
    onFindPath,
    onClearPath,
    onClearPathStart,
    onClearPathEnd,
    onClear,
    onClearCache,
  } = props;

  return (
    <div className={styles.toolbar}>
      <Space size={8} wrap className={styles.group}>
        <span className={styles.label}>{t("knowledgeNetwork.graphExplorer.toolbar.layout")}</span>
        <Select
          size="small"
          className={styles.select}
          data-testid="graph-explorer-layout"
          value={layout}
          options={LAYOUTS.map((item) => ({ value: item, label: t(`knowledgeNetwork.graphExplorer.layouts.${item}`) }))}
          onChange={onLayoutChange}
        />
        <Tooltip title={t("knowledgeNetwork.graphExplorer.toolbar.relayout")}>
          <Button size="small" data-testid="graph-explorer-relayout" icon={<ReloadOutlined />} disabled={nodeCount === 0 || busy} onClick={onRelayout} />
        </Tooltip>
        <span className={styles.label}>{t("knowledgeNetwork.graphExplorer.toolbar.shape")}</span>
        <Select
          size="small"
          className={styles.select}
          data-testid="graph-explorer-shape"
          value={shape}
          options={SHAPES.map((item) => ({ value: item, label: t(`knowledgeNetwork.graphExplorer.shapes.${item}`) }))}
          onChange={onShapeChange}
        />
        <span className={styles.label}>{t("knowledgeNetwork.graphExplorer.toolbar.label")}</span>
        <LabelPicker canvasObjectTypes={canvasObjectTypes} propertyNamesByOt={propertyNamesByOt} labelByOt={labelByOt} onLabelChange={onLabelChange} />
      </Space>
      <Divider type="vertical" className={styles.divider} />
      <Space size={6} className={styles.group}>
        <Tag
          color="green"
          className={styles.pathTag}
          closable={pathStart !== null}
          onClose={(event) => {
            event.preventDefault();
            onClearPathStart();
          }}
        >
          {t("knowledgeNetwork.graphExplorer.toolbar.pathStart")}: {pathStart?.display ?? t("knowledgeNetwork.graphExplorer.toolbar.unset")}
        </Tag>
        <Tag
          color="red"
          className={styles.pathTag}
          closable={pathEnd !== null}
          onClose={(event) => {
            event.preventDefault();
            onClearPathEnd();
          }}
        >
          {t("knowledgeNetwork.graphExplorer.toolbar.pathEnd")}: {pathEnd?.display ?? t("knowledgeNetwork.graphExplorer.toolbar.unset")}
        </Tag>
        <Button
          size="small"
          type="primary"
          data-testid="graph-explorer-find-path"
          icon={<NodeIndexOutlined />}
          disabled={disabled || busy || !pathStart || !pathEnd}
          onClick={onFindPath}
        >
          {t("knowledgeNetwork.graphExplorer.toolbar.findPath")}
        </Button>
        {pathActive || pathStart || pathEnd ? (
          <Button size="small" data-testid="graph-explorer-clear-path" onClick={onClearPath}>
            {t("knowledgeNetwork.graphExplorer.toolbar.clearPath")}
          </Button>
        ) : null}
      </Space>
      <div className={styles.spacer} />
      <Space size={6} className={styles.group}>
        <Typography.Text type="secondary" className={styles.stats} data-testid="graph-explorer-stats">
          {t("knowledgeNetwork.graphExplorer.toolbar.stats", { nodes: nodeCount, edges: edgeCount })}
        </Typography.Text>
        <Tooltip title={t("knowledgeNetwork.graphExplorer.toolbar.fit")}>
          <Button size="small" icon={<CompressOutlined />} disabled={nodeCount === 0} onClick={onFitView} />
        </Tooltip>
        <Popconfirm title={t("knowledgeNetwork.graphExplorer.toolbar.clear")} onConfirm={onClear} disabled={nodeCount === 0}>
          <Button size="small" icon={<ClearOutlined />} disabled={nodeCount === 0}>
            {t("knowledgeNetwork.graphExplorer.toolbar.clear")}
          </Button>
        </Popconfirm>
        <Popconfirm title={t("knowledgeNetwork.graphExplorer.toolbar.clearCache")} onConfirm={onClearCache}>
          <Button size="small" icon={<DeleteOutlined />}>
            {t("knowledgeNetwork.graphExplorer.toolbar.clearCache")}
          </Button>
        </Popconfirm>
      </Space>
    </div>
  );
}

type LabelPickerProps = Pick<ExplorerToolbarProps, "canvasObjectTypes" | "propertyNamesByOt" | "labelByOt" | "onLabelChange">;

/** Two cascaded selects: object type, then the property to show as its label. */
function LabelPicker(props: LabelPickerProps) {
  const { t } = useTranslation();
  // Remount when the set of object types changes so the picker never points at a type that left the canvas.
  return (
    <LabelPickerInner
      key={props.canvasObjectTypes.map((item) => item.id).join("|")}
      {...props}
      defaultLabel={t("knowledgeNetwork.graphExplorer.toolbar.labelDefault")}
    />
  );
}

function LabelPickerInner({ canvasObjectTypes, propertyNamesByOt, labelByOt, onLabelChange, defaultLabel }: LabelPickerProps & { defaultLabel: string }) {
  const [otId, setOtId] = useState<string | undefined>(canvasObjectTypes[0]?.id);
  const names = otId ? propertyNamesByOt[otId] ?? [] : [];
  return (
    <>
      <Select
        size="small"
        className={styles.select}
        value={otId}
        disabled={canvasObjectTypes.length === 0}
        options={canvasObjectTypes.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(value: string) => setOtId(value)}
      />
      <Select
        size="small"
        className={styles.selectWide}
        allowClear
        showSearch
        disabled={!otId}
        value={otId ? labelByOt[otId] : undefined}
        placeholder={defaultLabel}
        options={names.filter((name) => !name.startsWith("_")).map((name) => ({ value: name, label: name }))}
        onChange={(value: string | undefined) => {
          if (otId) onLabelChange(otId, value ?? null);
        }}
      />
    </>
  );
}
