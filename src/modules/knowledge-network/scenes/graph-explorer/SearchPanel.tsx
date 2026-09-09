/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Empty, Input, Select, Spin, Tabs, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GNode, KnCondition, ObjectTypeMeta } from "@/modules/knowledge-network/services/graph-explorer.service";

import { OPERATORS_BY_KIND, buildCondition, propertyKind, type ConditionRow } from "./condition-builder";
import styles from "./SearchPanel.module.css";

export type SearchPanelProps = {
  objectTypes: { id: string; name: string }[];
  metaByOt: Record<string, ObjectTypeMeta>;
  /** Loads and caches the object type definition; resolves null when it cannot be loaded. */
  ensureMeta: (otId: string) => Promise<ObjectTypeMeta | null>;
  onSearch: (query: string) => Promise<GNode[]>;
  onQuery: (otId: string, condition: KnCondition | null) => Promise<GNode[]>;
  onAdd: (nodes: GNode[]) => void;
  canvasIds: ReadonlySet<string>;
  disabled: boolean;
  colorOf: (otId: string) => string;
};

/** Lets the user type either the display name or the id into a searchable select. */
function matchIdOrLabel(input: string, option?: { value?: string | number; label?: unknown }): boolean {
  const needle = input.trim().toLowerCase();
  if (!needle) return true;
  const value = String(option?.value ?? "").toLowerCase();
  const label = typeof option?.label === "string" ? option.label.toLowerCase() : "";
  return value.includes(needle) || label.includes(needle);
}

type ResultListProps = {
  nodes: GNode[];
  canvasIds: ReadonlySet<string>;
  onAdd: (nodes: GNode[]) => void;
  colorOf: (otId: string) => string;
  emptyText: string;
  searched: boolean;
};

