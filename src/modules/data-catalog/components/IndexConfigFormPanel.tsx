/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Drawer, Input, Select, Space } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import { loadAnalyzerCapabilities, findUnavailableAnalyzers, type AnalyzerCapabilitiesLoadState } from "@/modules/data-catalog/utils/analyzer-capabilities";
import {
  getCatalogResource,
  updateCatalogResource,
} from "@/modules/data-catalog/services/resource.service";
import type {
  BuildTask,
  CatalogResource,
  EmbeddingModelOption,
  ResourceSchemaField,
} from "@/modules/data-catalog/types/data-catalog";
import {
  applyIndexFormToSchema,
  indexFormValuesFromResource,
  type ResourceFeatureDraft,
} from "@/modules/data-catalog/utils/resource-index-config";
import {
  extractRequestStatus,
  isActiveBuildTask,
} from "@/modules/data-catalog/utils/build-task-guards";
import {
  findUnregisteredEmbeddingModel,
  isRegisteredEmbeddingModel,
  loadEmbeddingModelOptions,
  pickRegisteredEmbeddingModelId,
  type EmbeddingModelsLoadState,
} from "@/modules/data-catalog/utils/embedding-model-options";
import {
  invalidKeyFields,
  isIncrementalField,
  isPrimaryKeyField,
  unsupportedSchemaFields,
} from "@/modules/data-catalog/lib/build-guards";

import formStyles from "./BuildTaskFormPanel.module.css";
import styles from "./shared.module.css";

export type IndexConfigFormPanelProps = {
  active: boolean;
  hideBuildControls?: boolean;
  onSaved?: () => void;
  readOnly?: boolean;
  resource: CatalogResource;
};

const INHERIT_VALUE = "__inherit__";

function isChineseAnalyzer(analyzer: string): boolean {
  return /^(?:ik|hanlp)(?:_|$)/.test(analyzer.trim().toLowerCase());
}

const normalizeFieldType = (type: string) => type.trim().toLowerCase();
const isFeatureConfigField = (type: string) => ["string", "text"].includes(normalizeFieldType(type));
const isTextField = isFeatureConfigField;

function keyFieldOptionLabel(field: ResourceSchemaField): string {
  const displayName = field.displayName?.trim();
  if (displayName && displayName !== field.name) {
    return `${displayName}（${field.name} · ${field.type}）`;
  }
  return `${field.name}（${field.type}）`;
}

const defaultFeatureNameOf = (kind: "embedding" | "fulltext", index: number) => {
  const base = kind === "embedding" ? "vector" : "fulltext";
  return index === 0 ? base : `${base}_${index + 1}`;
};

function coerceFeatureDrafts(
  kind: "embedding" | "fulltext",
  groups: Array<ResourceFeatureDraft | string> = [],
): ResourceFeatureDraft[] {
  const normalized = groups.map((item, index) =>
    typeof item === "string"
      ? {
        isDefault: index === 0,
        name: defaultFeatureNameOf(kind, index),
        value: item,
      }
      : {
        ...item,
        isDefault: item.isDefault ?? index === 0,
        name: item.name?.trim() || defaultFeatureNameOf(kind, index),
        value: item.value ?? "",
      },
  );
  const defaultIndex = normalized.findIndex((item) => item.isDefault);
  return normalized.map((item, index) => ({
    ...item,
    isDefault: defaultIndex >= 0 ? index === defaultIndex : index === 0,
  }));
}

function coerceFeatureDraftRecord(
  kind: "embedding" | "fulltext",
  groups?: Record<string, Array<ResourceFeatureDraft | string>>,
): Record<string, ResourceFeatureDraft[]> {
  return Object.fromEntries(
    Object.entries(groups ?? {}).map(([field, items]) => [
      field,
      coerceFeatureDrafts(kind, items),
    ]),
  );
}

