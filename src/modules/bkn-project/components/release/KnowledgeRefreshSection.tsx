/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppServices } from "@/framework/context/use-app-services";
import { BknProjectKbBadge, BknProjectKbSlot } from "@/framework/entitlement/BknProjectKbSlot";
import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import {
  commandKnowledgeRefresh,
  getKnowledgeRefresh,
  type KnowledgeRefreshStatus,
} from "@/modules/bkn-project/services/kb-refresh.service";
import { Section } from "./ReleaseSection";
import styles from "./Release.module.css";

const PREFIX = "bknProject.knowledgeRefresh";
const STATES = new Set([
  "idle",
  "running",
  "ready",
  "applying",
  "finishing",
  "discarding",
  "attention",
]);
const REASONS = new Set([
  "batch_review_required",
  "submission_unknown",
  "source_or_publication_changed",
  "source_access_changed",
  "source_unavailable",
  "source_hold_unavailable",
  "unsupported_content",
  "invalid_evidence",
  "invalid_extraction",
  "extraction_failed",
  "execution_changed",
  "execution_unknown",
  "task_unavailable",
  "write_set_changed",
  "write_plan_changed",
  "write_plan_unavailable",
  "dataset_write_unavailable",
  "hold_release_unavailable",
  "previous_version_update",
  "discard_requested",
]);
const REVIEWS = new Set(["changes_large", "removals_large", "duration_unknown", "duration_large"]);

export function KnowledgeRefreshSection({ lineageId }: { lineageId: string }) {
  const { t } = useTranslation();
  return (
    <BknProjectKbSlot
      preview={
        <Section title={t(`${PREFIX}.title`)} description={t(`${PREFIX}.description`)}>
          <p>{t(`${PREFIX}.preview`)}</p>
        </Section>
      }
    >
      <RefreshContent key={lineageId} lineageId={lineageId} />
    </BknProjectKbSlot>
  );
}

