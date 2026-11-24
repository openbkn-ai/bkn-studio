/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Form, Input, Space, Spin, Switch, type FormInstance } from "antd";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppServices } from "@/framework/context/use-app-services";
import {
  extractRequestErrorDetails,
  extractRequestErrorMessage,
  isRequestConflict,
  isRequestForbidden,
} from "@/framework/request/error-message";
import { getCatalog, hasCatalogOperation, type CatalogRecord } from "@/shared/catalog";
import { transformNumberLiteralJSONRequest } from "@/framework/request/precision-safe-json";
import { AppButton } from "@/framework/ui/common/AppButton";
import { LimitedTagsSelect } from "@/framework/ui/common/LimitedTagsSelect";
import {
  normalizeVegaTag,
  validateVegaTag,
  validateVegaTags,
  VEGA_TAGS_MAX_NUMBER,
} from "@/shared/catalog/vega-tags";
import { SceneBackButton } from "@/framework/ui/common/SceneBackButton";
import { objectValue } from "@/shared/api-definition/model";
import { ApiResourceWorkspaceView } from "../components/ApiResourceWorkspaceView";
import { ApiResourceInvocationEditor } from "../components/ApiResourceInvocationEditor";
import { ApiResourceDefinitionEditor } from "../components/ApiResourceDefinitionEditor";
import {
  createApiResourceInput,
  apiResourceChanges,
  validateApiResourceInput,
} from "../lib/api-resource";
import {
  getApiResource,
  getApiResourceConnector,
  saveApiResource,
} from "../services/api-resource.service";
import { deleteCatalogResource, setCatalogResourceEnabled } from "../services/resource.service";
import type { ApiResource, ApiResourceInput, ApiResourceQuery } from "../types/api-resource";
import type { ApiResourceSceneProps } from "../contracts/api-resource";
import { hasCatalogResourceOperation } from "../utils/resource-operations";
import styles from "../components/ApiResourceEditor.module.css";
import viewStyles from "./ViewEditorScene.module.css";

type SavedResourceReadback = { id: string; noticeKey: string };

