/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal, Segmented, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag, type LightStatusTone } from "@/framework/ui/common/LightStatusTag";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { ExistingMark } from "@/modules/bkn-project/components/draft/ExistingMark";
import { useListPage } from "@/modules/bkn-project/components/useListPage";
import type {
  Concept,
  RequirementConceptMatch,
  RequirementMatchState,
  RequirementMatchTarget,
} from "@/modules/bkn-project/types/concepts";

import {
  inNetwork,
  kindOf,
  objectVerdict,
  type RequirementFilter,
  requirementShown,
  statusOf,
  targetOf,
} from "./conceptView";
import styles from "./ProjectConcepts.module.css";

const PREFIX = "bknProject.concepts.requirement";

const STATE_TONE: Record<RequirementMatchState, LightStatusTone> = {
  confirmed: "success",
  excluded: "neutral",
  pending: "warning",
  unmatched: "error",
};

const FILTERS: RequirementFilter[] = [
  "all",
  "pending",
  "structured",
  "unstructured",
  "unmatched",
  "excluded",
];

/**
 * The requirement concepts: what the requirement documents name, each matched to an object of the
 * data, a table's or a knowledge-base extraction's, or to nothing yet. They never become objects
 * of their own: a match is confirmed, changed or left out; one matched to nothing is settled by
 * adding the data, matching it by hand or leaving it out.
 */
