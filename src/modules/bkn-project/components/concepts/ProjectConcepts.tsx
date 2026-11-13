/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Segmented, Select, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import { BknProjectKbSlot } from "@/framework/entitlement/BknProjectKbSlot";
import {
  extensionProjectConceptSource,
  extensionProjectKnowledgeBaseModel,
} from "@/framework/extension/registry";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { LightStatusTag, type LightStatusTone } from "@/framework/ui/common/LightStatusTag";
import {
  AskAiSidebar,
  type RevisionPreview,
} from "@/modules/bkn-project/components/ai/AskAiSidebar";
import { ClampedText } from "@/modules/bkn-project/components/ClampedText";
import { ReadStalledNotice } from "@/modules/bkn-project/components/ReadStalledNotice";
import { draftErrorCode } from "@/modules/bkn-project/components/draft/edit";
import { ExistingMark } from "@/modules/bkn-project/components/draft/ExistingMark";
import { requestFailureText } from "@/modules/bkn-project/components/publish/messages";
import { askConcepts } from "@/modules/bkn-project/services/ask.service";
import {
  projectErrorCode,
  understandCatalogs,
} from "@/modules/bkn-project/services/publish.service";
import {
  editItem,
  extractRequirementConcepts,
  getRequirements,
  POLL_FAILURE_LIMIT,
} from "@/modules/bkn-project/services/requirements.service";
import {
  acceptDraftSuggestions,
  DRAFT_POLL_MS,
  generateDraft,
  getConcepts,
  getDraft,
  judgeConcept,
  mergeConcept,
  reviseConcept,
} from "@/modules/bkn-project/services/draft.service";
import type {
  Concept,
  ConceptRevision,
  Concepts,
  ConceptState,
  ConceptVerdict,
} from "@/modules/bkn-project/types/concepts";
import { CONCEPT_STATES } from "@/modules/bkn-project/types/concepts";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { Project } from "@/modules/bkn-project/types/project";
import type { Requirements } from "@/modules/bkn-project/types/requirements";

import { conceptsInModel, modelVerdict } from "./inModel";
import styles from "./ProjectConcepts.module.css";

const PREFIX = "bknProject.concepts";

/** The key prefix of a requirement concept no draft item is. */
const REQUIREMENT_CONCEPT = "requirement_concepts/";

/** The key prefix of a catalog table's concept before drafting: judged once drafting makes it an item. */
const TABLE_CONCEPT = "table_concepts/";

/** A catalog table's concept listed before drafting. */
function tableCandidate(concept: Concept) {
  return concept.key.startsWith(TABLE_CONCEPT);
}

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
  // A concept of the knowledge-base files may be a value list, as drafting can suggest.
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

/** A concept of what the network already has: read only here. */
function inNetwork(concept: Concept) {
  return concept.sources.some((source) => source.kind === "network");
}

type Filter = "all" | ConceptState;

