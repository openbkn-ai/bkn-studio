/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Checkbox, Input, Modal, Segmented, Select, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag, type LightStatusTone } from "@/framework/ui/common/LightStatusTag";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { ExistingMark } from "@/modules/bkn-project/components/draft/ExistingMark";
import { useListPage } from "@/modules/bkn-project/components/useListPage";
import type { Concept, ConceptVerdict } from "@/modules/bkn-project/types/concepts";
import { CONCEPT_VERDICTS } from "@/modules/bkn-project/types/concepts";

import {
  type ConceptKind,
  type ConceptOrigin,
  type ConceptStatus,
  conceptStats,
  groupedOrder,
  inNetwork,
  kindOf,
  mergeable,
  mergeTargets,
  objectVerdict,
  originOf,
  statusOf,
  tableCandidate,
} from "./conceptView";
import styles from "./ProjectConcepts.module.css";

const PREFIX = "bknProject.concepts";

const STATUS_TONE: Record<ConceptStatus, LightStatusTone> = {
  candidate: "neutral",
  confirmed: "success",
  excluded: "neutral",
  network: "info",
  pending: "warning",
};

/** The verdicts that fit a concept: what its item can be, or anything for one with no item. */
const VERDICTS_OF: Record<"none" | NonNullable<Concept["item"]>["kind"], ConceptVerdict[]> = {
  none: ["object", "event", "property", "values", "relation", "kinetic", "none"],
  object_types: ["object", "event", "property", "kinetic", "none"],
  relation_types: ["relation", "none"],
  value_types: ["values", "property", "none"],
};

/** The code drafting gave for its suggestion, as the page words it. */
function becauseKey(code: string) {
  if (code.startsWith("document")) {
    return "document";
  }
  if (code.startsWith("requirement_")) {
    return "requirement";
  }
  return [
    "table_entity",
    "table_understood",
    "ai",
    "code_table",
    "foreign_key",
    "name_match",
    "stem_match",
    "link_table",
    "manual",
    "network",
  ].includes(code)
    ? code
    : "other";
}

export type DataFilters = {
  origin: "all" | ConceptOrigin;
  query: string;
  status: "all" | Exclude<ConceptStatus, "candidate">;
  verdict: "all" | ConceptVerdict;
};

type Row = { concept: Concept; key: string } | { group: ConceptKind; count: number; key: string };

/**
 * The data side's concepts: what the tables and the knowledge-base files hold, grouped by the data
 * they are bound to, the network's last in each group with the blue dot. Each is confirmed as what
 * it is suggested to be, changed, merged into another of the same kind, or left out; ticks stay
 * across pages for working on several at once or asking AI about them.
 */
