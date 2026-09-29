/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApartmentOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckOutlined,
  PartitionOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Alert, Form, Input, Select, Spin, Steps, Switch, Tag } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { SceneBackButton } from "@/framework/ui/common/SceneBackButton";
import { FilterTreeEditor } from "@/modules/data-catalog/components/FilterTreeEditor";
import { FieldIdentity } from "@/modules/data-catalog/components/FieldIdentity";
import {
  emptyFilterGroup,
  filterToBackend,
  filterValidationError,
  parseFilterCondition,
  type FilterGroup,
} from "@/modules/data-catalog/lib/filter-tree";
import {
  createDerivedView,
  getCatalogResource,
  listCatalogResourcePage,
  updateDerivedView,
} from "@/modules/data-catalog/services/resource.service";
import type {
  CatalogResource,
  ResourceSchemaField,
} from "@/modules/data-catalog/types/data-catalog";
import { hasCatalogResourceOperation } from "@/modules/data-catalog/utils/resource-operations";
import { canManageDerivedViews } from "@/modules/data-catalog/lib/view-access";
import { getCatalog, hasCatalogOperation, type CatalogRecord } from "@/shared/catalog";

import styles from "./ViewEditorScene.module.css";

const SOURCE_PAGE_SIZE = 30;

function isUsableSource(resource: CatalogResource) {
  return (
    (resource.category === "table" || resource.category === "index") &&
    resource.enabled !== false &&
    resource.status !== "stale" &&
    resource.lastDiscoverStatus !== "missing" &&
    hasCatalogResourceOperation(resource, "query_data")
  );
}

function draftField(field: ResourceSchemaField): ResourceSchemaField {
  return {
    name: field.name,
    originalName: field.originalName || field.name,
    type: field.type,
    displayName: field.displayName || field.name,
  };
}

