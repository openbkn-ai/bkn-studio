/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import { Alert, Input } from "antd";
import dayjs from "dayjs";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { networkItemCounts } from "@/modules/bkn-project/components/kinetic/kineticMessages";
import { InNetworkDot } from "@/modules/bkn-project/components/kinetic/KineticNeedPanel";
import { requirementErrorText } from "@/modules/bkn-project/components/requirements/requirementMessages";
import {
  getSupplement,
  saveSupplement,
  SUPPLEMENT_MAX,
} from "@/modules/bkn-project/services/conversations.service";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import type { AskModel } from "@/modules/bkn-project/components/ai/askModel";
import type { AskPage, Supplement } from "@/modules/bkn-project/types/conversations";
import type { LogicNetworkItem } from "@/modules/bkn-project/types/kinetic";
import type { RequirementDocument } from "@/modules/bkn-project/types/requirements";

import styles from "./RequirementAsk.module.css";

const PREFIX = "bknProject.ask.sources";
const NOTE = "bknProject.ask.supplement";

type Tone = "missing" | "none" | "ok";

function Source({
  action,
  children,
  hint,
  inNetwork,
  tone,
}: {
  action?: { label: string; onClick: () => void };
  children: ReactNode;
  hint?: ReactNode;
  /** Something the network already has: marked with the blue dot. */
  inNetwork?: boolean;
  tone: Tone;
}) {
  return (
    <li className={styles.source}>
      <span
        aria-hidden="true"
        className={`${styles.sourceIcon} ${
          tone === "ok" ? styles.sourceOk : tone === "missing" ? styles.sourceMissing : styles.note
        }`}
      >
        {tone === "ok" ? (
          <CheckCircleOutlined />
        ) : tone === "missing" ? (
          <ExclamationCircleOutlined />
        ) : (
          <MinusCircleOutlined />
        )}
      </span>
      <span className={styles.sourceWhat}>
        <span>
          {inNetwork ? <InNetworkDot /> : null}
          {children}
        </span>
        {hint}
      </span>
      {action ? (
        <AppButton className={styles.sourceAction} onClick={action.onClick} type="link">
          {action.label}
        </AppButton>
      ) : null}
    </li>
  );
}

/**
 * What AI reads on kinetic modeling and business scenarios, beside the project's supplement note:
 * each input with how much of it there is, what is missing with how to add it, and what the
 * network already has marked with the blue dot.
 */
export function AskSources({
  canEdit,
  concepts,
  documents,
  hasBackground,
  kineticNeeds,
  model,
  networkItems,
  onGoToKinetic,
  onGoToModel,
  onOpenDocuments,
  onViewBackground,
  onViewRules,
  page,
  projectId,
  rules,
}: {
  canEdit: boolean;
  /** Scenarios: the candidate concepts. */
  concepts?: number;
  /** null while unread. */
  documents: RequirementDocument[] | null;
  /** The network has a description or SKILL.md. */
  hasBackground: boolean;
  /** Scenarios: the kinetic needs. */
  kineticNeeds?: number;
  /** The object types AI reads; null while unread. */
  model: AskModel | null;
  networkItems: LogicNetworkItem[];
  onGoToKinetic?: () => void;
  onGoToModel: () => void;
  /** Opens the requirement documents, where they are uploaded. */
  onOpenDocuments: () => void;
  onViewBackground: () => void;
  onViewRules: () => void;
  page: AskPage;
  projectId: string;
  rules: number;
}) {
  const { t } = useTranslation();
  const separator = t("bknProject.listSeparator");
  const items = networkItemCounts(t, networkItems);
  return (
    <section className={styles.sources}>
      <div>
        <h3>{t(`${PREFIX}.title`)}</h3>
        <ul className={styles.sourceList}>
          {documents === null ? null : documents.length ? (
            <Source action={{ label: t(`${PREFIX}.view`), onClick: onOpenDocuments }} tone="ok">
              {t(`${PREFIX}.documents`, { count: documents.length })}
              <span className={styles.sourceNames}>
                {t(`${PREFIX}.names`, {
                  names: documents.map((document) => document.name).join(separator),
                })}
              </span>
            </Source>
          ) : (
            <Source
              action={{ label: t(`${PREFIX}.uploadDocuments`), onClick: onOpenDocuments }}
              hint={<span className={styles.sourceHint}>{t(`${PREFIX}.noDocuments.${page}`)}</span>}
              tone="missing"
            >
              {t(`${PREFIX}.documents`, { count: 0 })}
            </Source>
          )}
          {model?.network ? (
            <Source inNetwork tone="ok">
              {t(`${PREFIX}.networkObjectTypes`, { count: model.network })}
            </Source>
          ) : null}
          {model === null ? null : model.confirmed ? (
            <Source action={{ label: t(`${PREFIX}.goToModel`), onClick: onGoToModel }} tone="ok">
              {t(`${PREFIX}.model`, { count: model.project })}
            </Source>
          ) : (
            // What the network has is not the project's confirmed model: say none is confirmed.
            <Source
              action={{ label: t(`${PREFIX}.confirmModel`), onClick: onGoToModel }}
              hint={<span className={styles.sourceHint}>{t(`${PREFIX}.noModel`)}</span>}
              tone="missing"
            >
              {t(`${PREFIX}.notConfirmed`)}
            </Source>
          )}
          {page === "kinetic" ? (
            <Source
              action={rules ? { label: t(`${PREFIX}.view`), onClick: onViewRules } : undefined}
              tone={rules ? "ok" : "none"}
            >
              {t(`${PREFIX}.rules`, { count: rules })}
            </Source>
          ) : (
            <>
              <Source
                action={rules ? { label: t(`${PREFIX}.view`), onClick: onViewRules } : undefined}
                tone={concepts || rules ? "ok" : "none"}
              >
                {t(`${PREFIX}.conceptsAndRules`, {
                  concepts: t(`${PREFIX}.concepts`, { count: concepts ?? 0 }),
                  rules: t(`${PREFIX}.rules`, { count: rules }),
                })}
              </Source>
              <Source
                action={
                  onGoToKinetic
                    ? { label: t(`${PREFIX}.goToKinetic`), onClick: onGoToKinetic }
                    : undefined
                }
                tone={kineticNeeds ? "ok" : "none"}
              >
                {t(`${PREFIX}.kineticNeeds`, { count: kineticNeeds ?? 0 })}
              </Source>
            </>
          )}
          {items ? (
            <Source inNetwork tone="ok">
              {t(`${PREFIX}.networkItems`, { items })}
            </Source>
          ) : null}
          {hasBackground ? (
            <Source
              action={{ label: t(`${PREFIX}.view`), onClick: onViewBackground }}
              hint={
                page === "kinetic" ? (
                  <span className={styles.note}>{t(`${PREFIX}.backgroundNew`)}</span>
                ) : undefined
              }
              inNetwork
              tone="ok"
            >
              {t(`${PREFIX}.background`)}
            </Source>
          ) : null}
        </ul>
      </div>
      <SupplementNote canEdit={canEdit} page={page} projectId={projectId} />
    </section>
  );
}

