/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Empty, Spin } from "antd";
import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  SELF_GROUP,
  changedEntries,
  parseChangePath,
} from "@/modules/knowledge-network/lib/kn-diff-path";
import type {
  KnDiffDefinition,
  KnDiffFieldChange,
  KnDiffResult,
} from "@/modules/knowledge-network/types/kn-version";

import styles from "./KnVersions.module.css";

type KnDiffSummaryProps = {
  /** Name of the older side, such as `v2`. */
  baseLabel: string;
  error?: string | null;
  loading?: boolean;
  result?: KnDiffResult | null;
  /** Name of the newer side, such as `草稿`. */
  targetLabel: string;
};

type Action = KnDiffDefinition["action"];

const KINDS = [
  "network",
  "object_type",
  "relation_type",
  "action_type",
  "risk_type",
  "concept_group",
  "metric",
];

type Row = { field: string; kind: Action; newValue?: string; oldValue?: string; raw: string };

type ChangeGroup = { action: Action; key: string; label: string; member: string; rows: Row[] };

// Each count names its action, and reads in the colour of that action.
const COUNTS = [
  { action: "create", count: "create", key: "created" },
  { action: "update", count: "update", key: "updated" },
  { action: "delete", count: "delete", key: "deleted" },
  { action: "skip", count: "skip", key: "unchanged" },
] as const;

/** A word, not a glyph, on a light tint of its colour. */
function ActionBadge({ action, t }: { action: Action; t: TFunction }) {
  return (
    <span className={`${styles.diffBadge} ${styles[`diffBadge_${action}`]}`}>
      {t(`knowledgeNetwork.versions.diff.action.${action}`)}
    </span>
  );
}

function entryKey(entry: KnDiffDefinition) {
  return `${entry.type}:${entry.id}`;
}

function entryTitle(entry: KnDiffDefinition) {
  return entry.name?.new || entry.name?.old || entry.id;
}

function kindLabel(kind: string, t: TFunction) {
  return KINDS.includes(kind) ? t(`knowledgeNetwork.versions.diff.kind.${kind}`) : kind;
}

/** Changes arrive flat, keyed by path; they are regrouped by what they belong to. */
function groupChanges(changes: KnDiffFieldChange[], t: TFunction): ChangeGroup[] {
  const groups = new Map<string, ChangeGroup>();
  changes.forEach((change) => {
    const parsed = parseChangePath(change.path ?? "", t);
    const kind = change.kind ?? "update";
    let group = groups.get(parsed.groupKey);
    if (!group) {
      group = {
        action: kind,
        key: parsed.groupKey,
        label: parsed.groupLabel,
        member: parsed.groupMember,
        rows: [],
      };
      groups.set(parsed.groupKey, group);
    }
    // A group whose rows disagree is a change of the group as a whole.
    if (group.action !== kind) {
      group.action = "update";
    }
    group.rows.push({
      field: parsed.fieldLabel,
      kind,
      newValue: change.new,
      oldValue: change.old,
      raw: parsed.raw,
    });
  });
  // The definition's own fields lead.
  return [...groups.values()].sort((a, b) =>
    a.key === SELF_GROUP ? -1 : b.key === SELF_GROUP ? 1 : 0,
  );
}

/**
 * A definition on one side only is content, not a comparison: its own fields, then one table row
 * per property, instead of a card per property that repeats "absent" on every row.
 */