export function DataConcepts({
  busy,
  concepts,
  editable,
  filters,
  onFilters,
  onJudge,
  onJudgeMany,
  onMerge,
  onOpenItem,
  onAskAbout,
  onSelected,
  selected,
}: {
  /** The key of the concept being written, or another busy step; null when none is. */
  busy: string | null;
  concepts: Concept[];
  /** Whether the person may judge and merge now. */
  editable: boolean;
  filters: DataFilters;
  onFilters: (filters: DataFilters) => void;
  onJudge: (concept: Concept, verdict: ConceptVerdict) => void;
  onJudgeMany: (concepts: Concept[], verdict: "confirm" | "none") => void;
  onMerge: (key: string, into: string) => void;
  onOpenItem: (item: NonNullable<Concept["item"]>) => void;
  /** Asks AI about the ticked concepts; with `relation`, to suggest relating them instead. */
  onAskAbout: (relation?: boolean) => void;
  onSelected: (keys: string[]) => void;
  selected: string[];
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [changing, setChanging] = useState<Concept | null>(null);
  // The concept being merged, and the ticked ones it may go into when merging those.
  const [merging, setMerging] = useState<{ concept: Concept; among?: string[] } | null>(null);
  const [crossing, setCrossing] = useState<Concept[] | null>(null);
  const stats = conceptStats(concepts);
  // A knowledge-base object named as an object of a table: they are not one, which the page says.
  const sameNames = useMemo(() => {
    const tableObjects = new Map(
      concepts
        .filter((c) => kindOf(c) === "structured" && objectVerdict(c.verdict))
        .map((c) => [c.name.trim().toLowerCase(), c.name]),
    );
    return new Map(
      concepts
        .filter((c) => kindOf(c) === "unstructured" && objectVerdict(c.verdict))
        .filter((c) => tableObjects.has(c.name.trim().toLowerCase()))
        .map((c) => [c.key, tableObjects.get(c.name.trim().toLowerCase())!]),
    );
  }, [concepts]);

  const shown = useMemo(
    () =>
      groupedOrder(
        concepts.filter((concept) => {
          const status = statusOf(concept);
          return (
            (filters.origin === "all" || originOf(concept) === filters.origin) &&
            (filters.status === "all" || status === filters.status) &&
            (filters.verdict === "all" || concept.verdict === filters.verdict) &&
            (!filters.query ||
              [concept.name, ...concept.aliases].some((name) =>
                name.toLowerCase().includes(filters.query.toLowerCase()),
              ))
          );
        }),
      ),
    [concepts, filters],
  );
  const listPage = useListPage(shown.length, JSON.stringify(filters));
  const page = listPage.slice(shown);
  // Each group starts with its heading, again on a page it goes on to.
  const rows: Row[] = [];
  for (const concept of page) {
    const kind = kindOf(concept);
    const last = rows[rows.length - 1];
    const lastKind = last ? ("group" in last ? last.group : kindOf(last.concept)) : undefined;
    if (lastKind !== kind) {
      rows.push({
        count: shown.filter((other) => kindOf(other) === kind).length,
        group: kind,
        key: `group:${kind}`,
      });
    }
    rows.push({ concept, key: concept.key });
  }

  const setFilter = (next: Partial<DataFilters>) => onFilters({ ...filters, ...next });
  const toggle = (key: string, on: boolean) =>
    onSelected(on ? [...selected, key] : selected.filter((other) => other !== key));
  const ticked = concepts.filter((concept) => selected.includes(concept.key));

  const mergeTicked = () => {
    if (ticked.length < 2) {
      return;
    }
    if (ticked.some((concept) => !objectVerdict(concept.verdict) || tableCandidate(concept))) {
      message.info(t(`${PREFIX}.mergeTicked.objectsOnly`));
      return;
    }
    if (new Set(ticked.map(kindOf)).size > 1) {
      setCrossing(ticked);
      return;
    }
    const from = ticked.find(mergeable);
    if (from) {
      setMerging({
        among: ticked.filter((concept) => concept.key !== from.key).map((c) => c.key),
        concept: from,
      });
    }
  };

  const bindingLine = (concept: Concept) => {
    const kind = kindOf(concept);
    const name =
      concept.binding?.name ||
      (kind === "unstructured" ? t(`${PREFIX}.binding.datasetUnnamed`) : "");
    return (
      <span className={styles.muted}>
        <span className={kind === "structured" ? styles.kindStructured : styles.kindUnstructured}>
          {t(`${PREFIX}.kind.${kind}`)}
        </span>{" "}
        {name}
      </span>
    );
  };

  const reasonOf = (concept: Concept) => {
    const because =
      concept.suggestedBecause === "table_understood" && concept.description
        ? t(`${PREFIX}.understoodWith`, { description: concept.description })
        : t(`${PREFIX}.because.${becauseKey(concept.suggestedBecause)}`);
    const leftOut =
      concept.state === "pending" &&
      concept.item &&
      !concept.item.adopted &&
      concept.verdict === "none" &&
      concept.suggested !== "none";
    return (
      concept.reason ||
      (leftOut
        ? t(`${PREFIX}.notAdopted`, {
            because,
            verdict: t(`${PREFIX}.verdict.${concept.suggested}`),
          })
        : because)
    );
  };

  const asLabel = (concept: Concept) => {
    const verdict = t(`${PREFIX}.verdict.${concept.verdict}`);
    if (inNetwork(concept)) {
      return t(`${PREFIX}.as.network`, { verdict });
    }
    if (concept.state === "blocked" && concept.blocked) {
      return t(`${PREFIX}.as.blocked`, {
        blocked: t(`${PREFIX}.blocked.${concept.blocked}`),
        verdict,
      });
    }
    return verdict;
  };

  const actions = (concept: Concept): ReactNode => {
    const status = statusOf(concept);
    if (status === "network") {
      return concept.item ? (
        <AppButton onClick={() => onOpenItem(concept.item!)} size="small" type="link">
          {t(`${PREFIX}.view`)}
        </AppButton>
      ) : null;
    }
    if (status === "candidate" || !editable) {
      return null;
    }
    const busyHere = busy !== null;
    return (
      <span className={styles.actions}>
        {status === "pending" ? (
          <AppButton
            aria-label={t(`${PREFIX}.confirmOf`, { name: concept.name })}
            disabled={busyHere}
            onClick={() => onJudge(concept, concept.verdict)}
            size="small"
            type="link"
          >
            {t(`${PREFIX}.confirm`)}
          </AppButton>
        ) : null}
        <AppButton
          aria-label={t(`${PREFIX}.changeOf`, { name: concept.name })}
          disabled={busyHere}
          onClick={() => setChanging(concept)}
          size="small"
          type="link"
        >
          {t(`${PREFIX}.change`)}
        </AppButton>
        {mergeable(concept) && status !== "excluded" ? (
          <AppButton
            aria-label={t(`${PREFIX}.mergeIntoOf`, { name: concept.name })}
            disabled={busyHere}
            onClick={() => setMerging({ concept })}
            size="small"
            type="link"
          >
            {t(`${PREFIX}.mergeInto`)}
          </AppButton>
        ) : null}
        {status !== "excluded" ? (
          <AppButton
            aria-label={t(`${PREFIX}.excludeOf`, { name: concept.name })}
            disabled={busyHere}
            onClick={() => onJudge(concept, "none")}
            size="small"
            type="link"
          >
            {t(`${PREFIX}.exclude`)}
          </AppButton>
        ) : null}
        {concept.merged.map((merged) => (
          <AppButton
            disabled={busyHere}
            key={merged.key}
            onClick={() => onMerge(merged.key, "")}
            size="small"
            type="link"
          >
            {t(`${PREFIX}.unmerge`, { name: merged.name })}
          </AppButton>
        ))}
      </span>
    );
  };

  const groupCell = (row: Row) => ("group" in row ? { colSpan: 0 } : {});
  const columns: ColumnsType<Row> = [
    {
      key: "tick",
      onCell: (row) =>
        "group" in row ? { className: styles.groupRow, colSpan: editable ? 6 : 5 } : {},
      render: (_value, row) => {
        if ("group" in row) {
          return (
            <span>
              <span
                className={
                  row.group === "structured" ? styles.kindStructured : styles.kindUnstructured
                }
              >
                {t(`${PREFIX}.kind.${row.group}`)}
              </span>{" "}
              {t(`${PREFIX}.group.${row.group}`, { count: row.count })}
            </span>
          );
        }
        const { concept } = row;
        return statusOf(concept) === "candidate" ? null : (
          <Checkbox
            aria-label={t(`${PREFIX}.tick`, { name: concept.name })}
            checked={selected.includes(concept.key)}
            onChange={(event) => toggle(concept.key, event.target.checked)}
          />
        );
      },
      width: 40,
    },
    {
      key: "concept",
      onCell: groupCell,
      render: (_value, row) => {
        if ("group" in row) {
          return null;
        }
        const { concept } = row;
        return (
          <div className={styles.cell}>
            <span className={styles.name}>
              {inNetwork(concept) ? <ExistingMark /> : null}
              {concept.name}
            </span>
            <span className={styles.muted}>{t(`${PREFIX}.verdict.${concept.verdict}`)}</span>
            {concept.aliases.length ? (
              <span className={styles.muted}>
                {t(`${PREFIX}.aliases`, {
                  names: concept.aliases.join(t("bknProject.listSeparator")),
                })}
              </span>
            ) : null}
            {sameNames.get(concept.key) ? (
              <span className={styles.warning}>
                {t(`${PREFIX}.sameName`, { name: sameNames.get(concept.key) })}
              </span>
            ) : null}
            {concept.merged.length ? (
              <span className={styles.muted}>
                {t(`${PREFIX}.merged`, {
                  names: concept.merged.map((m) => m.name).join(t("bknProject.listSeparator")),
                })}
              </span>
            ) : null}
          </div>
        );
      },
      title: t(`${PREFIX}.columns.concept`),
    },
    {
      key: "source",
      onCell: groupCell,
      render: (_value, row) => {
        if ("group" in row) {
          return null;
        }
        const { concept } = row;
        const origin = originOf(concept);
        return (
          <div className={styles.cell}>
            <span>
              {origin === "network" ? <ExistingMark /> : null}
              {origin === "knowledgeBase"
                ? t(`${PREFIX}.origin.knowledgeBaseFiles`, {
                    count: new Set(
                      concept.sources
                        .filter((source) => source.kind === "document" && source.id)
                        .map((source) => source.id),
                    ).size,
                  })
                : t(`${PREFIX}.origin.${origin}`)}
            </span>
            {bindingLine(concept)}
          </div>
        );
      },
      title: t(`${PREFIX}.columns.source`),
    },
    {
      key: "as",
      onCell: (row) => ("group" in row ? { colSpan: 0 } : { className: styles.nowrap }),
      onHeaderCell: () => ({ className: styles.nowrap }),
      render: (_value, row) => {
        if ("group" in row) {
          return null;
        }
        const { concept } = row;
        return (
          <Tooltip title={reasonOf(concept)}>
            <span className={styles.as} tabIndex={0}>
              {asLabel(concept)}
            </span>
          </Tooltip>
        );
      },
      title: (
        <Tooltip title={t(`${PREFIX}.columns.asHint`)}>
          <span>{t(`${PREFIX}.columns.as`)}</span>
        </Tooltip>
      ),
    },
    {
      key: "status",
      onCell: groupCell,
      onHeaderCell: () => ({ className: styles.nowrap }),
      render: (_value, row) => {
        if ("group" in row) {
          return null;
        }
        const status = statusOf(row.concept);
        return (
          <LightStatusTag tone={STATUS_TONE[status]}>
            {t(`${PREFIX}.status.${status}`)}
          </LightStatusTag>
        );
      },
      title: t(`${PREFIX}.columns.status`),
    },
    ...(editable
      ? [
          {
            key: "actions",
            onCell: groupCell,
            render: (_value: unknown, row: Row) => ("group" in row ? null : actions(row.concept)),
            title: t(`${PREFIX}.columns.actions`),
          },
        ]
      : []),
  ];

  const options = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ label, value }));

  const mergeTargetList = merging
    ? mergeTargets(merging.concept, concepts).filter(
        (target) => !merging.among || merging.among.includes(target.key),
      )
    : [];

  return (
    <div className={styles.tab}>
      <dl className={styles.stats} data-region="stats">
        <div className={styles.stat}>
          <dt>{t(`${PREFIX}.stats.total`)}</dt>
          <dd>{stats.total}</dd>
        </div>
        {(
          [
            ["pending", stats.pending],
            ["confirmed", stats.confirmed],
            ["excluded", stats.excluded],
          ] as const
        ).map(([status, count]) => (
          <button
            className={styles.stat}
            key={status}
            onClick={() => setFilter({ status })}
            type="button"
          >
            <dt>{t(`${PREFIX}.stats.${status}`)}</dt>
            <dd>{count}</dd>
            {status === "confirmed" && stats.network ? (
              <span className={styles.muted}>
                {t(`${PREFIX}.stats.network`, { count: stats.network })}
              </span>
            ) : null}
          </button>
        ))}
      </dl>
      <div className={styles.filters}>
        <span className={styles.muted}>{t(`${PREFIX}.filter.origin`)}</span>
        <Segmented<DataFilters["origin"]>
          onChange={(origin) => setFilter({ origin })}
          options={
            options([
              ["all", t(`${PREFIX}.filter.all`)],
              ["network", t(`${PREFIX}.origin.network`)],
              ["table", t(`${PREFIX}.origin.table`)],
              ["knowledgeBase", t(`${PREFIX}.origin.knowledgeBase`)],
            ]) as { label: string; value: DataFilters["origin"] }[]
          }
          size="small"
          value={filters.origin}
        />
        <span className={styles.muted}>{t(`${PREFIX}.filter.status`)}</span>
        <Segmented<DataFilters["status"]>
          onChange={(status) => setFilter({ status })}
          options={
            options([
              ["pending", t(`${PREFIX}.status.pending`)],
              ["confirmed", t(`${PREFIX}.status.confirmed`)],
              ["network", t(`${PREFIX}.status.network`)],
              ["excluded", t(`${PREFIX}.status.excluded`)],
              ["all", t(`${PREFIX}.filter.all`)],
            ]) as { label: string; value: DataFilters["status"] }[]
          }
          size="small"
          value={filters.status}
        />
        <Select<DataFilters["verdict"]>
          aria-label={t(`${PREFIX}.filter.verdict`)}
          className={styles.verdictFilter}
          onChange={(verdict) => setFilter({ verdict })}
          options={[
            { label: t(`${PREFIX}.filter.allVerdicts`), value: "all" },
            ...CONCEPT_VERDICTS.map((verdict) => ({
              label: t(`${PREFIX}.verdict.${verdict}`),
              value: verdict,
            })),
          ]}
          size="small"
          value={filters.verdict}
        />
        <Input.Search
          allowClear
          aria-label={t(`${PREFIX}.filter.search`)}
          className={styles.search}
          defaultValue={filters.query}
          onSearch={(query) => setFilter({ query: query.trim() })}
          placeholder={t(`${PREFIX}.filter.search`)}
          size="small"
        />
      </div>
      {selected.length ? (
        <div className={styles.selection} role="status">
          <span>{t(`${PREFIX}.selection.count`, { count: selected.length })}</span>
          {editable ? (
            <>
              <AppButton
                disabled={busy !== null}
                onClick={() => onJudgeMany(ticked, "confirm")}
                size="small"
                type="link"
              >
                {t(`${PREFIX}.confirm`)}
              </AppButton>
              <AppButton
                disabled={busy !== null}
                onClick={() => onJudgeMany(ticked, "none")}
                size="small"
                type="link"
              >
                {t(`${PREFIX}.exclude`)}
              </AppButton>
              <AppButton
                disabled={busy !== null || ticked.length < 2}
                onClick={mergeTicked}
                size="small"
                type="link"
              >
                {t(`${PREFIX}.mergeTicked.action`)}
              </AppButton>
            </>
          ) : null}
          <AppButton onClick={() => onAskAbout()} size="small" type="link">
            {t(`${PREFIX}.ask`)}
          </AppButton>
          <AppButton onClick={() => onSelected([])} size="small" type="link">
            {t(`${PREFIX}.selection.clear`)}
          </AppButton>
        </div>
      ) : null}
      <AppTable<Row>
        columns={columns}
        dataSource={rows}
        locale={{
          emptyText: concepts.some((concept) => !inNetwork(concept))
            ? t(`${PREFIX}.emptyFiltered`)
            : t(`${PREFIX}.emptyData`),
        }}
        pagination={false}
        rowKey="key"
        size="small"
      />
      {listPage.pagination ? <TablePaginationBar {...listPage.pagination} /> : null}

      <Modal
        footer={null}
        onCancel={() => setChanging(null)}
        open={changing !== null}
        title={changing ? t(`${PREFIX}.changeTitle`, { name: changing.name }) : ""}
      >
        {changing ? (
          <div className={styles.options}>
            <p className={styles.muted}>{t(`${PREFIX}.changeNow`, { as: asLabel(changing) })}</p>
            {VERDICTS_OF[changing.item?.kind ?? "none"].map((verdict) => (
              <button
                className={styles.option}
                disabled={verdict === changing.verdict && changing.state !== "pending"}
                key={verdict}
                onClick={() => {
                  setChanging(null);
                  onJudge(changing, verdict);
                }}
                type="button"
              >
                {t(`${PREFIX}.verdict.${verdict}`)}
              </button>
            ))}
          </div>
        ) : null}
      </Modal>

      <Modal
        footer={null}
        onCancel={() => setMerging(null)}
        open={merging !== null}
        title={merging ? t(`${PREFIX}.mergeTitle`, { name: merging.concept.name }) : ""}
      >
        {merging ? (
          <div className={styles.options}>
            <p className={styles.muted}>
              {t(`${PREFIX}.mergeScope.${kindOf(merging.concept)}`, {
                name: merging.concept.name,
              })}
            </p>
            {mergeTargetList.length ? (
              mergeTargetList.map((target) => (
                <button
                  className={styles.option}
                  key={target.key}
                  onClick={() => {
                    setMerging(null);
                    onSelected(selected.filter((key) => key !== merging.concept.key));
                    onMerge(merging.concept.key, target.key);
                  }}
                  type="button"
                >
                  {inNetwork(target) ? <ExistingMark /> : null}
                  <span className={styles.cell}>
                    <span className={styles.name}>{target.name}</span>
                    {bindingLine(target)}
                  </span>
                </button>
              ))
            ) : (
              <p className={styles.muted}>{t(`${PREFIX}.mergeNone`)}</p>
            )}
            <p className={styles.footNote}>
              {t(`${PREFIX}.mergeOther.${kindOf(merging.concept)}`)}
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        cancelText={t(`${PREFIX}.cross.close`)}
        okText={t(`${PREFIX}.cross.relate`)}
        onCancel={() => setCrossing(null)}
        onOk={() => {
          setCrossing(null);
          onAskAbout(true);
        }}
        open={crossing !== null}
        title={t(`${PREFIX}.cross.title`)}
      >
        {crossing ? (
          <div className={styles.options}>
            <p>{t(`${PREFIX}.cross.both`)}</p>
            {(["structured", "unstructured"] as const).map((kind) => (
              <p key={kind}>
                <span
                  className={
                    kind === "structured" ? styles.kindStructured : styles.kindUnstructured
                  }
                >
                  {t(`${PREFIX}.kind.${kind}`)}
                </span>{" "}
                {crossing
                  .filter((concept) => kindOf(concept) === kind)
                  .map((concept) => concept.name)
                  .join(t("bknProject.listSeparator"))}
              </p>
            ))}
            <p className={styles.footNote}>{t(`${PREFIX}.cross.why`)}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