/** Why a judgment or merge was refused, and whether reading the page again can help. */
type Refusal = { reload: boolean; text: string };

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
  // Extracting a model from the knowledge-base files, where the edition has it.
  const KnowledgeBaseModel = extensionProjectKnowledgeBaseModel();
  const [concepts, setConcepts] = useState<Concepts | undefined>(undefined);
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  // The specification, for the run extracting the documents' concepts; null when unread.
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Reads failed in a row, of the page and of the specification's run: following a run stops
  // at the limit and the page offers to refresh.
  const [failures, setFailures] = useState(0);
  const [runFailures, setRunFailures] = useState(0);
  const [reads, setReads] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  // Why the last judgment or merge was refused, kept on the page until it is dealt with.
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  // Ask AI beside the list; what it proposes is adopted over the concepts as they are now.
  const [asking, setAsking] = useState(false);
  const current = useRef<Concepts | undefined>(undefined);
  useEffect(() => {
    current.current = concepts;
  }, [concepts]);
  const canEdit = ownerIsCaller && !project.archived;

  // Tells whether the page was read: a failed read keeps what was shown before.
  const load = useCallback(async (): Promise<boolean> => {
    try {
      const [nextDraft, next, nextRequirements] = await Promise.all([
        getDraft(project.id),
        getConcepts(project.id),
        // The run only adds to the page: a failed read keeps the run as last read, so a run
        // going on is still followed.
        getRequirements(project.id).catch(() => undefined),
      ]);
      setDraft(nextDraft);
      setConcepts(next);
      if (nextRequirements !== undefined) {
        setRequirements(nextRequirements);
      }
      setFailures(0);
      setRunFailures((count) => (nextRequirements === undefined ? count + 1 : 0));
      setLoadError(null);
      return true;
    } catch (error) {
      setLoadError(requestFailureText(t, error));
      setFailures((count) => count + 1);
      return false;
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
  const following = drafting || extractingRequirements;
  // Only the extraction is read from the specification: its failed reads leave drafting alone.
  const stalled =
    (following && failures >= POLL_FAILURE_LIMIT) ||
    (extractingRequirements && runFailures >= POLL_FAILURE_LIMIT);
  useEffect(() => {
    if (!following || stalled) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(), DRAFT_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [following, load, reads, stalled]);
  const stalledNotice = stalled ? <ReadStalledNotice onRefresh={() => void load()} /> : null;

  // A refused change is not replayed: the page says why until it is dealt with. A draft someone
  // else changed meanwhile is read again on request; an item of a knowledge-base selection no
  // longer in use is refused however often it is read, so reading again is not offered.
  const refused = (error: unknown, failedKey: string) => {
    const code = projectErrorCode(error);
    if (
      draftErrorCode(error) === "Stale" ||
      code === "Requirement.Stale" ||
      code === "Requirement.Drafting"
    ) {
      setRefusal({ reload: true, text: t(`${PREFIX}.stale`) });
    } else if (draftErrorCode(error) === "DocumentSourceChanged") {
      setRefusal({ reload: false, text: t(`${PREFIX}.sourceChanged`) });
    } else {
      setRefusal({ reload: false, text: requestFailureText(t, error, `${PREFIX}.${failedKey}`) });
    }
  };

  // The draft moved on with what was written. Reading it only tells whether it is being
  // extracted, so a failed read keeps the one before: what was written stands either way.
  const readDraftAgain = () => {
    getDraft(project.id).then(setDraft, () => undefined);
  };

  const judge = async (concept: Concept, verdict: ConceptVerdict) => {
    // A table's concept before drafting is no item and no requirement concept: nothing judges it yet.
    if (!concepts || tableCandidate(concept)) {
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
        setRefusal(null);
        await load();
      } catch (error) {
        refused(error, "judgeFailed");
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
      setRefusal(null);
      readDraftAgain();
    } catch (error) {
      refused(error, "judgeFailed");
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
      setRefusal(null);
      readDraftAgain();
    } catch (error) {
      refused(error, "mergeFailed");
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
      setRefusal(null);
      await load();
    } catch (error) {
      refused(error, "judgeFailed");
    } finally {
      setBusy(null);
    }
  };

  // Adopting a change Ask AI proposed records it as the person's decision, as judging does.
  const adoptRevision = async (revision: ConceptRevision): Promise<boolean> => {
    const read = current.current;
    if (!read) {
      return false;
    }
    try {
      const next = await reviseConcept(project.id, read.draftUpdateTime, revision);
      current.current = next;
      setConcepts(next);
      setRefusal(null);
      readDraftAgain();
      return true;
    } catch (error) {
      refused(error, "revise.failed");
      return false;
    }
  };

  // How a change reads against the concepts as they are now.
  const revisionPreview = (revision: ConceptRevision): RevisionPreview => {
    const list = current.current?.concepts ?? [];
    const find = (key: string) => list.find((concept) => concept.key === key);
    const named = (name: string, description: string) =>
      description ? t(`${PREFIX}.revise.named`, { description, name }) : name;
    const separator = t("bknProject.listSeparator");
    if (revision.field === "add") {
      return {
        after: t(`${PREFIX}.revise.added`, {
          concept: named(revision.value.name, revision.value.description),
          verdict: t(`${PREFIX}.verdict.${revision.value.verdict}`),
        }),
        before: "",
        label: t(`${PREFIX}.revise.add`),
      };
    }
    const concept = find(revision.value.key);
    const name = concept?.name ?? "";
    const label = t(`${PREFIX}.revise.${revision.field}`, { name });
    switch (revision.field) {
      case "define":
        return {
          after: named(revision.value.name, revision.value.description),
          before: named(name, concept?.description ?? ""),
          label,
        };
      case "verdict":
        return {
          after: t(`${PREFIX}.verdict.${revision.value.verdict}`),
          before: concept ? t(`${PREFIX}.verdict.${concept.verdict}`) : "",
          label,
        };
      case "merge":
        return {
          after: t(`${PREFIX}.revise.into`, {
            name: find(revision.value.into)?.name ?? revision.value.into,
          }),
          before: t(`${PREFIX}.revise.kept`),
          label,
        };
      case "split":
        return {
          after: revision.value.parts.map((part) => part.name).join(separator),
          before: name,
          label,
        };
      case "aliases":
        return {
          after: revision.value.aliases.join(separator) || t(`${PREFIX}.revise.nothing`),
          before: concept?.aliases.join(separator) || t(`${PREFIX}.revise.nothing`),
          label,
        };
    }
  };

  // Extracting again over decisions discards them, so it asks first, as the modeling page does.
  // Tables semantic understanding has not named are understood first, as far as the person may:
  // the concepts take the business names once it finishes.
  const extract = async (discardDecisions: boolean) => {
    setBusy("extract");
    if (concepts?.notUnderstood) {
      await understandCatalogs(project.id).catch(() => undefined);
    }
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
      network: new Set<string>(),
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

  // The knowledge-base files are a concept source: extracting from them is started here.
  const documentSource =
    ConceptSource && kbMode === "enabled" ? (
      <BknProjectKbSlot>
        <ConceptSource canEdit={canEdit} onChanged={() => void load()} projectId={project.id} />
      </BknProjectKbSlot>
    ) : KnowledgeBaseModel ? (
      <BknProjectKbSlot>
        <KnowledgeBaseModel
          canEdit={canEdit && !drafting && busy === null}
          draftUpdateTime={draft?.updateTime ?? 0}
          onChanged={() => void load()}
          projectId={project.id}
        />
      </BknProjectKbSlot>
    ) : null;

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
      <div className={styles.page}>
        {stalledNotice}
        {documentSource}
        <EmptyStatePanel
          action={
            <AppButton onClick={onGoToResources} type="primary">
              {t(`${PREFIX}.empty.action`)}
            </AppButton>
          }
          description={t(`${PREFIX}.empty.description`)}
          title={t(`${PREFIX}.empty.title`)}
        />
      </div>
    );
  }

  const ready = concepts.draftUpdateTime > 0;
  const editable = canEdit && ready && busy === null;
  // A requirement concept is judged in the specification, while no run rewrites it.
  // What the network already has is judged in the knowledge network, not here.
  // A table's concept before drafting is judged once extracting makes it an item.
  const judgeable = (concept: Concept) =>
    concept.item
      ? editable && !inNetwork(concept)
      : !tableCandidate(concept) &&
        canEdit &&
        busy === null &&
        concepts.requirementUpdateTime > 0 &&
        !extractingRequirements;
  const candidates = !ready && concepts.concepts.some(tableCandidate);
  const pending = concepts.counts.pending ?? 0;
  const total = concepts.concepts.length;
  const shown =
    filter === "all" ? concepts.concepts : concepts.concepts.filter((c) => c.state === filter);
  const standing = concepts.concepts;
  const inModel = conceptsInModel(concepts.concepts);

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
      if (tableCandidate(concept)) {
        return <span className={styles.muted}>{t(`${PREFIX}.destination.candidate`)}</span>;
      }
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
          <span className={styles.name}>
            {inNetwork(concept) ? <ExistingMark /> : null}
            {concept.ai ? (
              <span
                aria-label={t(`${PREFIX}.aiMark`)}
                className={styles.aiMark}
                role="img"
                title={t(`${PREFIX}.aiMark`)}
              />
            ) : null}
            {concept.name}
          </span>
          {concept.aliases.length ? (
            <span className={styles.muted}>
              {t(`${PREFIX}.aliases`, {
                names: concept.aliases.join(t("bknProject.listSeparator")),
              })}
            </span>
          ) : null}
          {concept.description ? (
            <ClampedText className={styles.muted} text={concept.description} />
          ) : null}
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
              {source.kind === "network" ? <ExistingMark /> : null}
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
      render: (_value, concept) => {
        // What semantic understanding said of the table is the reason it is what it is.
        const because =
          concept.suggestedBecause === "table_understood" && concept.description
            ? t(`${PREFIX}.understoodWith`, { description: concept.description })
            : t(`${PREFIX}.because.${becauseKey(concept.suggestedBecause)}`);
        // Drafting found it but left it out: say so, and what it could be judged instead.
        const leftOut =
          concept.state === "pending" &&
          concept.item &&
          !concept.item.adopted &&
          concept.verdict === "none" &&
          concept.suggested !== "none";
        return (
          <ClampedText
            className={styles.muted}
            text={
              concept.reason ||
              (leftOut
                ? t(`${PREFIX}.notAdopted`, {
                    because,
                    verdict: t(`${PREFIX}.verdict.${concept.suggested}`),
                  })
                : because)
            }
          />
        );
      },
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
                {concept.state === "pending" && !inNetwork(concept) && !tableCandidate(concept) ? (
                  <AppButton
                    aria-label={t(`${PREFIX}.confirmOf`, { name: concept.name })}
                    onClick={() => void judge(concept, concept.verdict)}
                    size="small"
                  >
                    {t(`${PREFIX}.confirm`)}
                  </AppButton>
                ) : null}
                {/* A concept others were merged into stays where it is, as does the network's. */}
                {concept.merged.length || inNetwork(concept) || tableCandidate(concept) ? null : (
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
    <div className={styles.layout}>
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
              {ready ? (
                <AppButton aria-pressed={asking} onClick={() => setAsking(!asking)}>
                  {t(`${PREFIX}.ask`)}
                </AppButton>
              ) : null}
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
                {t(`${PREFIX}.${ready ? "reextract" : "extract"}`)}
              </AppButton>
            </span>
          ) : (
            <span className={styles.muted}>{t(`${PREFIX}.readOnly`)}</span>
          )}
        </div>

        {refusal ? (
          <Alert
            action={
              refusal.reload ? (
                <AppButton
                  // Polling reads the page too: only reading it on request settles the refusal, and
                  // only once the read succeeds.
                  onClick={() => void load().then((read) => read && setRefusal(null))}
                  size="small"
                >
                  {t(`${PREFIX}.reload`)}
                </AppButton>
              ) : undefined
            }
            closable
            message={refusal.text}
            onClose={() => setRefusal(null)}
            showIcon
            type="warning"
          />
        ) : null}

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
          {/* As the modeling page counts it: what drafting adopted is in until someone takes it out. */}
          <div className={styles.stat}>
            <dt>{t(`${PREFIX}.stats.inModel`)}</dt>
            <dd>{inModel.count}</dd>
            {inModel.unconfirmed ? (
              <span className={styles.muted}>
                {t(`${PREFIX}.stats.inModelPending`, { count: inModel.unconfirmed })}
              </span>
            ) : null}
          </div>
        </dl>

        {drafting ? <Alert message={t(`${PREFIX}.drafting`)} showIcon type="info" /> : null}
        {candidates && !drafting ? (
          <Alert message={t(`${PREFIX}.candidates`)} showIcon type="info" />
        ) : null}
        {concepts.notUnderstood ? (
          <Alert
            action={
              <AppButton onClick={onGoToResources} size="small">
                {t(`${PREFIX}.understandAction`)}
              </AppButton>
            }
            message={t(`${PREFIX}.${canEdit ? "notUnderstood" : "notUnderstoodReadOnly"}`, {
              count: concepts.notUnderstood,
            })}
            showIcon
            type="info"
          />
        ) : null}
        {stalledNotice}
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

        {documentSource}

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
      {asking && canEdit && ready ? (
        <div className={styles.side}>
          <AskAiSidebar<ConceptRevision>
            adopt={adoptRevision}
            askWith={(request) => askConcepts({ ...request, projectId: project.id })}
            kind="concepts"
            onClose={() => setAsking(false)}
            preview={revisionPreview}
            projectId={project.id}
            subtitle={t("bknProject.model.ask.subtitle.concepts", { count: total })}
          />
        </div>
      ) : null}
    </div>
  );
}
