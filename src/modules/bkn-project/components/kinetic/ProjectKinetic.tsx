/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Select, Spin, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import {
  KINETIC,
  logicKindText,
  needStateText,
  needStateTone,
  runErrorText,
  sourceText,
} from "@/modules/bkn-project/components/kinetic/kineticMessages";
import { KineticNeedDialog } from "@/modules/bkn-project/components/kinetic/KineticNeedDialog";
import { KineticNeedPanel } from "@/modules/bkn-project/components/kinetic/KineticNeedPanel";
import {
  canExecute,
  executionPrefill,
  LOGIC_KINDS,
  METRIC_TYPES,
  NEED_STATES,
  type NeedState,
  needState,
  readImplementedReturn,
  useObjectMetricsMode,
} from "@/modules/bkn-project/components/kinetic/needs";
import { DocumentViewer } from "@/modules/bkn-project/components/requirements/Citations";
import { Citing } from "@/modules/bkn-project/components/requirements/citing";
import { requirementErrorText } from "@/modules/bkn-project/components/requirements/requirementMessages";
import { getDraft } from "@/modules/bkn-project/services/draft.service";
import {
  getLogicNeeds,
  linkLogicNeed,
  unlinkLogicNeed,
} from "@/modules/bkn-project/services/kinetic.service";
import { getProjectStatus, projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import {
  addItem,
  analyzeKinetic,
  editItem,
  getRequirements,
  listDocuments,
  removeItem,
  REQUIREMENTS_POLL_MS,
  reviewRequirements,
} from "@/modules/bkn-project/services/requirements.service";
import type {
  LogicNeeds,
  LogicNeedTarget,
  LogicNeedView,
} from "@/modules/bkn-project/types/kinetic";
import type { Project } from "@/modules/bkn-project/types/project";
import type { RequirementDocument, Requirements } from "@/modules/bkn-project/types/requirements";
import { projectSectionPath } from "@/modules/bkn-project/types/workspace";
import type {
  ActionTypeNavigationContext,
  ObjectMetricNavigationContext,
} from "@/modules/knowledge-network";

import styles from "./Kinetic.module.css";

const ALL = "all";

/**
 * Kinetic modeling: what the confirmed concept model needs computed or done beyond what it
 * stores — metrics, functions, Skills, MCP tools, APIs, applications and action types — and what
 * implements each in the project's live network. A person accepts, edits or adds needs, links
 * what the network already has, or opens the network's own forms to build a metric or an action
 * type and comes back to link it. Nothing is linked by itself.
 */
export function ProjectKinetic({
  onGoToModel,
  onGoToRelease,
  ownerIsCaller,
  project,
}: {
  /** Opens concept modeling, where the model is confirmed. */
  onGoToModel: () => void;
  /** Opens the release page, where the live network's changes are committed. */
  onGoToRelease: () => void;
  ownerIsCaller: boolean;
  project: Project;
}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const location = useLocation();
  const navigate = useNavigate();
  const metricsMode = useObjectMetricsMode();
  const canEdit = ownerIsCaller && !project.archived;

  // undefined while loading, null before the first drafting or analysis.
  const [requirements, setRequirements] = useState<Requirements | null | undefined>(undefined);
  // The needs as the live network implements them; null when that could not be read.
  const [logic, setLogic] = useState<LogicNeeds | null>(null);
  const [failed, setFailed] = useState(false);
  // null while unknown; the analysis needs a confirmed model.
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [documents, setDocuments] = useState<RequirementDocument[]>([]);
  const [objectTypes, setObjectTypes] = useState<{ id: string; name: string }[]>([]);
  const [kind, setKind] = useState<string>(ALL);
  const [stateFilter, setStateFilter] = useState<string>(ALL);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ needId: string | null } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Something was built in the live network and linked: it has to be committed before releasing.
  const [liveChanged, setLiveChanged] = useState(false);
  const [viewing, setViewing] = useState<{
    documentId: string;
    range?: { end: number; start: number };
  } | null>(null);
  const sending = useRef(false);
  const latest = useRef(0);
  const [reads, setReads] = useState(0);

  const load = useCallback(async () => {
    const read = ++latest.current;
    try {
      const [nextRequirements, nextLogic] = await Promise.all([
        getRequirements(project.id),
        getLogicNeeds(project.id).catch(() => null),
      ]);
      if (read === latest.current) {
        setRequirements(nextRequirements);
        setLogic(nextLogic);
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

  // What the page names but does not change: the confirmation, the documents and the draft.
  useEffect(() => {
    let active = true;
    getProjectStatus(project.id)
      .then((status) => active && setConfirmed(status.confirmation !== null))
      .catch(() => undefined);
    listDocuments(project.id)
      .then((next) => active && setDocuments(next))
      .catch(() => undefined);
    getDraft(project.id)
      .then(
        (draft) =>
          active &&
          draft &&
          setObjectTypes(
            draft.items.objectTypes
              .filter((item) => item.adopted)
              .map(({ id, name }) => ({ id, name })),
          ),
      )
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id]);

  const run = requirements?.spec.runs.kinetic ?? null;
  const running = run?.status === "running";
  useEffect(() => {
    if (!running) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(), REQUIREMENTS_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [load, reads, running]);

  const updateTime = logic?.updateTime ?? requirements?.updateTime;

  /** Sends an edit made on the specification as read, then reads the needs again. */
  const apply = useCallback(
    async (send: (time: number) => Promise<unknown>) => {
      if (updateTime === undefined || sending.current) {
        return false;
      }
      sending.current = true;
      setSaving(true);
      try {
        latest.current += 1;
        await send(updateTime);
        setDialog(null);
        return true;
      } catch (error) {
        const code = projectErrorCode(error);
        if (code === "Requirement.Stale") {
          message.warning(t(`${KINETIC}.editing.stale`));
          setDialog(null);
        } else {
          message.error(requirementErrorText(t, code));
        }
        return false;
      } finally {
        sending.current = false;
        setSaving(false);
        void load();
      }
    },
    [load, message, t, updateTime],
  );

  const link = (need: LogicNeedView, target: LogicNeedTarget, name: string) =>
    void apply((time) => linkLogicNeed(project.id, need.id, target, time)).then((done) => {
      if (done) {
        message.success(t(`${KINETIC}.linked`, { name }));
        setOpenId(null);
      }
    });

  // Back from the metric editor or the action type form with what was made there: it is linked
  // once, and the navigation state is cleared so reading the page again does not link it twice.
  const returned = useRef(false);
  useEffect(() => {
    const back = readImplementedReturn(location.state);
    if (!back || returned.current || requirements === undefined || updateTime === undefined) {
      return;
    }
    returned.current = true;
    const name =
      requirements?.spec.logicNeeds.find((need) => need.id === back.needId)?.name ?? back.id;
    void apply((time) =>
      linkLogicNeed(project.id, back.needId, { boxId: "", id: back.id, type: back.type }, time),
    ).then((done) => {
      void navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
      if (done) {
        message.success(t(`${KINETIC}.linked`, { name }));
        setLiveChanged(true);
      }
    });
  }, [
    apply,
    location.pathname,
    location.search,
    location.state,
    message,
    navigate,
    project.id,
    requirements,
    t,
    updateTime,
  ]);

  const analyze = async (discardDecisions: boolean) => {
    setAnalyzing(true);
    try {
      latest.current += 1;
      setRequirements(await analyzeKinetic(project.id, discardDecisions));
    } catch (error) {
      const code = projectErrorCode(error);
      if (code === "Requirement.ModelNotConfirmed") {
        setConfirmed(false);
      } else {
        message.error(requirementErrorText(t, code));
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const startOver = () =>
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t(`${KINETIC}.startOverContent`),
      okButtonProps: { danger: true },
      okText: t(`${KINETIC}.startOver`),
      onOk: () => analyze(true),
      title: t(`${KINETIC}.startOverTitle`),
    });

  const objectName = useCallback(
    (id: string) => objectTypes.find((item) => item.id === id)?.name ?? id,
    [objectTypes],
  );
  const citing = useMemo(
    () => ({
      documentName: (documentId: string) =>
        documents.find((document) => document.id === documentId)?.name ??
        t("bknProject.requirements.removedDocument"),
      openDocument: (documentId: string, range?: { end: number; start: number }) =>
        setViewing({ documentId, range }),
    }),
    [documents, t],
  );

  const spec = requirements?.spec ?? null;
  // The live read when there is one; the specification's needs say nothing of what implements them.
  const needs: LogicNeedView[] = useMemo(
    () =>
      logic?.needs ??
      (spec?.logicNeeds ?? []).map((need) => ({
        ...need,
        implementation: null,
        link: null,
        liveObjectTypeIds: [],
        unconnected: [],
      })),
    [logic, spec],
  );
  const live = logic !== null;
  // Before the project's first release, whatever a running network has was there already.
  const existingNetwork = Boolean(logic?.live && !logic.released);
  const networkId = logic?.networkId ?? "";
  const kinetic = projectSectionPath(project.id, "kinetic");

  const implement = (need: LogicNeedView) => {
    const objectTypeId = need.liveObjectTypeIds[0];
    if (!objectTypeId || !networkId) {
      return;
    }
    const network = `/knowledge-network/workspace/${encodeURIComponent(networkId)}`;
    const title = t(`${KINETIC}.handOff.title`, { name: need.name });
    const returnLabel = t(`${KINETIC}.handOff.returnLabel`);
    if (need.kind === "metric") {
      const objects = need.objectTypeIds.map(objectName).join(t("bknProject.listSeparator"));
      const objectMetricContext: ObjectMetricNavigationContext = {
        description: need.definition || undefined,
        prompt: need.definition
          ? t(`${KINETIC}.handOff.metricPrompt`, {
              definition: need.definition,
              name: need.name,
              objects,
            })
          : t(`${KINETIC}.handOff.metricPromptShort`, { name: need.name, objects }),
        returnLabel,
        returnState: { needId: need.id },
        returnTo: kinetic,
        title,
      };
      const query = new URLSearchParams({
        metricType: (METRIC_TYPES as readonly string[]).includes(need.suggestedMetricType)
          ? need.suggestedMetricType
          : "atomic",
        objectTypeId,
      });
      void navigate(`${network}/metrics/create?${query.toString()}`, {
        state: { objectMetricContext },
      });
    } else if (need.kind === "action_type") {
      // What carries it out fills the form once it is implemented; until then the form says so.
      const executor = needs.find((item) => item.id === need.executedBy && canExecute(item.kind));
      const execution = executor ? executionPrefill(executor) : undefined;
      const actionTypeContext: ActionTypeNavigationContext = {
        description: need.definition || undefined,
        notice:
          executor && !execution
            ? t(`${KINETIC}.handOff.executorPending`, { name: executor.name })
            : undefined,
        prefill: {
          description: need.definition,
          ...(execution ? { execution } : {}),
          name: need.name,
          objectTypeId,
        },
        returnLabel,
        returnState: { needId: need.id },
        returnTo: kinetic,
        title,
      };
      void navigate(`${network}/action-types/create`, { state: { actionTypeContext } });
    }
  };

  const unlink = (need: LogicNeedView) =>
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t(`${KINETIC}.panel.unlinkContent`),
      okButtonProps: { danger: true },
      okText: t(`${KINETIC}.panel.unlink`),
      onOk: () =>
        apply((time) => unlinkLogicNeed(project.id, need.id, time)).then((done) => {
          if (done) {
            message.success(t(`${KINETIC}.panel.unlinked`));
          }
        }),
      title: t(`${KINETIC}.panel.unlinkTitle`, {
        name: need.implementation?.name || need.name,
      }),
    });

  const remove = (need: LogicNeedView) =>
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t(`${KINETIC}.editing.removeConfirm`),
      okButtonProps: { danger: true },
      okText: t(`${KINETIC}.editing.remove`),
      onOk: () => apply((time) => removeItem(project.id, "logic_needs", need.id, time)),
      title: t(`${KINETIC}.editing.removeTitle`, { name: need.name }),
    });

  const review = (need: LogicNeedView, accept: boolean) =>
    void apply((time) =>
      accept
        ? reviewRequirements(project.id, time, [{ id: need.id, kind: "logic_needs" }])
        : reviewRequirements(project.id, time, [], [{ id: need.id, kind: "logic_needs" }]),
    );

  if (failed && requirements === undefined) {
    return (
      <Alert
        action={
          <AppButton onClick={() => void load()} size="small">
            {t("common.retry")}
          </AppButton>
        }
        message={t(`${KINETIC}.loadFailed`)}
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

  const states = needs.map((need) => ({ need, state: needState(need) }));
  const count = (state: NeedState) => states.filter((entry) => entry.state === state).length;
  const shown = states.filter(
    (entry) =>
      (kind === ALL || entry.need.kind === kind) &&
      // The state filter shows only with the live read: without it, it is not applied.
      (!live || stateFilter === ALL || entry.state === stateFilter),
  );
  const waiting = needs.filter((need) => !need.accepted);
  const editable = canEdit && requirements !== null && !running;
  const openNeed = openId ? needs.find((need) => need.id === openId) : undefined;
  const questionsOf = (needId: string) =>
    spec?.questions.filter((question) => question.logicNeedIds.includes(needId)).length ?? 0;
  const notConfirmed = confirmed === false;

  const columns: ColumnsType<{ need: LogicNeedView; state: NeedState }> = [
    {
      key: "name",
      render: (_, { need }) => (
        <span className={styles.name}>
          <span>{need.name}</span>
          {need.definition ? <span className={styles.definition}>{need.definition}</span> : null}
        </span>
      ),
      title: t(`${KINETIC}.columns.name`),
    },
    {
      key: "kind",
      render: (_, { need }) => (
        <span className={styles.row}>
          <LightStatusTag tone="info">{logicKindText(t, need.kind)}</LightStatusTag>
          {need.kind === "metric" && metricsMode !== "hidden" ? (
            <EditionBadge alwaysShow edition="professional" />
          ) : null}
        </span>
      ),
      title: t(`${KINETIC}.columns.kind`),
      width: 150,
    },
    {
      key: "source",
      render: (_, { need }) => (
        <span className={styles.definition}>
          {need.source === "documents" && need.citations.length
            ? t(`${KINETIC}.source.documentsFrom`, {
                name: citing.documentName(need.citations[0].documentId),
              })
            : sourceText(t, need.source)}
        </span>
      ),
      title: t(`${KINETIC}.columns.source`),
    },
    {
      key: "objects",
      render: (_, { need }) => (
        <span className={styles.definition}>
          {need.objectTypeIds.map(objectName).join(t("bknProject.listSeparator"))}
        </span>
      ),
      title: t(`${KINETIC}.columns.objects`),
    },
    {
      key: "state",
      render: (_, { need, state }) => (
        <span className={styles.row}>
          {live ? (
            <LightStatusTag tone={needStateTone(state)}>{needStateText(t, state)}</LightStatusTag>
          ) : null}
          {need.unconnected.length ? (
            <LightStatusTag tone="warning">{t(`${KINETIC}.unconnectedMark`)}</LightStatusTag>
          ) : null}
          {need.accepted ? null : (
            <LightStatusTag tone="warning">{t(`${KINETIC}.review.pending`)}</LightStatusTag>
          )}
        </span>
      ),
      title: t(`${KINETIC}.columns.state`),
      width: 180,
    },
    {
      key: "actions",
      render: (_, { need, state }) => (
        <span className={styles.actions}>
          <AppButton onClick={() => setOpenId(need.id)} size="small" type="link">
            {t(
              `${KINETIC}.cta.${state === "pending" ? "match" : state === "broken" ? "rematch" : "view"}`,
            )}
          </AppButton>
          {editable && !need.accepted ? (
            <AppButton
              aria-label={t(`${KINETIC}.review.acceptItem`, { name: need.name })}
              disabled={saving}
              onClick={() => review(need, true)}
              size="small"
              type="link"
            >
              {t(`${KINETIC}.review.accept`)}
            </AppButton>
          ) : null}
          {editable ? (
            <>
              <AppButton
                aria-label={t(`${KINETIC}.editing.editItem`, { name: need.name })}
                onClick={() => setDialog({ needId: need.id })}
                size="small"
                type="link"
              >
                {t(`${KINETIC}.editing.edit`)}
              </AppButton>
              <AppButton
                aria-label={t(`${KINETIC}.editing.removeItem`, { name: need.name })}
                danger
                onClick={() => remove(need)}
                size="small"
                type="link"
              >
                {t(`${KINETIC}.editing.remove`)}
              </AppButton>
            </>
          ) : null}
        </span>
      ),
      title: t(`${KINETIC}.columns.actions`),
      width: 220,
    },
  ];

  const analyzeButton = (
    <AppButton
      disabled={notConfirmed || running}
      loading={analyzing}
      onClick={() => void analyze(false)}
      type={needs.length ? "default" : "primary"}
    >
      {t(`${KINETIC}.${run ? "reanalyze" : "analyze"}`)}
    </AppButton>
  );

  return (
    <Citing.Provider value={citing}>
      <div className={styles.page}>
        <div className={styles.head}>
          <p className={styles.intro}>{t(`${KINETIC}.intro`)}</p>
          {editable && waiting.length ? (
            <AppButton
              disabled={saving}
              onClick={() =>
                void apply((time) =>
                  reviewRequirements(
                    project.id,
                    time,
                    waiting.map(({ id }) => ({ id, kind: "logic_needs" as const })),
                  ),
                )
              }
              type="primary"
            >
              {t(`${KINETIC}.review.acceptAll`, { count: waiting.length })}
            </AppButton>
          ) : null}
          {editable ? (
            <AppButton onClick={() => setDialog({ needId: null })}>
              {t(`${KINETIC}.editing.add`)}
            </AppButton>
          ) : null}
          {canEdit ? (
            notConfirmed ? (
              <Tooltip title={t(`${KINETIC}.modelNotConfirmed`)}>
                <span>{analyzeButton}</span>
              </Tooltip>
            ) : (
              analyzeButton
            )
          ) : null}
          {canEdit && run ? (
            <AppButton
              danger
              disabled={notConfirmed || running || analyzing}
              onClick={startOver}
              type="text"
            >
              {t(`${KINETIC}.startOver`)}
            </AppButton>
          ) : null}
        </div>
        {notConfirmed ? (
          <Alert
            action={
              <AppButton onClick={onGoToModel} size="small">
                {t(`${KINETIC}.goToModel`)}
              </AppButton>
            }
            message={t(`${KINETIC}.modelNotConfirmed`)}
            showIcon
            type="warning"
          />
        ) : null}
        {running ? <Alert message={t(`${KINETIC}.running`)} showIcon type="info" /> : null}
        {run?.status === "failed" ? (
          <Alert
            message={t(`${KINETIC}.failed`, { reason: runErrorText(t, run.error) })}
            showIcon
            type="error"
          />
        ) : null}
        {run?.stale && !running ? (
          <Alert message={t(`${KINETIC}.runStale`)} showIcon type="warning" />
        ) : null}
        {liveChanged ? (
          <Alert
            action={
              <AppButton onClick={onGoToRelease} size="small">
                {t(`${KINETIC}.goToRelease`)}
              </AppButton>
            }
            closable
            message={t(`${KINETIC}.commitHint`)}
            onClose={() => setLiveChanged(false)}
            showIcon
            type="success"
          />
        ) : null}
        {/* Before the network runs a version nothing is implemented live: that is not a failure. */}
        {logic && !logic.live ? (
          <Alert message={t(`${KINETIC}.beforeRelease`)} showIcon type="info" />
        ) : null}
        {/* A network the project started from runs already: what it has can be linked now. */}
        {existingNetwork ? (
          <Alert message={t(`${KINETIC}.liveBeforeRelease`)} showIcon type="info" />
        ) : null}
        {!live || logic?.reason ? (
          <Alert message={t(`${KINETIC}.liveUnavailable`)} showIcon type="warning" />
        ) : null}
        <Alert message={t(`${KINETIC}.liveNote`)} showIcon type="info" />
        {live && needs.length ? (
          <div className={styles.stats}>
            {(["implemented", "pending", "waitingRelease"] as const).map((state) => (
              <div className={styles.stat} key={state}>
                <span className={styles.muted}>{t(`${KINETIC}.stats.${state}`)}</span>
                <span className={styles.statValue}>
                  {state === "pending" ? count("pending") + count("broken") : count(state)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {needs.length ? (
          <>
            <div className={styles.filters}>
              <Select
                aria-label={t(`${KINETIC}.filter.kind`)}
                className={styles.filter}
                onChange={setKind}
                options={[
                  { label: t(`${KINETIC}.filter.all`), value: ALL },
                  ...LOGIC_KINDS.map((value) => ({ label: logicKindText(t, value), value })),
                ]}
                prefix={t(`${KINETIC}.filter.kind`)}
                value={kind}
              />
              {live ? (
                <Select
                  aria-label={t(`${KINETIC}.filter.state`)}
                  className={styles.filter}
                  onChange={setStateFilter}
                  options={[
                    { label: t(`${KINETIC}.filter.all`), value: ALL },
                    ...NEED_STATES.map((value) => ({ label: needStateText(t, value), value })),
                  ]}
                  prefix={t(`${KINETIC}.filter.state`)}
                  value={stateFilter}
                />
              ) : null}
            </div>
            <AppTable<{ need: LogicNeedView; state: NeedState }>
              columns={columns}
              dataSource={shown}
              locale={{ emptyText: t(`${KINETIC}.noneFiltered`) }}
              pagination={shown.length > 20 ? { pageSize: 20 } : false}
              rowKey={(entry) => entry.need.id}
              size="middle"
            />
          </>
        ) : (
          <p className={styles.muted}>{t(`${KINETIC}.none`)}</p>
        )}
        {openNeed ? (
          <KineticNeedPanel
            canEdit={editable}
            existingNetwork={existingNetwork}
            executor={needs.find(
              (item) => item.id === openNeed.executedBy && canExecute(item.kind),
            )}
            metricsMode={metricsMode}
            need={openNeed}
            networkId={networkId}
            objectName={objectName}
            onClose={() => setOpenId(null)}
            onGoToModel={onGoToModel}
            onImplement={implement}
            onLink={link}
            onUnlink={unlink}
            projectId={project.id}
            questions={questionsOf(openNeed.id)}
            saving={saving}
          />
        ) : null}
        {dialog ? (
          <KineticNeedDialog
            need={
              dialog.needId
                ? (spec?.logicNeeds.find((need) => need.id === dialog.needId) ?? null)
                : null
            }
            executors={(spec?.logicNeeds ?? []).filter(
              (need) => canExecute(need.kind) && need.id !== dialog.needId,
            )}
            objectTypes={objectTypes}
            onCancel={() => setDialog(null)}
            onSave={(fields) =>
              apply((time) =>
                dialog.needId
                  ? editItem(project.id, "logic_needs", dialog.needId, fields, time)
                  : addItem(project.id, "logic_needs", fields, time),
              )
            }
            saving={saving}
          />
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
