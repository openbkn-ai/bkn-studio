/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Segmented, Select, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import { BknProjectKbSlot } from "@/framework/entitlement/BknProjectKbSlot";
import { extensionProjectConceptSource } from "@/framework/extension/registry";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { LightStatusTag, type LightStatusTone } from "@/framework/ui/common/LightStatusTag";
import { draftErrorCode } from "@/modules/bkn-project/components/draft/edit";
import { requestFailureText } from "@/modules/bkn-project/components/publish/messages";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import {
  editItem,
  extractRequirementConcepts,
  getRequirements,
} from "@/modules/bkn-project/services/requirements.service";
import {
  acceptDraftSuggestions,
  DRAFT_POLL_MS,
  generateDraft,
  getConcepts,
  getDraft,
  judgeConcept,
  mergeConcept,
} from "@/modules/bkn-project/services/draft.service";
import type {
  Concept,
  Concepts,
  ConceptState,
  ConceptVerdict,
} from "@/modules/bkn-project/types/concepts";
import { CONCEPT_STATES } from "@/modules/bkn-project/types/concepts";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { Project } from "@/modules/bkn-project/types/project";
import type { Requirements } from "@/modules/bkn-project/types/requirements";

import styles from "./ProjectConcepts.module.css";

const PREFIX = "bknProject.concepts";

/** The key prefix of a requirement concept no draft item is. */
const REQUIREMENT_CONCEPT = "requirement_concepts/";

/** The specification's category of a verdict, as a requirement concept is judged there. */
const categoryOf = (verdict: ConceptVerdict) => (verdict === "none" ? "not_ontology" : verdict);

const STATE_TONE: Record<ConceptState, LightStatusTone> = {
  blocked: "warning",
  in_model: "success",
  judged: "info",
  pending: "neutral",
};

/** The verdicts that fit a concept: what its item can be, or anything for one with no item. */
const VERDICTS_OF: Record<"none" | NonNullable<Concept["item"]>["kind"], ConceptVerdict[]> = {
  none: ["object", "event", "property", "relation", "kinetic", "none"],
  object_types: ["object", "event", "property", "kinetic", "none"],
  relation_types: ["relation", "none"],
  value_types: ["values", "property", "none"],
};

/** Whether the verdict makes the concept's item part of the concept model. */
function modelVerdict(verdict: ConceptVerdict) {
  return ["object", "event", "relation", "values"].includes(verdict);
}

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
    "code_table",
    "foreign_key",
    "name_match",
    "stem_match",
    "link_table",
    "manual",
  ].includes(code)
    ? code
    : "other";
}

type Filter = "all" | ConceptState;

/**
 * Concept extraction: what the project's tables, knowledge-base samples and requirement
 * documents hold, each concept judged as an object, an event, a property, a value list, a
 * relation, kinetic, or not included. Judging is adopting: the concept's item goes into the
 * concept model or out of it at once; one that cannot go in yet says what it waits for.
 */
