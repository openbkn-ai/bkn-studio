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
import { Citing } from "@/modules/bkn-project/components/requirements/citing";
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
import { getDraft } from "@/modules/bkn-project/services/draft.service";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import {
  draftRequirements,
  getRequirements,
  listDocuments,
  REQUIREMENTS_POLL_MS,
} from "@/modules/bkn-project/services/requirements.service";
import type { Project } from "@/modules/bkn-project/types/project";
import type {
  RequirementDocument,
  RequirementItemRef,
  Requirements,
} from "@/modules/bkn-project/types/requirements";

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
  const [itemNames, setItemNames] = useState<Map<string, string>>(new Map());
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
          setItemNames(
            new Map(
              [...draft.items.objectTypes, ...draft.items.relationTypes].map((item) => [
                item.id,
                item.name,
              ]),
            ),
          );
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
  const itemName = (item: RequirementItemRef) => itemNames.get(item.id) ?? item.id;

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
            message={t(`${PREFIX}.waiting`, {
              choices: requirements.undecidedChoices,
              conflicts: requirements.unresolvedConflicts,
            })}
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
              <QuestionsView itemName={itemName} spec={spec} />
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
      </div>
    </Citing.Provider>
  );
}
