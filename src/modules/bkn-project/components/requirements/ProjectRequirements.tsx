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
import { DocumentViewer } from "@/modules/bkn-project/components/requirements/Citations";
import {
  Citing,
  Editing,
  type SpecEditing,
} from "@/modules/bkn-project/components/requirements/citing";
import {
  ChoiceDialog,
  ConflictDialog,
  type DraftedItem,
  ItemDialog,
  MappingDialog,
} from "@/modules/bkn-project/components/requirements/RequirementDialogs";
import { RequirementDocuments } from "@/modules/bkn-project/components/requirements/RequirementDocuments";
import {
  draftErrorText,
  requirementErrorText,
} from "@/modules/bkn-project/components/requirements/requirementMessages";
import {
  ConceptsView,
  QuestionsView,
  RejectedNote,
  RulesView,
  ScenariosView,
} from "@/modules/bkn-project/components/requirements/RequirementSpecViews";
import { RequirementsExport } from "@/modules/bkn-project/components/requirements/RequirementsExport";
import { getDraft } from "@/modules/bkn-project/services/draft.service";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import {
  addItem,
  decideChoice,
  draftRequirements,
  editItem,
  getRequirements,
  listDocuments,
  removeItem,
  REQUIREMENTS_POLL_MS,
  resolveConflict,
  setConceptMapping,
} from "@/modules/bkn-project/services/requirements.service";
import type { Project } from "@/modules/bkn-project/types/project";
import type {
  RequirementChoice,
  RequirementConcept,
  RequirementConflict,
  RequirementDocument,
  RequirementItemKind,
  RequirementItemRef,
  Requirements,
} from "@/modules/bkn-project/types/requirements";

/** The dialog the owner has open, if any. */
type Dialog =
  | { itemId: string | null; kind: RequirementItemKind; type: "item" }
  | { choice: RequirementChoice; type: "choice" }
  | { concept: RequirementConcept; type: "mapping" }
  | { conflict: RequirementConflict; type: "conflict" };

import styles from "./Requirements.module.css";

const PREFIX = "bknProject.requirements";

const TABS = ["questions", "inputs", "scenarios", "concepts", "rules"] as const;
type Tab = (typeof TABS)[number];

/**
 * What the knowledge network is for: the requirement documents, and the specification drafted
 * from them — scenarios, the questions that accept the network, candidate concepts and rules,
 * with the conflicts and choices the owner settles.
 */