export function ViewEditorScene({
  catalogId,
  resourceId,
}: {
  catalogId?: string;
  resourceId?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { snapshot } = useEntitlementContext();
  const [catalog, setCatalog] = useState<CatalogRecord | null>(null);
  const [view, setView] = useState<CatalogResource | null>(null);
  const [source, setSource] = useState<CatalogResource | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [fields, setFields] = useState<ResourceSchemaField[]>([]);
  const [filter, setFilter] = useState<FilterGroup>(emptyFilterGroup);
  const [unsupportedFilter, setUnsupportedFilter] = useState(false);
  const [fieldToAdd, setFieldToAdd] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sourcePage, setSourcePage] = useState(0);
  const [candidates, setCandidates] = useState<CatalogResource[]>([]);
  const [hasMoreSources, setHasMoreSources] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(resourceId ? 1 : 0);
  const [selectedType, setSelectedType] = useState<"derived" | null>(null);
  const initialDraft = useRef("");
  const searchGeneration = useRef(0);
  const sourceGeneration = useRef(0);

  const sourceLocked = unsupportedFilter;
  const sourceFields = useMemo(() => source?.schema ?? [], [source]);
  const sourceIdentity = (resource: CatalogResource) => (
    <span className={styles.sourceIdentity}>
      <strong>{resource.name}</strong>
      <small>{resource.sourceIdentifier}</small>
    </span>
  );
  const sourceSelectionLabel = (resource: CatalogResource) => (
    <span className={styles.sourceSelection}>
      {sourceIdentity(resource)}
      <Tag>{t(`dataCatalog.categories.${resource.category}`)}</Tag>
    </span>
  );
  const visibleCandidates = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase();
    return candidates.filter(
      (candidate) =>
        candidate.catalogId === catalog?.id &&
        (candidate.name.toLocaleLowerCase().includes(normalized) ||
          candidate.sourceIdentifier.toLocaleLowerCase().includes(normalized)),
    );
  }, [candidates, catalog?.id, keyword]);
  const sourceByName = useMemo(
    () => new Map(sourceFields.map((field) => [field.originalName || field.name, field])),
    [sourceFields],
  );
  const dirty =
    initialDraft.current !==
    JSON.stringify({ name, description, enabled, tags, sourceId: source?.id, fields, filter });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const currentView = resourceId ? await getCatalogResource(resourceId) : null;
        const targetId = currentView?.catalogId ?? catalogId;
        const target = targetId ? await getCatalog(targetId, { skipErrorToast: true }) : null;
        const currentSource = currentView?.logicDefinition?.sourceResourceId
          ? await getCatalogResource(currentView.logicDefinition.sourceResourceId)
          : null;
        if (cancelled) return;
        setCatalog(target);
        setView(currentView);
        setSource(currentSource);
        setName(currentView?.name ?? "");
        setDescription(currentView?.description ?? "");
        setEnabled(currentView?.enabled !== false);
        setTags(currentView?.tags ?? []);
        const viewFields =
          currentView?.schema.map((field) => ({
            ...field,
            displayName: field.displayName || field.name,
          })) ?? [];
        setFields(viewFields);
        const existingFilter = currentView?.logicDefinition?.filterCondition;
        const parsed = parseFilterCondition(existingFilter);
        const cannotEditFilter =
          Boolean(existingFilter) &&
          (parsed === null ||
            !currentSource ||
            filterValidationError(parsed, currentSource.schema) !== null);
        setFilter(parsed ?? emptyFilterGroup());
        setUnsupportedFilter(cannotEditFilter);
        initialDraft.current = JSON.stringify({
          name: currentView?.name ?? "",
          description: currentView?.description ?? "",
          enabled: currentView?.enabled !== false,
          tags: currentView?.tags ?? [],
          sourceId: currentSource?.id,
          fields: viewFields,
          filter: parsed ?? emptyFilterGroup(),
        });
      } catch (cause) {
        if (!cancelled) setError(extractRequestErrorMessage(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogId, resourceId]);

  useEffect(() => {
    const generation = ++searchGeneration.current;
    if (!catalog?.id || (!resourceId && currentStep === 0)) return;
    const currentCatalogId = catalog.id;
    const timer = window.setTimeout(
      () => {
        setSearching(true);
        const offset = sourcePage * SOURCE_PAGE_SIZE;
        void Promise.all(
          (["table", "index"] as const).map((category) =>
            listCatalogResourcePage({
              catalogId: currentCatalogId,
              category,
              keyword,
              limit: SOURCE_PAGE_SIZE,
              offset,
            }),
          ),
        )
          .then((pages) => {
            if (generation !== searchGeneration.current) return;
            const normalized = keyword.trim().toLocaleLowerCase();
            const found = pages
              .flatMap((page) => page.items)
              .filter(
                (item) =>
                  item.catalogId === currentCatalogId &&
                  (item.name.toLocaleLowerCase().includes(normalized) ||
                    item.sourceIdentifier.toLocaleLowerCase().includes(normalized)),
              );
            setCandidates((current) => {
              const merged = sourcePage === 0 ? found : [...current, ...found];
              return [...new Map(merged.map((item) => [item.id, item])).values()];
            });
            setHasMoreSources(pages.some((page) => page.total > offset + SOURCE_PAGE_SIZE));
          })
          .catch((cause) => {
            if (generation === searchGeneration.current)
              setError(extractRequestErrorMessage(cause));
          })
          .finally(() => {
            if (generation === searchGeneration.current) setSearching(false);
          });
      },
      keyword ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [catalog?.id, currentStep, keyword, resourceId, sourcePage]);

  const changeSource = useCallback(
    async (candidate: CatalogResource) => {
      if (
        candidate.id === source?.id ||
        candidate.catalogId !== catalog?.id ||
        !isUsableSource(candidate) ||
        sourceLocked
      )
        return;
      const generation = ++sourceGeneration.current;
      try {
        const detail = await getCatalogResource(candidate.id);
        if (generation !== sourceGeneration.current) return;
        if (
          !detail ||
          detail.catalogId !== catalog?.id ||
          !isUsableSource(detail) ||
          !detail.schema.length
        ) {
          setError(t("dataCatalog.viewEditor.invalidSource"));
          return;
        }
        const apply = () => {
          if (generation !== sourceGeneration.current) return;
          setSource(detail);
          setFields(detail.schema.slice(0, 3).map(draftField));
          setFilter(emptyFilterGroup());
          setFieldToAdd("");
          setError(null);
        };
        if (source && fields.length) {
          void modal.confirm({
            title: t("dataCatalog.viewEditor.sourceChangeTitle"),
            content: t("dataCatalog.viewEditor.sourceChangeHint"),
            onOk: apply,
          });
        } else apply();
      } catch (cause) {
        if (generation === sourceGeneration.current) setError(extractRequestErrorMessage(cause));
      }
    },
    [catalog?.id, fields.length, modal, source, sourceLocked, t],
  );

  const updateField = (index: number, patch: Partial<ResourceSchemaField>) => {
    setFields((current) =>
      current.map((field, position) => (position === index ? { ...field, ...patch } : field)),
    );
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const next = [...fields];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
  };

  const addField = () => {
    const chosen = sourceFields.find((field) => (field.originalName || field.name) === fieldToAdd);
    if (!chosen) return;
    let alias = chosen.name;
    for (let suffix = 2; fields.some((field) => field.name === alias); suffix++)
      alias = `${chosen.name}_${suffix}`;
    setFields((current) => [...current, { ...draftField(chosen), name: alias }]);
  };

  const returnToPrevious = () => {
    const destination = resourceId
      ? `/data-catalog/resource/${resourceId}`
      : `/data-catalog/catalog/${catalogId}`;
    const leave = () => {
      void navigate(destination);
    };
    if (dirty) {
      void modal.confirm({
        title: t("dataCatalog.viewEditor.discardTitle"),
        content: t("dataCatalog.viewEditor.discardHint"),
        onOk: leave,
      });
    } else leave();
  };

  const save = async () => {
    if (!canManageDerivedViews(snapshot)) {
      setError(t("dataCatalog.viewEditor.noAccess"));
      return;
    }
    if (!name.trim()) {
      setError(t("dataCatalog.viewEditor.invalidName"));
      return;
    }
    if (!catalog || !source || source.catalogId !== catalog.id || !isUsableSource(source)) {
      setError(t("dataCatalog.viewEditor.invalidSource"));
      return;
    }
    if (tags.length > 5 || tags.some((tag) => !tag.trim() || tag.length > 40)) {
      setError(t("dataCatalog.viewEditor.invalidTags"));
      return;
    }
    const names = fields.map((field) => field.name.trim());
    const displayNames = fields.map((field) => field.displayName?.trim() ?? "");
    if (
      !fields.length ||
      names.some((field) => !field) ||
      new Set(names).size !== names.length ||
      new Set(displayNames).size !== displayNames.length ||
      fields.some((field) => !field.displayName?.trim() || field.displayName.length > 255)
    ) {
      setError(t("dataCatalog.viewEditor.invalidFields"));
      return;
    }
    const filterError = unsupportedFilter ? null : filterValidationError(filter, sourceFields);
    if (filterError) {
      setError(t(`dataCatalog.filter.errors.${filterError}`));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const target = await getCatalog(catalog.id, { skipErrorToast: true });
      const latestSource = await getCatalogResource(source.id);
      if (
        !target ||
        target.builtin ||
        !target.enabled ||
        target.status !== "enabled" ||
        !hasCatalogOperation(target, "resource_manage")
      ) {
        setError(t("dataCatalog.viewEditor.noAccess"));
        return;
      }
      if (!latestSource || latestSource.catalogId !== target.id || !isUsableSource(latestSource)) {
        setError(t("dataCatalog.viewEditor.invalidSource"));
        return;
      }
      const input = {
        catalogId: target.id,
        description: description.trim(),
        enabled,
        name: name.trim(),
        schema: fields.map((field) => ({
          name: field.name.trim(),
          originalName: field.originalName,
          type: field.type,
          displayName: field.displayName?.trim(),
        })),
        sourceResourceId: source.id,
        filterCondition: unsupportedFilter
          ? view?.logicDefinition?.filterCondition
          : filterToBackend(filter, sourceFields),
        tags: tags.map((tag) => tag.trim()),
      };
      const saved =
        view && resourceId
          ? await updateDerivedView(resourceId, {
              ...input,
              expectedUpdateTime: view.expectedUpdateTime,
            })
          : await createDerivedView(input);
      if (!saved) throw new Error(t("dataCatalog.viewEditor.saveError"));
      void message.success(t("dataCatalog.viewEditor.saved"));
      void navigate(`/data-catalog/resource/${saved.id}`);
    } catch (cause) {
      setError(extractRequestErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <section className={styles.loading}>
        <Spin />
      </section>
    );
  if (
    !canManageDerivedViews(snapshot) ||
    !catalog ||
    catalog.builtin ||
    !catalog.enabled ||
    catalog.status !== "enabled" ||
    !hasCatalogOperation(catalog, "resource_manage")
  ) {
    return (
      <section className={styles.page}>
        <Alert message={error || t("dataCatalog.viewEditor.noAccess")} showIcon type="warning" />
      </section>
    );
  }
  if (
    resourceId &&
    (!view ||
      view.category !== "logicview" ||
      view.logicType !== "derived" ||
      !view.logicDefinition)
  ) {
    return (
      <section className={styles.page}>
        <Alert message={t("dataCatalog.viewEditor.unsupported")} showIcon type="warning" />
      </section>
    );
  }

  const catalogSummary = (
    <div className={styles.catalogSummary}>
      <strong title={catalog.name}>{catalog.name}</strong>
      <span>{t("dataCatalog.viewEditor.catalog")}</span>
    </div>
  );

  return (
    <section className={styles.page}>
      <header className={`${styles.header} ${resourceId ? "" : styles.headerWithSteps}`}>
        <SceneBackButton onClick={returnToPrevious} />
        <div className={styles.headerCopy}>
          <h1 className={styles.pageTitle}>
            {t(
              resourceId
                ? "dataCatalog.viewEditor.titleEdit"
                : "dataCatalog.viewEditor.titleCreate",
            )}
          </h1>
          <p className={styles.pageDescription}>
            {t(
              resourceId
                ? "dataCatalog.viewEditor.subtitleEdit"
                : "dataCatalog.viewEditor.subtitleCreate",
            )}
          </p>
        </div>
        {!resourceId ? (
          <div className={styles.headerTrailing}>
            <div className={styles.headerSteps}>
              <Steps
                current={currentStep}
                items={[
                  { title: t("dataCatalog.viewEditor.typeStep") },
                  { title: t("dataCatalog.viewEditor.configStep") },
                ]}
              />
            </div>
          </div>
        ) : null}
      </header>
      <div className={styles.formShell}>
        {error ? <Alert message={error} showIcon type="error" /> : null}
        {!resourceId && currentStep === 0 ? (
          <div className={styles.typePanel}>
            <Form layout="vertical">
              <div className={styles.panelHeading}>
                <div className={styles.panelIntro}>
                  <h3>{t("dataCatalog.viewEditor.typeTitle")}</h3>
                  <p>{t("dataCatalog.viewEditor.typeDescription")}</p>
                </div>
                {catalogSummary}
              </div>
              <div className={styles.typeChoices}>
                <button
                  aria-pressed={selectedType === "derived"}
                  className={`${styles.typeChoice} ${selectedType === "derived" ? styles.typeChoiceSelected : ""}`}
                  onClick={() => setSelectedType("derived")}
                  type="button"
                >
                  <span className={styles.typeChoiceIcon}>
                    <PartitionOutlined />
                  </span>
                  <span className={styles.typeChoiceCopy}>
                    <strong>{t("dataCatalog.viewEditor.derivedType")}</strong>
                    <span>{t("dataCatalog.viewEditor.derivedTypeDescription")}</span>
                  </span>
                  <span aria-hidden="true" className={styles.typeChoiceCheck}>
                    {selectedType === "derived" ? <CheckOutlined /> : null}
                  </span>
                </button>
                <button className={styles.typeChoice} disabled type="button">
                  <span className={styles.typeChoiceIcon}>
                    <ApartmentOutlined />
                  </span>
                  <span className={styles.typeChoiceCopy}>
                    <strong>{t("dataCatalog.viewEditor.compositeType")}</strong>
                    <span>{t("dataCatalog.viewEditor.compositeTypeDescription")}</span>
                  </span>
                  <span className={styles.typeChoiceUnavailable}>
                    {t("dataCatalog.viewEditor.typeUnavailable")}
                  </span>
                </button>
              </div>
            </Form>
          </div>
        ) : (
          <>
            <div className={styles.configPanel}>
              <Form layout="vertical">
                <div className={styles.configWrapper}>
                  <div className={styles.panelHeading}>
                    <div className={styles.panelIntro}>
                      <h3>
                        {t(
                          resourceId
                            ? "dataCatalog.viewEditor.editConfigTitle"
                            : "dataCatalog.viewEditor.configTitle",
                        )}
                      </h3>
                      <p>{t("dataCatalog.viewEditor.configDescription")}</p>
                    </div>
                    {catalogSummary}
                  </div>
                  <section className={styles.configSection}>
                    <h2>{t("dataCatalog.viewEditor.basic")}</h2>
                    <div className={styles.basicGrid}>
                      <label className={styles.basicField}>
                        <span className={styles.basicLabel}>
                          <span aria-hidden="true" className={styles.requiredMark}>
                            *
                          </span>
                          {t("dataCatalog.viewEditor.name")}
                        </span>
                        <span className={styles.basicControl}>
                          <Input
                            aria-label={t("dataCatalog.viewEditor.name")}
                            maxLength={255}
                            onChange={(event) => setName(event.target.value)}
                            required
                            value={name}
                          />
                        </span>
                      </label>
                      <label className={styles.basicField}>
                        <span className={styles.basicLabel}>{t("common.status")}</span>
                        <span className={styles.basicControl}>
                          <Switch
                            aria-label={t("common.status")}
                            checked={enabled}
                            checkedChildren={t("common.enabled")}
                            disabled={Boolean(resourceId)}
                            onChange={setEnabled}
                            unCheckedChildren={t("common.disabled")}
                          />
                        </span>
                      </label>
                      <label className={`${styles.basicField} ${styles.basicFieldFull}`}>
                        <span className={styles.basicLabel}>
                          {t("dataCatalog.viewEditor.description")}
                        </span>
                        <span className={styles.basicControl}>
                          <Input.TextArea
                            autoSize={{ minRows: 2, maxRows: 4 }}
                            maxLength={1000}
                            onChange={(event) => setDescription(event.target.value)}
                            value={description}
                          />
                        </span>
                      </label>
                      <label className={`${styles.basicField} ${styles.basicFieldFull}`}>
                        <span className={styles.basicLabel}>
                          {t("dataCatalog.viewEditor.tags")}
                        </span>
                        <span className={styles.basicControl}>
                          <Select
                            mode="tags"
                            onChange={setTags}
                            open={false}
                            tokenSeparators={[","]}
                            value={tags}
                          />
                          <small>{t("dataCatalog.viewEditor.tagsHint")}</small>
                        </span>
                      </label>
                    </div>
                  </section>
                  <section className={`${styles.configSection} ${styles.configGroup}`}>
                    <h2>{t("dataCatalog.viewEditor.source")}</h2>
                    {sourceLocked ? (
                      <Alert
                        message={t("dataCatalog.viewEditor.sourceLocked")}
                        showIcon
                        type="info"
                      />
                    ) : null}
                    <Select
                      aria-label={t("dataCatalog.viewEditor.sourceSearch")}
                      className={styles.sourceSelect}
                      disabled={sourceLocked}
                      filterOption={false}
                      labelInValue
                      loading={searching}
                      notFoundContent={
                        searching ? <Spin size="small" /> : t("dataCatalog.viewEditor.sourceEmpty")
                      }
                      onChange={(selection) => {
                        const candidate = candidates.find((item) => item.id === selection.value);
                        setKeyword("");
                        setSourcePage(0);
                        if (candidate) void changeSource(candidate);
                      }}
                      onOpenChange={(open) => {
                        if (!open) {
                          setKeyword("");
                          setSourcePage(0);
                        }
                      }}
                      onSearch={(value) => {
                        setKeyword(value);
                        setSourcePage(0);
                      }}
                      optionRender={(option) => {
                        const candidate = visibleCandidates.find(
                          (item) => item.id === option.value,
                        );
                        if (!candidate) return option.label;
                        return (
                          <div className={styles.sourceOption}>
                            {sourceIdentity(candidate)}
                            <Tag>{t(`dataCatalog.categories.${candidate.category}`)}</Tag>
                            {!isUsableSource(candidate) ? (
                              <small>{t("dataCatalog.viewEditor.sourceBlocked")}</small>
                            ) : null}
                          </div>
                        );
                      }}
                      options={visibleCandidates.map((candidate) => ({
                        disabled: !isUsableSource(candidate),
                        label: sourceSelectionLabel(candidate),
                        value: candidate.id,
                      }))}
                      placeholder={t("dataCatalog.viewEditor.sourceSearch")}
                      popupRender={(menu) => (
                        <>
                          {menu}
                          {hasMoreSources ? (
                            <div
                              className={styles.sourcePopupFooter}
                              onMouseDown={(event) => event.preventDefault()}
                            >
                              <AppButton
                                loading={searching}
                                onClick={() => {
                                  setSearching(true);
                                  setSourcePage((page) => page + 1);
                                }}
                              >
                                {t("dataCatalog.viewEditor.sourceMore")}
                              </AppButton>
                            </div>
                          ) : null}
                        </>
                      )}
                      searchValue={keyword}
                      showSearch
                      value={
                        source
                          ? { label: sourceSelectionLabel(source), value: source.id }
                          : undefined
                      }
                    />
                  </section>
                  <section className={`${styles.configSection} ${styles.configGroup}`}>
                    <h2>{t("dataCatalog.viewEditor.fields")}</h2>
                    <div className={styles.tableScroll}>
                      <table className={styles.fieldTable}>
                        <thead>
                          <tr>
                            <th>{t("dataCatalog.viewEditor.sourceField")}</th>
                            <th>{t("dataCatalog.viewEditor.outputName")}</th>
                            <th>{t("dataCatalog.viewEditor.displayName")}</th>
                            <th>{t("dataCatalog.viewEditor.fieldType")}</th>
                            <th aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((field, index) => {
                            const sourceField = sourceByName.get(field.originalName || field.name);
                            return (
                              <tr key={`${field.originalName || field.name}-${index}`}>
                                <td>
                                  <FieldIdentity
                                    field={sourceField}
                                    layout="inline"
                                    name={sourceField?.name || field.originalName || field.name}
                                    showNameWhenSame
                                  />
                                </td>
                                <td>
                                  <Input
                                    aria-label={`${t("dataCatalog.viewEditor.outputName")} ${index + 1}`}
                                    onChange={(event) =>
                                      updateField(index, { name: event.target.value })
                                    }
                                    value={field.name}
                                  />
                                </td>
                                <td>
                                  <Input
                                    aria-label={`${t("dataCatalog.viewEditor.displayName")} ${index + 1}`}
                                    maxLength={255}
                                    onChange={(event) =>
                                      updateField(index, { displayName: event.target.value })
                                    }
                                    value={field.displayName}
                                  />
                                </td>
                                <td>{field.type}</td>
                                <td className={styles.fieldActions}>
                                  <AppButton
                                    aria-label={t("dataCatalog.viewEditor.moveUp")}
                                    disabled={index === 0}
                                    icon={<ArrowUpOutlined />}
                                    onClick={() => moveField(index, -1)}
                                  />
                                  <AppButton
                                    aria-label={t("dataCatalog.viewEditor.moveDown")}
                                    disabled={index === fields.length - 1}
                                    icon={<ArrowDownOutlined />}
                                    onClick={() => moveField(index, 1)}
                                  />
                                  <AppButton
                                    onClick={() =>
                                      setFields((current) =>
                                        current.filter((_, position) => position !== index),
                                      )
                                    }
                                    type="link"
                                  >
                                    {t("dataCatalog.viewEditor.removeField")}
                                  </AppButton>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.addField}>
                      <Select
                        aria-label={t("dataCatalog.viewEditor.sourceField")}
                        onChange={setFieldToAdd}
                        options={sourceFields.map((field) => ({
                          label: (
                            <FieldIdentity
                              field={field}
                              layout="inline"
                              name={field.name}
                              showNameWhenSame
                            />
                          ),
                          searchText: `${field.displayName ?? ""} ${field.name} ${field.originalName ?? ""} ${field.type}`,
                          value: field.originalName || field.name,
                        }))}
                        optionFilterProp="searchText"
                        showSearch
                        value={fieldToAdd || undefined}
                      />
                      <AppButton disabled={!fieldToAdd} icon={<PlusOutlined />} onClick={addField}>
                        {t("dataCatalog.viewEditor.addField")}
                      </AppButton>
                    </div>
                  </section>
                  <section className={`${styles.configSection} ${styles.configGroup}`}>
                    <h2>{t("dataCatalog.viewEditor.fixedFilter")}</h2>
                    {unsupportedFilter ? (
                      <Alert
                        message={t("dataCatalog.viewEditor.unsupportedFilter")}
                        showIcon
                        type="warning"
                      />
                    ) : (
                      <FilterTreeEditor fields={sourceFields} onChange={setFilter} value={filter} />
                    )}
                  </section>
                </div>
              </Form>
            </div>
          </>
        )}
      </div>
      <footer className={styles.footer}>
        {!resourceId && currentStep === 1 ? (
          <AppButton
            onClick={() => {
              setCurrentStep(0);
              setError(null);
            }}
          >
            {t("common.previous")}
          </AppButton>
        ) : null}
        <AppButton onClick={returnToPrevious}>{t("dataCatalog.viewEditor.cancel")}</AppButton>
        <AppButton
          disabled={!resourceId && currentStep === 0 && selectedType !== "derived"}
          loading={saving}
          onClick={() => {
            if (!resourceId && currentStep === 0) {
              setCurrentStep(1);
              setError(null);
            } else void save();
          }}
          type="primary"
        >
          {t(
            resourceId
              ? "dataCatalog.viewEditor.save"
              : currentStep === 0
                ? "common.next"
                : "dataCatalog.viewEditor.create",
          )}
        </AppButton>
      </footer>
    </section>
  );
}