function RefreshContent({ lineageId }: { lineageId: string }) {
  const { t } = useTranslation();
  const { modal, message } = useAppServices();
  const [data, setData] = useState<{
    lineage: string;
    status: KnowledgeRefreshStatus | null;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const scope = useRef(0);
  useEffect(() => {
    const generation = ++scope.current;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const status = await getKnowledgeRefresh(lineageId);
        if (active && scope.current === generation) {
          setData({ lineage: lineageId, status });
          setFailed(false);
        }
      } catch {
        if (active && scope.current === generation) setFailed(true);
      } finally {
        if (active && scope.current === generation)
          timer = setTimeout(() => {
            void load();
          }, 6000);
      }
    };
    void load();
    return () => {
      active = false;
      scope.current = generation + 1;
      if (timer) clearTimeout(timer);
    };
  }, [lineageId, reload]);
  const status = data?.lineage === lineageId ? data.status : undefined;
  if (status === null && !failed) return null;
  const command = async (action: "check" | "release" | "discard") => {
    if (!status || !status.canManage) return;
    const generation = scope.current;
    setBusy(true);
    try {
      const updated = await commandKnowledgeRefresh(lineageId, action, status);
      if (scope.current === generation) {
        setData({ lineage: lineageId, status: updated });
        message.success(t(`${PREFIX}.accepted`));
      }
    } catch {
      if (scope.current === generation) {
        message.error(t(`${PREFIX}.actionFailed`));
        setReload((value) => value + 1);
      }
    } finally {
      if (scope.current === generation) setBusy(false);
    }
  };
  const confirm = (action: "release" | "discard") => {
    modal.confirm({
      title: t(`${PREFIX}.${action === "release" ? "confirmTitle" : "discardTitle"}`),
      content: t(`${PREFIX}.${action === "release" ? "confirmBody" : "discardBody"}`),
      okText: t(`${PREFIX}.${action}`),
      cancelText: t("common.cancel"),
      onOk: () => command(action),
    });
  };

  return (
    <Section
      title={<BknProjectKbBadge>{t(`${PREFIX}.title`)}</BknProjectKbBadge>}
      description={t(`${PREFIX}.description`)}
      actions={
        status?.canManage ? (
          <AppButton
            loading={busy}
            disabled={busy}
            onClick={() => {
              void command("check");
            }}
          >
            {t(`${PREFIX}.check`)}
          </AppButton>
        ) : undefined
      }
    >
      {failed ? (
        <Alert
          type="warning"
          showIcon
          message={t(`${PREFIX}.loadFailed`)}
          action={
            <AppButton size="small" onClick={() => setReload((value) => value + 1)}>
              {t("common.retry")}
            </AppButton>
          }
        />
      ) : null}
      {!status ? (
        <Spin />
      ) : (
        <div className={styles.stack} aria-live="polite">
          <div className={styles.row}>
            <LightStatusTag
              tone={
                status.state === "attention"
                  ? "warning"
                  : status.state === "idle"
                    ? "success"
                    : "info"
              }
            >
              {t(`${PREFIX}.state.${STATES.has(status.state) ? status.state : "unknown"}`)}
            </LightStatusTag>
            {status.updateTime > 0 ? (
              <span className={styles.muted}>
                {t(`${PREFIX}.updated`, { time: dayjs(status.updateTime).format("MM/DD HH:mm") })}
              </span>
            ) : null}
          </div>
          {status.reason ? (
            <Alert
              type="warning"
              showIcon
              message={t(
                `${PREFIX}.reason.${REASONS.has(status.reason) ? status.reason : "other"}`,
              )}
            />
          ) : null}
          <div className={styles.row}>
            <span>{t(`${PREFIX}.changed`, { value: status.changed })}</span>
            <span>{t(`${PREFIX}.removed`, { value: status.removed })}</span>
            <span>{t(`${PREFIX}.reused`, { value: status.reused })}</span>
            <span>
              {t(`${PREFIX}.completed`, { completed: status.completed, total: status.files })}
            </span>
          </div>
          {status.reviewReasons.length ? (
            <ul className={styles.list}>
              {status.reviewReasons.map((reason, index) => (
                <li key={`${reason}-${index}`}>
                  {t(`${PREFIX}.review.${REVIEWS.has(reason) ? reason : "other"}`)}
                </li>
              ))}
            </ul>
          ) : null}
          {status.state !== "idle" ? (
            <p className={styles.muted}>
              {status.estimatedMillis === null
                ? t(`${PREFIX}.durationUnknown`)
                : status.estimatedMillis === 0
                  ? t(`${PREFIX}.durationNone`)
                  : t(`${PREFIX}.duration`, {
                      minutes: Math.max(1, Math.ceil(status.estimatedMillis / 60000)),
                    })}
            </p>
          ) : null}
          {status.pendingLinks + status.pendingFields + status.pendingFacts > 0 ? (
            <Alert
              type="info"
              showIcon
              message={t(`${PREFIX}.pending`, {
                links: status.pendingLinks,
                fields: status.pendingFields,
                facts: status.pendingFacts,
              })}
            />
          ) : null}
          {status.canRelease ? (
            <div className={styles.row}>
              <AppButton
                type="primary"
                loading={busy}
                disabled={busy}
                onClick={() => confirm("release")}
              >
                {t(`${PREFIX}.release`)}
              </AppButton>
            </div>
          ) : null}
          {status.canDiscard ? (
            <AppButton disabled={busy} loading={busy} onClick={() => confirm("discard")}>
              {t(`${PREFIX}.discard`)}
            </AppButton>
          ) : null}
          <p className={styles.muted}>
            {t(`${PREFIX}.limits`, {
              changed: status.limits.changedPercent,
              removed: status.limits.removedPercent,
              minutes: Math.ceil(status.limits.durationMillis / 60000),
            })}
          </p>
        </div>
      )}
    </Section>
  );
}