export function IndexConfigFormPanel({
  active,
  hideBuildControls = false,
  onSaved,
  readOnly = false,
  resource,
}: IndexConfigFormPanelProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();

  const [activeTask, setActiveTask] = useState<BuildTask | null>(null);
  const [schema, setSchema] = useState<ResourceSchemaField[]>(resource.schema);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [primaryKeyFields, setPrimaryKeyFields] = useState<string[]>([]);
  const [incrementalFields, setIncrementalFields] = useState<string[]>([]);
  const [fieldEmbeddingModelGroups, setFieldEmbeddingModelGroups] = useState<Record<string, ResourceFeatureDraft[]>>({});
  const [fieldFulltextAnalyzerGroups, setFieldFulltextAnalyzerGroups] = useState<Record<string, ResourceFeatureDraft[]>>({});
  const [featureField, setFeatureField] = useState<ResourceSchemaField | null>(null);
  const [defaultFulltextAnalyzer, setDefaultFulltextAnalyzer] = useState<string>("");
  const [models, setModels] = useState<EmbeddingModelOption[]>([]);
  const [modelsLoadState, setModelsLoadState] = useState<EmbeddingModelsLoadState>("idle");
  const [modelsLoadError, setModelsLoadError] = useState<string | null>(null);
  const [analyzers, setAnalyzers] = useState<string[]>([]);
  const [analyzersLoadState, setAnalyzersLoadState] = useState<AnalyzerCapabilitiesLoadState>("idle");
  const [analyzersLoadError, setAnalyzersLoadError] = useState<string | null>(null);
  const analyzerResourceIdRef = useRef<string | null>(null);
  const analyzerRequestIdRef = useRef(0);
  const [orphanSavedModel, setOrphanSavedModel] = useState<string | null>(null);
  const [defaultModelId, setDefaultModelId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!error) {
      return undefined;
    }

    const timer = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const analyzerOptions = useMemo(
    () =>
      analyzers.map((analyzer) => ({
        label: t(`dataCatalog.build.analyzers.${analyzer}`, { defaultValue: analyzer }),
        value: analyzer,
      })),
    [analyzers, t],
  );
  const enabledChineseAnalyzers = useMemo(
    () => analyzers.filter(isChineseAnalyzer),
    [analyzers],
  );

  const modelOptions = useMemo(
    () =>
      models.map((model) => ({
        label: `${model.name} - ${model.dimensions}d`,
        value: model.id,
      })),
    [models],
  );

  const markDirty = () => {
    setDirty(true);
    setError(null);
  };

  const inheritAnalyzerOption = useMemo(
    () => ({
      label: t("dataCatalog.build.inheritDefaultAnalyzer"),
      value: INHERIT_VALUE,
    }),
    [t],
  );

  const inheritModelOption = useMemo(
    () => ({
      label: t("dataCatalog.build.inheritDefaultModel"),
      value: INHERIT_VALUE,
    }),
    [t],
  );

  useEffect(() => {
    if (!active) {
      return;
    }
    // Keep analyzer reset scope aligned with the capability effect's resource.id dependency.
    const resourceChanged = analyzerResourceIdRef.current !== resource.id;
    analyzerResourceIdRef.current = resource.id;

    setActiveTask(null);
    setPrimaryKeyFields([]);
    setIncrementalFields([]);
    setFieldEmbeddingModelGroups({});
    setFieldFulltextAnalyzerGroups({});
    setFeatureField(null);
    setDefaultFulltextAnalyzer("");
    setError(null);
    setDirty(false);
    setModelsLoadState("idle");
    setModelsLoadError(null);
    if (resourceChanged) {
      setAnalyzersLoadState("idle");
      setAnalyzersLoadError(null);
      setAnalyzers([]);
    }
    setOrphanSavedModel(null);
    setModels([]);
    setSchema(resource.schema);

    const hydrateFromResource = (detail: CatalogResource) => {
      setSchema(detail.schema);
      const form = indexFormValuesFromResource(detail);
      setPrimaryKeyFields(form.primaryKeyFields ?? []);
      setIncrementalFields(form.incrementalFields ?? []);
      setFieldEmbeddingModelGroups(coerceFeatureDraftRecord("embedding", form.fieldEmbeddingModelGroups));
      setFieldFulltextAnalyzerGroups(coerceFeatureDraftRecord("fulltext", form.fieldFulltextAnalyzerGroups));
      setDirty(false);
      if (form.fulltextAnalyzer) {
        setDefaultFulltextAnalyzer(form.fulltextAnalyzer);
      }
      return form.embeddingModel;
    };

    void (async () => {
      let preferredModel = "";
      setSchemaLoading(true);
      try {
        preferredModel = hydrateFromResource(resource) || "";
      } finally {
        setSchemaLoading(false);
      }

      try {
        const tasks = await listBuildTasks({ resourceId: resource.id });
        const running = tasks.find((task) => isActiveBuildTask(task)) ?? null;
        setActiveTask(running);
      } catch {
        setActiveTask(null);
      }

      try {
        setModelsLoadState("loading");
        setModelsLoadError(null);
        const loaded = await loadEmbeddingModelOptions();
        setModels(loaded.options);
        setModelsLoadState(loaded.state);
        setModelsLoadError(loaded.errorMessage);

        if (loaded.state === "ready") {
          const orphan = findUnregisteredEmbeddingModel(loaded.options, [preferredModel]);
          setOrphanSavedModel(orphan);
          setDefaultModelId(pickRegisteredEmbeddingModelId(loaded.options, preferredModel));
        } else {
          setOrphanSavedModel(preferredModel.trim() ? preferredModel.trim() : null);
          setDefaultModelId(undefined);
        }
      } catch (loadError) {
        setModels([]);
        setModelsLoadState("error");
        setModelsLoadError(extractRequestErrorMessage(loadError));
        setOrphanSavedModel(preferredModel.trim() ? preferredModel.trim() : null);
        setDefaultModelId(undefined);
      }
    })();
  }, [active, resource]);

  useEffect(() => {
    if (!active) {
      return;
    }
    void reloadAnalyzerCapabilities();
    return () => {
      analyzerRequestIdRef.current += 1;
    };
  }, [active, resource.id]);

  const reloadEmbeddingModels = async () => {
    setModelsLoadState("loading");
    setModelsLoadError(null);
    const preferred = defaultModelId ?? orphanSavedModel ?? "";
    const loaded = await loadEmbeddingModelOptions();
    setModels(loaded.options);
    setModelsLoadState(loaded.state);
    setModelsLoadError(loaded.errorMessage);
    if (loaded.state === "ready") {
      const orphan = findUnregisteredEmbeddingModel(loaded.options, [preferred, orphanSavedModel]);
      setOrphanSavedModel(orphan);
      setDefaultModelId(pickRegisteredEmbeddingModelId(loaded.options, preferred));
    } else {
      setOrphanSavedModel(preferred.trim() ? preferred.trim() : null);
      setDefaultModelId(undefined);
    }
  };

  const reloadAnalyzerCapabilities = async () => {
    const requestId = analyzerRequestIdRef.current + 1;
    analyzerRequestIdRef.current = requestId;
    setAnalyzersLoadState("loading");
    setAnalyzersLoadError(null);
    const loaded = await loadAnalyzerCapabilities();
    if (requestId !== analyzerRequestIdRef.current) {
      return;
    }
    setAnalyzers(loaded.options);
    setAnalyzersLoadState(loaded.state);
    setAnalyzersLoadError(loaded.errorMessage);
  };

  const defaultModel = useMemo(
    () => models.find((item) => item.id === defaultModelId) ?? null,
    [defaultModelId, models],
  );

  const actionsLocked = readOnly || isActiveBuildTask(activeTask);
  const streamingActive =
    activeTask?.mode === "streaming" && isActiveBuildTask(activeTask);
  const featureConfigFieldNames = useMemo(
    () =>
      new Set(
        schema
          .filter((field) => isFeatureConfigField(field.type))
          .map((field) => field.name),
      ),
    [schema],
  );
  const eligibleEmbeddingModelGroups = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(fieldEmbeddingModelGroups).filter(([field]) =>
          featureConfigFieldNames.has(field),
        ),
      ),
    [featureConfigFieldNames, fieldEmbeddingModelGroups],
  );
  const eligibleFulltextAnalyzerGroups = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(fieldFulltextAnalyzerGroups).filter(([field]) =>
          featureConfigFieldNames.has(field),
        ),
      ),
    [featureConfigFieldNames, fieldFulltextAnalyzerGroups],
  );
  const embeddingFields = useMemo(
    () => Object.keys(eligibleEmbeddingModelGroups).filter((field) => (eligibleEmbeddingModelGroups[field]?.length ?? 0) > 0),
    [eligibleEmbeddingModelGroups],
  );
  const fulltextFields = useMemo(
    () => Object.keys(eligibleFulltextAnalyzerGroups).filter((field) => (eligibleFulltextAnalyzerGroups[field]?.length ?? 0) > 0),
    [eligibleFulltextAnalyzerGroups],
  );
  const fulltextAnalyzerOverrides = useMemo(
    () =>
      Object.entries(eligibleFulltextAnalyzerGroups).flatMap(([field, groups]) =>
        groups
          .map((feature) => feature.value?.trim())
          .filter((analyzer): analyzer is string => Boolean(analyzer))
          .map((analyzer) => `${field}: ${analyzer}`),
      ),
    [eligibleFulltextAnalyzerGroups],
  );
  const unavailableSavedAnalyzers = useMemo(() => {
    const effective = Object.values(eligibleFulltextAnalyzerGroups).flatMap((groups) =>
      groups.map((feature) => feature.value?.trim() || defaultFulltextAnalyzer),
    );
    return findUnavailableAnalyzers(analyzers, effective);
  }, [analyzers, defaultFulltextAnalyzer, eligibleFulltextAnalyzerGroups]);
  const duplicateUnsupportedFeatureTypes = useMemo(() => {
    const duplicates: string[] = [];
    for (const [field, groups] of Object.entries(eligibleEmbeddingModelGroups)) {
      if (groups.length > 1) {
        duplicates.push(`${field}: vector`);
      }
    }
    for (const [field, groups] of Object.entries(eligibleFulltextAnalyzerGroups)) {
      if (groups.length > 1) {
        duplicates.push(`${field}: fulltext`);
      }
    }
    return duplicates;
  }, [eligibleEmbeddingModelGroups, eligibleFulltextAnalyzerGroups]);
  const invalidSavedPrimaryKeyFields = useMemo(
    () => invalidKeyFields(schema, primaryKeyFields, isPrimaryKeyField),
    [primaryKeyFields, schema],
  );
  const invalidSavedIncrementalFields = useMemo(
    () => invalidKeyFields(schema, incrementalFields, isIncrementalField),
    [incrementalFields, schema],
  );

  const validateForm = () => {
    const invalidKeyFields = [...invalidSavedPrimaryKeyFields, ...invalidSavedIncrementalFields];
    if (invalidKeyFields.length > 0) {
      setError(t("dataCatalog.build.invalidKeyFields", { fields: invalidKeyFields.join(", ") }));
      return false;
    }
    if (duplicateUnsupportedFeatureTypes.length > 0) {
      setError(t("dataCatalog.build.duplicateFeatureTypeUnsupported", { features: duplicateUnsupportedFeatureTypes.join(", ") }));
      return false;
    }
    if (embeddingFields.length === 0 && fulltextFields.length === 0) {
      setError(t("dataCatalog.build.fieldsRequired"));
      return false;
    }
    if (fulltextFields.length > 0) {
      if (analyzersLoadState === "loading" || analyzersLoadState === "idle") {
        setError(t("dataCatalog.build.analyzersLoading"));
        return false;
      }
      if (analyzersLoadState === "error") {
        setError(t("dataCatalog.build.analyzersLoadError", { message: analyzersLoadError ?? t("dataCatalog.build.analyzersLoadErrorFallback") }));
        return false;
      }
      if (analyzersLoadState === "empty") {
        setError(t("dataCatalog.build.noAnalyzers"));
        return false;
      }
      if (unavailableSavedAnalyzers.length > 0) {
        setError(t("dataCatalog.build.savedAnalyzerUnavailable", { analyzers: unavailableSavedAnalyzers.join(", ") }));
        return false;
      }
    }
    const fulltextNeedsDefault = fulltextFields.some((field) =>
      (fieldFulltextAnalyzerGroups[field] ?? []).some((feature) => !feature.value?.trim()),
    );
    const embeddingNeedsDefault = embeddingFields.some((field) =>
      (eligibleEmbeddingModelGroups[field] ?? []).some((feature) => !feature.value?.trim()),
    );
    if (fulltextNeedsDefault && !defaultFulltextAnalyzer) {
      setError(t("dataCatalog.build.defaultAnalyzerRequired"));
      return false;
    }
    if (embeddingFields.length > 0) {
      if (modelsLoadState === "loading" || modelsLoadState === "idle") {
        setError(t("dataCatalog.build.modelsLoading"));
        return false;
      }
      if (modelsLoadState === "error") {
        setError(
          t("dataCatalog.build.modelsLoadError", {
            message: modelsLoadError ?? t("dataCatalog.build.modelsLoadErrorFallback"),
          }),
        );
        return false;
      }
      if (modelsLoadState === "empty" || models.length === 0) {
        setError(t("dataCatalog.build.noModels"));
        return false;
      }
      if (embeddingNeedsDefault && !defaultModelId) {
        setError(t("dataCatalog.build.modelRequired"));
        return false;
      }
      if (
        embeddingNeedsDefault &&
        defaultModelId &&
        !isRegisteredEmbeddingModel(defaultModelId, models)
      ) {
        setError(t("dataCatalog.build.savedModelUnavailable", { model: defaultModelId }));
        return false;
      }
      for (const field of embeddingFields) {
        for (const feature of eligibleEmbeddingModelGroups[field] ?? []) {
          const override = feature.value?.trim();
          if (override && !isRegisteredEmbeddingModel(override, models)) {
            setError(t("dataCatalog.build.savedModelUnavailable", { model: override }));
            return false;
          }
        }
      }
    }
    return true;
  };

  const saveConfig = async () => {
    if (!validateForm()) {
      return;
    }
    if (actionsLocked) {
      setError(
        streamingActive
          ? t("dataCatalog.build.streamingActiveLocked")
          : t("dataCatalog.build.activeTaskLocked"),
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const detail =
        (await getCatalogResource(resource.id)) ??
        ({
          ...resource,
          schema,
        } satisfies CatalogResource);

      const { schema: nextSchema, indexConfig } = applyIndexFormToSchema(
        detail.schema.length ? detail.schema : schema,
        {
          primaryKeyFields,
          incrementalFields,
          embeddingFields,
          embeddingModel: defaultModel?.id ?? "",
          fieldEmbeddingModels: {},
          fieldEmbeddingModelGroups: eligibleEmbeddingModelGroups,
          fieldFulltextAnalyzers: {},
          fieldFulltextAnalyzerGroups: eligibleFulltextAnalyzerGroups,
          fulltextFields,
          fulltextAnalyzer: defaultFulltextAnalyzer,
        },
      );

      await updateCatalogResource(resource.id, {
        catalogId: detail.catalogId,
        category: detail.category,
        description: detail.description,
        enabled: detail.enabled ?? true,
        expectedUpdateTime: detail.expectedUpdateTime,
        name: detail.name,
        sourceIdentifier: detail.sourceIdentifier,
        schema: nextSchema,
        indexConfig,
      });

      setSchema(nextSchema);
      setDirty(false);
      message.success(t("dataCatalog.build.saveConfigSuccess"));
      onSaved?.();
    } catch (persistError) {
      if (extractRequestStatus(persistError) === 409) {
        setError(t("dataCatalog.build.configConflict"));
      } else {
        setError(extractRequestErrorMessage(persistError));
      }
    } finally {
      setSaving(false);
    }
  };

  const primaryKeyOptions = useMemo(
    () => schema.filter(isPrimaryKeyField).map((field) => ({
      label: keyFieldOptionLabel(field),
      value: field.name,
    })),
    [schema],
  );
  const incrementalFieldOptions = useMemo(
    () => schema.filter(isIncrementalField).map((field) => ({
      label: keyFieldOptionLabel(field),
      value: field.name,
    })),
    [schema],
  );


  const removeInvalidKeyFields = () => {
    if (actionsLocked) {
      return;
    }
    const invalidPrimary = new Set(invalidSavedPrimaryKeyFields);
    const invalidIncremental = new Set(invalidSavedIncrementalFields);
    setPrimaryKeyFields((current) => current.filter((field) => !invalidPrimary.has(field)));
    setIncrementalFields((current) => current.filter((field) => !invalidIncremental.has(field)));
    markDirty();
  };

  const cx = (...parts: Array<string | false | undefined>) =>
    parts.filter(Boolean).join(" ");


  const noModels =
    modelsLoadState === "empty" || (modelsLoadState === "ready" && models.length === 0);
  const modelsLoadFailed = modelsLoadState === "error";
  const modelsLoading = modelsLoadState === "loading" || modelsLoadState === "idle";
  const embeddingBlocked = noModels || modelsLoadFailed || modelsLoading;
  const analyzersLoading = analyzersLoadState === "loading" || analyzersLoadState === "idle";
  const analyzersLoadFailed = analyzersLoadState === "error";
  const analyzerSelectionDisabled = analyzersLoading || analyzersLoadFailed || analyzersLoadState === "empty";
  const analyzerBlocked = analyzerSelectionDisabled || unavailableSavedAnalyzers.length > 0;
  const embeddingSelectionDisabledReason = modelsLoading
    ? t("dataCatalog.build.modelsLoading")
    : modelsLoadFailed
      ? t("dataCatalog.build.modelsLoadError", {
        message: modelsLoadError ?? t("dataCatalog.build.modelsLoadErrorFallback"),
      })
      : t("dataCatalog.build.noModels");
  const analyzerSelectionDisabledReason = analyzersLoading
    ? t("dataCatalog.build.analyzersLoading")
    : analyzersLoadFailed
      ? t("dataCatalog.build.analyzersLoadError", {
        message: analyzersLoadError ?? t("dataCatalog.build.analyzersLoadErrorFallback"),
      })
      : t("dataCatalog.build.analyzerSelectionUnavailable");
  const hasIndexFeatures = embeddingFields.length > 0 || fulltextFields.length > 0;
  const canBuild =
    hasIndexFeatures &&
    primaryKeyFields.length > 0 &&
    incrementalFields.length > 0 &&
    invalidSavedPrimaryKeyFields.length === 0 &&
    invalidSavedIncrementalFields.length === 0 &&
    unsupportedSchemaFields(schema).length === 0;
  const selectedEmbeddingGroups = featureField ? (eligibleEmbeddingModelGroups[featureField.name] ?? []) : [];
  const selectedFulltextGroups = featureField ? (eligibleFulltextAnalyzerGroups[featureField.name] ?? []) : [];
  const normalizeFeatureDrafts = (
    kind: "embedding" | "fulltext",
    groups: ResourceFeatureDraft[],
  ) => {
    return coerceFeatureDrafts(kind, groups);
  };
  const updateFeatureGroups = (
    kind: "embedding" | "fulltext",
    fieldName: string,
    nextGroups: ResourceFeatureDraft[],
  ) => {
    if (actionsLocked) {
      return;
    }
    const setter = kind === "embedding" ? setFieldEmbeddingModelGroups : setFieldFulltextAnalyzerGroups;
    setter((current) => {
      const next = { ...current };
      const limited = normalizeFeatureDrafts(kind, nextGroups);
      if (limited.length === 0) {
        delete next[fieldName];
      } else {
        next[fieldName] = limited;
      }
      return next;
    });
    markDirty();
  };
  const featureCountOf = (fieldName: string) =>
    (eligibleEmbeddingModelGroups[fieldName]?.length ?? 0) +
    (eligibleFulltextAnalyzerGroups[fieldName]?.length ?? 0);
  const featureSummaryOf = (fieldName: string) => ({
    embedding: eligibleEmbeddingModelGroups[fieldName]?.length ?? 0,
    fulltext: eligibleFulltextAnalyzerGroups[fieldName]?.length ?? 0,
  });
  const renderFeatureRows = (
    kind: "embedding" | "fulltext",
    title: string,
    groups: ResourceFeatureDraft[],
    options: Array<{ label: string; value: string }>,
    disabled = false,
  ) => {
    if (!featureField) {
      return null;
    }
    const isEmbedding = kind === "embedding";
    const valueLabel = isEmbedding
      ? t("dataCatalog.build.fieldEmbeddingModel")
      : t("dataCatalog.build.fieldFulltextAnalyzer");
    const hasResourceDefault = isEmbedding
      ? Boolean(defaultModelId)
      : Boolean(defaultFulltextAnalyzer);
    const selectOptions = [
      ...(hasResourceDefault
        ? [isEmbedding ? inheritModelOption : inheritAnalyzerOption]
        : []),
      ...options,
    ];
    const disabledReason = !disabled ? "" : isEmbedding
      ? embeddingSelectionDisabledReason
      : !isTextField(featureField.type)
        ? t("dataCatalog.build.fulltextTypeHint")
        : analyzerSelectionDisabledReason;
    const addFeature = () => {
      updateFeatureGroups(kind, featureField.name, [
        ...groups,
        {
          description: "",
          isDefault: groups.length === 0,
          name: defaultFeatureNameOf(kind, groups.length),
          value: hasResourceDefault ? "" : options[0]?.value ?? "",
        },
      ]);
    };
    return (
      <div className={cx(formStyles.featureSection, groups.length > 0 && formStyles.featureSectionActive)}>
        <div className={formStyles.featureSectionHead}>
          <div>
            <div className={formStyles.featureSectionTitle}>
              {title}
              <span className={formStyles.featureStatus}>
                {groups.length > 0
                  ? t("dataCatalog.build.featureConfiguredCount")
                  : t("dataCatalog.build.featureNotEnabled")}
              </span>
            </div>
            <div className={formStyles.fieldHint}>
              {groups.length > 0 ? t("dataCatalog.build.featureGroupHint") : disabledReason || t("dataCatalog.build.featureEnableHint")}
            </div>
          </div>
          <AppButton
            disabled={disabled || groups.length > 0}
            onClick={addFeature}
            size="small"
            type={groups.length === 0 ? "primary" : "default"}
          >
            {t("dataCatalog.build.addFeature")}
          </AppButton>
        </div>
        {groups.length === 0 ? (
          <div className={formStyles.featureEmpty}>
            <span>{t("dataCatalog.build.featureEmpty", { feature: title })}</span>
          </div>
        ) : (
          <div className={formStyles.featureRows}>
            <div className={formStyles.featureRowsHead}>
              <span>{t("dataCatalog.build.defaultFeature")}</span>
              <span>{valueLabel}</span>
              <span>{t("dataCatalog.build.featureNameLabel")}</span>
              <span>{t("dataCatalog.build.featureDescriptionLabel")}</span>
              <span />
            </div>
            {groups.map((feature, index) => (
              <div className={formStyles.featureRow} key={`${kind}-${index}`}>
                <div className={formStyles.featureIndex}>
                  <label className={formStyles.featureDefaultChoice}>
                    <input
                      checked={Boolean(feature.isDefault)}
                      disabled={disabled}
                      name={`${kind}-${featureField.name}-default`}
                      onChange={() => {
                        updateFeatureGroups(
                          kind,
                          featureField.name,
                          groups.map((item, cursor) => ({
                            ...item,
                            isDefault: cursor === index,
                          })),
                        );
                      }}
                      type="radio"
                    />
                  </label>
                </div>
                <div className={formStyles.featureEditGrid}>
                  <Select
                    disabled={disabled}
                    onChange={(nextValue) => {
                      const copy = [...groups];
                      copy[index] = {
                        ...feature,
                        value: nextValue === INHERIT_VALUE ? "" : nextValue,
                      };
                      updateFeatureGroups(kind, featureField.name, copy);
                    }}
                    options={selectOptions}
                    value={feature.value || (hasResourceDefault ? INHERIT_VALUE : options[0]?.value)}
                  />
                  <Input
                    disabled={disabled}
                    onChange={(event) => {
                      const copy = [...groups];
                      copy[index] = { ...feature, name: event.target.value };
                      updateFeatureGroups(kind, featureField.name, copy);
                    }}
                    placeholder={t("dataCatalog.build.featureNamePlaceholder")}
                    value={feature.name}
                  />
                  <Input
                    disabled={disabled}
                    onChange={(event) => {
                      const copy = [...groups];
                      copy[index] = { ...feature, description: event.target.value };
                      updateFeatureGroups(kind, featureField.name, copy);
                    }}
                    placeholder={t("dataCatalog.build.featureDescriptionPlaceholder")}
                    value={feature.description}
                  />
                </div>
                <AppButton
                  disabled={disabled}
                  onClick={() => {
                    updateFeatureGroups(
                      kind,
                      featureField.name,
                      groups.filter((_, cursor) => cursor !== index),
                    );
                  }}
                  size="small"
                  type="link"
                >
                  {t("common.remove")}
                </AppButton>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!active) {
    return null;
  }

  return (
    <div className={formStyles.formCard}>
      {streamingActive ? (
        <Alert message={t("dataCatalog.build.streamingActiveLocked")} showIcon type="warning" />
      ) : null}
      {!streamingActive && actionsLocked ? (
        <Alert message={t("dataCatalog.build.activeTaskLocked")} showIcon type="warning" />
      ) : null}
      {fulltextFields.length > 0 && analyzersLoading ? (
        <Alert message={t("dataCatalog.build.analyzersLoading")} showIcon type="info" />
      ) : fulltextFields.length > 0 && analyzersLoadFailed ? (
        <Alert
          action={
            <AppButton
              onClick={() => {
                void reloadAnalyzerCapabilities();
              }}
              size="small"
              type="link"
            >
              {t("dataCatalog.build.retryLoadAnalyzers")}
            </AppButton>
          }
          message={t("dataCatalog.build.analyzersLoadError", {
            message: analyzersLoadError ?? t("dataCatalog.build.analyzersLoadErrorFallback"),
          })}
          showIcon
          type="error"
        />
      ) : fulltextFields.length > 0 && analyzersLoadState === "empty" ? (
        <Alert message={t("dataCatalog.build.noAnalyzers")} showIcon type="error" />
      ) : fulltextFields.length > 0 && unavailableSavedAnalyzers.length > 0 ? (
        <Alert
          message={t("dataCatalog.build.savedAnalyzerUnavailable", { analyzers: unavailableSavedAnalyzers.join(", ") })}
          showIcon
          type="error"
        />
      ) : duplicateUnsupportedFeatureTypes.length > 0 ? (
        <Alert
          message={t("dataCatalog.build.duplicateFeatureTypeUnsupported", { features: duplicateUnsupportedFeatureTypes.join(", ") })}
          showIcon
          type="error"
        />
      ) : null}
      {invalidSavedPrimaryKeyFields.length + invalidSavedIncrementalFields.length > 0 ? (
        <Alert
          action={
            <AppButton disabled={actionsLocked} onClick={removeInvalidKeyFields} size="small" type="link">
              {t("dataCatalog.build.removeInvalidKeyFields")}
            </AppButton>
          }
          message={t("dataCatalog.build.invalidKeyFields", {
            fields: [...invalidSavedPrimaryKeyFields, ...invalidSavedIncrementalFields].join(", "),
          })}
          showIcon
          type="warning"
        />
      ) : null}

      <div>
        <div className={formStyles.configOverview}>
          <div className={formStyles.configMetric}>
            <span>{t("dataCatalog.build.primaryKeyFieldCount")}</span>
            <b>{primaryKeyFields.length}</b>
          </div>
          <div className={formStyles.configMetric}>
            <span>{t("dataCatalog.build.incrementalFieldCount")}</span>
            <b>{incrementalFields.length}</b>
          </div>
          <div className={formStyles.configMetric}>
            <span>{t("dataCatalog.build.embeddingFieldCount")}</span>
            <b>{embeddingFields.length}</b>
          </div>
          <div className={formStyles.configMetric}>
            <span>{t("dataCatalog.build.fulltextFieldCount")}</span>
            <b>{fulltextFields.length}</b>
          </div>
          {!hideBuildControls ? (
            <div className={formStyles.configMetricWide}>
              <span>{t("dataCatalog.build.configCanBuild")}</span>
              <b>
                {canBuild
                  ? t("dataCatalog.build.configCanBuildYes")
                  : t("dataCatalog.build.configCannotBuild")}
              </b>
            </div>
          ) : null}
        </div>

        <div className={formStyles.resourceDefaults}>
          <div className={formStyles.resourceDefaultsHead}>
            <div>
              <div className={formStyles.resourceDefaultsTitle}>
                {t("dataCatalog.build.resourceDefaultsTitle")}
              </div>
              <div className={formStyles.fieldHint}>
                {t("dataCatalog.build.resourceDefaultsHint")}
              </div>
            </div>
          </div>
          <div className={formStyles.resourceDefaultsGrid}>
            <div className={formStyles.resourceDefaultItem}>
              <div className={formStyles.resourceDefaultItemHead}>
                <span>
                  {t("dataCatalog.build.defaultFulltextAnalyzer")}
                </span>
              </div>
              <Select
                allowClear
                disabled={actionsLocked || analyzerSelectionDisabled}
                onChange={(value) => {
                  setDefaultFulltextAnalyzer(value ?? "");
                  markDirty();
                }}
                options={analyzerOptions}
                placeholder={t("dataCatalog.build.defaultFulltextAnalyzer")}
                style={{ width: "100%" }}
                value={defaultFulltextAnalyzer || undefined}
              />
              <div className={formStyles.fieldHint}>
                {t("dataCatalog.build.fulltextAnalyzerHint")}
              </div>
              <div className={formStyles.fieldHint}>
                {t("dataCatalog.build.fulltextAnalyzerEnglishHint")}
              </div>
              {fulltextFields.length > 0 && analyzersLoadState === "ready" ? (
                <div className={formStyles.fieldHint}>
                  {enabledChineseAnalyzers.length > 0
                    ? t("dataCatalog.build.fulltextChineseAnalyzerAvailableHint", {
                      analyzers: enabledChineseAnalyzers.join(", "),
                    })
                    : t("dataCatalog.build.fulltextChineseAnalyzerUnavailableHint")}
                </div>
              ) : null}
              {analyzerSelectionDisabled ? (
                <div className={formStyles.fieldHint}>
                  {analyzerSelectionDisabledReason}
                </div>
              ) : null}
              {fulltextAnalyzerOverrides.length > 0 ? (
                <Alert
                  message={t("dataCatalog.build.fulltextAnalyzerOverrides", {
                    overrides: fulltextAnalyzerOverrides.join(", "),
                  })}
                  showIcon
                  type="info"
                />
              ) : null}
            </div>
            <div className={formStyles.resourceDefaultItem}>
              <div className={formStyles.resourceDefaultItemHead}>
                <span>
                  {t("dataCatalog.build.defaultEmbeddingModel")}
                </span>
              </div>
              {modelsLoading ? (
                <Select
                  disabled
                  loading
                  placeholder={t("dataCatalog.build.modelsLoading")}
                  style={{ width: "100%" }}
                />
              ) : modelsLoadFailed ? (
                <Alert
                  action={
                    <Space size={4}>
                      <AppButton
                        onClick={() => {
                          void reloadEmbeddingModels();
                        }}
                        size="small"
                        type="link"
                      >
                        {t("dataCatalog.build.retryLoadModels")}
                      </AppButton>
                      <AppButton
                        onClick={() => {
                          void navigate("/model-resources/models");
                        }}
                        size="small"
                        type="link"
                      >
                        {t("dataCatalog.build.goConnectModel")}
                      </AppButton>
                    </Space>
                  }
                  message={t("dataCatalog.build.modelsLoadError", {
                    message: modelsLoadError ?? t("dataCatalog.build.modelsLoadErrorFallback"),
                  })}
                  showIcon
                  type="error"
                />
              ) : noModels ? (
                <Alert
                  action={
                    <AppButton
                      onClick={() => {
                        void navigate("/model-resources/models");
                      }}
                      size="small"
                      type="link"
                    >
                      {t("dataCatalog.build.goConnectModel")}
                    </AppButton>
                  }
                  message={t("dataCatalog.build.noModels")}
                  showIcon
                  type="warning"
                />
              ) : (
                <>
                  <Select
                    allowClear
                    disabled={actionsLocked}
                    onChange={(value) => {
                      setDefaultModelId(value);
                      setOrphanSavedModel(null);
                      markDirty();
                    }}
                    options={modelOptions}
                    placeholder={t("dataCatalog.build.defaultEmbeddingModel")}
                    style={{ width: "100%" }}
                    value={defaultModelId}
                  />
                  {orphanSavedModel ? (
                    <Alert
                      message={t("dataCatalog.build.savedModelUnavailable", {
                        model: orphanSavedModel,
                      })}
                      showIcon
                      type="warning"
                    />
                  ) : null}
                </>
              )}
              <div className={formStyles.fieldHint}>
                {t("dataCatalog.build.defaultEmbeddingModelHint")}
              </div>
              <div className={formStyles.fieldHint}>
                {t("dataCatalog.build.defaultEmbeddingModelUsageHint")}
              </div>
            </div>
          </div>
        </div>
        {!hideBuildControls ? (
          <div className={formStyles.resourceDefaults}>
            <div className={formStyles.resourceDefaultsHead}>
              <div>
                <div className={formStyles.resourceDefaultsTitle}>
                  {t("dataCatalog.build.keyFields")}
                </div>
                <div className={formStyles.fieldHint}>
                  {t("dataCatalog.build.keyFieldsHint")}
                </div>
              </div>
            </div>
            <div className={formStyles.resourceDefaultsGrid}>
              <label className={formStyles.resourceDefaultItem}>
                <span className={formStyles.resourceDefaultItemHead}>
                  {t("dataCatalog.build.rolePrimaryKey")}
                </span>
                <Select
                  disabled={actionsLocked}
                  mode="multiple"
                  onChange={(values) => {
                    setPrimaryKeyFields(values);
                    markDirty();
                  }}
                  options={primaryKeyOptions}
                  placeholder={t("dataCatalog.build.primaryKeyFieldsPlaceholder")}
                  style={{ width: "100%" }}
                  value={primaryKeyFields}
                />
                <span className={formStyles.fieldHint}>
                  {t("dataCatalog.build.primaryKeyFieldsHint")}
                </span>
              </label>
              <label className={formStyles.resourceDefaultItem}>
                <span className={formStyles.resourceDefaultItemHead}>
                  {t("dataCatalog.build.roleIncrementalKey")}
                </span>
                <Select
                  disabled={actionsLocked}
                  mode="multiple"
                  onChange={(values) => {
                    setIncrementalFields(values);
                    markDirty();
                  }}
                  options={incrementalFieldOptions}
                  placeholder={t("dataCatalog.build.incrementalFieldsPlaceholder")}
                  style={{ width: "100%" }}
                  value={incrementalFields}
                />
                <span className={formStyles.fieldHint}>
                  {t("dataCatalog.build.incrementalFieldsHint")}
                </span>
              </label>
            </div>
          </div>
        ) : null}
        <div className={formStyles.resourceDefaults}>
          <div className={formStyles.resourceDefaultsHead}>
            <div>
              <div className={formStyles.resourceDefaultsTitle}>
                {t("dataCatalog.build.fieldFeatureConfig")}
              </div>
              <div className={formStyles.fieldHint}>
                {t("dataCatalog.build.fieldFeatureConfigHint")}
              </div>
            </div>
          </div>
          <div className={styles.fieldRoleCard}>
            {schemaLoading ? (
              <div className={styles.frtEmpty}>{t("dataCatalog.build.schemaLoading")}</div>
            ) : schema.length === 0 ? (
              <div className={styles.frtEmpty}>{t("dataCatalog.build.schemaEmpty")}</div>
            ) : (
              <>
                <div className={styles.frtBar}>
                  <span className={styles.frtStat}>
                    {t("dataCatalog.build.fieldCount", { count: schema.length })}
                  </span>
                  <span className={styles.frtSummary}>
                    <span className={styles.frtStat}>
                      <span className={cx(styles.frtDot, styles.frtDotEmb)} />
                      {t("dataCatalog.build.roleEmbedding")}
                      <b>{embeddingFields.length}</b>
                    </span>
                    <span className={styles.frtStat}>
                      <span className={cx(styles.frtDot, styles.frtDotFt)} />
                      {t("dataCatalog.build.roleFulltext")}
                      <b>{fulltextFields.length}</b>
                    </span>
                  </span>
                </div>
                <div className={styles.frtScroll}>
                  <table className={styles.frtTable}>
                    <colgroup>
                      <col className={styles.frtNameCol} />
                      <col className={styles.frtDisplayCol} />
                      <col className={styles.frtTypeCol} />
                      <col className={styles.frtDescriptionCol} />
                      <col className={styles.frtActionWidthCol} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>{t("dataCatalog.resource.fieldName")}</th>
                        <th>{t("dataCatalog.resource.fieldDisplayName")}</th>
                        <th>{t("dataCatalog.resource.fieldType")}</th>
                        <th>{t("dataCatalog.resource.fieldDescription")}</th>
                        <th className={cx(styles.frtActionCol, formStyles.featureActionHead)}>{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schema.map((field) => {
                        const canConfigureFeature = isFeatureConfigField(field.type);
                        const rowActive = featureCountOf(field.name) > 0;
                        const featureSummary = featureSummaryOf(field.name);
                        return (
                          <tr
                            className={rowActive ? styles.frtRowActive : undefined}
                            key={field.name}
                          >
                            <td className={styles.frtField}>
                              <code>{field.name}</code>
                            </td>
                            <td className={styles.frtFieldMeta}>{field.displayName || "-"}</td>
                            <td className={styles.frtFieldMeta}>{field.type}</td>
                            <td className={styles.frtFieldMeta} title={field.description || undefined}>
                              {field.description || "-"}
                            </td>
                            <td className={cx(styles.frtFieldMeta, styles.frtActionCol)}>
                              <div className={formStyles.featureActionCell}>
                                {canConfigureFeature ? (
                                  <>
                                    <div className={formStyles.featureMiniSummary}>
                                      {featureSummary.embedding > 0 ? (
                                        <span className={formStyles.featureMiniTag}>
                                          {t("dataCatalog.build.roleEmbedding")} {featureSummary.embedding}
                                        </span>
                                      ) : null}
                                      {featureSummary.fulltext > 0 ? (
                                        <span className={formStyles.featureMiniTag}>
                                          {t("dataCatalog.build.roleFulltext")} {featureSummary.fulltext}
                                        </span>
                                      ) : null}
                                      {featureCountOf(field.name) === 0 ? (
                                        <span className={formStyles.featureMiniEmpty}>
                                          {t("dataCatalog.build.featureSummaryEmpty")}
                                        </span>
                                      ) : null}
                                    </div>
                                    <AppButton
                                      className={formStyles.featureConfigLink}
                                      disabled={actionsLocked}
                                      onClick={() => setFeatureField(field)}
                                      type="link"
                                    >
                                      {t("dataCatalog.build.featureConfig")}
                                    </AppButton>
                                  </>
                                ) : (
                                  <span className={formStyles.featureMiniEmpty}>
                                    {t("dataCatalog.build.featureUnsupported")}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Drawer
        destroyOnHidden
        onClose={() => setFeatureField(null)}
        open={Boolean(featureField && isFeatureConfigField(featureField.type))}
        title={featureField ? `${t("dataCatalog.build.featureConfig")}: ${featureField.name}` : t("dataCatalog.build.featureConfig")}
        width={900}
      >
        {featureField ? (
          <div className={formStyles.featureDrawerBody}>
            <div className={formStyles.featureFieldMeta}>
              <span>{featureField.displayName || "-"}</span>
              <code>{featureField.type}</code>
            </div>
            {renderFeatureRows(
              "embedding",
              t("dataCatalog.build.roleEmbedding"),
              selectedEmbeddingGroups,
              modelOptions,
              actionsLocked || embeddingBlocked,
            )}
            {renderFeatureRows(
              "fulltext",
              t("dataCatalog.build.roleFulltext"),
              selectedFulltextGroups,
              analyzerOptions,
              actionsLocked || !isTextField(featureField.type) || analyzerSelectionDisabled,
            )}
            {!isTextField(featureField.type) ? (
              <Alert message={t("dataCatalog.build.fulltextTypeHint")} showIcon type="info" />
            ) : null}
          </div>
        ) : null}
      </Drawer>

      {error ? <Alert message={error} showIcon type="error" /> : null}
      {dirty ? (
        <Alert
          message={t("dataCatalog.build.unsavedIndexConfig")}
          showIcon
          type="warning"
        />
      ) : null}

      <div className={formStyles.footer}>
        <Space style={{ marginLeft: "auto" }}>
          <AppButton
            disabled={actionsLocked || saving || (fulltextFields.length > 0 && analyzerBlocked) || duplicateUnsupportedFeatureTypes.length > 0 || (embeddingFields.length > 0 && embeddingBlocked)}
            loading={saving}
            onClick={() => void saveConfig()}
            type="primary"
          >
            {t("dataCatalog.build.saveIndexConfig")}
          </AppButton>
        </Space>
      </div>
    </div>
  );
}
