/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Collapse, Empty, Input, InputNumber, Select, Spin, Switch, Tabs, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DEFAULT_SEARCH_OPTIONS,
  type GNode,
  type KnCondition,
  type ObjectTypeMeta,
  type SearchOptions,
} from "@/modules/knowledge-network/services/graph-explorer.service";

import { OPERATORS_BY_KIND, buildCondition, propertyKind, type ConditionRow } from "./condition-builder";
import styles from "./SearchPanel.module.css";

export type SearchPanelProps = {
  objectTypes: { id: string; name: string }[];
  conceptGroups: { id: string; name: string }[];
  metaByOt: Record<string, ObjectTypeMeta>;
  /** Loads and caches the object type definition; resolves null when it cannot be loaded. */
  ensureMeta: (otId: string) => Promise<ObjectTypeMeta | null>;
  /** Semantic search with the search_instance tunables chosen in the panel. */
  onSearch: (query: string, options: SearchOptions) => Promise<GNode[]>;
  /** Exact lookup by primary key value(s); composite keys arrive comma-separated in key order. */
  onLocate: (otId: string, rawKey: string) => Promise<GNode[]>;
  onQuery: (otId: string, condition: KnCondition | null) => Promise<GNode[]>;
  /** Lists instances of one object type without a filter, `offset` rows in. */
  onBrowse: (otId: string, offset: number) => Promise<GNode[]>;
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

export const BROWSE_PAGE_SIZE = 50;

export function SearchPanel({
  objectTypes,
  conceptGroups,
  metaByOt,
  ensureMeta,
  onSearch,
  onLocate,
  onQuery,
  onBrowse,
  onAdd,
  canvasIds,
  disabled,
  colorOf,
}: SearchPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"semantic" | "condition" | "browse">("semantic");

  const [browseOt, setBrowseOt] = useState<string | undefined>(undefined);
  const [browsing, setBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseResults, setBrowseResults] = useState<GNode[]>([]);
  const [browsed, setBrowsed] = useState(false);
  const [browseExhausted, setBrowseExhausted] = useState(false);

  const [locateKey, setLocateKey] = useState("");

  const runLocate = async () => {
    const raw = locateKey.trim();
    if (!browseOt || !raw || disabled) return;
    setBrowsing(true);
    setBrowseError(null);
    try {
      const hits = await onLocate(browseOt, raw);
      setBrowseResults(hits);
      setBrowseExhausted(true);
      setBrowsed(true);
      if (hits.length === 0) setBrowseError(t("knowledgeNetwork.graphExplorer.browse.locateEmpty"));
    } catch (error) {
      setBrowseError(error instanceof Error ? error.message : String(error));
    } finally {
      setBrowsing(false);
    }
  };

  const runBrowse = async (append: boolean) => {
    if (!browseOt || disabled) return;
    setBrowsing(true);
    setBrowseError(null);
    try {
      const offset = append ? browseResults.length : 0;
      const page = await onBrowse(browseOt, offset);
      setBrowseResults((previous) => {
        const base = append ? previous : [];
        const seen = new Set(base.map((node) => node.id));
        return [...base, ...page.filter((node) => !seen.has(node.id))];
      });
      setBrowseExhausted(page.length < BROWSE_PAGE_SIZE);
      setBrowsed(true);
    } catch (error) {
      setBrowseError(error instanceof Error ? error.message : String(error));
    } finally {
      setBrowsing(false);
    }
  };

  const [query, setQuery] = useState("");
  const [searchOptions, setSearchOptions] = useState<Required<SearchOptions>>({ ...DEFAULT_SEARCH_OPTIONS });
  const patchSearch = (patch: Partial<SearchOptions>) => setSearchOptions((previous) => ({ ...previous, ...patch }));
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
      setSearchResults(await onSearch(text, searchOptions));
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
      <Select
        className={styles.fullWidth}
        data-testid="graph-explorer-search-scope"
        mode="multiple"
        allowClear
        showSearch
        maxTagCount="responsive"
        filterOption={matchIdOrLabel}
        disabled={disabled}
        value={searchOptions.objectTypes}
        placeholder={t("knowledgeNetwork.graphExplorer.search.scopePlaceholder")}
        options={objectTypes.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(value: string[]) => patchSearch({ objectTypes: value })}
      />
      <Collapse
        size="small"
        ghost
        items={[
          {
            key: "advanced",
            label: t("knowledgeNetwork.graphExplorer.search.advanced"),
            children: (
              <div className={styles.advanced}>
                <Select
                  className={styles.fullWidth}
                  mode="multiple"
                  allowClear
                  showSearch
                  maxTagCount="responsive"
                  filterOption={matchIdOrLabel}
                  disabled={disabled}
                  value={searchOptions.excludeObjectTypes}
                  placeholder={t("knowledgeNetwork.graphExplorer.search.excludePlaceholder")}
                  options={objectTypes.map((item) => ({ value: item.id, label: item.name }))}
                  onChange={(value: string[]) => patchSearch({ excludeObjectTypes: value })}
                />
                <Select
                  className={styles.fullWidth}
                  mode="multiple"
                  allowClear
                  showSearch
                  maxTagCount="responsive"
                  filterOption={matchIdOrLabel}
                  disabled={disabled || conceptGroups.length === 0}
                  value={searchOptions.conceptGroups}
                  placeholder={t("knowledgeNetwork.graphExplorer.search.conceptGroupsPlaceholder")}
                  options={conceptGroups.map((item) => ({ value: item.id, label: item.name }))}
                  onChange={(value: string[]) => patchSearch({ conceptGroups: value })}
                />
                <div className={styles.advancedRow}>
                  <span className={styles.advancedLabel}>{t("knowledgeNetwork.graphExplorer.search.maxInstancesPerType")}</span>
                  <InputNumber
                    size="small"
                    min={1}
                    max={200}
                    value={searchOptions.maxInstancesPerType}
                    onChange={(value) => patchSearch({ maxInstancesPerType: typeof value === "number" ? value : DEFAULT_SEARCH_OPTIONS.maxInstancesPerType })}
                  />
                  <span className={styles.advancedLabel}>{t("knowledgeNetwork.graphExplorer.search.maxObjectTypes")}</span>
                  <InputNumber
                    size="small"
                    min={1}
                    max={100}
                    value={searchOptions.maxObjectTypes}
                    onChange={(value) => patchSearch({ maxObjectTypes: typeof value === "number" ? value : DEFAULT_SEARCH_OPTIONS.maxObjectTypes })}
                  />
                  <span className={styles.advancedLabel}>{t("knowledgeNetwork.graphExplorer.search.rerank")}</span>
                  <Switch size="small" checked={searchOptions.rerank} onChange={(checked) => patchSearch({ rerank: checked })} />
                </div>
              </div>
            ),
          },
        ]}
      />
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

  const browsePane = (
    <div className={styles.pane}>
      <Typography.Text type="secondary">{t("knowledgeNetwork.graphExplorer.browse.hint")}</Typography.Text>
      <Select
        className={styles.fullWidth}
        data-testid="graph-explorer-browse-ot"
        showSearch
        filterOption={matchIdOrLabel}
        disabled={disabled}
        value={browseOt}
        placeholder={t("knowledgeNetwork.graphExplorer.condition.objectTypePlaceholder")}
        options={objectTypes.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(value: string) => {
          setBrowseOt(value);
          setBrowseResults([]);
          setBrowsed(false);
          setBrowseExhausted(false);
          void ensureMeta(value);
        }}
      />
      <Input.Search
        data-testid="graph-explorer-locate"
        value={locateKey}
        disabled={disabled || !browseOt}
        enterButton={t("knowledgeNetwork.graphExplorer.browse.locate")}
        placeholder={t("knowledgeNetwork.graphExplorer.browse.locatePlaceholder")}
        onChange={(event) => setLocateKey(event.target.value)}
        onSearch={() => void runLocate()}
      />
      <Button type="primary" data-testid="graph-explorer-browse" loading={browsing} disabled={disabled || !browseOt} onClick={() => void runBrowse(false)}>
        {t("knowledgeNetwork.graphExplorer.browse.load")}
      </Button>
      {browseError ? <Alert className={styles.alert} type="error" showIcon message={browseError} /> : null}
      <Spin spinning={browsing}>
        <ResultList
          nodes={browseResults}
          canvasIds={canvasIds}
          onAdd={onAdd}
          colorOf={colorOf}
          emptyText={t("knowledgeNetwork.graphExplorer.browse.empty")}
          searched={browsed}
        />
      </Spin>
      {browsed && browseResults.length > 0 && !browseExhausted ? (
        <Button block disabled={browsing} onClick={() => void runBrowse(true)}>
          {t("knowledgeNetwork.graphExplorer.browse.more")}
        </Button>
      ) : null}
    </div>
  );

  return (
    <aside className={styles.panel}>
      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as "semantic" | "condition" | "browse")}
        className={styles.tabs}
        items={[
          { key: "semantic", label: t("knowledgeNetwork.graphExplorer.tabs.semantic"), children: semanticPane },
          { key: "condition", label: t("knowledgeNetwork.graphExplorer.tabs.condition"), children: conditionPane },
          { key: "browse", label: t("knowledgeNetwork.graphExplorer.tabs.browse"), children: browsePane },
        ]}
      />
    </aside>
  );
}