export function ApiResourceScene({
  resourceId,
  catalogId,
  startInEditMode = false,
  tab,
  onTabChange,
  onEdit,
  onSaveCommitted,
  onSaved,
  onDeleted,
  onBack,
}: ApiResourceSceneProps) {
  const { t } = useTranslation();
  const [validationInput, setValidationInput] = useState<ApiResourceQuery>({});
  const [validationInputValid, setValidationInputValid] = useState(true);
  const mockMode = import.meta.env.VITE_USE_MOCK !== "false";
  const { message, modal } = useAppServices();
  const configTitleId = useId();
  const basicTitleId = useId();
  const validationTitleId = useId();
  const formRef = useRef<FormInstance<ApiResourceInput>>(null);
  const [catalog, setCatalog] = useState<CatalogRecord | null>(null);
  const [saved, setSaved] = useState<ApiResource>();
  const [draft, setDraft] = useState<ApiResourceInput>();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(startInEditMode || !resourceId);
  const [busy, setBusy] = useState(false);
  const [editorValid, setEditorValid] = useState(true);
  const [showOutputFieldErrors, setShowOutputFieldErrors] = useState(false);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [pendingReadback, setPendingReadback] = useState<SavedResourceReadback>();
  const initialDraft = useRef<ApiResourceInput | undefined>(undefined);
  const generation = useRef(0);
  const errorSummary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const showError = (failure: unknown) => {
    const details = extractRequestErrorDetails(failure);
    if (isRequestConflict(failure) && details.code === "VegaBackend.Resource.UpdateConflict") {
      setConflict(true);
    }
    const stage = typeof details.metadata?.stage === "string" ? details.metadata.stage : undefined;
    setError([details.code, t(details.description), stage].filter(Boolean).join(" · "));
  };
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(undefined);
    setShowOutputFieldErrors(false);
    setPendingReadback(undefined);
    try {
      const resource = resourceId ? await getApiResource(resourceId) : undefined;
      const selectedCatalog = await getCatalog(resource?.catalog_id ?? catalogId ?? "", {
        skipErrorToast: true,
      }).catch((failure: unknown) => {
        if (resource && isRequestForbidden(failure)) return null;
        throw failure;
      });
      if (
        (!selectedCatalog && !resource) ||
        (selectedCatalog && (selectedCatalog.category !== "api" || selectedCatalog.builtin))
      )
        throw new Error("dataCatalog.apiResource.errors.catalog");
      const connector = selectedCatalog
        ? await getApiResourceConnector(selectedCatalog.connectorType)
        : null;
      if (!mounted.current || current !== generation.current) return;
      setAvailable(
        connector ? connector.category === "api" && connector.available && connector.enabled : null,
      );
      setSaved(resource);
      setEditing(startInEditMode || !resourceId);
      setEditorValid(true);
      setValidationInput({});
      setValidationInputValid(true);
      setCatalog(selectedCatalog);
      const input = resource ?? createApiResourceInput(selectedCatalog?.id ?? catalogId ?? "");
      initialDraft.current = input;
      setDraft(input);
      setConflict(false);
      setNotice(undefined);
    } catch (failure) {
      if (mounted.current && current === generation.current) {
        setError(extractRequestErrorDetails(failure).description);
        setDraft(undefined);
      }
    } finally {
      if (mounted.current && current === generation.current) setLoading(false);
    }
  }, [resourceId, catalogId, startInEditMode]);
  useEffect(() => {
    void load();
  }, [load]);
  const change = (next: ApiResourceInput) => {
    setDraft(next);
    setNotice(undefined);
  };
  const canEdit = saved
    ? hasCatalogResourceOperation(saved, "modify")
    : hasCatalogOperation(catalog, "resource_manage");
  const canDelete = hasCatalogResourceOperation(saved, "delete");
  const canQuery = hasCatalogResourceOperation(saved, "query_data");
  const enabled = catalog ? catalog.enabled === true && catalog.status === "enabled" : null;
  const changes = draft
    ? apiResourceChanges(draft, saved)
    : { definition: false, schema: false, requiresValidation: false };
  const dirty =
    editing &&
    !!draft &&
    (!editorValid ||
      (draft !== initialDraft.current &&
        transformNumberLiteralJSONRequest(draft) !==
          transformNumberLiteralJSONRequest(initialDraft.current)));
  const maySave =
    (!saved || dirty) &&
    canEdit &&
    available !== false &&
    !conflict &&
    !pendingReadback &&
    (!changes.definition || (enabled !== false && (!saved || canQuery)));
  const readSavedResource = async (readback: SavedResourceReadback) => {
    const current = generation.current;
    let latest: ApiResource;
    try {
      latest = await getApiResource(readback.id);
    } catch {
      if (mounted.current && current === generation.current) setPendingReadback(readback);
      return;
    }
    if (!mounted.current || current !== generation.current) return;
    setValidationInput({});
    setValidationInputValid(true);
    setSaved(latest);
    setShowOutputFieldErrors(false);
    initialDraft.current = latest;
    setDraft(latest);
    setPendingReadback(undefined);
    const success = t(readback.noticeKey);
    setNotice(success);
    if (onSaved) void message.success(success);
    setEditing(false);
    onSaved?.(readback.id);
  };
  const retryReadback = async () => {
    if (!pendingReadback || busy) return;
    setBusy(true);
    try {
      await readSavedResource(pendingReadback);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const submit = async () => {
    const form = formRef.current;
    if (!draft || !maySave || busy || !form) return;
    setError(undefined);
    try {
      await form.validateFields();
    } catch (failure) {
      const first = (failure as { errorFields?: { name: string[] }[] }).errorFields?.[0];
      if (first) form.scrollToField(first.name, { focus: true });
      return;
    }
    const validation = validateApiResourceInput(draft, changes);
    setShowOutputFieldErrors(changes.schema);
    if (validation || !editorValid || (changes.requiresValidation && !validationInputValid)) {
      setError(t(validation ?? "dataCatalog.apiResource.errors.incomplete"));
      return;
    }
    const current = generation.current;
    setBusy(true);
    let handedOff = false;
    try {
      const id =
        changes.requiresValidation && Object.keys(validationInput).length
          ? await saveApiResource(draft, saved, validationInput)
          : await saveApiResource(draft, saved);
      if (!mounted.current || current !== generation.current) return;
      let noticeKey = "dataCatalog.apiResource.savedMetadata";
      if (mockMode) noticeKey = "dataCatalog.apiResource.mockSaved";
      else if (changes.definition) noticeKey = "dataCatalog.apiResource.savedValidated";
      else if (changes.schema) noticeKey = "dataCatalog.apiResource.savedFields";
      if (onSaveCommitted) {
        void message.success(t(noticeKey));
        onSaveCommitted(id);
        // Keep the editor disabled until the host replaces it.
        handedOff = true;
        return;
      }
      await readSavedResource({ id, noticeKey });
    } catch (failure) {
      if (mounted.current) showError(failure);
    } finally {
      if (!handedOff && mounted.current) setBusy(false);
    }
  };
  const leaveEditor = () => {
    if (busy) return;
    const leave = () => {
      if (saved && (!startInEditMode || !onBack)) {
        setValidationInput({});
        setValidationInputValid(true);
        setDraft(saved);
        setEditorValid(true);
        setShowOutputFieldErrors(false);
        setEditing(false);
        setError(undefined);
      } else onBack?.();
    };
    if (dirty) {
      void modal.confirm({
        title: t("dataCatalog.viewEditor.discardTitle"),
        content: t("dataCatalog.viewEditor.discardHint"),
        onOk: leave,
      });
    } else leave();
  };
  const toggle = async () => {
    if (!saved || !canEdit || busy) return;
    setBusy(true);
    try {
      await setCatalogResourceEnabled(saved.id, !saved.enabled);
      await load();
    } catch (failure) {
      if (mounted.current) showError(failure);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const confirmReload = () => {
    void modal.confirm({
      title: t("dataCatalog.apiResource.reloadTitle"),
      content: t("dataCatalog.apiResource.reloadHint"),
      onOk: load,
    });
  };
  const confirmToggle = () => {
    void modal.confirm({
      title: t(saved?.enabled ? "common.disable" : "common.enable"),
      content: t("dataCatalog.apiResource.stateHint"),
      onOk: toggle,
    });
  };
  const confirmDelete = () => {
    if (!saved || !canDelete) return;
    void modal.confirm({
      title: t("dataCatalog.apiResource.deleteTitle", { name: saved.name }),
      content: t("dataCatalog.apiResource.deleteHint"),
      autoFocusButton: "cancel",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCatalogResource(saved.id, { skipErrorToast: true });
        } catch (failure) {
          void message.error(extractRequestErrorMessage(failure));
          throw failure;
        }
        onDeleted?.(saved.catalog_id);
      },
    });
  };
  if (loading) return <Spin />;
  if (pendingReadback)
    return (
      <Alert
        type="warning"
        role="status"
        showIcon
        message={t("dataCatalog.apiResource.savedReadbackFailed")}
        action={
          <Button
            htmlType="button"
            loading={busy}
            disabled={busy}
            onClick={() => void retryReadback()}
          >
            {t("dataCatalog.apiResource.retryReadback")}
          </Button>
        }
      />
    );
  if (!draft)
    return (
      <Alert
        type="error"
        showIcon
        message={error ? t(error) : t("dataCatalog.apiResource.errors.resource")}
        action={<Button onClick={() => void load()}>{t("common.retry")}</Button>}
      />
    );
  const disabled = !canEdit || available === false || busy || conflict;
  const headerActions = (
    <Space wrap>
      {saved && canEdit ? (
        <Button disabled={busy || available === false} onClick={confirmToggle}>
          {t(saved.enabled ? "common.disable" : "common.enable")}
        </Button>
      ) : null}
      {canDelete ? (
        <Button danger disabled={busy || available === false} onClick={confirmDelete}>
          {t("common.delete")}
        </Button>
      ) : null}
    </Space>
  );
  const feedback = (
    <>
      {mockMode ? (
        <Alert type="info" showIcon message={t("dataCatalog.apiResource.mockHint")} />
      ) : null}
      {available === false ? (
        <Alert type="warning" showIcon message={t("dataCatalog.apiResource.unavailable")} />
      ) : null}
      {!canEdit ? <Alert type="info" message={t("dataCatalog.apiResource.readOnly")} /> : null}
      {enabled === false ? (
        <Alert type="warning" message={t("dataCatalog.apiResource.disabledCatalogHint")} />
      ) : saved?.enabled === false ? (
        <Alert type="warning" message={t("dataCatalog.apiResource.disabledHint")} />
      ) : null}
      {conflict ? (
        <Alert
          type="warning"
          showIcon
          message={t("dataCatalog.apiResource.conflict")}
          action={<Button onClick={confirmReload}>{t("common.reload")}</Button>}
        />
      ) : null}
      {error ? (
        <div ref={errorSummary} role="alert" tabIndex={-1}>
          <Alert type="error" showIcon message={error} />
        </div>
      ) : null}
      {notice ? (
        <div role="status">
          <Alert type="success" showIcon message={notice} />
        </div>
      ) : null}
    </>
  );
  if (saved && !editing)
    return (
      <ApiResourceWorkspaceView
        resource={saved}
        catalog={catalog}
        tab={tab}
        onTabChange={onTabChange}
        canEdit={canEdit && available !== false && !conflict}
        canQuery={
          canQuery &&
          available !== false &&
          enabled !== false &&
          saved.enabled &&
          saved.status === "active" &&
          !busy &&
          !conflict
        }
        actions={headerActions}
        feedback={feedback}
        onBack={onBack ? () => onBack(catalog?.id) : undefined}
        onEdit={onEdit ?? (() => setEditing(true))}
        onConflict={() => setConflict(true)}
      />
    );
  return (
    <section className={viewStyles.page}>
      <header className={viewStyles.header}>
        {onBack || saved ? <SceneBackButton onClick={leaveEditor} /> : null}
        <div className={viewStyles.headerCopy}>
          <h1 className={viewStyles.pageTitle}>
            {t(saved ? "dataCatalog.apiResource.edit" : "dataCatalog.apiResource.create")}
          </h1>
          {saved ? <p className={viewStyles.pageDescription}>{saved.name}</p> : null}
        </div>
      </header>
      <div className={viewStyles.formShell}>
        {feedback}
        <article
          className={`${viewStyles.configPanel} ${viewStyles.configWrapper}`}
          aria-labelledby={configTitleId}
        >
          <header className={viewStyles.panelHeading}>
            <h2 id={configTitleId}>{t("dataCatalog.apiResource.configuration")}</h2>
            {catalog ? (
              <div className={viewStyles.catalogSummary}>
                <strong title={catalog.name}>{catalog.name}</strong>
                <span>{t("dataCatalog.viewEditor.catalog")}</span>
              </div>
            ) : null}
          </header>
          <section className={viewStyles.configSection} aria-labelledby={basicTitleId}>
            <h3 id={basicTitleId}>{t("dataCatalog.viewEditor.basic")}</h3>
            <Form<ApiResourceInput>
              key={generation.current}
              aria-labelledby={basicTitleId}
              className={`${viewStyles.basicGrid} ${styles.basicForm}`}
              colon={false}
              ref={formRef}
              initialValues={{
                name: draft.name,
                description: draft.description,
                tags: draft.tags,
              }}
              layout="horizontal"
              disabled={disabled}
              validateTrigger="onBlur"
              onValuesChange={(patch: Partial<ApiResourceInput>) => change({ ...draft, ...patch })}
            >
              <Form.Item
                name="name"
                label={t("dataCatalog.apiResource.name")}
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: t("common.required"),
                  },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label={t("dataCatalog.resource.enabledStatus")}
                htmlFor={`${basicTitleId}-enabled`}
              >
                <span className={viewStyles.basicControl}>
                  <Switch
                    id={`${basicTitleId}-enabled`}
                    checked={draft.enabled}
                    checkedChildren={t("common.enabled")}
                    unCheckedChildren={t("common.disabled")}
                    disabled
                  />
                </span>
              </Form.Item>
              <Form.Item
                className={viewStyles.basicFieldFull}
                name="description"
                label={t("common.description")}
              >
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
              </Form.Item>
              <Form.Item
                className={viewStyles.basicFieldFull}
                name="tags"
                label={t("dataCatalog.resource.tags")}
                extra={t("dataCatalog.resource.tagInputHint")}
                rules={[
                  {
                    validator: (_, tags: string[] | undefined) => {
                      const error = validateVegaTags(tags ?? []);
                      return error
                        ? Promise.reject(new Error(t(`dataCatalog.viewEditor.tagErrors.${error}`)))
                        : Promise.resolve();
                    },
                  },
                ]}
              >
                <LimitedTagsSelect
                  limit={VEGA_TAGS_MAX_NUMBER}
                  limitMessage={t("dataCatalog.viewEditor.tagErrors.count")}
                  normalizeTag={normalizeVegaTag}
                  open={false}
                  tokenSeparators={[","]}
                  validateTag={(tag) => {
                    const error = validateVegaTag(tag);
                    return error ? t(`dataCatalog.viewEditor.tagErrors.${error}`) : null;
                  }}
                />
              </Form.Item>
            </Form>
          </section>
          <ApiResourceDefinitionEditor
            key={saved ? `${saved.id}:${saved.update_time}` : "new"}
            value={draft}
            catalogVariableNames={Object.keys(objectValue(catalog?.connectorConfig?.variables))}
            onChange={change}
            disabled={disabled}
            showOutputFieldErrors={changes.schema && showOutputFieldErrors}
            onValidityChange={setEditorValid}
          />
        </article>
        <article
          className={`${viewStyles.configPanel} ${viewStyles.configWrapper}`}
          aria-labelledby={validationTitleId}
        >
          <header className={viewStyles.panelHeading}>
            <h2 id={validationTitleId}>{t("dataCatalog.apiResource.invocation.validation")}</h2>
          </header>
          <p className={styles.cardHint}>
            {t("dataCatalog.apiResource.invocation.validationHint")}
          </p>
          <ApiResourceInvocationEditor
            key={saved ? `${saved.id}:${saved.update_time}` : "new"}
            resource={draft}
            value={validationInput}
            onChange={setValidationInput}
            onValidityChange={setValidationInputValid}
            disabled={disabled}
          />
          {!mockMode && changes.requiresValidation ? (
            <Alert type="info" showIcon message={t("dataCatalog.apiResource.saveHint")} />
          ) : null}
        </article>
      </div>
      <footer className={viewStyles.footer}>
        {onBack || saved ? (
          <AppButton disabled={busy} onClick={leaveEditor}>
            {t("common.cancel")}
          </AppButton>
        ) : null}
        {canEdit ? (
          <AppButton
            type="primary"
            disabled={!maySave}
            loading={busy}
            onClick={() => void submit()}
          >
            {t(changes.definition ? "dataCatalog.apiResource.saveValidate" : "common.save")}
          </AppButton>
        ) : null}
      </footer>
    </section>
  );
}
