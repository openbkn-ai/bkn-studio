/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Drawer, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { CapabilityUpgradeDialog } from "@/framework/entitlement/CapabilityUpgradeDialog";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import {
  candidateReasonText,
  guideText,
  implementationReasonText,
  KINETIC,
  logicKindText,
  needStateText,
  needStateTone,
  executionText,
} from "@/modules/bkn-project/components/kinetic/kineticMessages";
import {
  IMPLEMENTED_HERE,
  implementationPath,
  needState,
  type ObjectMetricsMode,
  openInNewTab,
} from "@/modules/bkn-project/components/kinetic/needs";
import { Citations } from "@/modules/bkn-project/components/requirements/Citations";
import { getLogicNeedCandidates } from "@/modules/bkn-project/services/kinetic.service";
import type {
  LogicNeedCandidate,
  LogicNeedTarget,
  LogicNeedView,
} from "@/modules/bkn-project/types/kinetic";

import styles from "./Kinetic.module.css";

const PANEL = `${KINETIC}.panel`;

/**
 * One kinetic need: what it is and rests on, what implements it in the live network as read
 * now, the close matches a person may link, and how to implement it. Nothing links by itself.
 */
export function KineticNeedPanel({
  canEdit,
  executor,
  metricsMode,
  need,
  networkId,
  objectName,
  onClose,
  onImplement,
  onLink,
  onGoToModel,
  onUnlink,
  projectId,
  questions,
  saving,
}: {
  canEdit: boolean;
  metricsMode: ObjectMetricsMode;
  need: LogicNeedView;
  /** The live network; empty when it could not be read. */
  networkId: string;
  objectName: (id: string) => string;
  onClose: () => void;
  /** Opens the live network's form for a metric or action type. */
  onImplement: (need: LogicNeedView) => void;
  /** An action type's: the need that carries it out, when it names one. */
  executor?: LogicNeedView;
  onLink: (need: LogicNeedView, target: LogicNeedTarget, name: string) => void;
  /** Opens concept modeling, where the missing relations are added. */
  onGoToModel?: () => void;
  onUnlink: (need: LogicNeedView) => void;
  projectId: string;
  /** How many scenario questions rest on it. */
  questions: number;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const state = needState(need);
  const metric = need.kind === "metric";
  // Without the edition's metrics nothing about metrics is asked of the live network.
  const metricBlocked = metric && metricsMode !== "enabled";
  const wantsCandidates =
    state !== "implemented" && state !== "recordOnly" && !metricBlocked && Boolean(networkId);
  const [candidates, setCandidates] = useState<LogicNeedCandidate[] | null | undefined>(undefined);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!wantsCandidates) {
      return undefined;
    }
    let active = true;
    setCandidates(undefined);
    getLogicNeedCandidates(projectId, need.id)
      .then((next) => active && setCandidates(next.candidates))
      .catch(() => active && setCandidates(null));
    return () => {
      active = false;
    };
  }, [need.id, projectId, wantsCandidates]);

  const implementation = need.implementation;
  const viewPath = need.link && networkId ? implementationPath(networkId, need.link) : null;
  const implementable = IMPLEMENTED_HERE.includes(need.kind);
  const live = need.liveObjectTypeIds.length > 0;
  const guide = metricBlocked
    ? t(`${PANEL}.${metricsMode === "locked" ? "metricLocked" : "metricHidden"}`)
    : state === "waitingRelease"
      ? t(`${PANEL}.waitingRelease`)
      : implementable && !need.objectTypeIds.length
        ? t(`${PANEL}.noObjects`)
        : guideText(t, need.kind);
  const canImplement =
    canEdit &&
    implementable &&
    !metricBlocked &&
    live &&
    Boolean(networkId) &&
    state !== "implemented";

  return (
    <Drawer
      destroyOnHidden
      footer={<AppButton onClick={onClose}>{t(`${PANEL}.close`)}</AppButton>}
      onClose={onClose}
      open
      title={
        <span className={styles.row}>
          <span>{need.name}</span>
          <LightStatusTag tone="info">{logicKindText(t, need.kind)}</LightStatusTag>
          {metric && metricsMode !== "hidden" ? (
            <EditionBadge alwaysShow edition="professional" />
          ) : null}
        </span>
      }
      width={560}
    >
      <div className={styles.stack}>
        <LightStatusTag tone={needStateTone(state)}>{needStateText(t, state)}</LightStatusTag>
        {need.definition ? (
          <section className={styles.block}>
            <h4 className={styles.blockTitle}>{t(`${PANEL}.definition`)}</h4>
            <p>{need.definition}</p>
          </section>
        ) : null}
        {need.kind === "action_type" ? (
          <section className={styles.block}>
            <h4 className={styles.blockTitle}>{t(`${PANEL}.executedBy`)}</h4>
            {executor ? (
              <span className={styles.row}>
                <span>{executionText(t, executor)}</span>
                <LightStatusTag tone={needStateTone(needState(executor))}>
                  {needStateText(t, needState(executor))}
                </LightStatusTag>
              </span>
            ) : (
              <p className={styles.muted}>{t(`${PANEL}.executedByNone`)}</p>
            )}
          </section>
        ) : null}
        {need.objectTypeIds.length ? (
          <section className={styles.block}>
            <h4 className={styles.blockTitle}>{t(`${PANEL}.objects`)}</h4>
            <p>{need.objectTypeIds.map(objectName).join(t("bknProject.listSeparator"))}</p>
          </section>
        ) : null}
        {need.unconnected.length ? (
          <Alert
            action={
              onGoToModel ? (
                <AppButton onClick={onGoToModel} size="small">
                  {t(`${PANEL}.goToModel`)}
                </AppButton>
              ) : undefined
            }
            message={t(`${PANEL}.unconnected`, {
              pairs: need.unconnected
                .map(({ from, to }) =>
                  t(`${PANEL}.unconnectedPair`, { from: objectName(from), to: objectName(to) }),
                )
                .join(t("bknProject.listSeparator")),
            })}
            showIcon
            type="warning"
          />
        ) : null}
        <Citations citations={need.citations} supplementReason={need.supplementReason} />
        {questions ? (
          <p className={styles.muted}>{t(`${PANEL}.usedBy`, { count: questions })}</p>
        ) : null}

        {need.link ? (
          <section className={styles.block}>
            <h4 className={styles.blockTitle}>{t(`${PANEL}.implementation`)}</h4>
            {implementation?.available ? (
              <div className={styles.card}>
                <strong>{implementation.name}</strong>
                {implementation.description ? (
                  <span className={styles.muted}>{implementation.description}</span>
                ) : null}
                <span className={styles.row}>
                  {implementation.status ? (
                    <span className={styles.muted}>
                      {t(`${PANEL}.status`, { status: implementation.status })}
                    </span>
                  ) : null}
                  {implementation.version ? (
                    <span className={styles.muted}>
                      {t(`${PANEL}.version`, { version: implementation.version })}
                    </span>
                  ) : null}
                  {implementation.ownerObjectTypeName || implementation.ownerObjectTypeId ? (
                    <span className={styles.muted}>
                      {t(`${PANEL}.owner`, {
                        name:
                          implementation.ownerObjectTypeName || implementation.ownerObjectTypeId,
                      })}
                    </span>
                  ) : null}
                </span>
              </div>
            ) : (
              <Alert
                message={implementationReasonText(t, implementation?.reason ?? "")}
                showIcon
                type={state === "broken" ? "error" : "warning"}
              />
            )}
            <span className={styles.row}>
              {viewPath && implementation?.available ? (
                <AppButton
                  aria-label={t(`${PANEL}.viewItem`, { name: implementation.name })}
                  onClick={() => openInNewTab(viewPath)}
                  size="small"
                >
                  {t(`${PANEL}.view`)}
                </AppButton>
              ) : null}
              {canEdit ? (
                <AppButton
                  danger
                  disabled={saving}
                  onClick={() => onUnlink(need)}
                  size="small"
                  type="text"
                >
                  {t(`${PANEL}.unlink`)}
                </AppButton>
              ) : null}
            </span>
          </section>
        ) : null}

        {wantsCandidates ? (
          <section className={styles.block}>
            <h4 className={styles.blockTitle}>{t(`${PANEL}.candidates`)}</h4>
            {candidates === undefined ? (
              <Spin size="small" />
            ) : candidates === null ? (
              <p className={styles.muted}>{t(`${PANEL}.candidatesFailed`)}</p>
            ) : candidates.length ? (
              <ul className={styles.list}>
                {candidates.map((candidate) => (
                  <li
                    className={styles.card}
                    key={`${candidate.type}/${candidate.boxId}/${candidate.id}`}
                  >
                    <span className={styles.row}>
                      <strong>{candidate.name}</strong>
                      {candidate.reasons.map((reason) => (
                        <LightStatusTag key={reason} tone="neutral">
                          {candidateReasonText(t, reason)}
                        </LightStatusTag>
                      ))}
                      <span className={styles.spacer} />
                      {canEdit ? (
                        <AppButton
                          aria-label={t(`${PANEL}.connectItem`, { name: candidate.name })}
                          disabled={saving}
                          onClick={() =>
                            onLink(
                              need,
                              { boxId: candidate.boxId, id: candidate.id, type: candidate.type },
                              candidate.name,
                            )
                          }
                          size="small"
                          type="primary"
                        >
                          {t(`${PANEL}.connect`)}
                        </AppButton>
                      ) : null}
                    </span>
                    {candidate.description ? (
                      <span className={styles.muted}>{candidate.description}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>{t(`${PANEL}.candidatesNone`)}</p>
            )}
          </section>
        ) : null}

        {state === "implemented" ? null : (
          <Alert
            action={
              metricBlocked && metricsMode === "locked" ? (
                <AppButton onClick={() => setUpgrading(true)} size="small">
                  {t(`${PANEL}.upgrade`)}
                </AppButton>
              ) : undefined
            }
            message={guide}
            showIcon
            type="info"
          />
        )}
        {canImplement ? (
          <span>
            <AppButton disabled={saving} onClick={() => onImplement(need)} type="primary">
              {t(`${PANEL}.implement.${need.kind}`)}
            </AppButton>
          </span>
        ) : null}
      </div>
      <CapabilityUpgradeDialog
        capability={CAPABILITIES.OBJECT_METRICS}
        minEdition="professional"
        onClose={() => setUpgrading(false)}
        open={upgrading}
      />
    </Drawer>
  );
}
