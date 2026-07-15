/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudSyncOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileProtectOutlined,
  KeyOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Alert, Descriptions, Empty, Input, Space, Spin, Tabs, Tag } from "antd";
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
  getLicenseActivationCode,
  getLicenseDetail,
  getLicenseFingerprint,
  importLicense,
  importLicenseReceipt,
  resolveLicenseRequestErrorCode,
} from "@/modules/system-admin/services/license.service";
import type {
  LicenseActivationCode,
  LicenseDetail,
  LicenseState,
} from "@/modules/system-admin/types/license";
import { systemAdminPermissions } from "@/modules/system-admin/permissions";

import styles from "./admin.module.css";

const { TextArea } = Input;

type ActionKind = "activate" | "delete" | "import" | "receipt" | null;

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

function stateIcon(state: LicenseState) {
  if (state === "valid") {
    return <CheckCircleOutlined />;
  }
  if (state === "grace") {
    return <ClockCircleOutlined />;
  }
  if (state === "fallback_community") {
    return <WarningOutlined />;
  }
  return <FileProtectOutlined />;
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
  return typeof navigator !== "undefined" && Boolean(navigator.clipboard?.writeText);
}

export function LicenseManagementScene() {
  const { t, i18n } = useTranslation();
  const { message, modal } = useAppServices();

  const [detail, setDetail] = useState<LicenseDetail | null>(null);
  const [activation, setActivation] = useState<LicenseActivationCode | null>(null);
  const [fingerprint, setFingerprint] = useState("");
  const [licenseText, setLicenseText] = useState("");
  const [receiptText, setReceiptText] = useState("");
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
      setActivation(null);

      try {
        const code = await getLicenseActivationCode();
        setActivation(code);
        setFingerprint(code.instanceFp || next.instanceFp || "");
      } catch {
        const fp = await getLicenseFingerprint();
        setFingerprint(fp || next.instanceFp || "");
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

  const statusType = useMemo(() => {
    if (!detail) {
      return "info" as const;
    }
    if (detail.state === "valid" && !detail.renewError && detail.activated) {
      return "success" as const;
    }
    return "warning" as const;
  }, [detail]);

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
      return detail.error || t("systemAdmin.license.statusDesc.invalid");
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

  const nextStep = useMemo(() => {
    if (!detail) {
      return "";
    }
    if (detail.state === "invalid") {
      return t("systemAdmin.license.nextStep.invalid");
    }
    if (!detail.activated) {
      return t("systemAdmin.license.nextStep.unbound");
    }
    if (detail.state === "grace") {
      return t("systemAdmin.license.nextStep.grace");
    }
    if (detail.state === "fallback_community") {
      return t("systemAdmin.license.nextStep.fallback_community");
    }
    if (detail.renewError) {
      return t("systemAdmin.license.nextStep.renewError");
    }
    return t("systemAdmin.license.nextStep.valid");
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
    const text = licenseText.trim();
    if (!text) {
      await message.warning(t("systemAdmin.license.validation.licenseRequired"));
      return;
    }
    setAction("import");
    try {
      const next = await importLicense(text);
      setLicenseText("");
      await message.success(t("systemAdmin.license.toast.imported"));
      await refreshAfterAction(next);
    } catch (error) {
      await showActionError(error);
    } finally {
      setAction(null);
    }
  };

  const handleReceipt = async () => {
    const text = receiptText.trim();
    if (!text) {
      await message.warning(t("systemAdmin.license.validation.receiptRequired"));
      return;
    }
    setAction("receipt");
    try {
      const next = await importLicenseReceipt(text);
      setReceiptText("");
      await message.success(t("systemAdmin.license.toast.receiptImported"));
      await refreshAfterAction(next);
    } catch (error) {
      await showActionError(error);
    } finally {
      setAction(null);
    }
  };

  const handleActivate = async () => {
    setAction("activate");
    try {
      const next = await activateLicense();
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

  const identityRows = detail
    ? [
        {
          label: t("systemAdmin.license.fields.state"),
          children: (
            <Tag className={styles.licenseStateTag} icon={stateIcon(detail.state)}>
              {statusMessage}
            </Tag>
          ),
        },
        {
          label: t("systemAdmin.license.fields.edition"),
          children: detail.edition ? (
            <span title={detail.edition}>
              {translatedLicenseKey(t, "editionLabels", detail.edition)}
            </span>
          ) : (
            "-"
          ),
        },
        {
          label: t("systemAdmin.license.fields.licId"),
          children: detail.licId || "-",
        },
        {
          label: t("systemAdmin.license.fields.contractExpiresAt"),
          children: formatUnixSeconds(
            detail.contractExpiresAt,
            i18n.language,
            t("systemAdmin.license.permanent"),
          ),
        },
        {
          label: t("systemAdmin.license.fields.customer"),
          children: detail.customer?.name || "-",
        },
        {
          label: t("systemAdmin.license.fields.project"),
          children: detail.customer?.project || "-",
        },
        {
          label: t("systemAdmin.license.fields.email"),
          children: detail.customer?.email || "-",
        },
        {
          label: t("systemAdmin.license.fields.instanceFp"),
          children: fingerprint || detail.instanceFp || "-",
        },
      ]
    : [];
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
              </div>
              <div className={styles.licenseMetricGrid}>
                {metricItems.map((item) => (
                  <div className={styles.licenseMetricItem} key={item.label}>
                    <span>{item.label}</span>
                    <strong title={item.title}>{item.value}</strong>
                  </div>
                ))}
              </div>
              <Alert
                className={styles.licenseHeroAlert}
                message={t("systemAdmin.license.nextStep.title")}
                showIcon
                type={statusType}
                description={nextStep}
              />
            </section>

            <PermissionGate permissions={systemAdminPermissions.licenseManage}>
              <section className={styles.licenseSection}>
                <div className={styles.licenseSectionHead}>
                  <h3>{t("systemAdmin.license.sections.activationMode")}</h3>
                  <span>{t("systemAdmin.license.sections.activationModeHint")}</span>
                </div>
                <Tabs
                  className={styles.licenseScenarioTabs}
                  items={[
                    {
                      key: "online",
                      label: t("systemAdmin.license.scenarios.online"),
                      children: (
                        <div className={styles.licenseScenarioPanel}>
                          <Alert
                            message={t("systemAdmin.license.scenarios.onlineTitle")}
                            description={t("systemAdmin.license.scenarios.onlineDesc")}
                            showIcon
                            type="info"
                          />
                          <div className={styles.licenseScenarioGrid}>
                            <div className={styles.licenseScenarioStep}>
                              <div className={styles.licenseStepTitle}>
                                <span className={styles.licenseStepIndex}>1</span>
                                <h3>{t("systemAdmin.license.sections.importLicense")}</h3>
                              </div>
                              <p>{t("systemAdmin.license.sections.importLicenseHint")}</p>
                              <TextArea
                                autoSize={{ minRows: 5, maxRows: 9 }}
                                onChange={(event) => setLicenseText(event.target.value)}
                                placeholder={t("systemAdmin.license.placeholders.license")}
                                value={licenseText}
                              />
                              <Space className={styles.licenseActionRow}>
                                <AppButton
                                  icon={<UploadOutlined />}
                                  loading={action === "import"}
                                  onClick={() => void handleImport()}
                                  type="primary"
                                >
                                  {t("systemAdmin.license.import")}
                                </AppButton>
                              </Space>
                            </div>
                            <div className={styles.licenseScenarioStep}>
                              <div className={styles.licenseStepTitle}>
                                <span className={styles.licenseStepIndex}>2</span>
                                <h3>{t("systemAdmin.license.activate")}</h3>
                              </div>
                              <p>{t("systemAdmin.license.scenarios.onlineActivateHint")}</p>
                              {!onlineActivationHidden ? (
                                <AppButton
                                  icon={<CloudSyncOutlined />}
                                  loading={action === "activate"}
                                  onClick={() => void handleActivate()}
                                  type="primary"
                                >
                                  {t("systemAdmin.license.activate")}
                                </AppButton>
                              ) : (
                                <Alert
                                  message={t("systemAdmin.license.errors.activationUnavailable")}
                                  showIcon
                                  type="warning"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "offline",
                      label: t("systemAdmin.license.scenarios.offline"),
                      children: (
                        <div className={styles.licenseScenarioPanel}>
                          <Alert
                            message={t("systemAdmin.license.scenarios.offlineTitle")}
                            description={t("systemAdmin.license.scenarios.offlineDesc")}
                            showIcon
                            type="info"
                          />
                          <div className={styles.licenseScenarioGrid}>
                            <div className={styles.licenseScenarioStep}>
                              <div className={styles.licenseStepTitle}>
                                <span className={styles.licenseStepIndex}>1</span>
                                <h3>{t("systemAdmin.license.sections.activation")}</h3>
                              </div>
                              <p>{t("systemAdmin.license.sections.activationHint")}</p>
                              <div className={styles.licenseCodeGrid}>
                                <div className={styles.licenseCodeBox}>
                                  <span>{t("systemAdmin.license.fields.instanceFp")}</span>
                                  <code>{fingerprint || "-"}</code>
                                  <AppButton
                                    icon={<CopyOutlined />}
                                    size="small"
                                    onClick={() => void handleCopy(fingerprint)}
                                  >
                                    {t("common.copy")}
                                  </AppButton>
                                </div>
                                <div className={styles.licenseCodeBox}>
                                  <span>{t("systemAdmin.license.fields.activationCode")}</span>
                                  <code>{activation?.activationCode || "-"}</code>
                                  <AppButton
                                    icon={<CopyOutlined />}
                                    size="small"
                                    onClick={() => void handleCopy(activation?.activationCode ?? "")}
                                  >
                                    {t("common.copy")}
                                  </AppButton>
                                </div>
                              </div>
                            </div>
                            <div className={styles.licenseScenarioStep}>
                              <div className={styles.licenseStepTitle}>
                                <span className={styles.licenseStepIndex}>2</span>
                                <h3>{t("systemAdmin.license.sections.importLicense")}</h3>
                              </div>
                              <p>{t("systemAdmin.license.sections.importLicenseHint")}</p>
                              <TextArea
                                autoSize={{ minRows: 5, maxRows: 9 }}
                                onChange={(event) => setLicenseText(event.target.value)}
                                placeholder={t("systemAdmin.license.placeholders.license")}
                                value={licenseText}
                              />
                              <Space className={styles.licenseActionRow}>
                                <AppButton
                                  icon={<UploadOutlined />}
                                  loading={action === "import"}
                                  onClick={() => void handleImport()}
                                  type="primary"
                                >
                                  {t("systemAdmin.license.import")}
                                </AppButton>
                              </Space>
                            </div>
                            <div className={styles.licenseScenarioStep}>
                              <div className={styles.licenseStepTitle}>
                                <span className={styles.licenseStepIndex}>3</span>
                                <h3>{t("systemAdmin.license.sections.offlineReceipt")}</h3>
                              </div>
                              <p>{t("systemAdmin.license.sections.offlineReceiptHint")}</p>
                              <TextArea
                                autoSize={{ minRows: 5, maxRows: 9 }}
                                onChange={(event) => setReceiptText(event.target.value)}
                                placeholder={t("systemAdmin.license.placeholders.receipt")}
                                value={receiptText}
                              />
                              <Space className={styles.licenseActionRow}>
                                <AppButton
                                  icon={<KeyOutlined />}
                                  loading={action === "receipt"}
                                  onClick={() => void handleReceipt()}
                                  type="primary"
                                >
                                  {t("systemAdmin.license.importReceipt")}
                                </AppButton>
                              </Space>
                            </div>
                          </div>
                        </div>
                      ),
                    },
                  ]}
                />
              </section>
            </PermissionGate>

            <section className={styles.licenseSection}>
              <div className={styles.licenseSectionHead}>
                <h3>{t("systemAdmin.license.sections.summary")}</h3>
                <span>{t("systemAdmin.license.sections.summaryHint")}</span>
              </div>
              <Descriptions
                bordered
                column={{ lg: 2, md: 2, sm: 1, xs: 1 }}
                items={identityRows}
                size="small"
              />
            </section>

            <section className={styles.licenseSplit}>
              <div className={styles.licenseSection}>
                <div className={styles.licenseSectionHead}>
                  <h3>{t("systemAdmin.license.sections.features")}</h3>
                  <span>{t("systemAdmin.license.sections.featuresHint")}</span>
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

              <div className={styles.licenseSection}>
                <div className={styles.licenseSectionHead}>
                  <h3>{t("systemAdmin.license.sections.limits")}</h3>
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
            </section>
          </div>
        ) : null}
      </Spin>
    </div>
  );
}
