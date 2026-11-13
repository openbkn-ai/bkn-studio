/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Segmented, Spin } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { AskSources } from "@/modules/bkn-project/components/ai/AskSources";
import { RequirementAskPanel } from "@/modules/bkn-project/components/ai/RequirementAskPanel";
import { useFlash } from "@/modules/bkn-project/components/ai/useFlash";
import { ReadStalledNotice } from "@/modules/bkn-project/components/ReadStalledNotice";
import { DocumentViewer } from "@/modules/bkn-project/components/requirements/Citations";
import {
  Asking,
  Citing,
  Editing,
  type SpecAsking,
  type SpecEditing,
} from "@/modules/bkn-project/components/requirements/citing";
import {
  ChoiceDialog,
  ConflictDialog,
  type DraftedItem,
  ItemDialog,
} from "@/modules/bkn-project/components/requirements/RequirementDialogs";
import {
  draftErrorText,
  refusedInputs,
  requirementErrorText,
} from "@/modules/bkn-project/components/requirements/requirementMessages";
import {
  QuestionsView,
  RejectedNote,
  RulesView,
  ScenariosView,
} from "@/modules/bkn-project/components/requirements/RequirementSpecViews";
import { RequirementsExport } from "@/modules/bkn-project/components/requirements/RequirementsExport";
import { getDraft } from "@/modules/bkn-project/services/draft.service";
import { getLogicNeeds } from "@/modules/bkn-project/services/kinetic.service";
import {
  projectErrorCode,
  projectErrorDetails,
} from "@/modules/bkn-project/services/publish.service";
import {
  addItem,
  decideChoice,
  draftRequirements,
  editItem,
  getNetworkBackground,
  getRequirements,
  listDocuments,
  NETWORK_DOCUMENT_ID,
  POLL_FAILURE_LIMIT,
  removeItem,
  REQUIREMENTS_POLL_MS,
  resolveConflict,
  reviewRequirements,
} from "@/modules/bkn-project/services/requirements.service";
import type { AskItemKind } from "@/modules/bkn-project/types/conversations";
import type { LogicNeedView, LogicNetworkItem } from "@/modules/bkn-project/types/kinetic";
import type { Project } from "@/modules/bkn-project/types/project";
import type {
  RequirementChoice,
  RequirementConflict,
  RequirementDocument,
  RequirementItemKind,
  RequirementItemRef,
  Requirements,
} from "@/modules/bkn-project/types/requirements";
import type { ResourceTab } from "@/modules/bkn-project/types/workspace";

/** The dialog the owner has open, if any. */
type Dialog =
  | { itemId: string | null; kind: RequirementItemKind; type: "item" }
  | { choice: RequirementChoice; type: "choice" }
  | { conflict: RequirementConflict; type: "conflict" };

import ask from "../ai/RequirementAsk.module.css";
import styles from "./Requirements.module.css";

const PREFIX = "bknProject.requirements";

/** Object types from which generating takes minutes rather than a minute or two. */
const LARGE_MODEL_OBJECT_TYPES = 10;
/**
 * How long, in minutes, generating runs before the page says how long it has taken so far; past
 * the longest a run is kept, the start time read is not trusted and nothing is said of it.
 */
const LONG_DRAFTING_MINUTES = 2;
const LONGEST_DRAFTING_MINUTES = 60;

// The concepts are judged on the concept extraction page.
const TABS = ["questions", "scenarios", "rules"] as const;
type Tab = (typeof TABS)[number];

/**
 * What the knowledge network is for: the specification drafted from the requirement documents —
 * scenarios, the questions that accept the network, candidate concepts and rules, with the
 * conflicts and choices the owner settles. The documents themselves are managed with the
 * project's other inputs, on the requirements and resources page.
 */