function OneSided({
  entry,
  groups,
  t,
}: {
  entry: KnDiffDefinition;
  groups: ChangeGroup[];
  t: TFunction;
}) {
  const value = (row: Row) => (entry.action === "create" ? row.newValue : row.oldValue) ?? "";
  const singles = groups.filter((group) => !group.member);
  const tables = new Map<string, { columns: string[]; rows: Record<string, string>[] }>();
  groups
    .filter((group) => group.member)
    .forEach((group) => {
      const table = tables.get(group.label) ?? { columns: [], rows: [] };
      tables.set(group.label, table);
      const record: Record<string, string> = { __member__: group.member };
      group.rows.forEach((row) => {
        record[row.field] = value(row);
        if (!table.columns.includes(row.field)) {
          table.columns.push(row.field);
        }
      });
      table.rows.push(record);
    });
  const nameColumn = t("knowledgeNetwork.versions.diff.field.name");

  return (
    <>
      {singles.map((group) => (
        <div className={styles.diffCard} key={group.key}>
          <div className={styles.diffCardHead}>{group.label}</div>
          {group.rows.map((row) => (
            <div className={styles.diffContentRow} key={row.raw}>
              <span className={styles.diffFieldName} title={row.raw}>
                {row.field}
              </span>
              <span className={styles.diffValue}>{value(row)}</span>
            </div>
          ))}
        </div>
      ))}
      {[...tables.entries()].map(([label, table]) => {
        // The member is the row's first cell already.
        const columns = table.columns.filter((column) => column !== nameColumn);
        return (
          <div className={styles.diffCard} key={label}>
            <div className={styles.diffCardHead}>
              {label} · {table.rows.length}
            </div>
            <div className={styles.diffTableScroll}>
              <table className={styles.diffTable}>
                <thead>
                  <tr>
                    <th>{nameColumn}</th>
                    {columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={row.__member__}>
                      <td>{row.__member__}</td>
                      {columns.map((column) => (
                        <td key={column}>{row[column] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Counts, the changed definitions and, for the one picked, what changed field by field. */
export function KnDiffSummary({
  baseLabel,
  error,
  loading,
  result,
  targetLabel,
}: KnDiffSummaryProps) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string | null>(null);
  const entries = useMemo(() => (result ? changedEntries(result) : []), [result]);
  const selected = entries.find((entry) => entryKey(entry) === picked) ?? entries[0];
  const groups = useMemo(
    () => (selected ? groupChanges(selected.changes ?? [], t) : []),
    [selected, t],
  );

  if (loading) {
    return <Spin size="small" />;
  }
  if (error) {
    return <Alert message={error} showIcon type="warning" />;
  }
  if (!result) {
    return null;
  }

  const counted = result.summary ?? {};
  const networkAction = entries.find((entry) => entry.type === "network")?.action;
  const summary = {
    created: (counted.created ?? 0) + (networkAction === "create" ? 1 : 0),
    updated: (counted.updated ?? 0) + (networkAction === "update" ? 1 : 0),
    deleted: (counted.deleted ?? 0) + (networkAction === "delete" ? 1 : 0),
    unchanged: counted.unchanged ?? 0,
  };

  const byKind = KINDS.map((kind) => ({
    entries: entries.filter((entry) => entry.type === kind),
    kind,
  }))
    .concat([{ entries: entries.filter((entry) => !KINDS.includes(entry.type)), kind: "" }])
    .filter((group) => group.entries.length > 0);

  const renderValue = (row: Row, side: "old" | "new") => {
    const value = side === "old" ? row.oldValue : row.newValue;
    if (value) {
      const tone =
        row.kind !== "update"
          ? styles.diffValue
          : side === "old"
            ? styles.diffValueOld
            : styles.diffValueNew;
      return <span className={tone}>{value}</span>;
    }
    // Say a side does not have it rather than leaving a blank that reads as unknown.
    const absent =
      row.kind === "create" && side === "old"
        ? t("knowledgeNetwork.versions.diff.absent")
        : row.kind === "delete" && side === "new"
          ? t("knowledgeNetwork.versions.diff.removed")
          : t("knowledgeNetwork.versions.diff.empty");
    return <span className={styles.diffValueAbsent}>{absent}</span>;
  };

  return (
    <div className={styles.diff}>
      <div className={styles.diffCounts}>
        {COUNTS.map(({ action, count, key }) => (
          <div
            aria-label={t(`knowledgeNetwork.versions.diff.${key}`, { n: summary[key] })}
            className={`${styles.diffCount} ${styles[`diffCount_${action}`]}`}
            key={key}
          >
            <span className={styles.diffCountValue}>{summary[key]}</span>
            <span>{t(`knowledgeNetwork.versions.diff.action.${count}`)}</span>
          </div>
        ))}
      </div>
      {entries.length === 0 || !selected ? (
        <Empty
          description={t("knowledgeNetwork.versions.diff.noDifferences")}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <div className={styles.diffShell}>
          <nav
            aria-label={t("knowledgeNetwork.versions.diff.changedDefinitions")}
            className={styles.diffRail}
          >
            {byKind.map((group) => (
              <div key={group.kind || "other"}>
                <div className={styles.diffRailTitle}>
                  {kindLabel(group.kind, t)} · {group.entries.length}
                </div>
                {group.entries.map((entry) => {
                  const key = entryKey(entry);
                  return (
                    <button
                      aria-current={selected === entry ? "true" : undefined}
                      className={`${styles.diffRailItem} ${selected === entry ? styles.diffRailItemActive : ""}`}
                      key={key}
                      onClick={() => setPicked(key)}
                      type="button"
                    >
                      <ActionBadge action={entry.action} t={t} />
                      <span className={styles.diffRailName}>{entryTitle(entry)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className={styles.diffDetail}>
            <div className={styles.diffDetailHead}>
              <span className={styles.diffDetailName}>{entryTitle(selected)}</span>
              <span className={styles.diffDetailMeta}>
                {kindLabel(selected.type, t)} · {selected.id}
              </span>
            </div>
            {groups.length === 0 ? (
              <span className={styles.diffDetailMeta}>
                {t(`knowledgeNetwork.versions.diff.whole.${selected.action}`)}
              </span>
            ) : selected.action === "create" || selected.action === "delete" ? (
              <>
                <span className={styles.diffDetailMeta}>
                  {t(
                    selected.action === "create"
                      ? "knowledgeNetwork.versions.diff.onlyIn"
                      : "knowledgeNetwork.versions.diff.removedFrom",
                    { version: selected.action === "create" ? targetLabel : baseLabel },
                  )}
                </span>
                <OneSided entry={selected} groups={groups} t={t} />
              </>
            ) : (
              <>
                <div className={styles.diffColumns}>
                  <span>{t("knowledgeNetwork.versions.diff.fieldColumn")}</span>
                  <span>{baseLabel}</span>
                  <span>{targetLabel}</span>
                </div>
                {groups.map((group) => (
                  <div className={styles.diffCard} key={group.key}>
                    <div className={styles.diffCardHead}>
                      <ActionBadge action={group.action} t={t} />
                      <span>
                        {group.label}
                        {group.member ? ` · ${group.member}` : ""}
                      </span>
                    </div>
                    {group.rows.map((row) => (
                      <div className={styles.diffFieldRow} key={row.raw}>
                        <span className={styles.diffFieldName} title={row.raw}>
                          {row.field}
                        </span>
                        {renderValue(row, "old")}
                        {renderValue(row, "new")}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
