/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Select, Space, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag, type LightStatusTone } from "@/framework/ui/common/LightStatusTag";
import type { Candidate, Candidates, Draft } from "@/modules/bkn-project/types/draft";

import styles from "./DraftTables.module.css";

const PREFIX = "bknProject.model.candidates";
const PAGE_SIZE = 20;

const STATE_TONE: Record<Candidate["state"], LightStatusTone> = {
  adopted: "success",
  excluded: "neutral",
  pending: "warning",
};

/** What a candidate waits for before it can be adopted, read off the draft as it is. */
function waitsFor(draft: Draft, candidate: Candidate): "ends" | "identity" | null {
  if (candidate.kind === "object_types") {
    return draft.items.objectTypes.find((item) => item.id === candidate.id)?.needsIdentity
      ? "identity"
      : null;
  }
  const relation = draft.items.relationTypes.find((item) => item.id === candidate.id);
  const adopted = (id: string) =>
    draft.items.objectTypes.some((item) => item.id === id && item.adopted);
  return relation && (!adopted(relation.source) || !adopted(relation.target)) ? "ends" : null;
}

/**
 * The draft's object and relation types to confirm one by one, in bkn-project's order: what the
 * requirements need first, then what nobody confirmed. Each is marked with why it is first, the
 * catalog that added it, and what it waits for; opening one starts going through them in turn.
 */
export function CandidatesList({
  accepting,
  candidates,
  catalog,
  catalogIds,
  catalogNames,
  draft,
  error,
  onAcceptSuggestions,
  onCatalog,
  onOpen,
}: {
  accepting: boolean;
  /** undefined while it is read. */
  candidates: Candidates | undefined;
  /** The catalog the list keeps to; empty for all. */
  catalog: string;
  /** The project's catalogs, to keep the list to one of. */
  catalogIds: string[];
  catalogNames: Record<string, string>;
  draft: Draft;
  error: string | null;
  /** Confirms what nobody confirmed as drafting suggested it; absent where nothing can change. */
  onAcceptSuggestions?: () => void;
  onCatalog: (catalogId: string) => void;
  /** Opens a candidate where it is edited, from the list as it is ordered now. */
  onOpen?: (candidate: Candidate, order: Candidate[]) => void;
}) {
  const { t } = useTranslation();
  const items = candidates?.items ?? [];

  const columns: ColumnsType<Candidate> = [
    {
      title: t(`${PREFIX}.columns.name`),
      key: "name",
      render: (_value, record) => (
        <Space size={6} wrap>
          {onOpen ? (
            <button className={styles.link} onClick={() => onOpen(record, items)} type="button">
              {record.name}
            </button>
          ) : (
            <span>{record.name}</span>
          )}
          <LightStatusTag tone="info">{t(`${PREFIX}.kind.${record.kind}`)}</LightStatusTag>
        </Space>
      ),
    },
    {
      title: t(`${PREFIX}.columns.state`),
      key: "state",
      width: 120,
      render: (_value, record) => {
        const tag = (
          <LightStatusTag tone={STATE_TONE[record.state]}>
            {t(`${PREFIX}.state.${record.state}`)}
          </LightStatusTag>
        );
        // Why it was left out, when someone said.
        return record.state === "excluded" && record.excludeReason ? (
          <Tooltip title={record.excludeReason}>{tag}</Tooltip>
        ) : (
          tag
        );
      },
    },
    {
      title: t(`${PREFIX}.columns.marks`),
      key: "marks",
      render: (_value, record) => {
        const waiting = waitsFor(draft, record);
        const needed = record.neededBy;
        return (
          <Space size={4} wrap>
            {needed ? (
              <Tooltip
                title={
                  <ul className={styles.tooltipList}>
                    {needed.questions.map((question) => (
                      <li key={question.id}>{question.text}</li>
                    ))}
                    {needed.concepts.map((concept) => (
                      <li key={concept.id}>{t(`${PREFIX}.concept`, { term: concept.term })}</li>
                    ))}
                  </ul>
                }
              >
                <span>
                  <LightStatusTag tone="info">{t(`${PREFIX}.mark.needed`)}</LightStatusTag>
                </span>
              </Tooltip>
            ) : null}
            {record.addedByCatalog ? (
              <Tooltip title={catalogNames[record.addedByCatalog] ?? ""}>
                <span>
                  <LightStatusTag tone="neutral">{t(`${PREFIX}.mark.added`)}</LightStatusTag>
                </span>
              </Tooltip>
            ) : null}
            {waiting ? (
              <LightStatusTag tone="warning">{t(`${PREFIX}.mark.${waiting}`)}</LightStatusTag>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: t(`${PREFIX}.columns.source`),
      key: "source",
      render: (_value, record) =>
        // A row count only where bkn-project gave one; never a made-up zero.
        record.table
          ? record.table.rows === null
            ? record.table.name
            : t(`${PREFIX}.source`, { name: record.table.name, rows: record.table.rows })
          : null,
    },
  ];

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        {catalogIds.length > 1 ? (
          <Select
            aria-label={t(`${PREFIX}.catalog`)}
            onChange={onCatalog}
            options={[
              { label: t(`${PREFIX}.allCatalogs`), value: "" },
              ...catalogIds.map((id) => ({ label: catalogNames[id] ?? id, value: id })),
            ]}
            style={{ minWidth: 200 }}
            value={catalog}
          />
        ) : (
          <span />
        )}
        {onAcceptSuggestions && candidates?.counts.pending ? (
          <AppButton loading={accepting} onClick={onAcceptSuggestions}>
            {t(`${PREFIX}.acceptSuggestions`)}
          </AppButton>
        ) : null}
      </div>
      {error ? <Alert message={error} showIcon type="error" /> : null}
      <AppTable<Candidate>
        columns={columns}
        dataSource={items}
        loading={candidates === undefined && !error}
        pagination={items.length > PAGE_SIZE ? { pageSize: PAGE_SIZE } : false}
        rowKey={(record) => `${record.kind}/${record.id}`}
        size="middle"
      />
    </div>
  );
}
