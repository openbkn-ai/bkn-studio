/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ArrowLeftOutlined,
  InfoCircleOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Alert, Segmented, Select, Spin, Tag, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import { useCapability } from "@/framework/entitlement/use-entitlement";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { DirectoryUserPicker } from "@/modules/system-admin/components/DirectoryUserPicker";
import { authzPoints } from "@/modules/system-admin/permissions";
import { listUsers } from "@/modules/system-admin/services/admin.service";
import { resolveGrantNames } from "@/modules/system-admin/services/authz-objects.service";
import {
  listAuthorizableObjects,
  upsertObjectGrant,
} from "@/modules/system-admin/services/authz.service";
import type { AdminUser } from "@/modules/system-admin/types/admin";
import type { AuthorizableObject, GrantEffect } from "@/modules/system-admin/types/authz";
import {
  AUTHZ_OBJECT_PICKER_TYPES,
  HIDDEN_INSTANCE_OPS,
  isAuthzObjectPickerType,
  isCommunityObjectGrantType,
} from "@/modules/system-admin/utils/authz-catalog";
import { operationsForType, resourceTypeLabel } from "@/modules/system-admin/utils/resource-catalog";

import styles from "./admin.module.css";

function parseObjValue(value?: string): { objId: string; objType: string } | null {
  if (!value) {
    return null;
  }
  const [type, id] = value.split("::");
  if (!type || !id) {
    return null;
  }
  return { objId: id, objType: type };
}

const GRANT_LIST_PATH = "/system/authorizations";
const FULL_BUSINESS_ACCESS = "full_business_access" as const;

const OBJECT_TYPE_GROUPS = [
  { key: "data", types: ["catalog", "resource"] },
  { key: "knowledge", types: ["knowledge_network"] },
  { key: "execution", types: ["operator", "tool_box", "mcp", "skill"] },
] as const;

type ObjectGrantLocationState = {
  objectGrantReturnTo?: string;
};

/**
 * The wizard is reachable from the object's own page as well as from the grant list, so leaving it
 * has to land where the user came from. Only same-origin absolute paths are honoured — a caller
 * cannot send someone off-site through this.
 */
function resolveReturnPath(state: ObjectGrantLocationState | null): string {
  const candidate = state?.objectGrantReturnTo;
  if (typeof candidate !== "string" || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return GRANT_LIST_PATH;
  }
  return candidate;
}

export function ObjectAuthorizationCreateScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const fineGrainedCapability = useCapability(CAPABILITIES.PERM_FINE_GRAINED);
  const fineGrained = fineGrainedCapability === "available";
  // Deep link from the object's own page (`?object=catalog::<id>`), so an administrator sent here
  // from a data catalog does not have to find it again among hundreds of objects.
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const returnPath = resolveReturnPath(location.state as ObjectGrantLocationState | null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [objects, setObjects] = useState<AuthorizableObject[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  const deepLinkedObject = parseObjValue(searchParams.get("object") ?? undefined)
    ? (searchParams.get("object") ?? undefined)
    : undefined;
  const deepLinkedType = parseObjValue(deepLinkedObject)?.objType;
  const supportedDeepLinkedType = deepLinkedType && isAuthzObjectPickerType(deepLinkedType) &&
    (fineGrained || isCommunityObjectGrantType(deepLinkedType))
    ? deepLinkedType
    : undefined;
  const supportedDeepLinkedObject = supportedDeepLinkedType
    ? deepLinkedObject
    : undefined;
  const [objectValue, setObjectValue] = useState<string | undefined>(supportedDeepLinkedObject);
  const [objectType, setObjectType] = useState<string | undefined>(supportedDeepLinkedType);
  const [granteeIds, setGranteeIds] = useState<string[]>([]);
  const [opKeys, setOpKeys] = useState<string[]>([]);
  const [bundleSelected, setBundleSelected] = useState(false);
  const [effect, setEffect] = useState<GrantEffect>("allow");
  const [objectLoading, setObjectLoading] = useState(false);
  const [objectLoadRevision, setObjectLoadRevision] = useState(0);

  const selectedObject = useMemo(() => {
    const parsed = parseObjValue(objectValue);
    if (!parsed) {
      return null;
    }
    const meta = objects.find((item) => item.type === parsed.objType && item.id === parsed.objId);
    return meta
      ? { objType: meta.type, objId: meta.id, objName: meta.name, objSub: meta.sub }
      : {
          objType: parsed.objType,
          objId: parsed.objId,
          objName: parsed.objId,
          objSub: undefined,
        };
  }, [objectValue, objects]);

  const ops = useMemo(() => {
    if (!selectedObject) {
      return [];
    }
    return operationsForType(selectedObject.objType).filter((op) => !HIDDEN_INSTANCE_OPS.has(op.key));
  }, [selectedObject]);

  const activeRequirements = useMemo(
    () =>
      ops.flatMap((requirement) => {
        const dependents = ops.filter(
          (candidate) =>
            opKeys.includes(candidate.key) && candidate.requires.includes(requirement.key),
        );
        return dependents.length > 0 ? [{ dependents, requirement }] : [];
      }),
    [opKeys, ops],
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await listUsers());
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!objectType) {
      setObjects([]);
      return;
    }
    let cancelled = false;
    setObjectLoading(true);
    setLoadError(null);
    void listAuthorizableObjects(objectType)
      .then(async (listed) => {
        const linked = parseObjValue(deepLinkedObject);
        const alreadyListed =
          !linked || listed.some((item) => item.type === linked.objType && item.id === linked.objId);
        if (linked && linked.objType === objectType && !alreadyListed) {
          const [resolved] = await resolveGrantNames([
            {
              accessorId: "",
              objId: linked.objId,
              objName: linked.objId,
              objType: linked.objType,
              operations: [],
            },
          ]);
          listed = [...listed, { id: linked.objId, name: resolved?.objName || linked.objId, type: linked.objType }];
        }
        if (!cancelled) {
          setObjects(listed);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(extractRequestErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setObjectLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deepLinkedObject, objectLoadRevision, objectType]);

  const retryLoad = () => {
    void loadUsers();
    setObjectLoadRevision((revision) => revision + 1);
  };

  useEffect(() => {
    if (!fineGrained || !selectedObject || !ops.length) {
      setOpKeys([]);
      return;
    }
    setOpKeys((prev) => {
      if (prev.length > 0) {
        return prev.filter((key) => ops.some((op) => op.key === key));
      }
      const defaultOp = ops.find((op) => /view|display|list/.test(op.key))?.key ?? ops[0]?.key;
      return defaultOp ? [defaultOp] : [];
    });
  }, [fineGrained, ops, selectedObject]);

  const objectOptions = useMemo(
    () =>
      objects.map((obj) => ({
        label: obj.sub ? `${obj.name} (${obj.sub})` : obj.name,
        value: `${obj.type}::${obj.id}`,
      })),
    [objects],
  );

  const objectTypeOptions = useMemo(
    () =>
      OBJECT_TYPE_GROUPS.map((group) => ({
        label: t(`systemAdmin.objectGrants.objectTypeGroups.${group.key}`),
        options: group.types
          .filter((type) =>
            (AUTHZ_OBJECT_PICKER_TYPES as readonly string[]).includes(type) &&
            (fineGrained || isCommunityObjectGrantType(type)),
          )
          .map((type) => ({ label: resourceTypeLabel(type), value: type })),
      })),
    [fineGrained, t],
  );

  const toggleOp = (opKey: string) => {
    setOpKeys((prev) => {
      if (prev.includes(opKey)) {
        const requiredBySelected = ops.some(
          (op) => prev.includes(op.key) && op.requires.includes(opKey),
        );
        return requiredBySelected ? prev : prev.filter((key) => key !== opKey);
      }
      const requirements = effect === "allow"
        ? (ops.find((op) => op.key === opKey)?.requires ?? [])
        : [];
      return [...new Set([...prev, ...requirements, opKey])];
    });
  };

  const selectedOperations = ops.filter((op) => opKeys.includes(op.key));
  const canSubmit = Boolean(
    selectedObject && granteeIds.length > 0 &&
      (fineGrained ? opKeys.length > 0 : bundleSelected),
  );
  const nextActionKey = !selectedObject
    ? "systemAdmin.objectGrants.summaryNextPickObject"
    : granteeIds.length === 0
      ? "systemAdmin.objectGrants.summaryNextPickGrantee"
      : !fineGrained && !bundleSelected
        ? "systemAdmin.objectGrants.grantNeedsBundle"
        : fineGrained && opKeys.length === 0
          ? "systemAdmin.objectGrants.summaryNextPickOps"
          : "systemAdmin.objectGrants.summaryReady";

  const handleSubmit = async () => {
    if (!selectedObject) {
      void message.error(t("systemAdmin.objectGrants.pickObjectFirst"));
      return;
    }
    if (!granteeIds.length) {
      void message.error(t("systemAdmin.objectGrants.pickGranteeFirst"));
      return;
    }
    if (fineGrained ? !opKeys.length : !bundleSelected) {
      void message.error(t(fineGrained
        ? "systemAdmin.objectGrants.pickOpsFirst"
        : "systemAdmin.objectGrants.grantNeedsBundle"));
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        granteeIds.map((accessorId) =>
          upsertObjectGrant({
            accessorId,
            ...(fineGrained
              ? { effect, operations: opKeys }
              : { bundle: FULL_BUSINESS_ACCESS }),
            objId: selectedObject.objId,
            objName: selectedObject.objName,
            objSub: selectedObject.objSub,
            objType: selectedObject.objType,
          }),
        ),
      );
      message.success(t("systemAdmin.objectGrants.toast.grantCreated"));
      void navigate(returnPath);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (fineGrainedCapability === "unknown") {
    return (
      <section
        className={[styles.contentSurface, styles.contentSurfacePlain].join(" ")}
        data-page="object-authz-create"
      >
        <RequireEdition
          capability={CAPABILITIES.PERM_FINE_GRAINED}
          minEdition="professional"
          mountLockedContent={false}
        >
          <div />
        </RequireEdition>
      </section>
    );
  }

  return (
    <section
      className={[styles.contentSurface, styles.contentSurfacePlain].join(" ")}
      data-page="object-authz-create"
    >
      <header className={styles.authzCreateHeader}>
        <AppButton
          className={styles.authzCreateBack}
          icon={<ArrowLeftOutlined />}
          onClick={() => void navigate(returnPath)}
          type="text"
        >
          {t("common.back")}
        </AppButton>
        <div className={styles.authzCreateHeading}>
          <div className={styles.pageTitle}>{t("systemAdmin.objectGrants.createPageTitle")}</div>
          <div className={styles.pageSubtitle}>
            {t("systemAdmin.objectGrants.createPageHint")}
          </div>
        </div>
        <div className={styles.authzCreateMode}>
          <span className={styles.authzCreateModeIcon}>
            {fineGrained ? (
              <SafetyCertificateOutlined aria-hidden="true" />
            ) : (
              <LockOutlined aria-hidden="true" />
            )}
          </span>
          <strong>
            {t(
              fineGrained
                ? "systemAdmin.objectGrants.modeFineTitle"
                : "systemAdmin.objectGrants.modeCommunityTitle",
            )}
          </strong>
          <Tag color={fineGrained ? "blue" : "default"}>
            {t(
              fineGrained
                ? "systemAdmin.objectGrants.editionProfessional"
                : "systemAdmin.objectGrants.editionCommunity",
            )}
          </Tag>
          <Tooltip
            title={t(
              fineGrained
                ? "systemAdmin.objectGrants.modeFineDescription"
                : "systemAdmin.objectGrants.modeCommunityDescription",
            )}
          >
            <InfoCircleOutlined
              aria-label={t("systemAdmin.objectGrants.authorizationModeHelp")}
              className={styles.authzCreateModeHelp}
            />
          </Tooltip>
        </div>
      </header>

      {loadError ? (
        <Alert
          action={
            <AppButton onClick={retryLoad} type="link">
              {t("common.retry")}
            </AppButton>
          }
          message={loadError}
          showIcon
          type="error"
        />
      ) : loading ? (
        <div className={styles.createLoading}>
          <Spin />
        </div>
      ) : (
        <div className={styles.authzCreateLayout}>
          <main className={styles.authzCreateComposer}>
            <section className={styles.authzCreateStep}>
              <span className={styles.authzCreateStepIndex}>1</span>
              <div className={styles.authzCreateStepContent}>
                <div className={styles.authzCreateStepHead}>
                  <div>
                    <h2>{t("systemAdmin.objectGrants.createPagePickObject")}</h2>
                    <p>{t("systemAdmin.objectGrants.objectStepDescription")}</p>
                  </div>
                </div>
                <div className={styles.createObjectPickerRow}>
                  <Select
                    allowClear
                    aria-label={t("systemAdmin.objectGrants.pickerObjectTypePlaceholder")}
                    className={styles.createObjectTypeSelect}
                    onChange={(value) => {
                      setObjectType(value);
                      setObjectValue(undefined);
                      setOpKeys([]);
                      setBundleSelected(false);
                    }}
                    options={objectTypeOptions}
                    placeholder={t("systemAdmin.objectGrants.pickerObjectTypePlaceholder")}
                    value={objectType}
                  />
                  <Select
                    allowClear
                    aria-label={t("systemAdmin.objectGrants.pickerObjectPlaceholder")}
                    className={styles.createObjectSelect}
                    disabled={!objectType}
                    loading={objectLoading}
                    onChange={(value) => {
                      setObjectValue(value);
                      setBundleSelected(false);
                    }}
                    optionFilterProp="label"
                    options={objectOptions}
                    placeholder={t("systemAdmin.objectGrants.pickerObjectPlaceholder")}
                    showSearch
                    value={objectValue}
                  />
                </div>
              </div>
            </section>

            <section className={styles.authzCreateStep}>
              <span className={styles.authzCreateStepIndex}>2</span>
              <div className={styles.authzCreateStepContent}>
                <div className={styles.authzCreateStepHead}>
                  <div>
                    <h2>{t("systemAdmin.objectGrants.createPagePickGrantee")}</h2>
                    <p>{t("systemAdmin.objectGrants.createPageGranteeHint")}</p>
                  </div>
                </div>
                <DirectoryUserPicker
                  ariaLabel={t("systemAdmin.objectGrants.pickerGranteePlaceholder")}
                  className={styles.authzCreateSubjectSelect}
                  initialUsers={users}
                  mode="multiple"
                  onChange={setGranteeIds}
                  placeholder={t("systemAdmin.objectGrants.pickerGranteePlaceholder")}
                  value={granteeIds}
                />
              </div>
            </section>

            <section className={styles.authzCreateStep}>
              <span className={styles.authzCreateStepIndex}>3</span>
              <div className={styles.authzCreateStepContent}>
                <div className={styles.authzCreateStepHead}>
                  <div>
                    <h2>
                      {t(
                        fineGrained
                          ? "systemAdmin.objectGrants.createPagePickOps"
                          : "systemAdmin.objectGrants.fullBundleTitle",
                      )}
                    </h2>
                    <p>
                      {t(
                        fineGrained
                          ? "systemAdmin.objectGrants.createPageOpsPlaceholder"
                          : "systemAdmin.objectGrants.fullBundleDescription",
                      )}
                    </p>
                  </div>
                </div>
                {!selectedObject ? (
                  <div className={styles.authzCreateEmptyStep}>
                    <SafetyCertificateOutlined aria-hidden="true" />
                    <p>{t("systemAdmin.objectGrants.pickObjectFirst")}</p>
                  </div>
                ) : fineGrained ? (
                  <>
                    <div className={styles.authzOperationToolbar}>
                      <div className={styles.authzEffectControl}>
                        <span>{t("systemAdmin.objectGrants.effectLabel")}</span>
                        <Segmented
                          aria-label={t("systemAdmin.objectGrants.effectLabel")}
                          onChange={(value) => {
                            setEffect(value as GrantEffect);
                            setOpKeys([]);
                          }}
                          options={[
                            { label: t("systemAdmin.objectGrants.effectAllow"), value: "allow" },
                            { label: t("systemAdmin.objectGrants.effectDeny"), value: "deny" },
                          ]}
                          value={effect}
                        />
                      </div>
                      <div className={styles.authzOperationSelectionActions}>
                        <span>
                          {t("systemAdmin.objectGrants.selectedOperationCount", {
                            selected: opKeys.length,
                            total: ops.length,
                          })}
                        </span>
                        <AppButton
                          onClick={() => setOpKeys(ops.map((op) => op.key))}
                          size="small"
                          type="link"
                        >
                          {t("systemAdmin.objectGrants.selectAllOperations")}
                        </AppButton>
                        <AppButton
                          disabled={opKeys.length === 0}
                          onClick={() => setOpKeys([])}
                          size="small"
                          type="link"
                        >
                          {t("systemAdmin.objectGrants.clearOperations")}
                        </AppButton>
                      </div>
                    </div>
                    <div className={styles.authzCreateOperationGrid}>
                      {ops.map((op) => {
                        const prerequisiteLocked = activeRequirements.some(
                          ({ requirement }) => requirement.key === op.key,
                        );
                        return (
                          <button
                            aria-pressed={opKeys.includes(op.key)}
                            className={[
                              styles.chipOpt,
                              styles.authzCreateOperation,
                              opKeys.includes(op.key) ? styles.chipOptSelected : "",
                              prerequisiteLocked ? styles.chipRequired : "",
                            ].join(" ")}
                            key={op.key}
                            onClick={() => toggleOp(op.key)}
                            title={`${op.label} (${op.key})`}
                            type="button"
                          >
                            <span className={styles.chipLabelRow}>
                              <span className={styles.chipCode}>{op.label}</span>
                              {prerequisiteLocked ? (
                                <Tooltip title={t("systemAdmin.objectGrants.requiredBySelection")}>
                                  <LockOutlined
                                    aria-label={t("systemAdmin.objectGrants.requiredBySelection")}
                                    className={styles.chipLock}
                                  />
                                </Tooltip>
                              ) : null}
                            </span>
                            <span className={styles.chipType}>{op.key}</span>
                          </button>
                        );
                      })}
                    </div>
                    {activeRequirements.length > 0 ? (
                      <div className={styles.requirementNotice}>
                        <InfoCircleOutlined />
                        <div>
                          {activeRequirements.map(({ dependents, requirement }) => (
                            <div key={requirement.key}>
                              {t("systemAdmin.objectGrants.requiredSelectionNotice", {
                                dependents: dependents.map((item) => item.label).join("、"),
                                requirement: requirement.label,
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div
                      aria-label={t("systemAdmin.objectGrants.grantOperationsLabel")}
                      className={[
                        styles.authzGrantOperations,
                        styles.authzGrantOperationsSingle,
                      ].join(" ")}
                      role="group"
                    >
                      <Tooltip title={FULL_BUSINESS_ACCESS}>
                        <button
                          aria-label={`${t("systemAdmin.objectGrants.fullBundleName")} (${FULL_BUSINESS_ACCESS})`}
                          aria-pressed={bundleSelected}
                          className={bundleSelected
                            ? styles.authzGrantOperationSelected
                            : styles.authzGrantOperation}
                          onClick={() => setBundleSelected((selected) => !selected)}
                          type="button"
                        >
                          {t("systemAdmin.objectGrants.fullBundleName")}
                        </button>
                      </Tooltip>
                    </div>
                    <span className={styles.authzBundleHint}>
                      {t("systemAdmin.objectGrants.fullBundleScope")}
                    </span>
                  </>
                )}
              </div>
            </section>
          </main>

          <aside className={styles.authzCreateSummary}>
            <div className={styles.authzCreateSummaryHead}>
              <div>
                <h2>{t("systemAdmin.objectGrants.configurationSummary")}</h2>
                <p>{t(nextActionKey)}</p>
              </div>
              <span
                className={[
                  styles.authzCreateStatus,
                  canSubmit ? styles.authzCreateStatusReady : "",
                ].join(" ")}
              >
                {t(
                  canSubmit
                    ? "systemAdmin.objectGrants.configurationReady"
                    : "systemAdmin.objectGrants.configurationIncomplete",
                )}
              </span>
            </div>

            <dl className={styles.authzCreateSummaryList}>
              <div>
                <dt>{t("systemAdmin.objectGrants.summaryObject")}</dt>
                <dd title={selectedObject?.objName}>
                  {selectedObject?.objName ?? t("systemAdmin.objectGrants.notSelected")}
                </dd>
              </div>
              <div>
                <dt>{t("systemAdmin.objectGrants.summarySubjects")}</dt>
                <dd>
                  {granteeIds.length > 0
                    ? t("systemAdmin.objectGrants.selectedSubjectCount", {
                        count: granteeIds.length,
                      })
                    : t("systemAdmin.objectGrants.notSelected")}
                </dd>
              </div>
              <div>
                <dt>{t("systemAdmin.objectGrants.summaryRule")}</dt>
                <dd>
                  {fineGrained
                    ? t(`systemAdmin.objectGrants.effect.${effect}`)
                    : bundleSelected
                      ? t("systemAdmin.objectGrants.fullBundleName")
                      : t("systemAdmin.objectGrants.notSelected")}
                </dd>
              </div>
              <div>
                <dt>{t("systemAdmin.objectGrants.summaryOperations")}</dt>
                <dd>
                  {fineGrained
                    ? t("systemAdmin.objectGrants.selectedOperationCount", {
                        selected: opKeys.length,
                        total: ops.length,
                      })
                    : bundleSelected
                      ? t("systemAdmin.objectGrants.fullBundleName")
                      : t("systemAdmin.objectGrants.notSelected")}
                </dd>
              </div>
            </dl>

            {fineGrained && selectedOperations.length > 0 ? (
              <div className={styles.authzCreateSummaryOps}>
                {selectedOperations.slice(0, 6).map((op) => (
                  <span key={op.key}>{op.label}</span>
                ))}
                {selectedOperations.length > 6 ? (
                  <span>+{selectedOperations.length - 6}</span>
                ) : null}
              </div>
            ) : null}

            <div className={styles.authzCreateSummaryActions}>
              <PermissionGate permissions={authzPoints.grant}>
                <AppButton
                  block
                  disabled={!canSubmit}
                  loading={saving}
                  onClick={() => void handleSubmit()}
                  type="primary"
                >
                  {t("systemAdmin.objectGrants.confirmGrant")}
                </AppButton>
              </PermissionGate>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