export function RequirementConcepts({
  busy,
  concepts,
  editable,
  filter,
  knowledgeBase,
  onAskAgain,
  onFilter,
  onGoToCatalogs,
  onGoToKnowledgeBase,
  onMatch,
  requirements,
}: {
  busy: string | null;
  /** The data side's concepts, which a requirement concept may be matched to. */
  concepts: Concept[];
  editable: boolean;
  filter: RequirementFilter;
  /** Whether the knowledge base is a source, to add data to. */
  knowledgeBase: boolean;
  /** Asks AI to match the requirement concept again. */
  onAskAgain: (requirement: RequirementConceptMatch) => void;
  onFilter: (filter: RequirementFilter) => void;
  onGoToCatalogs: () => void;
  onGoToKnowledgeBase: () => void;
  onMatch: (
    requirement: RequirementConceptMatch,
    match: { excluded?: boolean; target: RequirementMatchTarget | null },
  ) => void;
  requirements: RequirementConceptMatch[];
}) {
  const { t } = useTranslation();
  const [choosing, setChoosing] = useState<RequirementConceptMatch | null>(null);
  const shown = useMemo(
    () => requirements.filter(requirementShown(filter)),
    [requirements, filter],
  );
  const listPage = useListPage(shown.length, filter);
  const byKey = new Map(concepts.map((concept) => [concept.key, concept]));
  const choices = concepts.filter(
    (concept) =>
      objectVerdict(concept.verdict) &&
      statusOf(concept) !== "excluded" &&
      statusOf(concept) !== "candidate" &&
      targetOf(concept) !== null,
  );
  // Before extracting, a table's candidate is an object to match to as well.
  const candidates = concepts.filter(
    (concept) => statusOf(concept) === "candidate" && targetOf(concept) !== null,
  );
  const options = [...choices, ...candidates];

  const kindLabel = (binding: Concept["binding"]) =>
    t(`${PREFIX}.kind.${binding?.kind === "dataset" ? "unstructured" : "structured"}`);

  const matchCell = (requirement: RequirementConceptMatch) => {
    if (requirement.state === "excluded") {
      return <span className={styles.muted}>{t(`${PREFIX}.excluded`)}</span>;
    }
    if (!requirement.match) {
      return (
        <div className={styles.cell}>
          <LightStatusTag tone="error">{t(`${PREFIX}.unmatched`)}</LightStatusTag>
          <span className={styles.warning}>
            {t(`${PREFIX}.notInData`)}
            {requirement.basis ? (
              <Tooltip title={requirement.basis}>
                <span className={styles.as} tabIndex={0}>
                  {t(`${PREFIX}.why`)}
                </span>
              </Tooltip>
            ) : null}
          </span>
          <span>
            <AppButton onClick={onGoToCatalogs} size="small" type="link">
              {t(`${PREFIX}.addCatalog`)}
            </AppButton>
            {knowledgeBase ? (
              <AppButton onClick={onGoToKnowledgeBase} size="small" type="link">
                {t(`${PREFIX}.addKnowledgeBase`)}
              </AppButton>
            ) : null}
          </span>
        </div>
      );
    }
    const matched = byKey.get(requirement.match.key);
    return (
      <div className={styles.cell}>
        <span>
          {matched && inNetwork(matched) ? <ExistingMark /> : null}
          <span
            className={
              requirement.match.binding?.kind === "dataset"
                ? styles.kindUnstructured
                : styles.kindStructured
            }
          >
            {kindLabel(requirement.match.binding)}
          </span>{" "}
          <span className={styles.name}>{requirement.match.name}</span>
        </span>
        <Tooltip title={requirement.basis || undefined}>
          <span className={styles.muted} tabIndex={requirement.basis ? 0 : undefined}>
            {t(`${PREFIX}.by.${requirement.by || "name"}`)}
            {requirement.basis ? t(`${PREFIX}.basisHint`) : null}
          </span>
        </Tooltip>
      </div>
    );
  };

  const actions = (requirement: RequirementConceptMatch) => {
    const disabled = busy !== null;
    const target = requirement.match?.target ?? null;
    const action = (label: string, onClick: () => void, aria?: string) => (
      <AppButton
        aria-label={aria}
        disabled={disabled}
        key={label}
        onClick={onClick}
        size="small"
        type="link"
      >
        {label}
      </AppButton>
    );
    const change = action(
      t(`${PREFIX}.change`),
      () => setChoosing(requirement),
      t(`${PREFIX}.changeOf`, { name: requirement.term }),
    );
    const exclude = action(
      t(`${PREFIX}.exclude`),
      () => onMatch(requirement, { excluded: true, target }),
      t(`${PREFIX}.excludeOf`, { name: requirement.term }),
    );
    switch (requirement.state) {
      case "excluded":
        return action(t(`${PREFIX}.restore`), () => onMatch(requirement, { target }));
      case "unmatched":
        return (
          <span className={styles.actions}>
            {change}
            {exclude}
            {action(t(`${PREFIX}.askAgain`), () => onAskAgain(requirement))}
          </span>
        );
      case "confirmed":
        return (
          <span className={styles.actions}>
            {change}
            {exclude}
          </span>
        );
      case "pending":
        return (
          <span className={styles.actions}>
            {target
              ? action(
                  t(`${PREFIX}.confirm`),
                  () => onMatch(requirement, { target }),
                  t(`${PREFIX}.confirmOf`, {
                    name: requirement.term,
                    target: requirement.match?.name,
                  }),
                )
              : null}
            {change}
            {exclude}
          </span>
        );
    }
  };

  const columns: ColumnsType<RequirementConceptMatch> = [
    {
      key: "term",
      render: (_value, requirement) => (
        <div className={styles.cell}>
          <span className={styles.name}>{requirement.term}</span>
          {requirement.quote ? (
            <span className={styles.quote}>
              {t(`${PREFIX}.quote`, { quote: requirement.quote })}
            </span>
          ) : null}
        </div>
      ),
      title: t(`${PREFIX}.columns.term`),
    },
    {
      key: "match",
      render: (_value, requirement) => matchCell(requirement),
      title: t(`${PREFIX}.columns.match`),
    },
    {
      key: "state",
      onHeaderCell: () => ({ className: styles.nowrap }),
      render: (_value, requirement) => (
        <LightStatusTag tone={STATE_TONE[requirement.state]}>
          {t(`${PREFIX}.state.${requirement.state}`)}
        </LightStatusTag>
      ),
      title: t(`${PREFIX}.columns.state`),
    },
    ...(editable
      ? [
          {
            key: "actions",
            render: (_value: unknown, requirement: RequirementConceptMatch) => actions(requirement),
            title: t(`${PREFIX}.columns.actions`),
          },
        ]
      : []),
  ];

  const option = (concept: Concept) => {
    const target = targetOf(concept)!;
    const current =
      choosing?.match?.target?.kind === target.kind && choosing.match.target.id === target.id;
    return (
      <button
        aria-pressed={current}
        className={styles.option}
        key={concept.key}
        onClick={() => {
          const requirement = choosing!;
          setChoosing(null);
          onMatch(requirement, { target });
        }}
        type="button"
      >
        {inNetwork(concept) ? <ExistingMark /> : null}
        <span className={styles.cell}>
          <span className={styles.name}>{concept.name}</span>
          <span className={styles.muted}>{concept.binding?.name}</span>
        </span>
      </button>
    );
  };

  return (
    <div className={styles.tab}>
      <p className={styles.muted}>{t(`${PREFIX}.intro`)}</p>
      <Segmented<RequirementFilter>
        onChange={onFilter}
        options={FILTERS.map((value) => ({
          label: t(`${PREFIX}.filter.${value}`, {
            count: requirements.filter(requirementShown(value)).length,
          }),
          value,
        }))}
        size="small"
        value={filter}
      />
      <AppTable<RequirementConceptMatch>
        columns={columns}
        dataSource={listPage.slice(shown)}
        locale={{ emptyText: t(`${PREFIX}.emptyFiltered`) }}
        pagination={false}
        rowKey="id"
        size="small"
      />
      {listPage.pagination ? <TablePaginationBar {...listPage.pagination} /> : null}
      <Modal
        footer={null}
        onCancel={() => setChoosing(null)}
        open={choosing !== null}
        title={choosing ? t(`${PREFIX}.chooseTitle`, { name: choosing.term }) : ""}
      >
        {choosing ? (
          <div className={styles.options}>
            {choosing.quote ? (
              <p className={styles.quote}>{t(`${PREFIX}.quote`, { quote: choosing.quote })}</p>
            ) : null}
            {(["structured", "unstructured"] as const).map((kind) => {
              const list = options.filter((concept) => kindOf(concept) === kind);
              return list.length ? (
                <div className={styles.cell} key={kind}>
                  <span className={styles.muted}>{t(`${PREFIX}.group.${kind}`)}</span>
                  {list.map(option)}
                </div>
              ) : null;
            })}
            <span className={styles.muted}>{t(`${PREFIX}.group.none`)}</span>
            <button
              aria-pressed={choosing.state === "unmatched"}
              className={styles.option}
              onClick={() => {
                const requirement = choosing;
                setChoosing(null);
                onMatch(requirement, { target: null });
              }}
              type="button"
            >
              <span className={styles.cell}>
                <span className={styles.name}>{t(`${PREFIX}.unmatched`)}</span>
                <span className={styles.muted}>{t(`${PREFIX}.unmatchedHint`)}</span>
              </span>
            </button>
            <p className={styles.footNote}>{t(`${PREFIX}.noNewObject`)}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
