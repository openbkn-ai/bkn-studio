/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Empty, Select, Spin, Statistic, Switch } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  diffKnowledgeNetworks,
  fetchObjectDataStats,
} from "@/modules/knowledge-network/services/kn-diff.service";
import { listKnowledgeNetworks } from "@/modules/knowledge-network/services/network.service";
import { parseChangePath } from "@/modules/knowledge-network/utils/kn-diff-path";
import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/network";
import type {
  KnDiffAction,
  KnDiffDefinition,
  KnDiffFieldChange,
  KnDiffResult,
  ObjectDataStatsResult,
} from "@/modules/knowledge-network/types/kn-diff";

import styles from "@/modules/knowledge-network/scenes/KnowledgeNetworkDiffScene.module.css";

const DEFINITION_ORDER = [
  "object_type",
  "relation_type",
  "action_type",
  "risk_type",
  "concept_group",
  "metric",
] as const;

const STATE_STYLE: Record<string, string> = {
  create: styles.stateAdd,
  delete: styles.stateDel,
  skip: styles.stateSame,
  update: styles.stateMod,
};

function definitionKey(entry: KnDiffDefinition) {
  return `${entry.type}:${entry.id}`;
}

type ChangeGroup = {
  key: string;
  label: string;
  member: string;
  action: KnDiffAction;
  rows: { field: string; raw: string; kind: KnDiffAction; oldValue: string; newValue: string }[];
};

