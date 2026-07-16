/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CloudSyncOutlined,
  CopyOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Input, Spin, Tag } from "antd";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  activateLicense,
  deleteLicense,
  getLicenseDetail,
  getLicenseFingerprint,
  importLicense,
  resolveLicenseRequestErrorCode,
} from "@/modules/system-admin/services/license.service";
import type { LicenseDetail } from "@/modules/system-admin/types/license";
import { systemAdminPermissions } from "@/modules/system-admin/permissions";

import styles from "./admin.module.css";

const { TextArea } = Input;

type ActionKind = "delete" | "import" | "online" | null;

function formatUnixSeconds(value: number | undefined, locale: string, permanentText: string) {
  if (value === undefined || value === null) {
    return "-";
  }
  if (value === 0) {
    return permanentText;
  }
  return new Intl.DateTimeFormat(locale, {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(value * 1000)
    .replace(/\//g, "-");
}

function limitValueLabel(value: number, unlimitedText: string, blockedText: string) {
  if (value === -1) {
    return unlimitedText;
  }
  if (value === 0) {
    return blockedText;
  }
  return String(value);
}

function translatedLicenseKey(
  t: ReturnType<typeof useTranslation>["t"],
  category: "editionLabels" | "featureLabels" | "limitLabels",
  key: string,
) {
  return t(`systemAdmin.license.${category}.${key}`, { defaultValue: key });
}

function copySupported() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function"
  );
}

export function LicenseManagementScene() {
  const { t, i18n } = useTranslation();
  const { message, modal } = useAppServices();

  const [detail, setDetail] = useState<LicenseDetail | null>(null);
  const [fingerprint, setFingerprint] = useState("");
  const [onlineLicenseText, setOnlineLicenseText] = useState("");
  const [offlineCertificateText, setOfflineCertificateText] = useState("");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<ActionKind>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onlineActivationHidden, setOnlineActivationHidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await getLicenseDetail();
      setDetail(next);
      setFingerprint(next.instanceFp ?? "");

      try {
        const fp = await getLicenseFingerprint();
        setFingerprint(fp || next.instanceFp || "");
      } catch {
        setFingerprint(next.instanceFp || "");
      }
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statusMessage = useMemo(() => {
    if (!detail) {
      return "";
    }
    if (detail.state === "valid" && !detail.activated) {
      return t("systemAdmin.license.status.validUnbound");
    }
    return t(`systemAdmin.license.status.${detail.state}`);
  }, [detail, t]);

  const statusDescription = useMemo(() => {
    if (!detail) {
      return "";
    }
    if (detail.state === "grace") {
      return t("systemAdmin.license.statusDesc.grace", {
        days: detail.graceRemainingDays ?? "-",
        reason: detail.renewError || t("systemAdmin.license.none"),
      });
    }
    if (detail.state === "fallback_community") {
      return t("systemAdmin.license.statusDesc.fallback_community");
    }
    if (detail.state === "invalid") {
      return t("systemAdmin.license.statusDesc.invalid");
    }
    if (detail.renewError) {
      return t("systemAdmin.license.statusDesc.renewError", {
        reason: detail.renewError,
      });
    }
    if (!detail.activated) {
      return t("systemAdmin.license.statusDesc.validUnbound");
    }
    return t("systemAdmin.license.statusDesc.valid");
  }, [detail, t]);

  const handleCopy = async (value: string) => {
    if (!value) {
      return;
    }
    if (!copySupported()) {
      await message.warning(t("systemAdmin.license.copyUnsupported"));
      return;
    }
    await navigator.clipboard.writeText(value);
    await message.success(t("systemAdmin.license.copySuccess"));
  };

  const refreshAfterAction = async (next?: LicenseDetail) => {
    if (next) {
      setDetail(next);
    }
    await load();
  };

  const showActionError = async (error: unknown) => {
    const code = resolveLicenseRequestErrorCode(error);
    if (code === "activationUnavailable") {
      setOnlineActivationHidden(true);
    }
    await message.error(
      t(`systemAdmin.license.errors.${code}`, {
        error: extractRequestErrorMessage(error),
      }),
    );
  };

  const handleImport = async () => {
    const text = offlineCertificateText.trim();
    if (!text) {
      await message.warning(t("systemAdmin.license.validation.licenseRequired"));
      return;
    }
    setAction("import");
    try {
      const next = await importLicense(text);
      setOfflineCertificateText("");
      await message.success(t("systemAdmin.license.toast.imported"));
      await refreshAfterAction(next);
    } catch (error) {
      await showActionError(error);
    } finally {
      setAction(null);
    }
  };

  const handleOnlineActivation = async () => {
    const text = onlineLicenseText.trim();
    setAction("online");
    try {
      if (text) {
        await importLicense(text);
      }
      const next = await activateLicense();
      setOnlineLicenseText("");
      await message.success(t("systemAdmin.license.toast.activated"));
      await refreshAfterAction(next);
    } catch (error) {
      await showActionError(error);
    } finally {
      setAction(null);
    }
  };

  const handleDelete = () => {
    modal.confirm({
      title: t("systemAdmin.license.deleteTitle"),
      content: t("systemAdmin.license.deleteConfirm"),
      okText: t("systemAdmin.license.delete"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        setAction("delete");
        try {
          await deleteLicense();
          await message.success(t("systemAdmin.license.toast.deleted"));
          await refreshAfterAction();
        } catch (error) {
          const fallback = axios.isAxiosError(error)
            ? t("systemAdmin.license.errors.unknown", {
                error: extractRequestErrorMessage(error),
              })
            : extractRequestErrorMessage(error);
          await message.error(fallback);
        } finally {
          setAction(null);
        }
      },
    });
  };

  const identityItems = detail
    ? [
        {
          label: t("systemAdmin.license.fields.licId"),
          value: detail.licId || "-",
        },
        {
          label: t("systemAdmin.license.fields.customer"),
          value: detail.customer?.name || "-",
        },
        {
          label: t("systemAdmin.license.fields.project"),
          value: detail.customer?.project || "-",
        },
        {
          label: t("systemAdmin.license.fields.email"),
          value: detail.customer?.email || "-",
        },
      ]
    : [];
  const fingerprintValue = detail ? fingerprint || detail.instanceFp || "-" : "-";
  const licensedUntil = detail
    ? formatUnixSeconds(
        detail.contractExpiresAt,
        i18n.language,
        t("systemAdmin.license.permanent"),
      )
    : "-";
  const metricItems = detail
    ? [
        {
          label: t("systemAdmin.license.metrics.edition"),
          title: detail.edition || undefined,
          value: detail.edition
            ? translatedLicenseKey(t, "editionLabels", detail.edition)
            : "-",
        },
        {
          label: t("systemAdmin.license.metrics.licensedUntil"),
          value: licensedUntil,
        },
        {
          label: t("systemAdmin.license.metrics.activation"),
          value: detail.activated
            ? t("systemAdmin.license.metrics.activationBound")
            : t("systemAdmin.license.metrics.activationPending"),
        },
        {
          label: t("systemAdmin.license.metrics.scope"),
          value: t("systemAdmin.license.metrics.scopeValue", {
            features: detail.features.length,
            limits: Object.keys(detail.limits).length,
          }),
        },
      ]
    : [];

  return (
    <div className={styles.contentSurface}>
      <div className={styles.operationBar}>
        <div className={styles.operationPrimary}>
          <div>
            <div className={styles.pageTitle}>{t("systemAdmin.license.title")}</div>
            <div className={styles.pageSubtitle}>
              {t("systemAdmin.license.description")}
            </div>
          </div>
        </div>
        <div className={styles.toolbarActions}>
          <AppButton icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
            {t("common.refresh")}
          </AppButton>
          <PermissionGate permissions={systemAdminPermissions.licenseManage}>
            <AppButton
              danger
              disabled={!detail || detail.state === "invalid"}
              icon={<DeleteOutlined />}
              loading={action === "delete"}
              onClick={handleDelete}
            >
              {t("systemAdmin.license.delete")}
            </AppButton>
          </PermissionGate>
        </div>
      </div>

      {loadError ? (
        <Alert
          action={
            <AppButton size="small" onClick={() => void load()}>
              {t("common.retry")}
            </AppButton>
          }
          className={styles.licenseSection}
          message={loadError}
          showIcon
          type="error"
        />
      ) : null}

      <Spin spinning={loading && !detail}>
        {detail ? (
          <div className={styles.licenseLayout}>
            <section className={styles.licenseHero}>
              <div className={styles.licenseHeroIcon}>
                <SafetyCertificateOutlined />
              </div>
              <div className={styles.licenseHeroBody}>
                <div className={styles.licenseHeroKicker}>
                  {t("systemAdmin.license.sections.currentStatus")}
                </div>
                <h3>{statusMessage}</h3>
                <p>{statusDescription}</p>
                <div className={styles.licenseFingerprintInline}>
                  <span>{t("systemAdmin.license.fields.instanceFp")}</span>
                  <strong title={fingerprintValue}>{fingerprintValue}</strong>
                  <AppButton
                    icon={<CopyOutlined />}
                    onClick={() => void handleCopy(fingerprintValue)}
                    size="small"
                  >
                    {t("common.copy")}
                  </AppButton>
                </div>
              </div>
              <div className={styles.licenseMetricGrid}>
                {metricItems.map((item) => (
                  <div className={styles.licenseMetricItem} key={item.label}>
                    <span>{item.label}</span>
                    <strong title={item.title}>{item.value}</strong>
                  </div>
                ))}
              </div>
              <div className={styles.licenseIdentityGrid}>
                {identityItems.map((item) => (
                  <div className={styles.licenseIdentityItem} key={item.label}>
                    <span>{item.label}</span>
                    <div className={styles.licenseIdentityValue}>
                      <strong title={item.value}>{item.value}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <PermissionGate permissions={systemAdminPermissions.licenseManage}>
              <section className={styles.licenseSection}>
                <div className={styles.licenseSectionHead}>
                  <h3>{t("systemAdmin.license.sections.activationMode")}</h3>
                  <span>{t("systemAdmin.license.sections.activationModeHint")}</span>
                </div>
                <div className={styles.licenseModeGrid}>
                  <div className={styles.licenseModePanel}>
                    <div className={styles.licenseModeHead}>
                      <Tag>{t("systemAdmin.license.scenarios.online")}</Tag>
                      <h3>{t("systemAdmin.license.sections.onlineActivationTitle")}</h3>
                      <p>{t("systemAdmin.license.sections.onlineActivationHint")}</p>
                      <a
                        className={styles.licensePortalLink}
                        href="https://license.openbkn.ai/"
                        rel="noreferrer"
                        target="_blank"
                      >
                        {t("systemAdmin.license.sections.licensePortalLink")}
                      </a>
                    </div>
                    <TextArea
                      autoSize={{ minRows: 7, maxRows: 11 }}
                      className={styles.licenseTextArea}
                      onChange={(event) => setOnlineLicenseText(event.target.value)}
                      placeholder={t("systemAdmin.license.placeholders.license")}
                      value={onlineLicenseText}
                    />
                    {!onlineActivationHidden ? (
                      <AppButton
                        className={styles.licenseFullAction}
                        icon={<CloudSyncOutlined />}
                        loading={action === "online"}
                        onClick={() => void handleOnlineActivation()}
                        type="primary"
                      >
                        {t("systemAdmin.license.onlineActivate")}
                      </AppButton>
                    ) : (
                      <Alert
                        message={t("systemAdmin.license.errors.activationUnavailable")}
                        showIcon
                        type="warning"
                      />
                    )}
                  </div>

                  <div className={styles.licenseModePanel}>
                    <div className={styles.licenseModeHead}>
                      <Tag>{t("systemAdmin.license.scenarios.offline")}</Tag>
                      <h3>{t("systemAdmin.license.sections.offlineActivationTitle")}</h3>
                      <p>{t("systemAdmin.license.sections.offlineSimpleHint")}</p>
                      <a
                        className={styles.licensePortalLink}
                        href="https://license.openbkn.ai/"
                        rel="noreferrer"
                        target="_blank"
                      >
                        {t("systemAdmin.license.sections.licensePortalLink")}
                      </a>
                    </div>
                    <TextArea
                      autoSize={{ minRows: 7, maxRows: 11 }}
                      className={styles.licenseTextArea}
                      onChange={(event) => setOfflineCertificateText(event.target.value)}
                      placeholder={t("systemAdmin.license.placeholders.activationCertificate")}
                      value={offlineCertificateText}
                    />
                    <AppButton
                      className={styles.licenseFullAction}
                      icon={<UploadOutlined />}
                      loading={action === "import"}
                      onClick={() => void handleImport()}
                      type="primary"
                    >
                      {t("systemAdmin.license.importActivationCertificate")}
                    </AppButton>
                  </div>
                </div>
              </section>
            </PermissionGate>

            <section className={styles.licenseSection}>
              <div className={styles.licenseSectionHead}>
                <h3>{t("systemAdmin.license.sections.scope")}</h3>
                <span>{t("systemAdmin.license.sections.scopeHint")}</span>
              </div>
              <div className={styles.licenseScopeGrid}>
                <div className={styles.licenseScopePanel}>
                  <div className={styles.licenseScopeHead}>
                    <h4>{t("systemAdmin.license.sections.features")}</h4>
                    <span>{detail.features.length}</span>
                  </div>
                  {detail.features.length ? (
                    <div className={styles.licenseTagList}>
                      {detail.features.map((feature) => (
                        <Tag key={feature} title={feature}>
                          {translatedLicenseKey(t, "featureLabels", feature)}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      description={t("systemAdmin.license.emptyFeatures")}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )}
                </div>

                <div className={styles.licenseScopePanel}>
                  <div className={styles.licenseScopeHead}>
                    <h4>{t("systemAdmin.license.sections.limits")}</h4>
                    <span>{t("systemAdmin.license.sections.limitsHint")}</span>
                  </div>
                  {Object.keys(detail.limits).length ? (
                    <div className={styles.licenseLimitList}>
                      {Object.entries(detail.limits).map(([key, value]) => (
                        <div className={styles.licenseLimitItem} key={key}>
                          <span title={key}>
                            {translatedLicenseKey(t, "limitLabels", key)}
                          </span>
                          <strong>
                            {limitValueLabel(
                              value,
                              t("systemAdmin.license.unlimited"),
                              t("systemAdmin.license.blocked"),
                            )}
                          </strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      description={t("systemAdmin.license.emptyLimits")}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )}
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </Spin>
    </div>
  );
}