export function ProjectConcepts({
  onGoToKinetic,
  onGoToModel,
  onGoToResources,
  onOpenItem,
  ownerIsCaller,
  project,
}: {
  /** Opens kinetic modeling, where what is judged kinetic is implemented. */
  onGoToKinetic: () => void;
  onGoToModel: () => void;
  onGoToResources: () => void;
  /** Opens a concept's item on the concept modeling page, where what blocks it is settled. */
  onOpenItem: (item: NonNullable<Concept["item"]>) => void;
  ownerIsCaller: boolean;
  project: Project;
}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const kbMode = useBknProjectKbMode();
  const ConceptSource = extensionProjectConceptSource();
  const [concepts, setConcepts] = useState<Concepts | undefined>(undefined);
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  // The specification, for the run extracting the documents' concepts; null when unread.
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reads, setReads] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const canEdit = ownerIsCaller && !project.archived;

  const load = useCallback(async () => {
    try {
      const [nextDraft, next, nextRequirements] = await Promise.all([
        getDraft(project.id),
        getConcepts(project.id),
        // The run only adds to the page: a failed read shows none.
        getRequirements(project.id).catch(() => null),
      ]);
      setDraft(nextDraft);
      setConcepts(next);
      setRequirements(nextRequirements);
      setLoadError(null);
    } catch (error) {
      setLoadError(requestFailureText(t, error));
    } finally {
      setReads((count) => count + 1);
    }
  }, [project.id, t]);
  useEffect(() => {
    void load();
  }, [load]);

  // Extracting runs in the background, from the tables or from the requirement documents: read
  // again until it ends.
  const drafting = draft?.status === "drafting";
  const conceptsRun = requirements?.spec.conceptsRun;
  const extractingRequirements = conceptsRun?.status === "running";
  useEffect(() => {
    if (!drafting && !extractingRequirements) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(), DRAFT_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [drafting, extractingRequirements, load, reads]);

  // A change made on a draft someone else changed meanwhile is not replayed: read it again.
  const refused = async (error: unknown, failedKey: string) => {
    const code = projectErrorCode(error);
    if (
      draftErrorCode(error) === "Stale" ||
      code === "Requirement.Stale" ||
      code === "Requirement.Drafting"
    ) {
      message.warning(t(`${PREFIX}.stale`));
      await load();
    } else {
      message.error(requestFailureText(t, error) || t(failedKey));
    }
  };

  // The draft moved on with what was written. Reading it only tells whether it is being
  // extracted, so a failed read keeps the one before: what was written stands either way.
  const readDraftAgain = () => {
    getDraft(project.id).then(setDraft, () => undefined);
  };

  const judge = async (concept: Concept, verdict: ConceptVerdict) => {
    if (!concepts) {
      return;
    }
    setBusy(concept.key);
    // A requirement concept no item is is judged in the specification, as its category.
    if (!concept.item) {
      try {
        await editItem(
          project.id,
          "concepts",
          concept.key.slice(REQUIREMENT_CONCEPT.length),
          { category: categoryOf(verdict) },
          concepts.requirementUpdateTime,
        );
        await load();
      } catch (error) {
        await refused(error, `${PREFIX}.judgeFailed`);
      } finally {
        setBusy(null);
      }
      return;
    }
    try {
      setConcepts(
        await judgeConcept(project.id, concepts.draftUpdateTime, {
          key: concept.key,
          reason: "",
          verdict,
        }),
      );
      readDraftAgain();
    } catch (error) {
      await refused(error, `${PREFIX}.judgeFailed`);
    } finally {
      setBusy(null);
    }
  };

  const merge = async (key: string, into = "") => {
    if (!concepts) {
      return;
    }
    setBusy(key);
    try {
      setConcepts(await mergeConcept(project.id, concepts.draftUpdateTime, key, into));
      readDraftAgain();
    } catch (error) {
      await refused(error, `${PREFIX}.mergeFailed`);
    } finally {
      setBusy(null);
    }
  };

  // Extracting the requirement documents' concepts keeps what a person edited of them.
  const extractRequirements = async () => {
    setBusy("requirements");
    try {
      setRequirements(await extractRequirementConcepts(project.id));
      message.success(t(`${PREFIX}.requirements.started`));
    } catch (error) {
      const code = projectErrorCode(error);
      message.error(
        code === "Requirement.NoDocuments"
          ? t(`${PREFIX}.requirements.noDocuments`)
          : code === "Requirement.Drafting"
            ? t(`${PREFIX}.requirements.busy`)
            : requestFailureText(t, error),
      );
    } finally {
      setBusy(null);
    }
  };

  // Judging every pending concept at once is asked first: what it skips stays for a person.
  const acceptAll = () => {
    if (!concepts) {
      return;
    }
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t(`${PREFIX}.acceptContent`),
      okText: t(`${PREFIX}.acceptAll`),
      onOk: () => acceptSuggestions(concepts.draftUpdateTime),
      title: t(`${PREFIX}.acceptTitle`),
    });
  };

  const acceptSuggestions = async (updateTime: number) => {
    setBusy("accept");
    try {
      const { accepted, skipped } = await acceptDraftSuggestions(project.id, updateTime);
      message.success(
        skipped
          ? t(`${PREFIX}.acceptedSkipped`, { accepted, count: skipped })
          : t(`${PREFIX}.accepted`, { count: accepted }),
      );
      await load();
    } catch (error) {
      await refused(error, `${PREFIX}.judgeFailed`);
    } finally {
      setBusy(null);
    }
  };

  // Extracting again over decisions discards them, so it asks first, as the modeling page does.
  const extract = async (discardDecisions: boolean) => {
    setBusy("extract");
    try {
      setDraft(await generateDraft(project.id, discardDecisions ? { discardDecisions } : {}));
    } catch (error) {
      if (!discardDecisions && draftErrorCode(error) === "HasDecisions") {
        const fresh = await getDraft(project.id).catch(() => null);
        void modal.confirm({
          cancelText: t("common.cancel"),
          content: fresh
            ? t("bknProject.model.regenerateConfirm.content", {
                count: fresh.items.decisions.length,
              })
            : t("bknProject.model.regenerateConfirm.contentUncounted"),
          okButtonProps: { danger: true },
          okText: t("bknProject.model.regenerateConfirm.ok"),
          onOk: () => extract(true),
          title: t("bknProject.model.regenerateConfirm.title"),
        });
      } else {
        message.error(requestFailureText(t, error));
      }
    } finally {
      setBusy(null);
    }
  };

  const list = concepts?.concepts;
  const sources = useMemo(() => {
    const seen = {
      document: new Set<string>(),
      requirement: new Set<string>(),
      table: new Set<string>(),
    };
    for (const concept of list ?? []) {
      for (const source of concept.sources) {
        if (source.id) {
          seen[source.kind].add(source.id);
        }
      }
    }
    return seen;
  }, [list]);

  if (loadError && concepts === undefined) {
    return (
      <Alert
        action={
          <AppButton onClick={() => void load()} size="small">
            {t("common.retry")}
          </AppButton>
        }
        description={loadError}
        message={t(`${PREFIX}.loadFailed`)}
        showIcon
        type="error"
      />
    );
  }
  if (concepts === undefined || draft === undefined) {
    return (
      <div className={styles.center}>
        <Spin />
      </div>
    );
  }
  if (!concepts.concepts.length && !drafting) {
    return (
      <EmptyStatePanel
        action={
          <AppButton onClick={onGoToResources} type="primary">
            {t(`${PREFIX}.empty.action`)}
          </AppButton>
        }
        description={t(`${PREFIX}.empty.description`)}
        title={t(`${PREFIX}.empty.title`)}
      />
    );
  }

  const ready = concepts.draftUpdateTime > 0;
  const editable = canEdit && ready && busy === null;
  // A requirement concept is judged in the specification, while no run rewrites it.
  const judgeable = (concept: Concept) =>
    concept.item
      ? editable
      : canEdit && busy === null && concepts.requirementUpdateTime > 0 && !extractingRequirements;
  const pending = concepts.counts.pending ?? 0;
  const total = concepts.concepts.length;
  const shown =
    filter === "all" ? concepts.concepts : concepts.concepts.filter((c) => c.state === filter);
  const standing = concepts.concepts;

  const destination = (concept: Concept) => {
    if (concept.state === "blocked" && concept.blocked) {
      return (
        <span className={styles.cell}>
          <span>{t(`${PREFIX}.blocked.${concept.blocked}`)}</span>
          {concept.item ? (
            <AppButton onClick={() => onOpenItem(concept.item!)} size="small" type="link">
              {t(`${PREFIX}.blocked.action`)}
            </AppButton>
          ) : null}
        </span>
      );
    }
    if (modelVerdict(concept.verdict)) {
      return concept.item ? (
        <AppButton onClick={() => onOpenItem(concept.item!)} size="small" type="link">
          {t(`${PREFIX}.destination.model`)}
        </AppButton>
      ) : (
        <span className={styles.muted}>{t(`${PREFIX}.destination.noItem`)}</span>
      );
    }
    if (concept.verdict === "kinetic") {
      return (
        <AppButton onClick={onGoToKinetic} size="small" type="link">
          {t(`${PREFIX}.destination.kinetic`)}
        </AppButton>
      );
    }
    return <span className={styles.muted}>{t(`${PREFIX}.destination.${concept.verdict}`)}</span>;
  };

  const columns: ColumnsType<Concept> = [
    {
      key: "concept",
      render: (_value, concept) => (
        <div className={styles.cell}>
          <span className={styles.name}>{concept.name}</span>
          {concept.description ? <span className={styles.muted}>{concept.description}</span> : null}
          {concept.merged.length ? (
            <span className={styles.muted}>
              {t(`${PREFIX}.merged`, {
                names: concept.merged.map((m) => m.name).join(t("bknProject.listSeparator")),
              })}
              {editable
                ? concept.merged.map((m) => (
                    <AppButton
                      key={m.key}
                      onClick={() => void merge(m.key)}
                      size="small"
                      type="link"
                    >
                      {t(`${PREFIX}.unmerge`, { name: m.name })}
                    </AppButton>
                  ))
                : null}
            </span>
          ) : null}
        </div>
      ),
      title: t(`${PREFIX}.columns.concept`),
    },
    {
      key: "sources",
      render: (_value, concept) => (
        <div className={styles.cell}>
          {concept.sources.map((source, index) => (
            <span key={`${source.kind}-${source.id}-${index}`}>
              {t(`${PREFIX}.source.${source.kind}`, { name: source.name })}
            </span>
          ))}
        </div>
      ),
      title: t(`${PREFIX}.columns.sources`),
    },
    {
      key: "verdict",
      render: (_value, concept) =>
        judgeable(concept) ? (
          <Select<ConceptVerdict>
            aria-label={t(`${PREFIX}.verdictOf`, { name: concept.name })}
            className={styles.verdict}
            loading={busy === concept.key}
            onChange={(verdict) => void judge(concept, verdict)}
            options={VERDICTS_OF[concept.item?.kind ?? "none"].map((verdict) => ({
              label: t(`${PREFIX}.verdict.${verdict}`),
              value: verdict,
            }))}
            size="small"
            value={concept.verdict}
          />
        ) : (
          <LightStatusTag tone="info">{t(`${PREFIX}.verdict.${concept.verdict}`)}</LightStatusTag>
        ),
      title: t(`${PREFIX}.columns.verdict`),
    },
    {
      key: "reason",
      render: (_value, concept) => (
        <span className={styles.muted}>
          {concept.reason || t(`${PREFIX}.because.${becauseKey(concept.suggestedBecause)}`)}
        </span>
      ),
      title: t(`${PREFIX}.columns.reason`),
    },
    {
      key: "destination",
      render: (_value, concept) => destination(concept),
      title: t(`${PREFIX}.columns.destination`),
    },
    {
      key: "state",
      onHeaderCell: () => ({ className: styles.nowrap }),
      render: (_value, concept) => (
        <LightStatusTag tone={STATE_TONE[concept.state]}>
          {t(`${PREFIX}.state.${concept.state}`)}
        </LightStatusTag>
      ),
      title: t(`${PREFIX}.columns.state`),
    },
    ...(editable
      ? [
          {
            key: "actions",
            render: (_value: unknown, concept: Concept) => (
              <span className={styles.actions}>
                {/* The suggestion is right as it is: confirming it judges it so. */}
                {concept.state === "pending" ? (
                  <AppButton
                    aria-label={t(`${PREFIX}.confirmOf`, { name: concept.name })}
                    onClick={() => void judge(concept, concept.verdict)}
                    size="small"
                  >
                    {t(`${PREFIX}.confirm`)}
                  </AppButton>
                ) : null}
                {/* A concept others were merged into stays where it is. */}
                {concept.merged.length ? null : (
                  <Select<string>
                    aria-label={t(`${PREFIX}.mergeIntoOf`, { name: concept.name })}
                    className={styles.merge}
                    onChange={(into) => void merge(concept.key, into)}
                    options={standing
                      .filter((other) => other.key !== concept.key)
                      .map((other) => ({ label: other.name, value: other.key }))}
                    placeholder={t(`${PREFIX}.mergeInto`)}
                    showSearch
                    optionFilterProp="label"
                    size="small"
                    value={null}
                  />
                )}
              </span>
            ),
            title: t(`${PREFIX}.columns.actions`),
          },
        ]
      : []),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <span className={styles.muted}>
          {kbMode === "hidden"
            ? t(`${PREFIX}.summaryCore`, {
                requirements: sources.requirement.size,
                tables: sources.table.size,
              })
            : t(`${PREFIX}.summary`, {
                documents: sources.document.size,
                requirements: sources.requirement.size,
                tables: sources.table.size,
              })}
        </span>
        {canEdit ? (
          <span className={styles.actions}>
            <AppButton
              disabled={extractingRequirements || (busy !== null && busy !== "requirements")}
              loading={busy === "requirements"}
              onClick={() => void extractRequirements()}
            >
              {t(`${PREFIX}.requirements.extract`)}
            </AppButton>
            <AppButton
              disabled={drafting || (busy !== null && busy !== "extract")}
              loading={busy === "extract"}
              onClick={() => void extract(false)}
            >
              {t(`${PREFIX}.reextract`)}
            </AppButton>
          </span>
        ) : (
          <span className={styles.muted}>{t(`${PREFIX}.readOnly`)}</span>
        )}
      </div>

      {/* The funnel: where the concepts come from, what they were judged, how many are in. */}
      <dl className={styles.stats} data-region="funnel">
        {[
          ["sources", sources.table.size + sources.document.size + sources.requirement.size],
          ["concepts", total],
        ].map(([key, value]) => (
          <div className={styles.stat} key={key}>
            <dt>{t(`${PREFIX}.stats.${key}`)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        {(["object", "event", "property", "values", "relation", "kinetic", "none"] as const).map(
          (verdict) => (
            <div className={styles.stat} key={verdict}>
              <dt>{t(`${PREFIX}.verdict.${verdict}`)}</dt>
              <dd>{concepts.counts[`verdict:${verdict}`] ?? 0}</dd>
            </div>
          ),
        )}
        <div className={styles.stat}>
          <dt>{t(`${PREFIX}.stats.inModel`)}</dt>
          <dd>{concepts.counts.in_model ?? 0}</dd>
        </div>
      </dl>

      {drafting ? <Alert message={t(`${PREFIX}.drafting`)} showIcon type="info" /> : null}
      {extractingRequirements ? (
        <Alert message={t(`${PREFIX}.requirements.running`)} showIcon type="info" />
      ) : conceptsRun?.status === "failed" ? (
        // What the last run that ended extracted stands: say so, rather than an empty page.
        <Alert
          message={t(
            conceptsRun.extracted
              ? `${PREFIX}.requirements.failedKept`
              : `${PREFIX}.requirements.failed`,
          )}
          showIcon
          type="warning"
        />
      ) : conceptsRun?.extracted && conceptsRun.stale ? (
        <Alert message={t(`${PREFIX}.requirements.stale`)} showIcon type="info" />
      ) : null}
      {pending && ready ? (
        <Alert
          action={
            <span className={styles.actions}>
              {canEdit ? (
                <AppButton
                  disabled={busy !== null && busy !== "accept"}
                  loading={busy === "accept"}
                  onClick={acceptAll}
                  size="small"
                  type="primary"
                >
                  {t(`${PREFIX}.acceptAll`)}
                </AppButton>
              ) : null}
              <AppButton onClick={onGoToModel} size="small">
                {t(`${PREFIX}.goToModel`)}
              </AppButton>
            </span>
          }
          description={t(`${PREFIX}.pendingAdopted`)}
          message={t(`${PREFIX}.pending`, { count: pending })}
          showIcon
          type="info"
        />
      ) : null}

      {ConceptSource && kbMode === "enabled" ? (
        <BknProjectKbSlot>
          <ConceptSource canEdit={canEdit} onChanged={() => void load()} projectId={project.id} />
        </BknProjectKbSlot>
      ) : null}

      <Segmented<Filter>
        onChange={setFilter}
        options={[
          { label: `${t(`${PREFIX}.filter.all`)} ${total}`, value: "all" },
          ...CONCEPT_STATES.map((state) => ({
            label: `${t(`${PREFIX}.state.${state}`)} ${concepts.counts[state] ?? 0}`,
            value: state,
          })),
        ]}
        value={filter}
      />
      <AppTable<Concept>
        columns={columns}
        dataSource={shown}
        pagination={false}
        rowKey="key"
        size="small"
      />
    </div>
  );
}
