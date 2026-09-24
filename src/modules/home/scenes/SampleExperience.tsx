/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import {
  SAMPLE_NAMESPACE,
  sampleCardAction,
  sampleCatalogName,
  type SampleCatalog,
  type SampleCatalogItem,
  type SampleInstallation,
} from "@/modules/home/lib/sample-catalog";
import {
  createSampleInstallation,
  getSampleInstallation,
  listSamples,
  retrySampleInstallation,
  SampleRequestError,
} from "@/modules/home/services/sample-catalog.service";

import styles from "./SampleExperience.module.css";

const POLL_INTERVAL_MS = 4000;

export function SampleExperience() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<SampleCatalog | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [installations, setInstallations] = useState<Record<string, SampleInstallation>>({});
  const [pending, setPending] = useState<SampleCatalogItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const installationsRef = useRef(installations);
  installationsRef.current = installations;

  const loadCatalog = useCallback(async () => {
    try {
      const next = await listSamples();
      setCatalog(next);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const active = (catalog?.samples ?? []).flatMap((item) => {
      if (item.status !== "installing") {
        return [];
      }

      const installationId = item.installationId ?? installationsRef.current[item.name]?.id ?? null;
      return installationId ? [{ installationId, name: item.name }] : [];
    });

    if (active.length === 0) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      const updates = await Promise.all(
        active.map(async (item) => {
          try {
            return await getSampleInstallation(item.name, item.installationId);
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setInstallations((current) => {
        const next = { ...current };
        updates.forEach((installation) => {
          if (installation) {
            next[installation.sample] = installation;
          }
        });
        return next;
      });

      if (updates.some((installation) => installation && installation.status !== "installing")) {
        void loadCatalog();
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [catalog, loadCatalog]);

  const runInstallation = async (item: SampleCatalogItem, mode: "install" | "retry") => {
    setSubmitting(true);
    setActionError("");

    try {
      const installation =
        mode === "install" || !item.installationId
          ? await createSampleInstallation(item.name)
          : await retrySampleInstallation(item.name, item.installationId);
      setInstallations((current) => ({ ...current, [item.name]: installation }));
      setPending(null);
      await loadCatalog();
    } catch (error) {
      const requestError =
        error instanceof SampleRequestError ? error : new SampleRequestError("install_failed", "");
      setPending(null);
      setActionError(
        requestError.message || t(`home.sample.errors.${knownError(requestError.code)}`),
      );
      await loadCatalog();
    } finally {
      setSubmitting(false);
    }
  };

  const samples = catalog?.samples ?? [];
  const sharedVersion = samples.every(
    (item) => item.version && item.version === samples[0]?.version,
  )
    ? samples[0]?.version
    : "";
  const showUnavailable =
    Boolean(catalog?.sourceRejected) ||
    (samples.length > 0 && samples.every((item) => item.status === "unavailable"));

  return (
    <section aria-labelledby="sample-experience-title" className={styles.layout}>
      <div className={styles.heading}>
        <h2 id="sample-experience-title">{t("home.paths.sample.heading")}</h2>
        <p>{t("home.paths.sample.description")}</p>
        <p className={styles.meta}>
          {t("home.sample.sourceLabel")} {t("home.sample.sourceName")}
          {sharedVersion ? ` · ${t("home.sample.versionLabel", { version: sharedVersion })}` : ""}
        </p>
      </div>

      {loadError ? (
        <div className={styles.banner}>
          <p>{t("home.sample.loadFailed")}</p>
          <button className={styles.reload} onClick={() => void loadCatalog()} type="button">
            {t("home.sample.reload")}
          </button>
        </div>
      ) : null}

      {!catalog && !loadError ? <p className={styles.meta}>{t("home.sample.loading")}</p> : null}

      {showUnavailable ? (
        <p className={styles.banner}>{t("home.sample.unavailableBanner")}</p>
      ) : null}

      {catalog && samples.length === 0 && !showUnavailable ? (
        <p className={styles.meta}>{t("home.sample.empty")}</p>
      ) : null}

      {actionError ? <p className={styles.error}>{actionError}</p> : null}

      <div className={styles.cards}>
        {samples.map((item) => (
          <SampleCard
            installation={installations[item.name]}
            item={item}
            key={item.name}
            onInstall={() => setPending(item)}
            onOpen={() =>
              void navigate(`/knowledge-network/workspace/${item.knowledgeNetwork.id}/overview`)
            }
            onRetry={() => void runInstallation(item, "retry")}
          />
        ))}
      </div>

      <Modal
        destroyOnHidden
        footer={null}
        onCancel={() => setPending(null)}
        open={pending !== null}
        title={
          pending
            ? t("home.sample.confirm.title", {
                name: pending.displayName,
                version: pending.version,
              })
            : ""
        }
      >
        {pending ? (
          <>
            <p>{t("home.sample.confirm.body")}</p>
            <ul className={styles.confirmList}>
              <li>{t("home.sample.confirm.namespace", { namespace: SAMPLE_NAMESPACE })}</li>
              <li>
                {t("home.sample.confirm.catalog", { catalog: sampleCatalogName(pending.name) })}
              </li>
              <li>
                {t("home.sample.confirm.network", {
                  network: pending.knowledgeNetwork.displayName,
                })}
              </li>
              <li>{t("home.sample.confirm.irreversible")}</li>
            </ul>
            <div className={styles.confirmActions}>
              <button className={styles.reload} onClick={() => setPending(null)} type="button">
                {t("home.sample.actions.cancel")}
              </button>
              <button
                className={styles.install}
                disabled={submitting}
                onClick={() => void runInstallation(pending, "install")}
                type="button"
              >
                {t("home.sample.actions.start")}
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </section>
  );
}

function SampleCard({
  installation,
  item,
  onInstall,
  onOpen,
  onRetry,
}: {
  installation?: SampleInstallation;
  item: SampleCatalogItem;
  onInstall: () => void;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const action = sampleCardAction(item);
  const enabled = item.installable;
  const detail = installation?.error?.message || item.message;

  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3>{item.displayName}</h3>
          <p className={styles.meta}>{item.summary}</p>
          <div className={styles.facts}>
            <span className={styles.fact}>
              {t("home.sample.tables", { count: item.expectedTables })}
            </span>
            <span className={styles.fact}>{item.knowledgeNetwork.displayName}</span>
            {item.licenseNote ? <span className={styles.fact}>{item.licenseNote}</span> : null}
          </div>
        </div>
        <div className={styles.actions}>
          <span className={styles.status}>{t(`home.sample.status.${item.status}`)}</span>
          {action === "install" ? (
            <button
              className={styles.install}
              disabled={!enabled}
              onClick={onInstall}
              type="button"
            >
              {t("home.sample.actions.install")}
            </button>
          ) : null}
          {action === "retry" ? (
            <button className={styles.retry} disabled={!enabled} onClick={onRetry} type="button">
              {t("home.sample.actions.retry")}
            </button>
          ) : null}
          {action === "open" ? (
            <button className={styles.open} onClick={onOpen} type="button">
              {t("home.sample.actions.open")}
            </button>
          ) : null}
          {!enabled && (action === "install" || action === "retry") ? (
            <span className={styles.meta}>{t("home.sample.adminHint")}</span>
          ) : null}
        </div>
      </div>

      {installation &&
      installation.stages.length > 0 &&
      (item.status === "installing" || item.status === "failed") ? (
        <div className={styles.stages}>
          {installation.stages.map((stage, index) => (
            <div className={styles.stage} key={stage.id}>
              <strong>
                {index + 1}. {stage.name}
              </strong>
              <span>{t(`home.sample.stageState.${stage.state}`)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {detail && item.status !== "installed" && item.status !== "not_installed" ? (
        <p className={styles.error}>{detail}</p>
      ) : null}

      {item.status === "installed" ? (
        <>
          <p className={styles.note}>
            {t("home.sample.installedMeta", {
              time: item.installedAt ?? "",
              version: item.version,
            })}
          </p>
          <p className={styles.note}>{t("home.sample.llmNote")}</p>
          {item.questions.length > 0 ? (
            <ul className={styles.questions}>
              {item.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function knownError(code: string) {
  const known = [
    "already_installed",
    "database_not_ready",
    "discover_incomplete",
    "forbidden",
    "image_unavailable",
    "install_failed",
    "ownership_conflict",
    "sample_data_unavailable",
    "source_rejected",
    "storage_class_missing",
    "use_retry",
    "verify_failed",
  ];

  return known.includes(code) ? code : "install_failed";
}
