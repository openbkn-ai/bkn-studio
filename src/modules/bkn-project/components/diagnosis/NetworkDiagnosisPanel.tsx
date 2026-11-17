/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined } from "@ant-design/icons";
import { Alert, Input, Modal, Progress, Segmented, Spin } from "antd";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  fieldLabel,
  fieldOwners,
  percent,
  writebackGroups,
} from "@/modules/bkn-project/components/diagnosis/diagnosis";
import { listText, requestFailureText } from "@/modules/bkn-project/components/publish/messages";
import {
  applySuggestion,
  diagnosisErrorCode,
  dismissSuggestion,
  getDiagnosis,
  runDiagnosis,
} from "@/modules/bkn-project/services/diagnosis.service";
import { DRAFT_POLL_MS } from "@/modules/bkn-project/services/draft.service";
import type {
  Diagnosis,
  DiagnosisGroup,
  DiagnosisSuggestion,
} from "@/modules/bkn-project/types/diagnosis";
import type { Draft } from "@/modules/bkn-project/types/draft";

import styles from "./NetworkDiagnosisPanel.module.css";

const PREFIX = "bknProject.diagnosis";

type Tab = "all" | DiagnosisGroup;
const TABS: readonly Tab[] = ["all", "connect", "object", "data"];

/** Failure keys bkn-project names in business wording; any other is said generally. */
const FAILURE_KEYS = new Set(["timeout", "interrupted"]);

const TAG_TONE: Record<DiagnosisSuggestion["kind"], string> = {
  adopt_object: "object",
  adopt_relation: "connect",
  choose_identity: "object",
  concept_disposition: "neutral",
  create_relation: "connect",
  data_quality: "data",
  exclude_object: "neutral",
  writeback_object: "new",
};

/** What a suggestion's evidence says, line by line, in business wording. */
function evidenceLines(t: TFunction, suggestion: DiagnosisSuggestion, draft: Draft): string[] {
  const { condition, hits, nulls, quotes, rate, rows, sourceField, targetField } =
    suggestion.evidence;
  const owners = fieldOwners(suggestion, draft);
  const lines: string[] = [];
  if (rows !== undefined && hits !== undefined && rows > 0) {
    const fields =
      sourceField && targetField
        ? t(`${PREFIX}.evidence.fields`, {
            source: fieldLabel(draft, owners.source, sourceField),
            target: fieldLabel(draft, owners.target, targetField),
          })
        : "";
    lines.push(
      fields +
        t(`${PREFIX}.evidence.match`, {
          hits,
          rate: Math.round(100 * (rate ?? hits / rows)),
          rows,
        }),
    );
  }
  if (condition) {
    lines.push(
      t(`${PREFIX}.evidence.condition`, {
        field: fieldLabel(draft, owners.source, condition.field),
        value: condition.value,
      }),
    );
  }
  if (nulls) {
    lines.push(t(`${PREFIX}.evidence.nulls`, { count: nulls }));
  }
  quotes.forEach((quote) => lines.push(t(`${PREFIX}.evidence.quote`, { text: quote.text })));
  return lines;
}

/** What applying a suggestion would change: the object types it connects, the questions it serves. */
function impactText(t: TFunction, suggestion: DiagnosisSuggestion, draft: Draft): string {
  const names = suggestion.impact.connects
    .map((id) => draft.items.objectTypes.find((item) => item.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const parts = [
    ...(names.length ? [t(`${PREFIX}.impact.connects`, { names: listText(t, names) })] : []),
    ...(suggestion.impact.questions.length
      ? [t(`${PREFIX}.impact.questions`, { count: suggestion.impact.questions.length })]
      : []),
  ];
  return parts.join(t(`${PREFIX}.impact.separator`));
}

function Metric({
  detail,
  label,
  share,
  value,
}: {
  detail: string;
  label: string;
  /** The bar's fill as a percentage; no bar without it. */
  share?: number | null;
  value: string;
}) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricDetail}>{detail}</div>
      {share !== undefined ? (
        <Progress
          aria-label={label}
          percent={share ?? 0}
          showInfo={false}
          size="small"
          strokeColor={
            (share ?? 0) >= 90 ? "var(--color-success-text)" : "var(--color-warning-text)"
          }
        />
      ) : null}
    </div>
  );
}