export function KnowledgeNetworkDiffScene() {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [searchParams] = useSearchParams();

  const [networks, setNetworks] = useState<KnowledgeNetworkRecord[]>([]);
  const [baseId, setBaseId] = useState(searchParams.get("base") ?? "");
  const [targetId, setTargetId] = useState(searchParams.get("target") ?? "");
  const [fallbackByName, setFallbackByName] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);

  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<KnDiffResult | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [statsByKey, setStatsByKey] = useState<Record<string, ObjectDataStatsResult>>({});
  const [statsLoadingKey, setStatsLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadNetworks = async () => {
      try {
        const { items } = await listKnowledgeNetworks({
          direction: "desc",
          keyword: "",
          page: 1,
          pageSize: 200,
          sortBy: "updateTime",
          tag: "",
        });
        if (!cancelled) {
          setNetworks(items);
        }
      } catch (error) {
        if (!cancelled) {
          void message.error(
            extractRequestErrorMessage(error) || t("knowledgeNetwork.diffLoadNetworksFailed"),
          );
        }
      }
    };

    void loadNetworks();
    return () => {
      cancelled = true;
    };
  }, [message, t]);

  const networkOptions = useMemo(
    () => networks.map((network) => ({ label: network.name, value: network.id })),
    [networks],
  );

  const runComparison = useCallback(async () => {
    if (!baseId || !targetId) {
      void message.warning(t("knowledgeNetwork.diffPickBothNetworks"));
      return;
    }

    setComparing(true);
    try {
      // The identical definitions come back with the rest and are filtered in the rail: they are
      // name and id only, and fetching them again on a toggle would cost a round trip to show a
      // list the page already had.
      const diff = await diffKnowledgeNetworks({
        baseNetworkId: baseId,
        fallbackByName,
        includeUnchanged: true,
        targetNetworkId: targetId,
      });
      setResult(diff);
      const firstChanged = diff.entries.find((entry) => entry.action !== "skip");
      setSelectedKey(firstChanged ? definitionKey(firstChanged) : null);
      // Counts belong to the pair that produced them; keeping them would show one network's row
      // counts beside another network's schema.
      setStatsByKey({});
    } catch (error) {
      void message.error(extractRequestErrorMessage(error) || t("knowledgeNetwork.diffFailed"));
    } finally {
      setComparing(false);
    }
  }, [baseId, fallbackByName, message, t, targetId]);

  const groups = useMemo(() => {
    if (!result) {
      return [];
    }
    return DEFINITION_ORDER.map((kind) => ({
      entries: result.entries.filter(
        (entry) => entry.type === kind && (showUnchanged || entry.action !== "skip"),
      ),
      kind,
    })).filter((group) => group.entries.length > 0);
  }, [result, showUnchanged]);

  const selectedEntry = useMemo(() => {
    if (!result || !selectedKey) {
      return null;
    }
    if (result.network && selectedKey === "network") {
      return result.network;
    }
    return result.entries.find((entry) => definitionKey(entry) === selectedKey) ?? null;
  }, [result, selectedKey]);

  // Changes arrive as a flat list keyed by field path. They are regrouped by what they belong to —
  // one data property, one mapping rule, the definition's own fields — because that is the unit a
  // reviewer reads.
  const changeGroups = useMemo<ChangeGroup[]>(() => {
    if (!selectedEntry) {
      return [];
    }
    const byKey = new Map<string, ChangeGroup>();
    selectedEntry.changes.forEach((change: KnDiffFieldChange) => {
      const parsed = parseChangePath(change.path, t);
      let group = byKey.get(parsed.groupKey);
      if (!group) {
        group = {
          action: change.kind,
          key: parsed.groupKey,
          label: parsed.groupLabel,
          member: parsed.groupMember,
          rows: [],
        };
        byKey.set(parsed.groupKey, group);
      }
      // A group whose rows disagree is a modification of that group as a whole.
      if (group.action !== change.kind) {
        group.action = "update";
      }
      group.rows.push({
        field: parsed.fieldLabel,
        kind: change.kind,
        newValue: change.newValue,
        oldValue: change.oldValue,
        raw: parsed.raw,
      });
    });
    return Array.from(byKey.values());
  }, [selectedEntry, t]);

  // A definition that exists on one side only is content, not a comparison. Laying it out as a
  // diff gives every property its own card and repeats "not on the left" on every row — five cards
  // of five rows each to say one object type was added. It is shown as what it is instead: the
  // definition's own fields, and one table row per property.
  const oneSided = selectedEntry
    ? selectedEntry.action === "create" || selectedEntry.action === "delete"
    : false;

  const contentSections = useMemo(() => {
    if (!oneSided) {
      return { singles: [], tables: [] };
    }
    const sideValue = (row: ChangeGroup["rows"][number]) =>
      selectedEntry?.action === "create" ? row.newValue : row.oldValue;

    // A group without a member is a section of the definition itself — its own fields, its data
    // source, its endpoint. Each keeps its own card: merged into one, "id" and "名称" appear twice
    // with nothing to say which is which.
    const singles = new Map<string, { label: string; rows: { field: string; value: string }[] }>();
    const tables = new Map<string, { label: string; columns: string[]; rows: Record<string, string>[] }>();

    changeGroups.forEach((group) => {
      if (!group.member) {
        let single = singles.get(group.key);
        if (!single) {
          single = { label: group.label, rows: [] };
          singles.set(group.key, single);
        }
        group.rows.forEach((row) => single.rows.push({ field: row.field, value: sideValue(row) }));
        return;
      }
      let table = tables.get(group.label);
      if (!table) {
        table = { columns: [], label: group.label, rows: [] };
        tables.set(group.label, table);
      }
      const record: Record<string, string> = { __member__: group.member };
      group.rows.forEach((row) => {
        record[row.field] = sideValue(row);
        if (!table.columns.includes(row.field)) {
          table.columns.push(row.field);
        }
      });
      table.rows.push(record);
    });

    // Read left to right the way the modelling page shows a property.
    const preferred = [
      t("knowledgeNetwork.diffField_displayName"),
      t("knowledgeNetwork.diffField_type"),
      t("knowledgeNetwork.diffField_mappedField"),
      t("knowledgeNetwork.diffField_description"),
    ];
    tables.forEach((table) => {
      table.columns.sort((a, b) => {
        const ai = preferred.indexOf(a);
        const bi = preferred.indexOf(b);
        return (ai < 0 ? preferred.length : ai) - (bi < 0 ? preferred.length : bi);
      });
      // The member name is already the row's first cell; repeating it as a column is noise.
      table.columns = table.columns.filter(
        (column) => column !== t("knowledgeNetwork.diffField_name"),
      );
    });

    // The definition's own fields lead; the sections it points at follow.
    const orderedSingles = Array.from(singles.entries())
      .sort(([a], [b]) => (a === "__self__" ? -1 : b === "__self__" ? 1 : a.localeCompare(b)))
      .map(([, value]) => value);

    return { singles: orderedSingles, tables: Array.from(tables.values()) };
  }, [changeGroups, oneSided, selectedEntry, t]);

  const loadStats = useCallback(
    async (entry: KnDiffDefinition) => {
      if (!result) {
        return;
      }
      const key = definitionKey(entry);
      if (statsByKey[key] || statsLoadingKey === key) {
        return;
      }

      setStatsLoadingKey(key);
      try {
        const stats = await fetchObjectDataStats({
          baseBranch: result.base.branch,
          baseNetworkId: result.base.networkId,
          baseObjectTypeId: entry.baseId || entry.id,
          targetBranch: result.target.branch,
          targetNetworkId: result.target.networkId,
          targetObjectTypeId: entry.targetId || entry.id,
        });
        setStatsByKey((current) => ({ ...current, [key]: stats }));
      } catch (error) {
        void message.error(extractRequestErrorMessage(error) || t("knowledgeNetwork.diffStatsFailed"));
      } finally {
        setStatsLoadingKey(null);
      }
    },
    [message, result, statsByKey, statsLoadingKey, t],
  );

  // Counting runs against the customer's own database, so it is asked for the object type someone
  // opens rather than for every object type in the comparison.
  useEffect(() => {
    if (selectedEntry && selectedEntry.type === "object_type" && selectedEntry.action === "update") {
      void loadStats(selectedEntry);
    }
  }, [loadStats, selectedEntry]);

  const selectedStats = selectedEntry ? statsByKey[definitionKey(selectedEntry)] : undefined;
  const baseTitle = result?.base.name || t("knowledgeNetwork.diffBaseNetwork");
  const targetTitle = result?.target.name || t("knowledgeNetwork.diffTargetNetwork");

  const renderValue = (value: string, kind: KnDiffAction, side: "old" | "new") => {
    if (value) {
      const tone =
        kind === "update" ? (side === "old" ? styles.valueOld : styles.valueNew) : styles.valueSame;
      return <span className={`${styles.valueCell} ${tone}`}>{value}</span>;
    }
    // Say the side does not exist rather than leaving the cell blank, which reads as "unknown".
    const absent =
      kind === "create" && side === "old"
        ? t("knowledgeNetwork.diffAbsentInBase")
        : kind === "delete" && side === "new"
          ? t("knowledgeNetwork.diffAbsentInTarget")
          : t("knowledgeNetwork.diffEmptyValue");
    return <span className={`${styles.valueCell} ${styles.valueAbsent}`}>{absent}</span>;
  };

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.sideField}>
          <span className={styles.sideLabel}>{t("knowledgeNetwork.diffBaseNetwork")}</span>
          <Select
            onChange={setBaseId}
            optionFilterProp="label"
            options={networkOptions}
            placeholder={t("knowledgeNetwork.diffPickNetwork")}
            showSearch
            value={baseId || undefined}
          />
        </div>
        <span className={styles.arrow}>→</span>
        <div className={styles.sideField}>
          <span className={styles.sideLabel}>{t("knowledgeNetwork.diffTargetNetwork")}</span>
          <Select
            onChange={setTargetId}
            optionFilterProp="label"
            options={networkOptions}
            placeholder={t("knowledgeNetwork.diffPickNetwork")}
            showSearch
            value={targetId || undefined}
          />
        </div>
        <AppButton loading={comparing} onClick={() => void runComparison()} type="primary">
          {t("knowledgeNetwork.diffCompare")}
        </AppButton>
        <div className={styles.options}>
          <Switch checked={fallbackByName} onChange={setFallbackByName} size="small" />
          <span>{t("knowledgeNetwork.diffFallbackByName")}</span>
          <Switch checked={showUnchanged} onChange={setShowUnchanged} size="small" />
          <span>{t("knowledgeNetwork.diffShowUnchanged")}</span>
        </div>
      </div>

      {!result && !comparing ? <Empty description={t("knowledgeNetwork.diffEmptyHint")} /> : null}

      {result ? (
        <>
          <div className={styles.summary}>
            <div className={`${styles.chip} ${styles.chipAdd}`}>
              <span className={styles.chipValue}>{result.summary.created}</span>
              {t("knowledgeNetwork.diffCreated")}
            </div>
            <div className={`${styles.chip} ${styles.chipMod}`}>
              <span className={styles.chipValue}>{result.summary.updated}</span>
              {t("knowledgeNetwork.diffUpdated")}
            </div>
            <div className={`${styles.chip} ${styles.chipDel}`}>
              <span className={styles.chipValue}>{result.summary.deleted}</span>
              {t("knowledgeNetwork.diffDeleted")}
            </div>
            <div className={styles.chip}>
              <span className={styles.chipValue}>{result.summary.unchanged}</span>
              {t("knowledgeNetwork.diffUnchanged")}
            </div>
          </div>

          {result.lineage.related ? (
            <Alert
              closable
              message={t("knowledgeNetwork.diffLineageRelated", {
                common: result.lineage.commonIds,
                total: result.lineage.totalIds,
              })}
              showIcon
              type="info"
            />
          ) : (
            <Alert
              closable
              description={t("knowledgeNetwork.diffLineageUnrelatedHint")}
              message={t("knowledgeNetwork.diffLineageUnrelated")}
              showIcon
              type="warning"
            />
          )}

          <div className={styles.shell}>
            <nav className={styles.rail}>
              {result.network ? (
                <>
                  <div className={styles.groupTitle}>{t("knowledgeNetwork.diffNetworkLevel")}</div>
                  <button
                    className={`${styles.item} ${selectedKey === "network" ? styles.itemActive : ""}`}
                    onClick={() => setSelectedKey("network")}
                    type="button"
                  >
                    <span className={`${styles.stateTag} ${STATE_STYLE[result.network.action] ?? ""}`}>
                      {t(`knowledgeNetwork.diffAction_${result.network.action}`)}
                    </span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemName}>{t("knowledgeNetwork.diffNetworkEntry")}</span>
                      <span className={styles.itemKey}>{t("knowledgeNetwork.diffNetworkEntryHint")}</span>
                    </span>
                  </button>
                </>
              ) : null}

              {groups.map((group) => (
                <div key={group.kind}>
                  <div className={styles.groupTitle}>
                    {t(`knowledgeNetwork.diffKind_${group.kind}`)} · {group.entries.length}
                  </div>
                  {group.entries.map((entry) => {
                    const key = definitionKey(entry);
                    return (
                      <button
                        className={`${styles.item} ${selectedKey === key ? styles.itemActive : ""}`}
                        key={key}
                        onClick={() => setSelectedKey(key)}
                        type="button"
                      >
                        {/* A word, not a glyph: "+" and "−" have to be learned before they read. */}
                        <span className={`${styles.stateTag} ${STATE_STYLE[entry.action] ?? ""}`}>
                          {t(`knowledgeNetwork.diffAction_${entry.action}`)}
                        </span>
                        <span className={styles.itemBody}>
                          <span className={styles.itemName}>
                            {entry.newName || entry.oldName || entry.id}
                          </span>
                          <span className={styles.itemKey}>
                            {entry.pairedBy === "name"
                              ? t("knowledgeNetwork.diffIdChangedShort", {
                                  baseId: entry.baseId,
                                  targetId: entry.targetId,
                                })
                              : key}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}

              {showUnchanged ? null : (
                <div className={styles.groupTitle}>
                  {t("knowledgeNetwork.diffUnchangedHint", { count: result.summary.unchanged })}
                </div>
              )}
            </nav>

            <div className={styles.detail}>
              {selectedEntry ? (
                <>
                  {selectedEntry.pairedBy === "name" ? (
                    <Alert
                      closable
                      description={t("knowledgeNetwork.diffPairedByNameHint", {
                        baseId: selectedEntry.baseId,
                        targetId: selectedEntry.targetId,
                      })}
                      message={t("knowledgeNetwork.diffPairedByName")}
                      showIcon
                      type="warning"
                    />
                  ) : null}

                  {selectedEntry.type === "object_type" && selectedEntry.action === "update" ? (
                    <Spin spinning={statsLoadingKey === definitionKey(selectedEntry)}>
                      {selectedStats ? (
                        <>
                          {selectedStats.sameResource ? (
                            <Alert
                              closable
                              message={t("knowledgeNetwork.diffSameResource")}
                              showIcon
                              type="info"
                            />
                          ) : null}
                          <div className={styles.summary}>
                            <Statistic
                              title={t("knowledgeNetwork.diffBaseRowCount")}
                              value={selectedStats.base.rowCount}
                            />
                            <Statistic
                              title={t("knowledgeNetwork.diffTargetRowCount")}
                              value={selectedStats.target.rowCount}
                            />
                            <Statistic
                              title={t("knowledgeNetwork.diffRowCountDelta")}
                              value={selectedStats.delta.rowCount}
                            />
                            {selectedStats.target.duplicateKeys ? (
                              <Statistic
                                title={t("knowledgeNetwork.diffDuplicateKeys")}
                                value={selectedStats.target.duplicateKeys}
                              />
                            ) : null}
                          </div>
                        </>
                      ) : null}
                    </Spin>
                  ) : null}

                  {oneSided && changeGroups.length > 0 ? (
                    <>
                      <div className={styles.onlyOnSide}>
                        {selectedEntry.action === "create"
                          ? t("knowledgeNetwork.diffOnlyOnRight", { network: targetTitle })
                          : t("knowledgeNetwork.diffOnlyOnLeft", { network: baseTitle })}
                      </div>
                      {contentSections.singles.map((section) => (
                        <div className={styles.groupCard} key={section.label}>
                          <div className={styles.groupHead}>
                            <span className={styles.groupHeadName}>{section.label}</span>
                          </div>
                          {section.rows.map((row) => (
                            <div className={styles.contentRow} key={`${section.label}-${row.field}`}>
                              <span className={styles.fieldName}>{row.field}</span>
                              <span className={styles.valueCell}>{row.value}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                      {contentSections.tables.map((table) => (
                        <div className={styles.groupCard} key={table.label}>
                          <div className={styles.groupHead}>
                            <span className={styles.groupHeadName}>
                              {table.label} · {table.rows.length}
                            </span>
                          </div>
                          <div className={styles.tableScroll}>
                            <table className={styles.contentTable}>
                              <thead>
                                <tr>
                                  <th>{t("knowledgeNetwork.diffField_name")}</th>
                                  {table.columns.map((column) => (
                                    <th key={column}>{column}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {table.rows.map((row) => (
                                  <tr key={row.__member__}>
                                    <td>{row.__member__}</td>
                                    {table.columns.map((column) => (
                                      <td key={column}>{row[column] ?? ""}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : changeGroups.length > 0 ? (
                    <>
                      <div className={styles.columnHeads}>
                        <span>{t("knowledgeNetwork.diffFieldColumn")}</span>
                        <span className={styles.columnHeadName}>{baseTitle}</span>
                        <span className={styles.columnHeadName}>{targetTitle}</span>
                      </div>
                      {changeGroups.map((group) => (
                        <div className={styles.groupCard} key={group.key}>
                          <div className={styles.groupHead}>
                            <span className={`${styles.stateTag} ${STATE_STYLE[group.action] ?? ""}`}>
                              {t(`knowledgeNetwork.diffAction_${group.action}`)}
                            </span>
                            <span className={styles.groupHeadName}>
                              {group.label}
                              {group.member ? ` · ${group.member}` : ""}
                            </span>
                          </div>
                          {group.rows.map((row) => (
                            <div className={styles.fieldRow} key={row.raw}>
                              <span className={styles.fieldName} title={row.raw}>
                                {row.field}
                              </span>
                              {renderValue(row.oldValue, row.kind, "old")}
                              {renderValue(row.newValue, row.kind, "new")}
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  ) : (
                    <Empty description={t(`knowledgeNetwork.diffWhole_${selectedEntry.action}`)} />
                  )}
                </>
              ) : (
                <Empty description={t("knowledgeNetwork.diffPickDefinition")} />
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
