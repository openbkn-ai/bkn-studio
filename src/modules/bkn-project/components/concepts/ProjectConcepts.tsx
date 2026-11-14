/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin, Tabs, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import { BknProjectKbSlot } from "@/framework/entitlement/BknProjectKbSlot";
import {
  extensionProjectConceptSource,
  extensionProjectKnowledgeBaseModel,
  type ProjectKnowledgeBaseModelStatus,
} from "@/framework/extension/registry";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import {
  AskAiSidebar,
  type RevisionPreview,
} from "@/modules/bkn-project/components/ai/AskAiSidebar";
import { ReadStalledNotice } from "@/modules/bkn-project/components/ReadStalledNotice";
import { draftErrorCode } from "@/modules/bkn-project/components/draft/edit";
import { requestFailureText } from "@/modules/bkn-project/components/publish/messages";
import { conceptsRunErrorText } from "@/modules/bkn-project/components/requirements/requirementMessages";
import type { ResourceTab } from "@/modules/bkn-project/types/workspace";
import { askConcepts } from "@/modules/bkn-project/services/ask.service";
import {
  DRAFT_POLL_MS,
  getConcepts,
  getDraft,
  judgeConcept,
  mergeConcept,
  reviseConcept,
} from "@/modules/bkn-project/services/draft.service";
import { getUnderstanding, projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import {
  getRequirements,
  listDocuments,
  matchRequirementConcept,
  POLL_FAILURE_LIMIT,
} from "@/modules/bkn-project/services/requirements.service";
import type {
  Concept,
  ConceptRevision,
  Concepts,
  ConceptVerdict,
  RequirementConceptMatch,
  RequirementMatchTarget,
} from "@/modules/bkn-project/types/concepts";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { Project } from "@/modules/bkn-project/types/project";
import type { Requirements } from "@/modules/bkn-project/types/requirements";

import { ConceptSources, type SourceFacts } from "./ConceptSources";
import {
  dataConcepts,
  inNetwork,
  kindOf,
  originOf,
  type RequirementFilter,
  statusOf,
  unmatched,
} from "./conceptView";
import { DataConcepts, type DataFilters } from "./DataConcepts";
import styles from "./ProjectConcepts.module.css";
import { RequirementConcepts } from "./RequirementConcepts";
import {
  CONCEPT_SOURCES,
  type ConceptSourceKey,
  type KnowledgeBaseOutcome,
  useConceptRun,
} from "./useConceptRun";

const PREFIX = "bknProject.concepts";

/** Why a judgment or merge was refused, and whether reading the page again can help. */
type Refusal = { reload: boolean; text: string };

/** What the page reads besides the concepts: how much each source holds. */
type SourceCounts = { catalogs: number; documents: number | null; tables: number | null };

/** How many unmatched names the notice lists before it says how many more. */
const NOTICE_NAMES = 5;

/**
 * Concept extraction: the concepts of the project's sources, the data tables, the requirement
 * documents and, where the edition has them, the knowledge-base files. One action extracts from
 * them in turn, each source showing its progress; one source can be extracted alone. The data
 * side's concepts are judged, merged within their kind of data, or left out; the requirement
 * concepts are matched to the data, never objects of their own. Ask AI stays beside the list.
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
  onGoToResources: (tab?: ResourceTab) => void;
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
  const [counts, setCounts] = useState<SourceCounts>({
    catalogs: project.catalogIds.length,
    documents: null,
    tables: null,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  // Reads failed in a row, of the page and of the specification's run: following a run stops
  // at the limit and the page offers to refresh.
  const [failures, setFailures] = useState(0);
  const [runFailures, setRunFailures] = useState(0);
  const [reads, setReads] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [tab, setTab] = useState<"data" | "requirement">("data");
  const [filters, setFilters] = useState<DataFilters>({
    origin: "all",
    query: "",
    status: "pending",
    verdict: "all",
  });
  const filterChosen = useRef(false);
  const [requirementFilter, setRequirementFilter] = useState<RequirementFilter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  // What Ask AI is asked about besides the ticked concepts, such as a requirement concept.
  const [askRefs, setAskRefs] = useState<string[]>([]);
  // The AI assistant opens when asked for, as on kinetic modeling and business scenarios: docked
  // open, it would squeeze the list.
  const [asking, setAsking] = useState(false);
  // What failed in the last run, by source, as words.
  const [runFailed, setRunFailed] = useState<Partial<Record<ConceptSourceKey, string>>>({});
  const [kbStatus, setKbStatus] = useState<ProjectKnowledgeBaseModelStatus | null>(null);
  const [kbRequest, setKbRequest] = useState(0);
  const kbStatusRef = useRef<ProjectKnowledgeBaseModelStatus | null>(null);
  const kbWaiter = useRef<{
    request: number;
    resolve: (outcome: KnowledgeBaseOutcome) => void;
  } | null>(null);
  const current = useRef<Concepts | undefined>(undefined);
  useEffect(() => {
    current.current = concepts;
  }, [concepts]);
  const canEdit = ownerIsCaller && !project.archived;
  const knowledgeBaseShown = Boolean(KnowledgeBaseModel) && kbMode !== "hidden";

  // Tells whether the page was read: a failed read keeps what was shown before.
  const load = useCallback(async (): Promise<boolean> => {
    try {
      const [nextDraft, next, nextRequirements, documents, understanding] = await Promise.all([
        getDraft(project.id),
        getConcepts(project.id),
        // The run only adds to the page: a failed read keeps the run as last read, so a run
        // going on is still followed.
        getRequirements(project.id).catch(() => undefined),
        listDocuments(project.id).catch(() => undefined),
        getUnderstanding(project.id).catch(() => undefined),
      ]);
      setDraft(nextDraft);
      setConcepts(next);
      if (nextRequirements !== undefined) {
        setRequirements(nextRequirements);
      }
      setCounts((before) => ({
        catalogs: understanding?.length ?? before.catalogs,
        documents: documents?.length ?? before.documents,
        tables: understanding
          ? understanding.reduce((sum, catalog) => sum + catalog.tables.length, 0)
          : before.tables,
      }));
      // At first the list shows what waits for a person, when anything does.
      if (!filterChosen.current) {
        filterChosen.current = true;
        if (!dataConcepts(next.concepts).some((concept) => statusOf(concept) === "pending")) {
          setFilters((before) => ({ ...before, status: "all" }));
        }
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

  // Extracting the knowledge-base files is the edition's: the page asks for a start and waits for
  // the panel to say it ended.
  const onKbStatus = useCallback((status: ProjectKnowledgeBaseModelStatus) => {
    kbStatusRef.current = status;
    setKbStatus(status);
    const waiter = kbWaiter.current;
    if (waiter && status.handledRequest >= waiter.request && status.state !== "running") {
      kbWaiter.current = null;
      waiter.resolve(status.state === "failed" ? "failed" : "done");
    }
  }, []);
  const extractKnowledgeBase = useCallback((): Promise<KnowledgeBaseOutcome> => {
    if (!kbStatusRef.current?.debugFiles) {
      return Promise.resolve("skipped");
    }
    return new Promise((resolve) => {
      setKbRequest((request) => {
        kbWaiter.current = { request: request + 1, resolve };
        return request + 1;
      });
    });
  }, []);

  const { run, start } = useConceptRun({
    catalogIds: project.catalogIds,
    extractKnowledgeBase,
    notUnderstood: Boolean(concepts?.notUnderstood),
    onSourceDone: load,
    projectId: project.id,
  });

  // Extracting runs in the background, here or from another page: read again until it ends.
  const drafting = draft?.status === "drafting";
  const conceptsRun = requirements?.spec.conceptsRun;
  const extractingRequirements = conceptsRun?.status === "running";
  const following = !run && (drafting || extractingRequirements);
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

  // A refused change is not replayed: the page says why until it is dealt with.
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
    } else if (draftErrorCode(error) === "MergeKindMismatch") {
      setRefusal({ reload: false, text: t(`${PREFIX}.mergeKindRefused`) });
    } else if (draftErrorCode(error) === "CrossBindingMerge") {
      setRefusal({ reload: false, text: t(`${PREFIX}.cross.refused`) });
    } else {
      setRefusal({ reload: false, text: requestFailureText(t, error, `${PREFIX}.${failedKey}`) });
    }
  };

  // The draft moved on with what was written; a failed read keeps the one before.
  const readDraftAgain = () => {
    getDraft(project.id).then(setDraft, () => undefined);
  };

  const judge = async (concept: Concept, verdict: ConceptVerdict) => {
    if (!concepts) {
      return;
    }
    setBusy(concept.key);
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

  // Confirming or leaving out the ticked concepts one after another, each over the draft the last
  // one wrote; what waits for no one, or is the network's, is skipped.
  const judgeMany = async (list: Concept[], mode: "confirm" | "none") => {
    let read = current.current;
    if (!read) {
      return;
    }
    setBusy("many");
    let done = 0;
    try {
      for (const concept of list) {
        const status = statusOf(concept);
        if (
          status === "network" ||
          status === "candidate" ||
          (mode === "confirm" && status !== "pending") ||
          (mode === "none" && status === "excluded")
        ) {
          continue;
        }
        read = await judgeConcept(project.id, read.draftUpdateTime, {
          key: concept.key,
          reason: "",
          verdict: mode === "confirm" ? concept.verdict : "none",
        });
        done++;
      }
      setRefusal(null);
      setSelected([]);
      message.success(
        t(`${PREFIX}.selection.${mode === "confirm" ? "confirmed" : "excluded"}`, {
          count: done,
        }),
      );
    } catch (error) {
      refused(error, "judgeFailed");
    } finally {
      setConcepts(read);
      readDraftAgain();
      setBusy(null);
    }
  };

  const merge = async (key: string, into: string) => {
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

  const matchRequirement = async (
    requirement: RequirementConceptMatch,
    match: { excluded?: boolean; target: RequirementMatchTarget | null },
  ) => {
    if (!requirements) {
      return;
    }
    setBusy(requirement.id);
    try {
      setRequirements(
        await matchRequirementConcept(project.id, requirement.id, match, requirements.updateTime),
      );
      setRefusal(null);
      await load();
    } catch (error) {
      refused(error, "requirement.matchFailed");
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
            name: find(revision.value.into)?.name ?? t(`${PREFIX}.revise.unknown`),
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

  const data = useMemo(() => dataConcepts(concepts?.concepts ?? []), [concepts]);
  const requirementList = concepts?.requirements ?? [];
  const waiting = unmatched(requirementList);

  const runSources = async (keys: ConceptSourceKey[]) => {
    setRunFailed({});
    const outcome = await start(keys);
    const failed: Partial<Record<ConceptSourceKey, string>> = {};
    for (const key of keys) {
      const turn = outcome[key];
      if (turn?.state === "failed") {
        const what = t(
          `${PREFIX}.run.failed.${key === "document" && turn.error === "busy" ? "busy" : key}`,
        );
        // A requirement run that ended failed says why, as the row does once read again.
        const [code, why] = (turn.error ?? "").split(":", 2);
        failed[key] =
          key === "document" && code === "requirements"
            ? t(`${PREFIX}.run.withReason`, { reason: conceptsRunErrorText(t, why ?? ""), what })
            : what;
      }
    }
    setRunFailed(failed);
    filterChosen.current = true;
    setFilters((before) => ({ ...before, status: "pending" }));
    const names = (Object.keys(failed) as ConceptSourceKey[])
      .map((key) => t(`${PREFIX}.sources.kind.${key}`))
      .join(t("bknProject.listSeparator"));
    if (names) {
      message.warning(t(`${PREFIX}.run.someFailed`, { names }));
    } else {
      message.success(t(`${PREFIX}.run.${keys.length > 1 ? "doneAll" : "doneOne"}`));
    }
  };

  // The sources a run takes: those that hold something to extract.
  const available = (key: ConceptSourceKey) =>
    key === "table"
      ? counts.tables !== 0
      : key === "document"
        ? counts.documents !== 0
        : knowledgeBaseShown && Boolean(kbStatus?.debugFiles);

  const askRun = (keys: ConceptSourceKey[], extractedAny = false) => {
    const one = keys.length === 1;
    const count = (key: ConceptSourceKey) =>
      key === "table"
        ? (counts.tables ?? 0)
        : key === "document"
          ? (counts.documents ?? 0)
          : (kbStatus?.debugFiles ?? 0);
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: (
        <div className={styles.cell}>
          {one ? (
            <span>{t(`${PREFIX}.run.oneContent`)}</span>
          ) : (
            <>
              <span>{t(`${PREFIX}.run.allIntro`)}</span>
              <ol className={styles.runList}>
                {keys.map((key) => (
                  <li key={key}>{t(`${PREFIX}.run.step.${key}`, { count: count(key) })}</li>
                ))}
              </ol>
            </>
          )}
          <span className={styles.footNote}>{t(`${PREFIX}.run.keeps`)}</span>
        </div>
      ),
      okText: t(`${PREFIX}.run.start`),
      onOk: () => {
        void runSources(keys);
      },
      title: one
        ? t(`${PREFIX}.run.oneTitle`, { name: t(`${PREFIX}.sources.kind.${keys[0]}`) })
        : t(`${PREFIX}.run.${extractedAny ? "againTitle" : "allTitle"}`),
    });
  };

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

  const ready = concepts.draftUpdateTime > 0;
  const editable = canEdit && ready && busy === null && !run;
  const runnable = CONCEPT_SOURCES.filter(available);
  const extracted = ready || Boolean(conceptsRun?.extracted) || kbStatus?.state === "succeeded";
  // With nothing to extract from at all: a knowledge base the edition has is a source too.
  const nothing =
    !data.length &&
    !requirementList.length &&
    counts.tables === 0 &&
    counts.documents === 0 &&
    !knowledgeBaseShown;
  const stalledNotice = stalled ? <ReadStalledNotice onRefresh={() => void load()} /> : null;

  const produced = (origin: "table" | "knowledgeBase") =>
    data.filter((concept) => originOf(concept) === origin && statusOf(concept) !== "candidate")
      .length;
  const conceptsRunRecord = requirements?.spec.runs.concepts;
  const tableFacts: SourceFacts = {
    count: counts.tables,
    extracted: ready,
    extractedAt: ready ? (draft?.createTime ?? null) : null,
    failed: runFailed.table ?? (draft?.status === "failed" ? t(`${PREFIX}.run.failed.table`) : ""),
    produced: produced("table"),
    running: drafting,
  };
  const documentFacts: SourceFacts = {
    count: counts.documents,
    extracted: Boolean(conceptsRun?.extracted),
    extractedAt: conceptsRunRecord?.status === "ready" ? conceptsRunRecord.updateTime : null,
    // Why the documents' last extraction failed and what to do; parts it left while the documents
    // stay as they were are read alone next time. Documents changed since are all read again.
    failed:
      runFailed.document ??
      (conceptsRun?.status === "failed"
        ? t(`${PREFIX}.run.withReason`, {
            reason: conceptsRunErrorText(t, conceptsRun.error),
            what: t(`${PREFIX}.run.failed.document`),
          })
        : conceptsRun?.status === "ready" && conceptsRun.pendingParts > 0 && !conceptsRun.stale
          ? t(`${PREFIX}.run.withReason`, {
              reason: conceptsRunErrorText(t, conceptsRun.error),
              what: t(`${PREFIX}.run.partial`, { count: conceptsRun.pendingParts }),
            })
          : ""),
    produced: requirementList.length,
    running: extractingRequirements,
  };
  const knowledgeBaseFacts: SourceFacts | null = knowledgeBaseShown
    ? {
        count: kbStatus?.debugFiles ?? null,
        extracted: kbStatus?.state === "succeeded",
        extractedAt: kbStatus?.finishTime ?? null,
        failed:
          runFailed.knowledgeBase ??
          (kbStatus?.state === "failed" ? t(`${PREFIX}.run.failed.knowledgeBase`) : ""),
        produced: produced("knowledgeBase"),
        running: kbStatus?.state === "running",
      }
    : null;
  const network = data.filter(inNetwork);

  const knowledgeBasePanel =
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
          onStatus={onKbStatus}
          projectId={project.id}
          runRequest={kbRequest}
          variant="status"
        />
      </BknProjectKbSlot>
    ) : null;

  // One notice at most, for what needs the person: tables still named by their table names, then
  // requirement concepts nothing in the data is yet.
  const notice = run ? null : concepts.notUnderstood ? (
    <Alert
      message={t(`${PREFIX}.notice.${canEdit ? "notUnderstood" : "notUnderstoodReadOnly"}`, {
        count: concepts.notUnderstood,
      })}
      showIcon
      type="info"
    />
  ) : waiting.length ? (
    <Alert
      action={
        <AppButton
          onClick={() => {
            setTab("requirement");
            setRequirementFilter("unmatched");
          }}
          size="small"
        >
          {t(`${PREFIX}.notice.settle`)}
        </AppButton>
      }
      message={t(`${PREFIX}.notice.unmatched`, {
        count: waiting.length,
        names:
          waiting
            .slice(0, NOTICE_NAMES)
            .map((requirement) => requirement.term)
            .join(t("bknProject.listSeparator")) +
          (waiting.length > NOTICE_NAMES
            ? t(`${PREFIX}.notice.more`, { count: waiting.length - NOTICE_NAMES })
            : ""),
      })}
      showIcon
      type="warning"
    />
  ) : null;

  const viewSource = (key: ConceptSourceKey) => {
    if (key === "document") {
      setTab("requirement");
      setRequirementFilter("all");
      return;
    }
    setTab("data");
    setFilters({
      origin: key === "table" ? "table" : "knowledgeBase",
      query: "",
      status: "all",
      verdict: "all",
    });
  };

  const tickedNames = data
    .filter((concept) => selected.includes(concept.key))
    .map((concept) => concept.name);
  const refs = [...tickedNames, ...askRefs.filter((name) => !tickedNames.includes(name))];
  const openAsk = (names: string[] = []) => {
    setAskRefs(names);
    setAsking(true);
  };
  const askReady = canEdit && ready;

  const askButton = askReady ? (
    <AppButton
      aria-pressed={asking}
      onClick={() => setAsking(!asking)}
      type={asking ? "default" : "primary"}
    >
      {selected.length
        ? t("bknProject.ask.button.selected", { count: selected.length })
        : t("bknProject.ask.button.label")}
    </AppButton>
  ) : canEdit ? (
    <Tooltip title={t(`${PREFIX}.askAfterExtracting`)}>
      <span>
        <AppButton disabled>{t("bknProject.ask.button.label")}</AppButton>
      </span>
    </Tooltip>
  ) : null;

  if (nothing && !run) {
    return (
      <div className={styles.page}>
        {stalledNotice}
        <EmptyStatePanel
          action={
            <AppButton onClick={() => onGoToResources()} type="primary">
              {t(`${PREFIX}.empty.action`)}
            </AppButton>
          }
          description={t(`${PREFIX}.empty.description`)}
          title={t(`${PREFIX}.empty.title`)}
        />
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.page}>
        <section className={styles.card}>
          <div className={styles.head}>
            <p className={styles.intro}>{t(`${PREFIX}.intro`)}</p>
            <span className={styles.actions}>
              {canEdit ? (
                <AppButton
                  disabled={!runnable.length || busy !== null || drafting || extractingRequirements}
                  loading={run !== null}
                  onClick={() => askRun(runnable, extracted)}
                  type="primary"
                >
                  {t(`${PREFIX}.${run ? "running" : extracted ? "reextract" : "extract"}`)}
                </AppButton>
              ) : (
                <span className={styles.muted}>{t(`${PREFIX}.readOnly`)}</span>
              )}
              <AppButton onClick={onGoToModel}>{t(`${PREFIX}.goToModel`)}</AppButton>
              {askButton}
            </span>
          </div>
          {notice}
        </section>

        {refusal ? (
          <Alert
            action={
              refusal.reload ? (
                <AppButton
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
        {stalledNotice}

        <ConceptSources
          canRun={canEdit && busy === null}
          catalogs={counts.catalogs}
          documents={documentFacts}
          knowledgeBase={knowledgeBaseFacts}
          knowledgeBasePanel={knowledgeBasePanel}
          knowledgeBaseStatus={kbStatus}
          network={{
            structured: network.filter((concept) => kindOf(concept) === "structured").length,
            total: network.length,
            unstructured: network.filter((concept) => kindOf(concept) === "unstructured").length,
          }}
          notUnderstood={concepts.notUnderstood}
          onGoToResources={() => onGoToResources()}
          onRun={(key) => askRun([key])}
          onView={viewSource}
          run={run}
          tables={tableFacts}
          unmatched={waiting.length}
        />

        <section className={styles.card}>
          <Tabs
            activeKey={tab}
            items={[
              {
                children: (
                  <DataConcepts
                    busy={busy}
                    concepts={data}
                    editable={editable}
                    filters={filters}
                    onAskAbout={(relation) =>
                      openAsk(relation ? [t(`${PREFIX}.cross.askRelation`)] : [])
                    }
                    onFilters={setFilters}
                    onGoToKinetic={onGoToKinetic}
                    onJudge={(concept, verdict) => void judge(concept, verdict)}
                    onJudgeMany={(list, mode) => void judgeMany(list, mode)}
                    onMerge={(key, into) => void merge(key, into)}
                    onOpenItem={onOpenItem}
                    onSelected={setSelected}
                    selected={selected}
                  />
                ),
                key: "data",
                label: t(`${PREFIX}.tabs.data`, { count: data.length }),
              },
              {
                children: requirementList.length ? (
                  <RequirementConcepts
                    busy={busy}
                    concepts={data}
                    editable={canEdit && busy === null && !run && !extractingRequirements}
                    filter={requirementFilter}
                    knowledgeBase={knowledgeBaseShown}
                    onAskAgain={askReady ? (requirement) => openAsk([requirement.term]) : undefined}
                    onFilter={setRequirementFilter}
                    onGoToCatalogs={() => onGoToResources("catalogs")}
                    onGoToKnowledgeBase={() => onGoToResources("knowledge-base")}
                    onMatch={(requirement, match) => void matchRequirement(requirement, match)}
                    requirements={requirementList}
                  />
                ) : (
                  <p className={styles.empty}>{t(`${PREFIX}.requirement.empty`)}</p>
                ),
                key: "requirement",
                label: (
                  <span>
                    {t(`${PREFIX}.tabs.requirement`, { count: requirementList.length })}
                    {waiting.length ? (
                      <span className={styles.tabBadge}>
                        {t(`${PREFIX}.tabs.unmatched`, { count: waiting.length })}
                      </span>
                    ) : null}
                  </span>
                ),
              },
            ]}
            onChange={(key) => setTab(key as "data" | "requirement")}
          />
        </section>
      </div>
      {asking && askReady ? (
        <div className={styles.side}>
          <AskAiSidebar<ConceptRevision>
            adopt={adoptRevision}
            askWith={(request) =>
              askConcepts({
                ...request,
                projectId: project.id,
                question: refs.length
                  ? t(`${PREFIX}.askAbout`, {
                      names: refs.join(t("bknProject.listSeparator")),
                      question: request.question,
                    })
                  : request.question,
              })
            }
            kind="concepts"
            onClose={() => setAsking(false)}
            preview={revisionPreview}
            projectId={project.id}
            subtitle={t("bknProject.model.ask.subtitle.concepts", { count: data.length })}
            top={
              refs.length ? (
                <p className={styles.refs}>
                  {t(`${PREFIX}.refs`, { names: refs.join(t("bknProject.listSeparator")) })}
                </p>
              ) : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}