/**
 * The network diagnosis beside the concept model: four measures of how well the model hangs
 * together and ranked suggestions to apply or dismiss, each with its reason, evidence and impact.
 * A diagnosis runs in the background and is read again until it is done; one made before the
 * draft changed says so and offers to run again. Applying writes to the draft through bkn-project;
 * choosing an identity opens the page's identity chooser instead.
 */
export function NetworkDiagnosisPanel({
  draft,
  editable,
  onChooseIdentity,
  onClose,
  onDiagnosis,
  onDraftChanged,
  onPreview,
  ownerIsCaller,
  projectId,
}: {
  draft: Draft;
  /** Suggestions may be applied and dismissed: a ready draft of a project in use. */
  editable: boolean;
  /** Opens the identity chooser for an object type; replies false when it is not in the draft. */
  onChooseIdentity: (objectTypeId: string, candidates: string[][]) => boolean;
  onClose: () => void;
  /** Each diagnosis read, for the graph to ring the islands. */
  onDiagnosis?: (diagnosis: Diagnosis | null) => void;
  /** Reads the draft again after a suggestion changed it. */
  onDraftChanged: () => Promise<unknown>;
  /** The suggestion pointed at, for the graph to preview; null when none is. */
  onPreview?: (suggestion: DiagnosisSuggestion | null) => void;
  /** Only the owner runs a diagnosis. */
  ownerIsCaller: boolean;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  // undefined while loading, null before the first diagnosis.
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reads, setReads] = useState(0);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [dismissing, setDismissing] = useState<DiagnosisSuggestion | null>(null);
  const [reason, setReason] = useState("");
  // Only the latest read is shown: an older one answering late is dropped.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const at = ++latest.current;
    try {
      const next = await getDiagnosis(projectId);
      if (at === latest.current) {
        setDiagnosis(next);
        setLoadError(null);
      }
    } catch (error) {
      if (at === latest.current) {
        setLoadError(requestFailureText(t, error));
      }
    } finally {
      setReads((count) => count + 1);
    }
  }, [projectId, t]);

  // Read again whenever the draft changes: bkn-project says whether the diagnosis still holds.
  useEffect(() => {
    void load();
  }, [load, draft.updateTime]);

  // A running diagnosis is read again until it is done; closing the panel stops it.
  const running = diagnosis?.state === "running";
  useEffect(() => {
    if (!running) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(), DRAFT_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [running, load, reads]);

  useEffect(() => {
    onDiagnosis?.(diagnosis ?? null);
  }, [diagnosis, onDiagnosis]);

  const run = async () => {
    setStarting(true);
    try {
      await runDiagnosis(projectId);
      setDiagnosis((current) => ({
        ...(current ?? {
          components: [],
          computedAt: 0,
          draftUpdateTime: 0,
          error: "",
          metrics: null,
          runId: "",
          stale: false,
          suggestions: [],
        }),
        state: "running",
      }));
      setTab("all");
    } catch (error) {
      const code = diagnosisErrorCode(error);
      if (code === "Diagnosis.Running") {
        // Someone started one already: follow it.
        await load();
      } else if (code === "Draft.NotReady") {
        message.warning(t(`${PREFIX}.notReady`));
      } else {
        message.error(
          t("bknProject.failedWithReason", {
            reason: requestFailureText(t, error),
            what: t(`${PREFIX}.runFailed`),
          }),
        );
      }
    } finally {
      setStarting(false);
    }
  };

  const settle = (next: DiagnosisSuggestion) =>
    setDiagnosis((current) =>
      current
        ? {
            ...current,
            suggestions: current.suggestions.map((item) => (item.id === next.id ? next : item)),
          }
        : current,
    );

  const apply = async (suggestion: DiagnosisSuggestion) => {
    setBusy(suggestion.id);
    try {
      const result = await applySuggestion(projectId, suggestion.id, draft.updateTime);
      settle({ ...suggestion, ...result.suggestion, status: "applied" });
      onPreview?.(null);
      message.success(t(`${PREFIX}.applyDone`, { title: suggestion.title }));
      await onDraftChanged();
    } catch (error) {
      const code = diagnosisErrorCode(error);
      if (code === "Draft.Stale") {
        message.warning(t(`${PREFIX}.errors.draftStale`));
        await onDraftChanged();
      } else if (code === "Diagnosis.SuggestionStale") {
        message.warning(t(`${PREFIX}.errors.suggestionStale`));
        await load();
      } else if (code === "Diagnosis.NotApplicable") {
        message.warning(
          t(
            suggestion.kind === "writeback_object"
              ? `${PREFIX}.errors.writebackNotApplicable`
              : `${PREFIX}.errors.notApplicable`,
          ),
        );
      } else {
        message.error(requestFailureText(t, error));
      }
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async (suggestion: DiagnosisSuggestion, why: string, done: string) => {
    setBusy(suggestion.id);
    try {
      await dismissSuggestion(projectId, suggestion.id, why);
      settle({ ...suggestion, status: "dismissed" });
      onPreview?.(null);
      message.success(t(done));
      return true;
    } catch (error) {
      message.error(requestFailureText(t, error));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const chooseIdentity = (suggestion: DiagnosisSuggestion) => {
    if (suggestion.apply?.kind !== "choose_identity") {
      return;
    }
    if (!onChooseIdentity(suggestion.apply.objectTypeId, suggestion.apply.candidates)) {
      message.warning(t(`${PREFIX}.errors.objectGone`));
    }
  };

  const objectName = (id: string) =>
    draft.items.objectTypes.find((item) => item.id === id)?.name ?? "";

  const rerunButton = (primary = false) =>
    ownerIsCaller && editable ? (
      <AppButton
        loading={starting}
        onClick={() => void run()}
        size="small"
        type={primary ? "primary" : "default"}
      >
        {t(`${PREFIX}.rerun`)}
      </AppButton>
    ) : null;

  const actions = (suggestion: DiagnosisSuggestion) => {
    if (!editable || suggestion.status !== "open") {
      return null;
    }
    const loading = busy === suggestion.id;
    const disabled = busy !== null && !loading;
    if (suggestion.kind === "data_quality") {
      return (
        <AppButton
          disabled={disabled}
          loading={loading}
          onClick={() => void dismiss(suggestion, "", `${PREFIX}.acknowledgeDone`)}
          size="small"
        >
          {t(`${PREFIX}.actions.acknowledge`)}
        </AppButton>
      );
    }
    return (
      <>
        {suggestion.kind === "choose_identity" ? (
          <AppButton
            disabled={busy !== null}
            onClick={() => chooseIdentity(suggestion)}
            size="small"
            type="primary"
          >
            {t(`${PREFIX}.actions.chooseIdentity`)}
          </AppButton>
        ) : suggestion.apply ? (
          <AppButton
            disabled={disabled}
            loading={loading}
            onClick={() => void apply(suggestion)}
            size="small"
            type="primary"
          >
            {t(`${PREFIX}.actions.apply`)}
          </AppButton>
        ) : null}
        <AppButton
          disabled={busy !== null}
          onClick={() => {
            setReason("");
            setDismissing(suggestion);
          }}
          size="small"
        >
          {t(`${PREFIX}.actions.dismiss`)}
        </AppButton>
      </>
    );
  };

  const writeback = (suggestion: DiagnosisSuggestion) => {
    const spec = suggestion.apply?.kind === "writeback_object" ? suggestion.apply : null;
    if (!spec) {
      return null;
    }
    const label = (name: string) =>
      spec.properties.find((property) => property.name === name)?.displayName || name;
    const tracked = objectName(spec.trackedObjectTypeId);
    return (
      <div className={styles.writeback}>
        <div className={styles.writebackTitle}>{t(`${PREFIX}.writeback.title`)}</div>
        <table>
          <tbody>
            {writebackGroups(spec.properties).map((group) => (
              <tr key={group.role}>
                <th scope="row">{t(`${PREFIX}.writeback.roles.${group.role}`)}</th>
                <td>
                  {listText(
                    t,
                    group.properties.map((property) => property.displayName || property.name),
                  )}
                  {group.role === "tracked" && tracked ? (
                    <span className={styles.muted}>
                      {" "}
                      {t(`${PREFIX}.writeback.tracks`, { name: tracked })}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
            {spec.actions.length ? (
              <tr>
                <th scope="row">{t(`${PREFIX}.writeback.actions`)}</th>
                <td>
                  {spec.actions.map((action) => (
                    <div key={`${action.kind}/${action.name}`}>
                      {t(`${PREFIX}.writeback.action.${action.kind}`, {
                        name: action.name,
                        parameters: listText(t, action.parameters.map(label)),
                      })}
                    </div>
                  ))}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  };

  const card = (suggestion: DiagnosisSuggestion) => {
    const lines = evidenceLines(t, suggestion, draft);
    const impact = impactText(t, suggestion, draft);
    const applied = suggestion.status === "applied";
    return (
      <article
        aria-label={suggestion.title}
        className={`${styles.card} ${applied ? styles.cardApplied : ""}`}
        key={suggestion.id}
        onMouseEnter={() => onPreview?.(suggestion)}
        onMouseLeave={() => onPreview?.(null)}
      >
        <div className={styles.cardHead}>
          <span aria-hidden="true" className={styles.rank}>
            {suggestion.rank}
          </span>
          <div className={styles.cardTitle}>
            <span className={`${styles.tag} ${styles[`tag-${TAG_TONE[suggestion.kind]}`]}`}>
              {t(`${PREFIX}.kind.${suggestion.kind}`)}
            </span>
            <span className={styles.what}>{suggestion.title}</span>
            {applied ? <span className={styles.appliedMark}>{t(`${PREFIX}.applied`)}</span> : null}
          </div>
        </div>
        {suggestion.reason ? <p className={styles.reason}>{suggestion.reason}</p> : null}
        {lines.length ? (
          <ul className={styles.evidence}>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {impact ? (
          <p className={styles.impact}>
            {t(`${PREFIX}.impact.label`)}
            {impact}
          </p>
        ) : null}
        {writeback(suggestion)}
        {editable && suggestion.status === "open" ? (
          <div className={styles.actions}>{actions(suggestion)}</div>
        ) : null}
      </article>
    );
  };

  const body = () => {
    if (diagnosis === undefined) {
      return loadError ? (
        <Alert
          action={
            <AppButton onClick={() => void load()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={t("bknProject.failedWithReason", {
            reason: loadError,
            what: t(`${PREFIX}.loadFailed`),
          })}
          showIcon
          type="error"
        />
      ) : (
        <div className={styles.center}>
          <Spin />
        </div>
      );
    }
    if (diagnosis === null) {
      return (
        <div className={styles.state}>
          <p>{t(`${PREFIX}.never`)}</p>
          {ownerIsCaller ? (
            editable ? (
              <AppButton loading={starting} onClick={() => void run()} type="primary">
                {t(`${PREFIX}.start`)}
              </AppButton>
            ) : null
          ) : (
            <p className={styles.muted}>{t(`${PREFIX}.ownerOnly`)}</p>
          )}
        </div>
      );
    }
    if (diagnosis.state === "running") {
      return (
        <div aria-live="polite" className={styles.state}>
          <Spin />
          <p>{t(`${PREFIX}.running`)}</p>
        </div>
      );
    }
    if (diagnosis.state === "failed") {
      return (
        <Alert
          action={rerunButton()}
          description={t(
            FAILURE_KEYS.has(diagnosis.error)
              ? `${PREFIX}.failed.${diagnosis.error}`
              : `${PREFIX}.failed.generic`,
          )}
          message={t(`${PREFIX}.failed.title`)}
          showIcon
          type="error"
        />
      );
    }
    const metrics = diagnosis.metrics;
    const shown = diagnosis.suggestions.filter((item) => item.status !== "dismissed");
    const open = shown.filter((item) => item.status === "open");
    const count = (value: Tab) =>
      value === "all" ? open.length : open.filter((item) => item.group === value).length;
    const listed = tab === "all" ? shown : shown.filter((item) => item.group === tab);
    const none = t(`${PREFIX}.metrics.none`);
    const shareText = (share: number | null) => (share === null ? none : `${share}%`);
    const connectivity = metrics
      ? percent(metrics.connectivity.largest, metrics.connectivity.objects)
      : null;
    const references = metrics
      ? percent(metrics.references.covered, metrics.references.total)
      : null;
    const reachability = metrics
      ? percent(metrics.reachability.reachable, metrics.reachability.total)
      : null;
    return (
      <>
        {diagnosis.stale ? (
          <Alert
            action={rerunButton(true)}
            message={t(`${PREFIX}.stale`)}
            showIcon
            type="warning"
          />
        ) : null}
        {metrics ? (
          <div className={styles.metrics}>
            <Metric
              detail={t(`${PREFIX}.metrics.connectivityDetail`, metrics.connectivity)}
              label={t(`${PREFIX}.metrics.connectivity`)}
              share={connectivity}
              value={shareText(connectivity)}
            />
            <Metric
              detail={t(`${PREFIX}.metrics.referencesDetail`, metrics.references)}
              label={t(`${PREFIX}.metrics.references`)}
              share={references}
              value={shareText(references)}
            />
            <Metric
              detail={t(`${PREFIX}.metrics.reachabilityDetail`, {
                missing: metrics.reachability.total - metrics.reachability.reachable,
                total: metrics.reachability.total,
              })}
              label={t(`${PREFIX}.metrics.reachability`)}
              share={reachability}
              value={shareText(reachability)}
            />
            <Metric
              detail={t(`${PREFIX}.metrics.pendingDetail`)}
              label={t(`${PREFIX}.metrics.pending`)}
              value={String(metrics.pendingConcepts)}
            />
          </div>
        ) : null}
        <Segmented<Tab>
          block
          onChange={setTab}
          options={TABS.map((value) => ({
            label: t(`${PREFIX}.tabs.${value}`, { count: count(value) }),
            value,
          }))}
          size="small"
          value={tab}
        />
        <div className={styles.list}>
          {listed.length ? (
            listed.map(card)
          ) : (
            <p className={styles.muted}>{t(`${PREFIX}.empty`)}</p>
          )}
        </div>
      </>
    );
  };

  const settled =
    diagnosis && (diagnosis.state === "ready" || diagnosis.state === "failed") && !diagnosis.stale;

  return (
    <aside aria-label={t(`${PREFIX}.title`)} className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.title}>{t(`${PREFIX}.title`)}</span>
        <span className={styles.headerActions}>
          {settled && diagnosis.state === "ready" ? rerunButton() : null}
          <AppButton
            aria-label={t(`${PREFIX}.close`)}
            icon={<CloseOutlined />}
            onClick={onClose}
            type="text"
          />
        </span>
      </header>
      <div className={styles.body}>
        <p className={styles.hint}>{t(`${PREFIX}.hint`)}</p>
        {body()}
      </div>
      <Modal
        cancelText={t("common.cancel")}
        confirmLoading={dismissing !== null && busy === dismissing.id}
        destroyOnHidden
        okText={t(`${PREFIX}.dismissDialog.ok`)}
        onCancel={() => setDismissing(null)}
        onOk={() => {
          if (dismissing) {
            void dismiss(dismissing, reason, `${PREFIX}.dismissDone`).then((done) => {
              if (done) {
                setDismissing(null);
              }
            });
          }
        }}
        open={dismissing !== null}
        title={t(`${PREFIX}.dismissDialog.title`)}
      >
        <label className={styles.reasonLabel}>
          {t(`${PREFIX}.dismissDialog.reason`)}
          <Input.TextArea
            autoSize={{ maxRows: 4, minRows: 2 }}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t(`${PREFIX}.dismissDialog.placeholder`)}
            value={reason}
          />
        </label>
      </Modal>
    </aside>
  );
}