export function ProjectRequirements({
  ownerIsCaller,
  project,
}: {
  ownerIsCaller: boolean;
  project: Project;
}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  // undefined while loading, null before the first drafting.
  const [requirements, setRequirements] = useState<Requirements | null | undefined>(undefined);
  const [documents, setDocuments] = useState<RequirementDocument[]>([]);
  const [failed, setFailed] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [drafted, setDrafted] = useState<DraftedItem[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<{
    documentId: string;
    range?: { end: number; start: number };
  } | null>(null);
  // Counts every read, so a specification being drafted is read again after a failure too.
  const [reads, setReads] = useState(0);
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
        setFailed(false);
      }
    } catch {
      if (read === latest.current) {
        setFailed(true);
      }
    } finally {
      setReads((count) => count + 1);
    }
  }, [project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Needs and concepts name drafted items by id; the draft gives the names people know.
  useEffect(() => {
    let active = true;
    getDraft(project.id)
      .then((draft) => {
        if (active && draft) {
          setDrafted([
            ...draft.items.objectTypes.map(({ id, name }) => ({ id, kind: "object_type", name })),
            ...draft.items.relationTypes.map(({ id, name }) => ({
              id,
              kind: "relation_type",
              name,
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
  useEffect(() => {
    if (!isDrafting) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(), REQUIREMENTS_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [isDrafting, load, reads]);

  const draft = async (discardDecisions: boolean) => {
    setDrafting(true);
    try {
      latest.current += 1;
      setRequirements(await draftRequirements(project.id, discardDecisions));
    } catch (error) {
      const code = projectErrorCode(error);
      if (!discardDecisions && code === "Requirement.HasDecisions") {
        void modal.confirm({
          cancelText: t("common.cancel"),
          content: t(`${PREFIX}.redraftDiscards`),
          okText: t(`${PREFIX}.redraft`),
          onOk: () => draft(true),
          title: t(`${PREFIX}.redraftTitle`),
        });
      } else {
        message.error(requirementErrorText(t, code));
      }
    } finally {
      setDrafting(false);
    }
  };

  const citing = useMemo(
    () => ({
      documentName: (documentId: string) =>
        documents.find((document) => document.id === documentId)?.name ??
        t(`${PREFIX}.removedDocument`),
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
    if (!requirements) {
      return false;
    }
    setSaving(true);
    try {
      latest.current += 1;
      setRequirements(await send(requirements.updateTime));
      setDialog(null);
      return true;
    } catch (error) {
      const code = projectErrorCode(error);
      if (code === "Requirement.Stale") {
        message.warning(t(`${PREFIX}.editing.stale`));
        setDialog(null);
        void load();
      } else {
        message.error(requirementErrorText(t, code));
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const editing: SpecEditing | null =
    canEdit && requirements?.status === "ready"
      ? {
          add: (kind) => setDialog({ itemId: null, kind, type: "item" }),
          decide: (choice) => setDialog({ choice, type: "choice" }),
          edit: (kind, itemId) => setDialog({ itemId, kind, type: "item" }),
          map: (concept) => setDialog({ concept, type: "mapping" }),
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
        }
      : null;

  if (failed && requirements === undefined) {
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
  // Before a specification is drafted, only the documents can be worked on.
  const activeTab: Tab = ready ? (tab ?? "questions") : "inputs";
  return (
    <Citing.Provider value={citing}>
      <Editing.Provider value={editing}>
        <div className={styles.page}>
          <div className={styles.head}>
            {requirements ? (
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
            {canEdit ? (
              <AppButton
                disabled={isDrafting || !documents.length}
                loading={drafting}
                onClick={() => void draft(false)}
                type={requirements ? "default" : "primary"}
              >
                {t(`${PREFIX}.${requirements ? "redraft" : "draft"}`)}
              </AppButton>
            ) : null}
          </div>
          {!requirements ? (
            <Alert message={t(`${PREFIX}.notDrafted`)} showIcon type="info" />
          ) : isDrafting ? (
            <Alert message={t(`${PREFIX}.drafting`)} showIcon type="info" />
          ) : requirements.status === "failed" ? (
            <Alert message={draftErrorText(t, requirements.error)} showIcon type="error" />
          ) : null}
          {requirements?.stale ? (
            <Alert message={t(`${PREFIX}.stale`)} showIcon type="warning" />
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
                    ? t(`${PREFIX}.waiting.conflicts`, { count: requirements.unresolvedConflicts })
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
          <Segmented<Tab>
            onChange={setTab}
            options={TABS.map((value) => ({
              disabled: !ready && value !== "inputs",
              label: t(`${PREFIX}.tabs.${value}`, {
                count: spec
                  ? {
                      concepts: spec.concepts.length,
                      inputs: documents.length,
                      questions: spec.questions.length,
                      rules: spec.rules.length + spec.conflicts.length + spec.choices.length,
                      scenarios: spec.scenarios.length,
                    }[value]
                  : documents.length,
              }),
              value,
            }))}
            value={activeTab}
          />
          {activeTab === "inputs" ? (
            <RequirementDocuments
              canEdit={canEdit}
              documents={documents}
              onChanged={() => void load()}
              projectId={project.id}
            />
          ) : spec ? (
            <>
              {activeTab === "questions" ? (
                <QuestionsView itemName={itemName} projectId={project.id} spec={spec} />
              ) : activeTab === "scenarios" ? (
                <ScenariosView spec={spec} />
              ) : activeTab === "concepts" ? (
                <ConceptsView itemName={itemName} spec={spec} />
              ) : (
                <RulesView spec={spec} />
              )}
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
              itemId={dialog.itemId}
              kind={dialog.kind}
              onCancel={() => setDialog(null)}
              onSave={(fields) =>
                void apply((time) =>
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
                void apply((time) => resolveConflict(project.id, dialog.conflict.id, ruling, time))
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
          {dialog?.type === "mapping" ? (
            <MappingDialog
              concept={dialog.concept}
              drafted={drafted}
              onCancel={() => setDialog(null)}
              onSave={(mapsTo) =>
                void apply((time) => setConceptMapping(project.id, dialog.concept.id, mapsTo, time))
              }
              saving={saving}
            />
          ) : null}
        </div>
      </Editing.Provider>
    </Citing.Provider>
  );
}
