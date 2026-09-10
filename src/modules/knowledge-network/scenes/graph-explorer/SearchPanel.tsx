/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, PlusOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Collapse, Empty, Input, InputNumber, Select, Slider, Spin, Switch, Tabs, Tag, Tooltip, Typography } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DEFAULT_RRF_OPTIONS,
  DEFAULT_SEARCH_OPTIONS,
  needsKnSearch,
  type GEdge,
  type GNode,
  type KnCondition,
  type ObjectTypeMeta,
  type RrfOptions,
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
  /** Semantic search with the search_instance tunables and, when changed, the fusion knobs. */
  onSearch: (query: string, options: SearchOptions, rrf: RrfOptions) => Promise<GNode[]>;
  /** Exact lookup by primary key value(s); composite keys arrive comma-separated in key order. */
  onLocate: (otId: string, rawKey: string) => Promise<GNode[]>;
  onQuery: (otId: string, condition: KnCondition | null) => Promise<GNode[]>;
  /** Lists instances of one object type without a filter, `offset` rows in. */
  onBrowse: (otId: string, offset: number) => Promise<GNode[]>;
  /** Resolves pasted ids to instances plus the relations among them and puts them on the canvas. */
  onSubgraphByIds: (text: string, fallbackOt?: string) => Promise<void>;
  /** Runs a MATCH / WHERE fragment through Cypher and returns the rebuilt subgraph plus the row count. */
  onCypher: (fragment: string) => Promise<{ nodes: GNode[]; edges: GEdge[]; rows: number }>;
  /** Adds nodes together with the edges among them. */
  onAddGraph: (nodes: GNode[], edges: GEdge[]) => void;
  cypherRowLimit: number;
  /** Turns a natural-language question into a MATCH fragment through the default LLM; null when no model is available. */
  onGenerateCypher: ((question: string, modelName: string) => Promise<string>) | null;
  /** Model factory LLMs offered for generation; the first is the default. */
  cypherModels: { name: string; isDefault?: boolean }[];
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
  const allSelected = selectable.length > 0 && selectedVisible.length === selectable.length;
  const someSelected = selectedVisible.length > 0 && !allSelected;

  if (nodes.length === 0) {
    return searched ? <Empty className={styles.empty} image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} /> : null;
  }

  return (
    <div className={styles.results}>
      <div className={styles.resultsHeader}>
        <span className={styles.resultsLeft}>
          <Checkbox
            data-testid="graph-explorer-select-all"
            disabled={selectable.length === 0}
            checked={allSelected}
            indeterminate={someSelected}
            onChange={(event) => setSelected(event.target.checked ? new Set(selectable.map((node) => node.id)) : new Set())}
          >
            {t("knowledgeNetwork.graphExplorer.selectAll")}
          </Checkbox>
          <Typography.Text type="secondary">{t("knowledgeNetwork.graphExplorer.search.resultCount", { count: nodes.length })}</Typography.Text>
        </span>
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
  onSubgraphByIds,
  onCypher,
  onAddGraph,
  cypherRowLimit,
  onGenerateCypher,
  cypherModels,
  onAdd,
  canvasIds,
  disabled,
  colorOf,
}: SearchPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"semantic" | "condition" | "browse" | "cypher">("semantic");

  const [cypherText, setCypherText] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiModel, setAiModel] = useState<string | undefined>(undefined);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [cypherRunning, setCypherRunning] = useState(false);

  const effectiveAiModel = aiModel ?? cypherModels.find((model) => model.isDefault)?.name ?? cypherModels[0]?.name;

  const runGenerate = async () => {
    const question = aiQuestion.trim();
    if (!question || disabled || !onGenerateCypher) return;
    if (!effectiveAiModel) {
      setCypherError(t("knowledgeNetwork.graphExplorer.cypher.aiNoModel"));
      return;
    }
    setAiGenerating(true);
    setCypherError(null);
    try {
      const fragment = await onGenerateCypher(question, effectiveAiModel);
      if (!fragment) {
        setCypherError(t("knowledgeNetwork.graphExplorer.cypher.aiEmpty"));
        return;
      }
      setCypherText(fragment);
      setCypherGraph(null);
    } catch (error) {
      setCypherError(error instanceof Error ? error.message : String(error));
    } finally {
      setAiGenerating(false);
    }
  };
  const [cypherError, setCypherError] = useState<string | null>(null);
  const [cypherGraph, setCypherGraph] = useState<{ nodes: GNode[]; edges: GEdge[]; rows: number } | null>(null);

  const runCypher = async () => {
    if (!cypherText.trim() || disabled) return;
    setCypherRunning(true);
    setCypherError(null);
    try {
      setCypherGraph(await onCypher(cypherText));
    } catch (error) {
      setCypherError(error instanceof Error ? error.message : String(error));
    } finally {
      setCypherRunning(false);
    }
  };

  const [browseOt, setBrowseOt] = useState<string | undefined>(undefined);
  const [browsing, setBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseResults, setBrowseResults] = useState<GNode[]>([]);
  const [browsed, setBrowsed] = useState(false);
  const [browseExhausted, setBrowseExhausted] = useState(false);

  const [locateKey, setLocateKey] = useState("");
  const [idsText, setIdsText] = useState("");
  const [idsRunning, setIdsRunning] = useState(false);

  const runIds = async () => {
    if (!idsText.trim() || disabled) return;
    setIdsRunning(true);
    setBrowseError(null);
    try {
      await onSubgraphByIds(idsText, browseOt);
    } catch (error) {
      setBrowseError(error instanceof Error ? error.message : String(error));
    } finally {
      setIdsRunning(false);
    }
  };

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
  const [rrf, setRrf] = useState<RrfOptions>({ ...DEFAULT_RRF_OPTIONS });
  const patchRrf = (patch: Partial<RrfOptions>) => setRrf((previous) => ({ ...previous, ...patch }));
  const viaKnSearch = needsKnSearch(rrf);

  /** Label with a hover explanation; every tunable carries one so the panel documents itself. */
  const helpLabel = (text: string, help: string) => (
    <span className={styles.advancedLabel}>
      {text}
      <Tooltip title={help} placement="right">
        <QuestionCircleOutlined className={styles.helpIcon} />
      </Tooltip>
    </span>
  );
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
      setSearchResults(await onSearch(text, { ...searchOptions, rerank: rrf.rerankMode === "on" }, rrf));
      setSearched(true);
    } catch (error) {
      // Stale hits must not stay addable after a failed search; an empty message means a toast already said it.
      setSearchResults([]);
      setSearched(false);
      const text = error instanceof Error ? error.message : String(error);
      setSearchError(text || null);
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
      setQueryResults([]);
      setQueried(false);
      const text = error instanceof Error ? error.message : String(error);
      setQueryError(text || null);
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
                <div className={styles.advancedGrid}>
                  {helpLabel(t("knowledgeNetwork.graphExplorer.search.maxInstancesPerType"), t("knowledgeNetwork.graphExplorer.search.maxInstancesPerTypeHelp"))}
                  <InputNumber
                    size="small"
                    className={styles.advancedNumber}
                    min={1}
                    max={200}
                    value={searchOptions.maxInstancesPerType}
                    onChange={(value) => patchSearch({ maxInstancesPerType: typeof value === "number" ? value : DEFAULT_SEARCH_OPTIONS.maxInstancesPerType })}
                  />
                  {helpLabel(t("knowledgeNetwork.graphExplorer.search.maxObjectTypes"), t("knowledgeNetwork.graphExplorer.search.maxObjectTypesHelp"))}
                  <InputNumber
                    size="small"
                    className={styles.advancedNumber}
                    min={1}
                    max={100}
                    value={searchOptions.maxObjectTypes}
                    onChange={(value) => patchSearch({ maxObjectTypes: typeof value === "number" ? value : DEFAULT_SEARCH_OPTIONS.maxObjectTypes })}
                  />
                </div>
              </div>
            ),
          },
          {
            key: "rrf",
            label: t("knowledgeNetwork.graphExplorer.search.rrf"),
            children: (
              <div className={styles.advanced}>
                <Typography.Paragraph type="secondary" className={styles.rrfIntro}>
                  {t("knowledgeNetwork.graphExplorer.search.rrfIntro")}
                </Typography.Paragraph>
                <div className={styles.advancedGrid}>
                  {helpLabel(t("knowledgeNetwork.graphExplorer.search.enableRrf"), t("knowledgeNetwork.graphExplorer.search.enableRrfHelp"))}
                  <span className={styles.advancedControl}>
                    <Switch size="small" data-testid="graph-explorer-rrf-enable" checked={rrf.enableRrfFusion} onChange={(checked) => patchRrf({ enableRrfFusion: checked })} />
                  </span>
                  {helpLabel(t("knowledgeNetwork.graphExplorer.search.enableKnn"), t("knowledgeNetwork.graphExplorer.search.enableKnnHelp"))}
                  <span className={styles.advancedControl}>
                    <Switch size="small" checked={rrf.enableKnn} onChange={(checked) => patchRrf({ enableKnn: checked })} />
                  </span>
                  {helpLabel(t("knowledgeNetwork.graphExplorer.search.rrfK"), t("knowledgeNetwork.graphExplorer.search.rrfKHelp"))}
                  <InputNumber
                    size="small"
                    className={styles.advancedNumber}
                    min={1}
                    max={1000}
                    value={rrf.rrfK}
                    onChange={(value) => patchRrf({ rrfK: typeof value === "number" ? value : DEFAULT_RRF_OPTIONS.rrfK })}
                  />
                  {helpLabel(t("knowledgeNetwork.graphExplorer.search.knnWeight"), t("knowledgeNetwork.graphExplorer.search.knnWeightHelp"))}
                  <div className={styles.sliderCell}>
                    <Slider
                      min={0}
                      max={1}
                      step={0.05}
                      value={rrf.knnWeight}
                      tooltip={{ formatter: (value) => (typeof value === "number" ? value.toFixed(2) : "") }}
                      onChange={(value: number) => patchRrf({ knnWeight: Math.round(value * 100) / 100 })}
                    />
                    <span className={styles.sliderValue}>
                      {t("knowledgeNetwork.graphExplorer.search.knnWeightValue", { knn: rrf.knnWeight.toFixed(2), text: (1 - rrf.knnWeight).toFixed(2) })}
                    </span>
                  </div>
                  {helpLabel(t("knowledgeNetwork.graphExplorer.search.initialCandidateCount"), t("knowledgeNetwork.graphExplorer.search.initialCandidateCountHelp"))}
                  <InputNumber
                    size="small"
                    className={styles.advancedNumber}
                    min={1}
                    max={1000}
                    value={rrf.initialCandidateCount}
                    onChange={(value) => patchRrf({ initialCandidateCount: typeof value === "number" ? value : DEFAULT_RRF_OPTIONS.initialCandidateCount })}
                  />
                  {helpLabel(t("knowledgeNetwork.graphExplorer.search.minDirectRelevance"), t("knowledgeNetwork.graphExplorer.search.minDirectRelevanceHelp"))}
                  <InputNumber
                    size="small"
                    className={styles.advancedNumber}
                    min={0}
                    max={1}
                    step={0.05}
                    value={rrf.minDirectRelevance}
                    onChange={(value) => patchRrf({ minDirectRelevance: typeof value === "number" ? value : DEFAULT_RRF_OPTIONS.minDirectRelevance })}
                  />
                  {helpLabel(t("knowledgeNetwork.graphExplorer.search.rerankMode"), t("knowledgeNetwork.graphExplorer.search.rerankModeHelp"))}
                  <Select
                    size="small"
                    className={styles.advancedNumber}
                    value={rrf.rerankMode}
                    options={[
                      { value: "off", label: t("knowledgeNetwork.graphExplorer.search.rerankOff") },
                      { value: "shadow", label: t("knowledgeNetwork.graphExplorer.search.rerankShadow") },
                      { value: "on", label: t("knowledgeNetwork.graphExplorer.search.rerankOn") },
                    ]}
                    onChange={(value: RrfOptions["rerankMode"]) => patchRrf({ rerankMode: value })}
                  />
                </div>
                {viaKnSearch ? (
                  <Tooltip title={t("knowledgeNetwork.graphExplorer.search.viaKnSearchHelp")} placement="right">
                    <Typography.Text type="warning">{t("knowledgeNetwork.graphExplorer.search.viaKnSearch")}</Typography.Text>
                  </Tooltip>
                ) : null}
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
      <Typography.Text type="secondary" className={styles.hint}>
        {t("knowledgeNetwork.graphExplorer.browse.hint")}
      </Typography.Text>
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
      {/* Above the candidate list: pasting a list of ids is a starting point, not a refinement of the rows below. */}
      <div className={styles.aiBox}>
        <Typography.Text strong>{t("knowledgeNetwork.graphExplorer.browse.idsTitle")}</Typography.Text>
        <Input.TextArea
          data-testid="graph-explorer-ids"
          value={idsText}
          disabled={disabled}
          autoSize={{ minRows: 3, maxRows: 8 }}
          placeholder={t("knowledgeNetwork.graphExplorer.browse.idsPlaceholder")}
          onChange={(event) => setIdsText(event.target.value)}
        />
        <Button type="primary" data-testid="graph-explorer-ids-run" loading={idsRunning} disabled={disabled || !idsText.trim()} onClick={() => void runIds()}>
          {t("knowledgeNetwork.graphExplorer.browse.idsRun")}
        </Button>
      </div>
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

  const cypherPane = (
    <div className={styles.pane}>
      <Typography.Text type="secondary" className={styles.hint}>
        {t("knowledgeNetwork.graphExplorer.cypher.hint", { limit: cypherRowLimit })}
      </Typography.Text>
      {onGenerateCypher ? (
        <div className={styles.aiBox}>
          <Input.Search
            data-testid="graph-explorer-cypher-ai"
            size="small"
            value={aiQuestion}
            disabled={disabled || aiGenerating}
            loading={aiGenerating}
            enterButton={t("knowledgeNetwork.graphExplorer.cypher.aiGenerate")}
            placeholder={t("knowledgeNetwork.graphExplorer.cypher.aiPlaceholder")}
            onChange={(event) => setAiQuestion(event.target.value)}
            onSearch={() => void runGenerate()}
          />
          <div className={styles.aiMeta}>
            <Typography.Text type="secondary" className={styles.aiHint}>
              {t("knowledgeNetwork.graphExplorer.cypher.aiHint")}
            </Typography.Text>
            {cypherModels.length > 1 ? (
              <Select
                size="small"
                className={styles.aiModel}
                value={effectiveAiModel}
                options={cypherModels.map((model) => ({ value: model.name, label: model.name }))}
                onChange={(value: string) => setAiModel(value)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      <Input.TextArea
        data-testid="graph-explorer-cypher"
        value={cypherText}
        disabled={disabled}
        autoSize={{ minRows: 4, maxRows: 10 }}
        placeholder={t("knowledgeNetwork.graphExplorer.cypher.placeholder")}
        onChange={(event) => setCypherText(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void runCypher();
        }}
      />
      <div className={styles.conditionActions}>
        <Button type="primary" data-testid="graph-explorer-cypher-run" loading={cypherRunning} disabled={disabled || !cypherText.trim()} onClick={() => void runCypher()}>
          {t("knowledgeNetwork.graphExplorer.cypher.run")}
        </Button>
        {cypherGraph && cypherGraph.nodes.length > 0 ? (
          <Button data-testid="graph-explorer-cypher-add-all" onClick={() => onAddGraph(cypherGraph.nodes, cypherGraph.edges)}>
            {t("knowledgeNetwork.graphExplorer.cypher.addAll", { nodes: cypherGraph.nodes.length, edges: cypherGraph.edges.length })}
          </Button>
        ) : null}
      </div>
      {cypherError ? <Alert className={styles.alert} type="error" showIcon message={cypherError} /> : null}
      {cypherGraph ? (
        <Typography.Text type="secondary">
          {t("knowledgeNetwork.graphExplorer.cypher.summary", { rows: cypherGraph.rows, nodes: cypherGraph.nodes.length, edges: cypherGraph.edges.length })}
        </Typography.Text>
      ) : null}
      <Spin spinning={cypherRunning}>
        <ResultList
          nodes={cypherGraph?.nodes ?? []}
          canvasIds={canvasIds}
          onAdd={(nodes) => onAddGraph(nodes, cypherGraph?.edges ?? [])}
          colorOf={colorOf}
          emptyText={t("knowledgeNetwork.graphExplorer.cypher.empty")}
          searched={cypherGraph !== null}
        />
      </Spin>
    </div>
  );

  return (
    <aside className={styles.panel}>
      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as "semantic" | "condition" | "browse" | "cypher")}
        className={styles.tabs}
        items={[
          { key: "semantic", label: t("knowledgeNetwork.graphExplorer.tabs.semantic"), children: semanticPane },
          { key: "condition", label: t("knowledgeNetwork.graphExplorer.tabs.condition"), children: conditionPane },
          { key: "browse", label: t("knowledgeNetwork.graphExplorer.tabs.browse"), children: browsePane },
          { key: "cypher", label: t("knowledgeNetwork.graphExplorer.tabs.cypher"), children: cypherPane },
        ]}
      />
    </aside>
  );
}