export function ProjectRequirements({
  onGoToKinetic,
  onGoToModel,
  onGoToResources,
  ownerIsCaller,
  project,
}: {
  /** Opens kinetic modeling, where the kinetic needs are. */
  onGoToKinetic?: () => void;
  /** Opens ontology modeling, where the object types scenarios are generated from are adopted. */
  onGoToModel: () => void;
  /** Opens the requirements and resources page, where the documents are uploaded. */
  onGoToResources: (tab?: ResourceTab) => void;
  ownerIsCaller: boolean;
  project: Project;
}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  // undefined while loading, null before the first drafting.
  const [requirements, setRequirements] = useState<Requirements | null | undefined>(undefined);
  const [documents, setDocuments] = useState<RequirementDocument[]>([]);
  // The kinetic needs as the live network implements them; null when they could not be read.
  const [logicNeeds, setLogicNeeds] = useState<LogicNeedView[] | null>(null);
  // What the network had before the project, which AI reads.
  const [networkItems, setNetworkItems] = useState<LogicNetworkItem[]>([]);
  // The confirmed model's object types; null while unread.
  const [adoptedObjectTypes, setAdoptedObjectTypes] = useState<number | null>(null);
  // The network has a description or SKILL.md, which generating and Ask AI read.
  const [background, setBackground] = useState(false);
  // Ask AI beside the lists, with the scenarios and questions ticked to ask about.
  const [asking, setAsking] = useState(false);
  const [selected, setSelected] = useState<{ id: string; kind: "questions" | "scenarios" }[]>([]);
  const [flash, flashItems] = useFlash();
  // Reads failed in a row: following a drafting stops at the limit and the page offers to refresh.
  const [failures, setFailures] = useState(0);
  const [drafting, setDrafting] = useState(false);
  // Generating was refused because no object type is adopted yet.
  const [blocked, setBlocked] = useState<"modelNotConfirmed" | "noOntology" | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [drafted, setDrafted] = useState<DraftedItem[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [saving, setSaving] = useState(false);
  const sending = useRef(false);
  // The server's reasons for a question's refused inputs, shown on their rows.
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<{
    documentId: string;
    range?: { end: number; start: number };
  } | null>(null);
  // Counts every read, so a specification being drafted is read again after a failure too.
  const [reads, setReads] = useState(0);
  // When the specification was last read, for how long generating has run.
  const [readAt, setReadAt] = useState(() => Date.now());
  const latest = useRef(0);
  const canEdit = ownerIsCaller && !project.archived;

  const load = useCallback(async () => {
    const read = ++latest.current;
    try {
      const [nextRequirements, nextDocuments] = await Promise.all([
        getRequirements(project.id),
        listDocuments(project.id),
      ]);
      if (read === latest.current) {
        setRequirements(nextRequirements);
        setDocuments(nextDocuments);
        setFailures(0);
      }
    } catch {
      if (read === latest.current) {
        setFailures((count) => count + 1);
      }
    } finally {
      setReads((count) => count + 1);
      setReadAt(Date.now());
    }
  }, [project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Read once: which needs are implemented changes in the live network, not on this page.
  useEffect(() => {
    let active = true;
    getLogicNeeds(project.id)
      .then((next) => {
        if (active) {
          setLogicNeeds(next.needs);
          setNetworkItems(next.networkItems ?? []);
        }
      })
      .catch(() => undefined);
    getNetworkBackground(project.id)
      .then((found) => active && setBackground(found !== null))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id]);

  // Needs and concepts name drafted items by id; the draft gives the names people know.
  useEffect(() => {
    let active = true;
    getDraft(project.id)
      .then((draft) => {
        if (active) {
          setAdoptedObjectTypes(
            draft ? draft.items.objectTypes.filter((item) => item.adopted).length : 0,
          );
        }
        if (active && draft) {
          setDrafted([
            ...draft.items.objectTypes.map(({ id, name, properties }) => ({
              id,
              kind: "object_type",
              name,
              properties: properties.map(({ displayName, name: field, type }) => ({
                displayName,
                name: field,
                type,
              })),
            })),
            ...draft.items.relationTypes.map(({ id, name }) => ({
              id,
              kind: "relation_type",
              name,
              properties: [],
            })),
          ]);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id]);

  const isDrafting = requirements?.status === "drafting";
  const stalled = failures >= POLL_FAILURE_LIMIT;
  useEffect(() => {
    if (!isDrafting || stalled) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(), REQUIREMENTS_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [isDrafting, load, reads, stalled]);
  const objectTypes = drafted.filter((item) => item.kind === "object_type").length;
  // Generating takes longer the larger the model: say so rather than promise a minute or two.
  const draftingMinutes =
    isDrafting && requirements?.updateTime
      ? Math.floor((readAt - requirements.updateTime) / 60_000)
      : 0;
  const draftingText =
    draftingMinutes >= LONG_DRAFTING_MINUTES && draftingMinutes <= LONGEST_DRAFTING_MINUTES
      ? t(`${PREFIX}.draftingLong`, { count: draftingMinutes })
      : objectTypes >= LARGE_MODEL_OBJECT_TYPES
        ? t(`${PREFIX}.draftingLarge`, { count: objectTypes })
        : t(`${PREFIX}.drafting`);

  /**
   * Generates the scenarios and questions from the adopted ontology. What was accepted is kept;
   * starting over keeps nothing, so it asks first.
   */
  const draft = async (discardDecisions: boolean) => {
    setDrafting(true);
    try {
      latest.current += 1;
      setRequirements(await draftRequirements(project.id, discardDecisions));
      setBlocked(null);
    } catch (error) {
      const code = projectErrorCode(error);
      if (code === "Requirement.NoAdoptedOntology") {
        setBlocked("noOntology");
      } else if (code === "Requirement.ModelNotConfirmed") {
        setBlocked("modelNotConfirmed");
      } else {
        message.error(requirementErrorText(t, code));
      }
    } finally {
      setDrafting(false);
    }
  };

  const startOver = () =>
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t(`${PREFIX}.startOverContent`),
      okButtonProps: { danger: true },
      okText: t(`${PREFIX}.startOver`),
      onOk: () => draft(true),
      title: t(`${PREFIX}.startOverTitle`),
    });

  const citing = useMemo(
    () => ({
      // The network's own background is cited as such, never as a removed document.
      documentName: (documentId: string) =>
        documentId === NETWORK_DOCUMENT_ID
          ? t("bknProject.networkExisting.background.name")
          : (documents.find((document) => document.id === documentId)?.name ??
            t(`${PREFIX}.removedDocument`)),
      openDocument: (documentId: string, range?: { end: number; start: number }) =>
        setViewing({ documentId, range }),
    }),
    [documents, t],
  );
  const itemName = (item: RequirementItemRef) =>
    drafted.find((entry) => entry.id === item.id && entry.kind === item.kind)?.name ?? item.id;

  /**
   * Sends an edit made on the specification as read. When someone changed it since, the page
   * reads it again and says so; nothing is overwritten.
   */
  const apply = async (send: (updateTime: number) => Promise<Requirements>) => {
    // One edit at a time, set at once: two clicks in a row would both send the version read.
    if (!requirements || sending.current) {
      return false;
    }
    sending.current = true;
    setSaving(true);
    try {
      latest.current += 1;
      setRequirements(await send(requirements.updateTime));
      setDialog(null);
      setInputErrors({});
      return true;
    } catch (error) {
      const code = projectErrorCode(error);
      const refused =
        code === "Requirement.InvalidItem" ? refusedInputs(projectErrorDetails(error)) : {};
      if (code === "Requirement.Stale") {
        message.warning(t(`${PREFIX}.editing.stale`));
        setDialog(null);
        void load();
      } else if (Object.keys(refused).length) {
        // The dialog stays open with each refused input saying why.
        setInputErrors(refused);
        message.error(t(`${PREFIX}.editing.inputs.refused`));
      } else {
        message.error(requirementErrorText(t, code));
      }
      return false;
    } finally {
      sending.current = false;
      setSaving(false);
    }
  };

  const editing: SpecEditing | null =
    canEdit && requirements?.status === "ready"
      ? {
          add: (kind) => setDialog({ itemId: null, kind, type: "item" }),
          decide: (choice) => setDialog({ choice, type: "choice" }),
          edit: (kind, itemId) => setDialog({ itemId, kind, type: "item" }),
          remove: (kind, itemId, label) =>
            void modal.confirm({
              cancelText: t("common.cancel"),
              content: t(`${PREFIX}.editing.removeConfirm.${kind}`),
              okButtonProps: { danger: true },
              okText: t(`${PREFIX}.editing.remove`),
              onOk: () => apply((time) => removeItem(project.id, kind, itemId, time)),
              title: t(`${PREFIX}.editing.removeTitle`, { name: label }),
            }),
          resolve: (conflict) => setDialog({ conflict, type: "conflict" }),
          saving,
          review: (kind, itemId, accept) =>
            void apply((time) =>
              accept
                ? reviewRequirements(project.id, time, [{ id: itemId, kind }])
                : reviewRequirements(project.id, time, [], [{ id: itemId, kind }]),
            ),
        }
      : null;

  if (failures > 0 && requirements === undefined) {
    return (
      <Alert
        action={
          <AppButton onClick={() => void load()} size="small">
            {t("common.retry")}
          </AppButton>
        }
        message={t(`${PREFIX}.loadFailed`)}
        showIcon
        type="error"
      />
    );
  }
  if (requirements === undefined) {
    return (
      <div className={styles.page}>
        <Spin />
      </div>
    );
  }

  const spec = requirements?.spec;
  const ready = requirements?.status === "ready";
  // What AI generated and nobody accepted yet, scenarios and questions alike.
  const waiting = spec
    ? [
        ...spec.scenarios
          .filter((item) => !item.accepted)
          .map(({ id }) => ({ id, kind: "scenarios" as const })),
        ...spec.questions
          .filter((item) => !item.accepted)
          .map(({ id }) => ({ id, kind: "questions" as const })),
      ]
    : [];
  // Extracting concepts writes a specification too: it is not drafted until it has scenarios.
  const started = Boolean(spec && (spec.scenarios.length || spec.questions.length));
  const outdated = spec?.questions.filter((question) => question.ontologyChanged).length ?? 0;
  const activeTab: Tab = tab ?? "questions";
  // Asking needs a specification: the items it changes are kept in it.
  const canAsk = canEdit && requirements !== null;
  const refs = selected
    .map(({ id, kind }) => {
      const name =
        kind === "scenarios"
          ? spec?.scenarios.find((item) => item.id === id)?.name
          : spec?.questions.find((item) => item.id === id)?.text;
      return name === undefined ? null : { id, kind, name };
    })
    .filter((ref) => ref !== null);
  const askingContext: SpecAsking | null = canAsk
    ? {
        flash,
        selected: new Set(selected.map(({ id }) => id)),
        toggle: (kind, id) => {
          const ticked = !selected.some((item) => item.id === id);
          setSelected(
            ticked ? [...selected, { id, kind }] : selected.filter((item) => item.id !== id),
          );
          // Ticking is for asking: the panel opens to ask about them.
          if (ticked) {
            setAsking(true);
          }
        },
      }
    : null;
  /** Shows the tab of what was changed from a conversation, the first of them. */
  const showChanged = (changed: { id: string; kind: AskItemKind }[]) => {
    const first = changed[0]?.kind;
    if (first === "questions" || first === "scenarios" || first === "rules") {
      setTab(first);
    }
    flashItems(changed.map((item) => item.id));
  };
  return (
    <Citing.Provider value={citing}>
      <Editing.Provider value={editing}>
        <Asking.Provider value={askingContext}>
          <div className={ask.layout}>
            <div className={`${styles.page} ${ask.main}`}>
              <div className={styles.head}>
                {requirements && (started || !ready) ? (
                  <LightStatusTag
                    tone={ready ? "success" : requirements.status === "failed" ? "error" : "info"}
                  >
                    {t(`${PREFIX}.version`, {
                      status: t(
                        `${PREFIX}.status.${ready ? "ready" : isDrafting ? "drafting" : "failed"}`,
                      ),
                      version: requirements.version,
                    })}
                  </LightStatusTag>
                ) : null}
                <span className={styles.spacer} />
                {requirements ? <RequirementsExport projectId={project.id} ready={ready} /> : null}
                {canEdit && ready && waiting.length ? (
                  <AppButton
                    disabled={saving}
                    onClick={() =>
                      void apply((time) => reviewRequirements(project.id, time, waiting))
                    }
                    type="primary"
                  >
                    {t(`${PREFIX}.review.acceptAll`, { count: waiting.length })}
                  </AppButton>
                ) : null}
                {canEdit ? (
                  <AppButton
                    disabled={isDrafting}
                    loading={drafting}
                    onClick={() => void draft(false)}
                    type={started ? "default" : "primary"}
                  >
                    {t(`${PREFIX}.${started ? "redraft" : "draft"}`)}
                  </AppButton>
                ) : null}
                {canEdit && started ? (
                  <AppButton
                    danger
                    disabled={isDrafting || drafting}
                    onClick={startOver}
                    type="text"
                  >
                    {t(`${PREFIX}.startOver`)}
                  </AppButton>
                ) : null}
                {canAsk ? (
                  <AppButton
                    aria-pressed={asking}
                    onClick={() => setAsking(!asking)}
                    type={asking ? "default" : "primary"}
                  >
                    {refs.length
                      ? t("bknProject.ask.button.selected", { count: refs.length })
                      : t("bknProject.ask.button.label")}
                  </AppButton>
                ) : null}
              </div>
              <AskSources
                canEdit={canEdit}
                concepts={spec?.concepts.length ?? 0}
                documents={documents}
                hasBackground={background}
                kineticNeeds={spec?.logicNeeds.length ?? 0}
                networkItems={networkItems}
                objectTypes={adoptedObjectTypes}
                onGoToKinetic={onGoToKinetic}
                onGoToModel={onGoToModel}
                onOpenDocuments={() => onGoToResources("documents")}
                onViewBackground={() => setViewing({ documentId: NETWORK_DOCUMENT_ID })}
                onViewRules={() => setTab("rules")}
                page="scenarios"
                projectId={project.id}
                rules={spec?.rules.length ?? 0}
              />
              {stalled ? <ReadStalledNotice onRefresh={() => void load()} /> : null}
              {blocked ? (
                <Alert
                  action={
                    <AppButton onClick={onGoToModel} size="small">
                      {t(`${PREFIX}.goToModel`)}
                    </AppButton>
                  }
                  message={t(
                    blocked === "modelNotConfirmed"
                      ? `${PREFIX}.modelNotConfirmed`
                      : `${PREFIX}.error.NoAdoptedOntology`,
                  )}
                  showIcon
                  type="warning"
                />
              ) : null}
              {!requirements || (ready && !started) ? (
                <Alert
                  action={
                    <AppButton onClick={() => onGoToResources("documents")} size="small">
                      {t(`${PREFIX}.goToDocuments`)}
                    </AppButton>
                  }
                  description={t(
                    documents.length ? `${PREFIX}.notDraftedDocuments` : `${PREFIX}.noDocuments`,
                  )}
                  message={t(`${PREFIX}.notDrafted`)}
                  showIcon
                  type="info"
                />
              ) : isDrafting ? (
                <Alert message={draftingText} showIcon type="info" />
              ) : requirements?.status === "failed" ? (
                <Alert message={draftErrorText(t, requirements.error)} showIcon type="error" />
              ) : null}
              {requirements?.stale ? (
                <Alert message={t(`${PREFIX}.stale`)} showIcon type="warning" />
              ) : null}
              {ready && outdated ? (
                <Alert
                  action={
                    canEdit ? (
                      <AppButton disabled={drafting} onClick={() => void draft(false)} size="small">
                        {t(`${PREFIX}.redraft`)}
                      </AppButton>
                    ) : undefined
                  }
                  description={t(`${PREFIX}.review.outdatedDetail`, { count: outdated })}
                  message={t(`${PREFIX}.review.outdated`)}
                  showIcon
                  type="warning"
                />
              ) : null}
              {ready && requirements.ontologyUncovered.length ? (
                <Alert
                  message={t(`${PREFIX}.review.uncovered`, {
                    count: requirements.ontologyUncovered.length,
                    names: requirements.ontologyUncovered
                      .map((item) => item.name)
                      .join(t("bknProject.listSeparator")),
                  })}
                  showIcon
                  type="info"
                />
              ) : null}
              {ready && waiting.length ? (
                <p className={styles.muted}>
                  {t(`${PREFIX}.review.waiting`, { count: waiting.length })}
                </p>
              ) : null}
              {ready && (requirements.unresolvedConflicts || requirements.undecidedChoices) ? (
                <Alert
                  action={
                    <AppButton onClick={() => setTab("rules")} size="small">
                      {t(`${PREFIX}.goDecide`)}
                    </AppButton>
                  }
                  message={
                    // Only what waits is named.
                    requirements.unresolvedConflicts && requirements.undecidedChoices
                      ? t(`${PREFIX}.waiting.both`, {
                          choices: requirements.undecidedChoices,
                          conflicts: requirements.unresolvedConflicts,
                        })
                      : requirements.unresolvedConflicts
                        ? t(`${PREFIX}.waiting.conflicts`, {
                            count: requirements.unresolvedConflicts,
                          })
                        : t(`${PREFIX}.waiting.choices`, { count: requirements.undecidedChoices })
                  }
                  showIcon
                  type="warning"
                />
              ) : null}
              {spec && (spec.tablesOmitted || spec.catalogsUnlisted.length) ? (
                <p className={styles.muted}>
                  {spec.catalogsUnlisted.length
                    ? t(`${PREFIX}.catalogsUnlisted`, { count: spec.catalogsUnlisted.length })
                    : t(`${PREFIX}.tablesOmitted`, { count: spec.tablesOmitted })}
                </p>
              ) : null}
              {spec ? (
                <>
                  <Segmented<Tab>
                    onChange={setTab}
                    options={TABS.map((value) => ({
                      label: t(`${PREFIX}.tabs.${value}`, {
                        count: {
                          questions: spec.questions.length,
                          rules: spec.rules.length + spec.conflicts.length + spec.choices.length,
                          scenarios: spec.scenarios.length,
                        }[value],
                      }),
                      value,
                    }))}
                    value={activeTab}
                  />
                  {activeTab === "questions" ? (
                    <QuestionsView
                      drafted={drafted}
                      itemName={itemName}
                      logicNeeds={logicNeeds}
                      projectId={project.id}
                      spec={spec}
                    />
                  ) : activeTab === "scenarios" ? (
                    <ScenariosView logicNeeds={logicNeeds} spec={spec} />
                  ) : (
                    <RulesView spec={spec} />
                  )}
                  {canAsk ? (
                    <p className={styles.muted}>{t("bknProject.ask.select.hint.scenarios")}</p>
                  ) : null}
                  <RejectedNote spec={spec} />
                </>
              ) : null}
              {viewing ? (
                <DocumentViewer
                  documentId={viewing.documentId}
                  onClose={() => setViewing(null)}
                  projectId={project.id}
                  range={viewing.range}
                />
              ) : null}
              {spec && dialog?.type === "item" ? (
                <ItemDialog
                  drafted={drafted}
                  inputErrors={inputErrors}
                  itemId={dialog.itemId}
                  kind={dialog.kind}
                  onCancel={() => {
                    setDialog(null);
                    setInputErrors({});
                  }}
                  onSave={(fields) =>
                    apply((time) =>
                      dialog.itemId
                        ? editItem(project.id, dialog.kind, dialog.itemId, fields, time)
                        : addItem(project.id, dialog.kind, fields, time),
                    )
                  }
                  saving={saving}
                  spec={spec}
                />
              ) : null}
              {dialog?.type === "conflict" ? (
                <ConflictDialog
                  conflict={dialog.conflict}
                  onCancel={() => setDialog(null)}
                  onSave={(ruling) =>
                    void apply((time) =>
                      resolveConflict(project.id, dialog.conflict.id, ruling, time),
                    )
                  }
                  saving={saving}
                />
              ) : null}
              {dialog?.type === "choice" ? (
                <ChoiceDialog
                  choice={dialog.choice}
                  onCancel={() => setDialog(null)}
                  onSave={(decision) =>
                    void apply((time) => decideChoice(project.id, dialog.choice.id, decision, time))
                  }
                  saving={saving}
                />
              ) : null}
            </div>
            {asking && canAsk ? (
              <div className={ask.side}>
                <RequirementAskPanel
                  names={{
                    logicNeed: (id) => spec?.logicNeeds.find((need) => need.id === id)?.name ?? "",
                    objectType: (id) =>
                      drafted.find((item) => item.id === id && item.kind === "object_type")?.name ??
                      "",
                    scenario: (id) => spec?.scenarios.find((item) => item.id === id)?.name ?? "",
                  }}
                  onClose={() => setAsking(false)}
                  onDecided={(next, changed) => {
                    latest.current += 1;
                    if (next) {
                      setRequirements(next);
                    } else {
                      void load();
                    }
                    showChanged(changed);
                  }}
                  onRemoveRef={(ref) => setSelected(selected.filter((item) => item.id !== ref.id))}
                  onSent={() => setSelected([])}
                  onStale={() => void load()}
                  page="scenarios"
                  projectId={project.id}
                  refs={refs}
                  subtitle={t("bknProject.ask.panel.subtitle.scenarios", {
                    questions: spec?.questions.length ?? 0,
                    scenarios: spec?.scenarios.length ?? 0,
                  })}
                  updateTime={requirements?.updateTime}
                />
              </div>
            ) : null}
          </div>
        </Asking.Provider>
      </Editing.Provider>
    </Citing.Provider>
  );
}