/**
 * The project's one paragraph of extra direction, shared by kinetic modeling and business
 * scenarios: every analysis, generation and question takes it along.
 */
export function SupplementNote({
  canEdit,
  page,
  projectId,
}: {
  canEdit: boolean;
  page: AskPage;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  // null while unread; a note that could not be read is never shown as none, nor written over.
  const [note, setNote] = useState<Supplement | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [reads, setReads] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setReadFailed(false);
    getSupplement(projectId)
      .then((next) => active && setNote(next))
      .catch(() => active && setReadFailed(true));
    return () => {
      active = false;
    };
  }, [projectId, reads]);

  const save = async () => {
    if (draft === null) {
      return;
    }
    setSaving(true);
    try {
      setNote(await saveSupplement(projectId, draft.trim()));
      setDraft(null);
      message.success(t(`${NOTE}.saved`));
    } catch (error) {
      const code = projectErrorCode(error);
      message.error(
        code === "Requirement.InvalidSupplement"
          ? t(`${NOTE}.tooLong`, { count: SUPPLEMENT_MAX })
          : requirementErrorText(t, code),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3>{t(`${NOTE}.title`)}</h3>
      <p className={styles.noteIntro}>{t(`${NOTE}.intro.${page}`)}</p>
      {draft !== null ? (
        <>
          <Input.TextArea
            aria-label={t(`${NOTE}.title`)}
            autoFocus
            autoSize={{ maxRows: 8, minRows: 3 }}
            maxLength={SUPPLEMENT_MAX}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t(`${NOTE}.placeholder`)}
            showCount
            value={draft}
          />
          <div className={styles.noteFoot}>
            <span />
            <span className={styles.inNetwork}>
              <AppButton disabled={saving} onClick={() => setDraft(null)} size="small">
                {t("common.cancel")}
              </AppButton>
              <AppButton loading={saving} onClick={() => void save()} size="small" type="primary">
                {t(`${NOTE}.save`)}
              </AppButton>
            </span>
          </div>
        </>
      ) : readFailed ? (
        <Alert
          action={
            <AppButton onClick={() => setReads((count) => count + 1)} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={t(`${NOTE}.loadFailed`)}
          showIcon
          type="warning"
        />
      ) : (
        <>
          <div className={styles.noteBox}>
            {/* Until it is read, nothing is said of it. */}
            {note?.text ? (
              note.text
            ) : note ? (
              <span className={styles.notePlaceholder}>{t(`${NOTE}.empty`)}</span>
            ) : null}
          </div>
          <div className={styles.noteFoot}>
            <span className={styles.note}>
              {note?.text && note.time
                ? note.by?.name
                  ? t(`${NOTE}.lastChanged`, {
                      name: note.by.name,
                      time: dayjs(note.time).format("YYYY/MM/DD HH:mm"),
                    })
                  : t(`${NOTE}.lastChangedAt`, {
                      time: dayjs(note.time).format("YYYY/MM/DD HH:mm"),
                    })
                : ""}
            </span>
            {canEdit && note ? (
              <AppButton onClick={() => setDraft(note.text)} size="small">
                {t(`${NOTE}.${note.text ? "edit" : "write"}`)}
              </AppButton>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