function ResultList({ nodes, canvasIds, onAdd, colorOf, emptyText, searched }: ResultListProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectable = nodes.filter((node) => !canvasIds.has(node.id));
  const selectedVisible = selectable.filter((node) => selected.has(node.id));

  if (nodes.length === 0) {
    return searched ? <Empty className={styles.empty} image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} /> : null;
  }

  return (
    <div className={styles.results}>
      <div className={styles.resultsHeader}>
        <Typography.Text type="secondary">{t("knowledgeNetwork.graphExplorer.search.resultCount", { count: nodes.length })}</Typography.Text>
        <Button
          size="small"
          type="primary"
          disabled={selectedVisible.length === 0}
          onClick={() => {
            onAdd(selectedVisible);
            setSelected(new Set());
          }}
        >
          {t("knowledgeNetwork.graphExplorer.addSelected", { count: selectedVisible.length })}
        </Button>
      </div>
      <ul className={styles.resultList}>
        {nodes.map((node) => {
          const onCanvas = canvasIds.has(node.id);
          return (
            <li key={node.id} className={styles.resultItem} data-testid="graph-explorer-result">
              <Checkbox
                disabled={onCanvas}
                checked={selected.has(node.id)}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(node.id);
                  else next.delete(node.id);
                  setSelected(next);
                }}
              />
              <span className={styles.resultDot} style={{ background: colorOf(node.otId) }} />
              <div className={styles.resultBody}>
                <div className={styles.resultTitle} title={node.display}>
                  {node.display}
                </div>
                <div className={styles.resultMeta}>{node.otName}</div>
              </div>
              {onCanvas ? (
                <Tag className={styles.resultTag} data-testid="graph-explorer-on-canvas">
                  {t("knowledgeNetwork.graphExplorer.onCanvas")}
                </Tag>
              ) : (
                <Button size="small" data-testid="graph-explorer-add" onClick={() => onAdd([node])}>
                  {t("knowledgeNetwork.graphExplorer.addToCanvas")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SearchPanel({ objectTypes, metaByOt, ensureMeta, onSearch, onQuery, onAdd, canvasIds, disabled, colorOf }: SearchPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"semantic" | "condition">("semantic");

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GNode[]>([]);
  const [searched, setSearched] = useState(false);

  const [otId, setOtId] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<ConditionRow[]>([{ field: "", operator: "==", value: "" }]);
  const [querying, setQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryResults, setQueryResults] = useState<GNode[]>([]);
  const [queried, setQueried] = useState(false);

  const meta = otId ? metaByOt[otId] : undefined;
  const properties = useMemo(() => meta?.properties ?? [], [meta]);

  const runSearch = async () => {
    const text = query.trim();
    if (!text || disabled) return;
    setSearching(true);
    setSearchError(null);
    try {
      setSearchResults(await onSearch(text));
      setSearched(true);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : String(error));
    } finally {
      setSearching(false);
    }
  };

  const runQuery = async () => {
    if (!otId || disabled) return;
    setQuerying(true);
    setQueryError(null);
    try {
      const loaded = metaByOt[otId] ?? (await ensureMeta(otId));
      setQueryResults(await onQuery(otId, buildCondition(rows, loaded?.properties ?? [])));
      setQueried(true);
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : String(error));
    } finally {
      setQuerying(false);
    }
  };

  const updateRow = (index: number, patch: Partial<ConditionRow>) => {
    setRows((previous) => previous.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  };

  const semanticPane = (
    <div className={styles.pane}>
      <Input.Search
        data-testid="graph-explorer-search-input"
        value={query}
        disabled={disabled}
        loading={searching}
        enterButton={t("knowledgeNetwork.graphExplorer.search.button")}
        placeholder={t("knowledgeNetwork.graphExplorer.search.placeholder")}
        onChange={(event) => setQuery(event.target.value)}
        onSearch={() => void runSearch()}
      />
      {searchError ? <Alert className={styles.alert} type="error" showIcon message={searchError} /> : null}
      <Spin spinning={searching}>
        <ResultList
          nodes={searchResults}
          canvasIds={canvasIds}
          onAdd={onAdd}
          colorOf={colorOf}
          emptyText={t("knowledgeNetwork.graphExplorer.search.empty")}
          searched={searched}
        />
      </Spin>
    </div>
  );

  const conditionPane = (
    <div className={styles.pane}>
      <Select
        className={styles.fullWidth}
        data-testid="graph-explorer-ot-select"
        showSearch
        filterOption={matchIdOrLabel}
        disabled={disabled}
        value={otId}
        placeholder={t("knowledgeNetwork.graphExplorer.condition.objectTypePlaceholder")}
        options={objectTypes.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(value: string) => {
          setOtId(value);
          setRows([{ field: "", operator: "==", value: "" }]);
          setQueryResults([]);
          setQueried(false);
          void ensureMeta(value);
        }}
      />
      {rows.map((row, index) => {
        const kind = propertyKind(properties.find((property) => property.name === row.field)?.type);
        const operators = OPERATORS_BY_KIND[kind];
        return (
          <div key={index} className={styles.conditionRow}>
            <Select
              className={styles.conditionField}
              data-testid="graph-explorer-cond-field"
              showSearch
              filterOption={matchIdOrLabel}
              disabled={disabled || !otId}
              value={row.field || undefined}
              placeholder={t("knowledgeNetwork.graphExplorer.condition.field")}
              options={properties.map((property) => ({ value: property.name, label: property.displayName ? `${property.displayName} (${property.name})` : property.name }))}
              onChange={(value: string) => {
                const nextKind = propertyKind(properties.find((property) => property.name === value)?.type);
                const nextOperators = OPERATORS_BY_KIND[nextKind];
                updateRow(index, { field: value, operator: nextOperators.includes(row.operator) ? row.operator : nextOperators[0] });
              }}
            />
            <Select
              className={styles.conditionOperator}
              data-testid="graph-explorer-cond-op"
              disabled={disabled || !otId}
              value={row.operator}
              options={operators.map((operator) => ({ value: operator, label: operator }))}
              onChange={(value: string) => updateRow(index, { operator: value })}
            />
            <Input
              className={styles.conditionValue}
              data-testid="graph-explorer-cond-value"
              disabled={disabled || !otId}
              value={row.value}
              placeholder={t("knowledgeNetwork.graphExplorer.condition.valuePlaceholder")}
              onChange={(event) => updateRow(index, { value: event.target.value })}
              onPressEnter={() => void runQuery()}
            />
            <Button
              type="text"
              icon={<DeleteOutlined />}
              disabled={rows.length === 1}
              onClick={() => setRows((previous) => previous.filter((_, position) => position !== index))}
            />
          </div>
        );
      })}
      <div className={styles.conditionActions}>
        <Button type="dashed" icon={<PlusOutlined />} disabled={disabled || !otId} onClick={() => setRows((previous) => [...previous, { field: "", operator: "==", value: "" }])}>
          {t("knowledgeNetwork.graphExplorer.condition.addRow")}
        </Button>
        <Button type="primary" data-testid="graph-explorer-query" loading={querying} disabled={disabled || !otId} onClick={() => void runQuery()}>
          {t("knowledgeNetwork.graphExplorer.condition.query")}
        </Button>
      </div>
      {queryError ? <Alert className={styles.alert} type="error" showIcon message={queryError} /> : null}
      <Spin spinning={querying}>
        <ResultList
          nodes={queryResults}
          canvasIds={canvasIds}
          onAdd={onAdd}
          colorOf={colorOf}
          emptyText={t("knowledgeNetwork.graphExplorer.condition.empty")}
          searched={queried}
        />
      </Spin>
    </div>
  );

  return (
    <aside className={styles.panel}>
      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as "semantic" | "condition")}
        className={styles.tabs}
        items={[
          { key: "semantic", label: t("knowledgeNetwork.graphExplorer.tabs.semantic"), children: semanticPane },
          { key: "condition", label: t("knowledgeNetwork.graphExplorer.tabs.condition"), children: conditionPane },
        ]}
      />
    </aside>
  );
}
