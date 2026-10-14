/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useDangerDelete } from "@/framework/safety/DangerDeleteModal";
import { MarkdownText } from "@/framework/ui/common/MarkdownText";

import {
  OFFICIAL_SAMPLE_SOURCE,
  sampleCardAction,
  type SampleCatalog,
  type SampleCatalogItem,
  type SampleInstallation,
} from "@/modules/home/lib/sample-catalog";
import {
  createSampleInstallation,
  uninstallSample,
  deleteSamplePackage,
  getSampleInstallation,
  getSampleReleaseNotes,
  importSamplePackage,
  listSampleInstallations,
  type SampleReleaseNotes,
  listSamples,
  refreshSamples,
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
  const [refreshError, setRefreshError] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [installationRefresh, setInstallationRefresh] = useState(0);
  const [progressUnavailable, setProgressUnavailable] = useState<Record<string, boolean>>({});
  const [installations, setInstallations] = useState<Record<string, SampleInstallation>>({});
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [uninstallingNames, setUninstallingNames] = useState<string[]>([]);
  const [installingNames, setInstallingNames] = useState<string[]>([]);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(false);
  const [offlineDeleting, setOfflineDeleting] = useState<string | null>(null);
  const installationsRef = useRef(installations);
  const runningRef = useRef(new Set<string>());
  const catalogRequestRef = useRef(0);
  installationsRef.current = installations;

  const loadCatalog = useCallback(async () => {
    const request = ++catalogRequestRef.current;
    setCatalogLoading(true);
    try {
      const next = await listSamples();
      if (request === catalogRequestRef.current) {
        setCatalog(next);
        setLoadError(false);
      }
    } catch {
      if (request === catalogRequestRef.current) setLoadError(true);
    } finally {
      if (request === catalogRequestRef.current) setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const request = ++catalogRequestRef.current;
    const isCurrent = () => !cancelled && request === catalogRequestRef.current;
    setCatalogLoading(true);
    void (async () => {
      try {
        const cached = await listSamples();
        if (!isCurrent()) return;
        setCatalog(cached);
        setLoadError(false);
        if (cached.sourceRefresh?.supported) {
          try {
            const refreshed = await refreshSamples();
            if (isCurrent()) {
              setCatalog(refreshed);
              setRefreshError(false);
            }
          } catch {
            if (isCurrent()) setRefreshError(true);
          }
        }
      } catch {
        if (isCurrent()) setLoadError(true);
      } finally {
        if (isCurrent()) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (installingNames.length === 0) {
      return;
    }

    const timer = window.setInterval(() => void loadCatalog(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [installingNames, loadCatalog]);

  useEffect(() => {
    const installed = new Set(
      (catalog?.samples ?? [])
        .filter((item) => item.status === "installed")
        .map((item) => item.name),
    );
    if (installed.size === 0) return;
    setActionErrors((current) => {
      const next = { ...current };
      installed.forEach((name) => delete next[name]);
      return next;
    });
  }, [catalog]);

  useEffect(() => {
    const tracked = (catalog?.samples ?? [])
      .filter((item) =>
        ["installing", "failed", "conflict", "uninstalling", "uninstall_failed"].includes(
          item.status,
        ),
      )
      .map((item) => ({
        name: item.name,
        status: item.status,
        installationId: item.installationId ?? installationsRef.current[item.name]?.id ?? null,
      }));
    if (tracked.length === 0) return;

    let cancelled = false;
    let refreshing = false;
    const tick = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const updates = await Promise.all(
          tracked.map(async (item) => {
            try {
              const installation = item.installationId
                ? await getSampleInstallation(item.name, item.installationId)
                : null;
              return { ...item, installation };
            } catch {
              return { ...item, installation: null };
            }
          }),
        );
        if (cancelled) return;
        setInstallations((current) => {
          const next = { ...current };
          updates.forEach(({ name, installation }) => {
            if (installation) next[name] = installation;
          });
          return next;
        });
        setProgressUnavailable((current) => {
          const next = { ...current };
          updates.forEach(({ name, installation }) => {
            next[name] = installation === null;
          });
          return next;
        });
        if (
          updates.some(
            ({ status, installation }) =>
              ["installing", "uninstalling"].includes(status) &&
              installation &&
              !["installing", "uninstalling"].includes(installation.status),
          )
        )
          void loadCatalog();
      } finally {
        refreshing = false;
      }
    };

    void tick();
    const timer = tracked.some((item) => ["installing", "uninstalling"].includes(item.status))
      ? window.setInterval(() => void tick(), POLL_INTERVAL_MS)
      : undefined;
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [catalog, installationRefresh, loadCatalog]);

  const runInstallation = async (
    item: SampleCatalogItem,
    mode: "install" | "retry" | "uninstall",
  ) => {
    if (runningRef.current.has(item.name)) {
      return;
    }

    runningRef.current.add(item.name);
    if (mode === "uninstall") setUninstallingNames((current) => [...current, item.name]);
    setActionErrors((current) => ({ ...current, [item.name]: "" }));
    setInstallingNames((current) =>
      current.includes(item.name) ? current : [...current, item.name],
    );

    try {
      if (mode === "retry" && !item.installationId) {
        throw new SampleRequestError("use_retry", "");
      }
      const installation =
        mode === "install"
          ? item.manifestSha256
            ? await createSampleInstallation(item.name, {
                version: item.version,
                manifestSha256: item.manifestSha256,
              })
            : await createSampleInstallation(item.name)
          : mode === "uninstall"
            ? await uninstallSample(item.name, item.installationId!)
            : await retrySampleInstallation(item.name, item.installationId!);
      setInstallations((current) => ({ ...current, [item.name]: installation }));
      await loadCatalog();
    } catch (error) {
      const requestError =
        error instanceof SampleRequestError ? error : new SampleRequestError("install_failed", "");
      setActionErrors((current) => ({
        ...current,
        [item.name]:
          requestError.message || t(`home.sample.errors.${knownError(requestError.code)}`),
      }));
      await loadCatalog();
    } finally {
      runningRef.current.delete(item.name);
      setUninstallingNames((current) => current.filter((name) => name !== item.name));
      setInstallingNames((current) => current.filter((name) => name !== item.name));
    }
  };

  const refreshCatalog = async () => {
    const request = ++catalogRequestRef.current;
    setCatalogLoading(true);
    try {
      const next = await refreshSamples();
      if (request === catalogRequestRef.current) {
        setCatalog(next);
        setLoadError(false);
        setRefreshError(false);
      }
    } catch {
      if (request === catalogRequestRef.current) setRefreshError(true);
    } finally {
      if (request === catalogRequestRef.current) setCatalogLoading(false);
    }
  };

  const importPackage = async (file: File) => {
    setImporting(true);
    setImportError(false);
    try {
      await importSamplePackage(file);
      await loadCatalog();
    } catch {
      setImportError(true);
    } finally {
      setImporting(false);
    }
  };

  const removeOfflinePackage = async (item: SampleCatalogItem) => {
    setActionErrors((current) => ({ ...current, [item.name]: "" }));
    setOfflineDeleting(item.name);
    try {
      await deleteSamplePackage(item.name);
      await loadCatalog();
    } catch {
      setActionErrors((current) => ({
        ...current,
        [item.name]: t("home.sample.offlineDeleteFailed"),
      }));
    } finally {
      setOfflineDeleting(null);
    }
  };

  const samples = catalog?.samples ?? [];
  const showUnavailable = Boolean(catalog?.sourceRejected);

  return (
    <section aria-labelledby="sample-experience-title" className={styles.layout}>
      <div className={styles.heading}>
        <h2 id="sample-experience-title">{t("home.paths.sample.heading")}</h2>
        <p>{t("home.paths.sample.description")}</p>
        <div className={styles.catalogPanel}>
          <div className={styles.catalogSummary}>
            <div className={styles.catalogInfo}>
              <span className={styles.catalogLabel}>{t("home.sample.sourceLabel")}</span>
              <a
                className={styles.sourceLink}
                href={OFFICIAL_SAMPLE_SOURCE}
                rel="noreferrer"
                target="_blank"
              >
                {t("home.sample.sourceName")}
              </a>
              {catalog?.sourceRefresh?.lastSuccessfulRefreshAt ? (
                <span className={styles.catalogUpdated}>
                  {t("home.sample.lastRefresh", {
                    time: catalog.sourceRefresh.lastSuccessfulRefreshAt,
                  })}
                </span>
              ) : null}
            </div>
            {catalog?.sourceRefresh &&
            !loadError &&
            !refreshError &&
            catalog.sourceRefresh.status !== "failed" ? (
              <div
                className={
                  !catalog.sourceRefresh.throttled &&
                  ["updated", "unchanged"].includes(catalog.sourceRefresh.status)
                    ? styles.refreshSuccess
                    : styles.meta
                }
                role="status"
              >
                <p>
                  {t(
                    `home.sample.refreshStatus.${catalog.sourceRefresh.throttled ? "rate_limited" : ["updated", "unchanged", "not_refreshed"].includes(catalog.sourceRefresh.status) ? catalog.sourceRefresh.status : "not_refreshed"}`,
                  )}
                </p>
              </div>
            ) : null}
            {loadError || refreshError || catalog?.sourceRefresh?.status === "failed" ? (
              <div className={styles.refreshFailure} role="alert">
                <p>
                  {loadError ? (
                    t("home.sample.loadFailed")
                  ) : catalog?.sourceRefresh?.code === "catalog_not_published" && !refreshError ? (
                    t("home.sample.catalogNotPublished")
                  ) : (
                    <>
                      {t("home.sample.refreshStatus.failed")}
                      <a
                        href={`${OFFICIAL_SAMPLE_SOURCE}/releases`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("home.sample.downloadOffline")}
                      </a>
                    </>
                  )}
                </p>
              </div>
            ) : null}
          </div>
          <div className={styles.catalogActions}>
            <button
              className={styles.reload}
              disabled={catalogLoading}
              onClick={() =>
                void (catalog?.sourceRefresh?.supported ? refreshCatalog() : loadCatalog())
              }
              type="button"
            >
              {t(
                catalog?.sourceRefresh?.supported
                  ? "home.sample.refreshSource"
                  : "home.sample.reload",
              )}
            </button>
            {catalog?.canImport ? (
              <label className={styles.reload}>
                {importing ? t("home.sample.importing") : t("home.sample.importPackage")}
                <input
                  accept=".tar.gz,application/gzip"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void importPackage(file);
                  }}
                  type="file"
                />
              </label>
            ) : null}
          </div>
        </div>
      </div>

      {importError ? <div className={styles.banner}>{t("home.sample.importFailed")}</div> : null}

      {!catalog && !loadError ? <p className={styles.meta}>{t("home.sample.loading")}</p> : null}

      {showUnavailable ? (
        <p className={styles.banner}>{t("home.sample.unavailableBanner")}</p>
      ) : null}

      {catalog && samples.length === 0 && !showUnavailable ? (
        <p className={styles.meta}>{t("home.sample.empty")}</p>
      ) : null}

      {samples.some((item) => item.source === "offline") ? (
        <section className={styles.offlinePackages} aria-labelledby="offline-packages-title">
          <div>
            <h3 id="offline-packages-title">{t("home.sample.offlinePackagesTitle")}</h3>
            <p className={styles.meta}>{t("home.sample.offlinePackagesDescription")}</p>
          </div>
          <div className={styles.offlinePackageList}>
            {samples
              .filter((item) => item.source === "offline")
              .map((item) => (
                <div className={styles.offlinePackage} key={item.name}>
                  <span className={styles.offlineBadge}>
                    {item.displayName} · {item.version}
                  </span>
                  {catalog?.canImport ? (
                    <button
                      className={styles.removeOffline}
                      disabled={
                        offlineDeleting === item.name ||
                        installingNames.includes(item.name) ||
                        ["installed", "installing", "uninstalling", "uninstall_failed"].includes(
                          item.status,
                        )
                      }
                      onClick={() => void removeOfflinePackage(item)}
                      type="button"
                    >
                      {offlineDeleting === item.name
                        ? t("home.sample.offlineDeleting")
                        : t("home.sample.removeOffline")}
                    </button>
                  ) : null}
                </div>
              ))}
          </div>
        </section>
      ) : null}

      <div className={styles.cards}>
        {samples.map((item) => {
          const liveInstallation = installations[item.name];
          const serverInstalling = liveInstallation?.status === "installing";
          const showLocalProgress =
            installingNames.includes(item.name) &&
            !serverInstalling &&
            (item.status === "not_installed" ||
              item.status === "failed" ||
              item.status === "conflict");

          return (
            <SampleCard
              installation={showLocalProgress ? undefined : liveInstallation}
              item={
                uninstallingNames.includes(item.name)
                  ? { ...item, canUninstall: false, status: "uninstalling" }
                  : showLocalProgress
                    ? { ...item, message: "", status: "installing" }
                    : item
              }
              key={item.name}
              actionError={actionErrors[item.name]}
              progressUnavailable={progressUnavailable[item.name] ?? false}
              onRefreshProgress={() => setInstallationRefresh((current) => current + 1)}
              expanded={expandedName === item.name}
              onToggle={() => {
                setExpandedName((current) => (current === item.name ? null : item.name));
              }}
              onInstall={(selected) => {
                setExpandedName(item.name);
                void runInstallation(selected, "install");
              }}
              onUninstall={() => {
                setExpandedName(item.name);
                return runInstallation(item, "uninstall");
              }}
              onOpen={() =>
                void navigate(`/knowledge-network/workspace/${item.knowledgeNetwork.id}/overview`)
              }
              onRetry={() => {
                setExpandedName(item.name);
                void runInstallation(item, "retry");
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

function SampleCard({
  progressUnavailable,
  onRefreshProgress,
  actionError,
  expanded,
  onToggle,
  installation,
  item,
  onInstall,
  onOpen,
  onRetry,
  onUninstall,
}: {
  progressUnavailable: boolean;
  onRefreshProgress: () => void;
  actionError?: string;
  expanded: boolean;
  onToggle: () => void;
  installation?: SampleInstallation;
  item: SampleCatalogItem;
  onInstall: (selected: SampleCatalogItem) => void;
  onOpen: () => void;
  onRetry: () => void;
  onUninstall: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const uninstallConfirmation = useDangerDelete();
  const [notes, setNotes] = useState<SampleReleaseNotes | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState(false);
  const [history, setHistory] = useState<{
    items: SampleInstallation[];
    historyComplete: boolean;
  } | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailsReload, setDetailsReload] = useState(0);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const notesVersion =
    selectedVersion ??
    (["installed", "uninstalling", "uninstall_failed"].includes(item.status)
      ? item.installedVersion
      : item.version);
  const versions: NonNullable<SampleCatalogItem["versions"]> = item.versions ?? [
    { version: item.version, hasReleaseNotes: item.hasReleaseNotes === true },
  ];
  const selectedRelease = versions.find((release) => release.version === notesVersion);
  const hasNotes =
    selectedRelease?.hasReleaseNotes ??
    (item.hasReleaseNotes === true && notesVersion === item.installedVersion);
  const locale = i18n.resolvedLanguage || i18n.language || "zh-CN";
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    if (hasNotes && notesVersion) {
      setNotesLoading(true);
      setNotesError(false);
      void getSampleReleaseNotes(item.name, notesVersion, locale)
        .then((value) => {
          if (!cancelled) setNotes(value);
        })
        .catch(() => {
          if (!cancelled) setNotesError(true);
        })
        .finally(() => {
          if (!cancelled) setNotesLoading(false);
        });
    }
    if (item.installationId) {
      setHistoryLoading(true);
      setHistoryError(false);
      void listSampleInstallations(item.name)
        .then((value) => {
          if (!cancelled) setHistory(value);
        })
        .catch(() => {
          if (!cancelled) setHistoryError(true);
        })
        .finally(() => {
          if (!cancelled) setHistoryLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [
    expanded,
    item.name,
    item.hasReleaseNotes,
    hasNotes,
    item.installationId,
    item.status,
    notesVersion,
    locale,
    detailsReload,
  ]);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const expansionNeedsAlignment = useRef(true);
  useLayoutEffect(() => {
    if (!expanded) {
      expansionNeedsAlignment.current = true;
      return;
    }
    const waitingForNotes = hasNotes && notesVersion && !notes && !notesError;
    const waitingForHistory = item.installationId && !history && !historyError;
    if (
      !expansionNeedsAlignment.current ||
      notesLoading ||
      historyLoading ||
      waitingForNotes ||
      waitingForHistory
    )
      return;
    cardRef.current?.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
    expansionNeedsAlignment.current = false;
  }, [
    expanded,
    hasNotes,
    notesVersion,
    notes,
    notesError,
    notesLoading,
    item.installationId,
    history,
    historyError,
    historyLoading,
  ]);
  const action = sampleCardAction(item);
  const enabled = item.installable;
  const selectedDigest =
    selectedRelease?.manifestSha256 ??
    (notesVersion === item.version ? item.manifestSha256 : undefined);
  const selectedInstallable =
    notesVersion === item.version
      ? selectedRelease?.installable !== false
      : selectedRelease?.installable === true && Boolean(selectedDigest);
  const canRetry =
    enabled &&
    !progressUnavailable &&
    Boolean(item.installationId) &&
    ["failed", "conflict"].includes(installation?.status ?? "");
  const conflict = item.status === "conflict" || installation?.error?.code === "ownership_conflict";
  const interrupted = ["install_interrupted", "uninstall_interrupted"].includes(
    installation?.error?.code ?? "",
  );
  const detail = conflict
    ? t("home.sample.errors.ownership_conflict")
    : interrupted
      ? t(
          installation?.operation === "uninstall"
            ? "home.sample.errors.uninstall_interrupted"
            : "home.sample.errors.install_interrupted",
        )
      : installation?.error?.message ||
        (["runtime_upgrade_required", "release_withdrawn"].includes(item.message)
          ? t(`home.sample.errors.${item.message}`)
          : item.message);
  const stages =
    installation &&
    installation.stages.length > 0 &&
    ["installing", "failed", "conflict", "uninstalling", "uninstall_failed"].includes(item.status)
      ? installation.stages
      : [];

  const activeStage = stages.find((stage) => stage.state === "running");
  const panelId = `sample-details-${item.name}`;

  return (
    <article ref={cardRef} className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3>{item.displayName}</h3>
          <p className={styles.meta}>{item.summary}</p>
          {activeStage ? (
            <p className={styles.note} role="status">
              {t(
                installation?.operation === "uninstall"
                  ? "home.sample.uninstallProgress"
                  : "home.sample.installProgress",
                {
                  stage: t(
                    (installation?.operation === "uninstall"
                      ? "home.sample.uninstallStages."
                      : "home.sample.stages.") + activeStage.id,
                    {
                      defaultValue: activeStage.name,
                    },
                  ),
                },
              )}
            </p>
          ) : null}
          <div className={styles.facts}>
            {item.version ? (
              <span className={styles.fact}>
                {t("home.sample.versionLabel", { version: item.version })}
              </span>
            ) : null}
            {item.source === "offline" ? (
              <span className={styles.offlineBadge}>{t("home.sample.offlineImported")}</span>
            ) : null}
            {item.status === "installed" ? (
              <span className={styles.fact}>
                {t("home.sample.installedVersion", {
                  version: item.installedVersion || t("home.sample.versionUnknown"),
                })}
              </span>
            ) : null}
            {item.latestPublishedVersion ? (
              <span className={styles.fact}>
                {t("home.sample.latestVersion", { version: item.latestPublishedVersion })}
              </span>
            ) : null}
            {item.expectedTables > 0 ? (
              <span className={styles.fact}>
                {t("home.sample.tables", { count: item.expectedTables })}
              </span>
            ) : null}
            {item.knowledgeNetwork.displayName ? (
              <span className={styles.fact}>{item.knowledgeNetwork.displayName}</span>
            ) : null}
          </div>
        </div>
        <div className={styles.actions}>
          <span className={styles.status}>{t(`home.sample.status.${item.status}`)}</span>
          <button
            ref={toggleRef}
            aria-controls={panelId}
            aria-expanded={expanded}
            className={styles.reload}
            onClick={onToggle}
            type="button"
          >
            {t(expanded ? "home.sample.actions.collapse" : "home.sample.actions.expand")}
          </button>
          {action === "install" ? (
            <button
              className={styles.install}
              disabled={!enabled || !selectedInstallable}
              onClick={() => {
                toggleRef.current?.focus();
                onInstall({
                  ...item,
                  version: notesVersion ?? item.version,
                  manifestSha256: selectedDigest,
                  hasReleaseNotes: hasNotes,
                });
              }}
              type="button"
            >
              {t("home.sample.actions.install")}
            </button>
          ) : null}
          {action === "retry" ? (
            <button
              className={styles.open}
              onClick={() => {
                if (!expanded) onToggle();
              }}
              type="button"
            >
              {t("home.sample.actions.failureDetails")}
            </button>
          ) : null}
          {action === "open" ? (
            <button className={styles.open} onClick={onOpen} type="button">
              {t("home.sample.actions.open")}
            </button>
          ) : null}
          {item.canUninstall ? (
            <button
              className={styles.reload}
              type="button"
              onClick={() =>
                uninstallConfirmation.open({
                  title: t("home.sample.uninstallTitle", {
                    name: item.displayName,
                    version: item.installedVersion || item.version,
                  }),
                  targetName: item.displayName,
                  impact: <p>{t("home.sample.uninstallWarning")}</p>,
                  onOk: async () => {
                    toggleRef.current?.focus();
                    await onUninstall();
                  },
                })
              }
            >
              {t(
                item.status === "uninstall_failed"
                  ? "home.sample.retryUninstall"
                  : "home.sample.uninstall",
              )}
            </button>
          ) : null}
          {["installing", "uninstalling"].includes(item.status) ? (
            <button
              className={styles.open}
              onClick={() => {
                if (!expanded) onToggle();
              }}
              type="button"
            >
              {t("home.sample.actions.progress")}
            </button>
          ) : null}
          {!enabled && (action === "install" || action === "retry") ? (
            <span className={styles.meta}>{t("home.sample.adminHint")}</span>
          ) : null}
        </div>
      </div>

      {detail && item.status !== "installed" && item.status !== "not_installed" ? (
        <p className={conflict ? styles.conflict : styles.error}>{detail}</p>
      ) : null}

      {actionError && actionError !== detail ? <p className={styles.error}>{actionError}</p> : null}

      {progressUnavailable &&
      ["installing", "failed", "conflict", "uninstalling", "uninstall_failed"].includes(
        item.status,
      ) ? (
        <div className={styles.banner} role="status">
          <p>{t("home.sample.progressUnavailable")}</p>
          <button className={styles.reload} onClick={onRefreshProgress} type="button">
            {t("home.sample.actions.refreshProgress")}
          </button>
        </div>
      ) : null}
      {item.uninstallUnavailableReason === "ownership_receipt_missing" ? (
        <p className={styles.note}>{t("home.sample.errors.ownership_receipt_missing")}</p>
      ) : null}
      <div id={panelId} hidden={!expanded} className={styles.details}>
        {versions.length > 1 ? (
          <label className={styles.versionPicker}>
            {t("home.sample.selectVersion")}
            <select
              value={notesVersion ?? ""}
              onChange={(event) => {
                setSelectedVersion(event.target.value);
                setNotes(null);
              }}
            >
              {!versions.some((release) => release.version === notesVersion) && notesVersion ? (
                <option value={notesVersion}>{notesVersion}</option>
              ) : null}
              {versions.map((release) => (
                <option key={release.version} value={release.version}>
                  {release.version}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {selectedRelease?.publishedAt ? (
          <p className={styles.meta}>
            {t("home.sample.publishedAt", { time: selectedRelease.publishedAt })}
          </p>
        ) : null}
        {selectedRelease?.reason ? (
          <p className={styles.note}>
            {t(`home.sample.errors.${selectedRelease.reason}`, {
              defaultValue: t("home.sample.status.unavailable"),
            })}
          </p>
        ) : null}
        {stages.length > 0 ? (
          <div className={styles.stages}>
            {stages.map((stage, index) => (
              <div className={styles.stage} data-state={stage.state} key={stage.id}>
                <strong>
                  {index + 1}.{" "}
                  {installation?.operation === "uninstall"
                    ? t(`home.sample.uninstallStages.${stage.id}`, { defaultValue: stage.name })
                    : t(`home.sample.stages.${stage.id}`, { defaultValue: stage.name })}
                </strong>
                <span>{t(`home.sample.stageState.${stage.state}`)}</span>
              </div>
            ))}
          </div>
        ) : null}
        {hasNotes ? (
          <div className={styles.releaseNotes}>
            <h4>
              {t("home.sample.notesTitle", {
                version: notesVersion || t("home.sample.versionUnknown"),
              })}
            </h4>
            {notesLoading ? <p className={styles.meta}>{t("home.sample.notesLoading")}</p> : null}
            {notesError ? <p className={styles.error}>{t("home.sample.notesFailed")}</p> : null}
            {!notesLoading && !notesError && notes && notes.version === notesVersion ? (
              <>
                <p className={styles.meta}>
                  {t("home.sample.notesLocale", { locale: notes.resolvedLocale })}
                </p>
                <MarkdownText className={styles.notesContent} text={notes.content} />
              </>
            ) : null}
            {notesError ? (
              <button
                className={styles.reload}
                onClick={() => setDetailsReload((current) => current + 1)}
                type="button"
              >
                {t("home.sample.reload")}
              </button>
            ) : null}
          </div>
        ) : null}
        {item.licenseNote ? <p className={styles.note}>{item.licenseNote}</p> : null}
        {conflict ? <p className={styles.conflictHint}>{t("home.sample.conflictHint")}</p> : null}

        {item.status === "installed" ? (
          <>
            {item.installedAt ? (
              <p className={styles.note}>
                {t("home.sample.installedMeta", {
                  time: item.installedAt,
                  version: item.installedVersion || t("home.sample.versionUnknown"),
                })}
              </p>
            ) : null}
            <p className={styles.note}>{t("home.sample.llmNote")}</p>
          </>
        ) : null}
        {item.questions.length > 0 ? (
          <ul className={styles.questions}>
            {item.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        ) : null}
        {item.installationId ? (
          <div className={styles.history}>
            <h4>{t("home.sample.historyTitle")}</h4>
            {historyLoading ? (
              <p className={styles.meta}>{t("home.sample.historyLoading")}</p>
            ) : null}
            {historyError ? (
              <>
                <p className={styles.error}>{t("home.sample.historyFailed")}</p>
                <button
                  className={styles.reload}
                  onClick={() => setDetailsReload((current) => current + 1)}
                  type="button"
                >
                  {t("home.sample.reload")}
                </button>
              </>
            ) : null}
            {history && !historyError && !historyLoading ? (
              <>
                {!history.historyComplete ? (
                  <p className={styles.note}>{t("home.sample.historyPartial")}</p>
                ) : null}
                {history.items.map((record) => (
                  <div
                    key={
                      record.attemptId ??
                      `${record.id}-${record.version}-${record.finishedAt ?? record.startedAt ?? ""}`
                    }
                    className={styles.historyItem}
                  >
                    <span>
                      {record.operation === "uninstall" ? t("home.sample.uninstall") + " · " : ""}
                      {t("home.sample.versionLabel", { version: record.version })} ·{" "}
                      {t(`home.sample.status.${record.status}`)}
                    </span>
                    {record.finishedAt ? <span>{record.finishedAt}</span> : null}
                  </div>
                ))}
              </>
            ) : null}
          </div>
        ) : null}
        {action === "retry" ? (
          <div className={styles.confirmActions}>
            <button
              className={styles.retry}
              disabled={!canRetry}
              onClick={() => {
                toggleRef.current?.focus();
                onRetry();
              }}
              type="button"
            >
              {t("home.sample.actions.retry")}
            </button>
          </div>
        ) : null}
      </div>
      {uninstallConfirmation.node}
    </article>
  );
}

function knownError(code: string) {
  const known = [
    "uninstall_failed",
    "ownership_receipt_missing",
    "already_installed",
    "database_not_ready",
    "discover_incomplete",
    "forbidden",
    "image_unavailable",
    "install_failed",
    "install_interrupted",
    "release_withdrawn",
    "runtime_upgrade_required",
    "ownership_conflict",
    "sample_data_unavailable",
    "source_rejected",
    "storage_class_missing",
    "status_unknown",
    "use_retry",
    "verify_failed",
    "version_changed",
    "already_installing",
  ];

  return known.includes(code) ? code : "install_failed";
}
