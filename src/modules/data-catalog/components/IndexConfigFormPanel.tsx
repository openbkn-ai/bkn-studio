/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { QuestionCircleOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Drawer, Input, Select, Space, Tooltip } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
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
import { listSmallModels } from "@/modules/model-resources/services/small-model.service";

import formStyles from "./BuildTaskFormPanel.module.css";
import styles from "./shared.module.css";

export type IndexConfigFormPanelProps = {
  active: boolean;
  onSaved?: () => void;
  resource: CatalogResource;
};

const FALLBACK_MODELS: EmbeddingModelOption[] = [
  { id: "bge-m3", name: "BGE-M3", dimensions: 1024 },
  { id: "bge-large-zh-v1.5", name: "BGE-Large-zh v1.5", dimensions: 1024 },
];

const FULLTEXT_ANALYZERS = ["standard", "ik_max_word", "hanlp_index"] as const;
const INHERIT_VALUE = "__inherit__";

const normalizeFieldType = (type: string) => type.trim().toLowerCase();
const isFeatureConfigField = (type: string) => ["string", "text"].includes(normalizeFieldType(type));
const isTextField = isFeatureConfigField;

type FieldRoleId = "emb" | "key" | "ft";

const defaultFeatureNameOf = (kind: "embedding" | "fulltext", index: number) => {
  const base = kind === "embedding" ? "vector" : "fulltext";
  return index === 0 ? base : `${base}_${index + 1}`;
};

function coerceFeatureDrafts(
  kind: "embedding" | "fulltext",
  groups: Array<ResourceFeatureDraft | string> = [],
): ResourceFeatureDraft[] {
  const normalized = groups.slice(0, 3).map((item, index) =>
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

function getRoleHint(roleId: FieldRoleId, t: (key: string) => string): string {
  switch (roleId) {
    case "emb":
      return t("dataCatalog.build.roleEmbeddingHint");
    case "key":
      return t("dataCatalog.build.roleBuildKeyHintConfig");
    case "ft":
      return t("dataCatalog.build.roleFulltextHint");
  }
}

function RoleHintIcon({ hint }: { hint: string }) {
  return (
    <Tooltip title={hint}>
      <QuestionCircleOutlined
        className={styles.frtRoleHint}
        onClick={(event) => event.stopPropagation()}
      />
    </Tooltip>
  );
}

export function IndexConfigFormPanel({
  active,
  onSaved,
  resource,
}: IndexConfigFormPanelProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();

  const [activeTask, setActiveTask] = useState<BuildTask | null>(null);
  const [schema, setSchema] = useState<ResourceSchemaField[]>(resource.schema);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [buildKeyFields, setBuildKeyFields] = useState<string[]>([]);
  const [fieldEmbeddingModelGroups, setFieldEmbeddingModelGroups] = useState<Record<string, ResourceFeatureDraft[]>>({});
  const [fieldFulltextAnalyzerGroups, setFieldFulltextAnalyzerGroups] = useState<Record<string, ResourceFeatureDraft[]>>({});
  const [featureField, setFeatureField] = useState<ResourceSchemaField | null>(null);
  const [defaultFulltextAnalyzer, setDefaultFulltextAnalyzer] = useState<string>("standard");
  const [fieldFilter, setFieldFilter] = useState("");
  const [models, setModels] = useState<EmbeddingModelOption[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
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
      FULLTEXT_ANALYZERS.map((analyzer) => ({
        label: t(`dataCatalog.build.analyzers.${analyzer}`),
        value: analyzer,
      })),
    [t],
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

    setActiveTask(null);
    setBuildKeyFields([]);
    setFieldEmbeddingModelGroups({});
    setFieldFulltextAnalyzerGroups({});
    setFeatureField(null);
    setDefaultFulltextAnalyzer("standard");
    setFieldFilter("");
    setError(null);
    setDirty(false);
    setModelsLoaded(false);
    setSchema(resource.schema);

    const hydrateFromResource = (detail: CatalogResource) => {
      setSchema(detail.schema);
      const form = indexFormValuesFromResource(detail);
      setBuildKeyFields(form.buildKeyFields);
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
        const detail = await getCatalogResource(resource.id);
        if (detail) {
          preferredModel = hydrateFromResource(detail) || "";
        } else if (resource.schema.length > 0) {
          preferredModel = hydrateFromResource(resource) || "";
        }
      } finally {
        setSchemaLoading(false);
      }

      try {
        const tasks = await listBuildTasks({ resourceId: resource.id });
        const running = tasks.find((task) => isActiveBuildTask(task)) ?? null;
        setActiveTask(running);
        if (
          !preferredModel &&
          running &&
          running.embeddingFields.length + running.fulltextFields.length > 0
        ) {
          setBuildKeyFields(running.buildKeyFields);
          setFieldEmbeddingModelGroups(Object.fromEntries(running.embeddingFields.map((field) => [field, [{ name: "vector", value: "", isDefault: true }]])));
          setFieldFulltextAnalyzerGroups(Object.fromEntries(running.fulltextFields.map((field) => [field, [{ name: "fulltext", value: "", isDefault: true }]])));
          if (running.fulltextAnalyzer) {
            setDefaultFulltextAnalyzer(running.fulltextAnalyzer);
          }
          preferredModel = running.embeddingModel;
        }
      } catch {
        setActiveTask(null);
      }

      try {
        const result = await listSmallModels({
          modelType: "embedding",
          page: 1,
          size: 100,
        });
        const options = result.items
          .filter((item) => item.modelType === "embedding")
          .map((item) => ({
            dimensions: item.embeddingDim ?? 1024,
            id: item.modelName,
            name: item.modelName,
          }));
        const list = options.length > 0 ? options : FALLBACK_MODELS;
        setModels(list);
        setDefaultModelId(
          preferredModel && list.some((item) => item.id === preferredModel)
            ? preferredModel
            : list[0]?.id,
        );
      } catch {
        setModels(FALLBACK_MODELS);
        setDefaultModelId(
          preferredModel && FALLBACK_MODELS.some((item) => item.id === preferredModel)
            ? preferredModel
            : FALLBACK_MODELS[0].id,
        );
      } finally {
        setModelsLoaded(true);
      }
    })();
  }, [active, resource]);

  const defaultModel = useMemo(
    () => models.find((item) => item.id === defaultModelId) ?? null,
    [defaultModelId, models],
  );

  const actionsLocked = isActiveBuildTask(activeTask);
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

  const toggleField = (
    field: string,
    list: string[],
    setList: (next: string[]) => void,
    onRemove?: () => void,
  ) => {
    markDirty();
    if (list.includes(field)) {
      setList(list.filter((item) => item !== field));
      onRemove?.();
    } else {
      setList([...list, field]);
    }
  };

  const validateForm = () => {
    if (embeddingFields.length === 0 && fulltextFields.length === 0) {
      setError(t("dataCatalog.build.fieldsRequired"));
      return false;
    }
    const fulltextNeedsDefault = fulltextFields.some((field) =>
      (fieldFulltextAnalyzerGroups[field] ?? []).some((feature) => !feature.value?.trim()),
    );
    const embeddingNeedsDefault = embeddingFields.some((field) =>
      (fieldEmbeddingModelGroups[field] ?? []).some((feature) => !feature.value?.trim()),
    );
    if (fulltextNeedsDefault && !defaultFulltextAnalyzer) {
      setError(t("dataCatalog.build.defaultAnalyzerRequired"));
      return false;
    }
    if (embeddingNeedsDefault && !defaultModel) {
      setError(t("dataCatalog.build.modelRequired"));
      return false;
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
          buildKeyFields,
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

  const roleDefs = [
    {
      box: styles.frtBoxKey,
      dot: styles.frtDotKey,
      id: "key" as const,
      list: buildKeyFields,
      name: t("dataCatalog.build.roleBuildKey"),
      onRemove: undefined as ((fieldName: string) => void) | undefined,
      set: setBuildKeyFields,
      textOnly: false,
    },
  ];

  const filterText = fieldFilter.trim().toLowerCase();
  const visibleFields = useMemo(
    () =>
      schema.filter((field) => {
        if (!filterText) {
          return true;
        }
        return (
          field.name.toLowerCase().includes(filterText) ||
          (field.displayName?.toLowerCase().includes(filterText) ?? false)
        );
      }),
    [schema, filterText],
  );
  const showFieldSearch = schema.length > 8;

  const eligibleFields = (role: (typeof roleDefs)[number]) =>
    role.textOnly ? visibleFields.filter((field) => isTextField(field.type)) : visibleFields;

  const columnAllOn = (role: (typeof roleDefs)[number]) => {
    const eligible = eligibleFields(role);
    return eligible.length > 0 && eligible.every((field) => role.list.includes(field.name));
  };

  const toggleColumn = (role: (typeof roleDefs)[number]) => {
    markDirty();
    const eligible = eligibleFields(role);
    if (columnAllOn(role)) {
      const drop = new Set(eligible.map((field) => field.name));
      role.set(role.list.filter((name) => !drop.has(name)));
      if (role.onRemove) {
        eligible.forEach((field) => role.onRemove?.(field.name));
      }
    } else {
      const next = new Set(role.list);
      eligible.forEach((field) => next.add(field.name));
      role.set([...next]);
    }
  };

  const cx = (...parts: Array<string | false | undefined>) =>
    parts.filter(Boolean).join(" ");

  const checkIcon = (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path
        d="M3.5 8.4l3 3 6-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );

  const [buildKeyRole] = roleDefs;
  const renderRoleHeader = (role: (typeof roleDefs)[number]) => {
    const allOn = columnAllOn(role);
    return (
      <th className={styles.frtRoleCol} key={role.id}>
        <span className={styles.frtRoleHead} onClick={() => toggleColumn(role)}>
          <span className={styles.frtRoleName}>
            <span className={cx(styles.frtDot, role.dot)} />
            {role.name}
            <RoleHintIcon hint={getRoleHint(role.id, t)} />
          </span>
          <span className={cx(styles.frtAll, allOn && styles.frtAllOn)}>
            {allOn ? t("dataCatalog.build.clearAll") : t("dataCatalog.build.selectAll")}
          </span>
        </span>
      </th>
    );
  };
  const renderRoleCell = (field: ResourceSchemaField, role: (typeof roleDefs)[number]) => {
    const disabled = role.textOnly && !isTextField(field.type);
    const checked = role.list.includes(field.name);
    return (
      <td className={styles.frtCell} key={role.id}>
        <span
          className={cx(
            styles.frtBox,
            role.box,
            checked && styles.frtBoxChecked,
            disabled && styles.frtBoxDisabled,
          )}
          onClick={() => {
            if (disabled) {
              return;
            }
            toggleField(
              field.name,
              role.list,
              role.set,
              checked ? () => role.onRemove?.(field.name) : undefined,
            );
          }}
          title={disabled ? t("dataCatalog.build.fulltextTypeHint") : undefined}
        >
          <span className={styles.frtMark}>{checkIcon}</span>
        </span>
      </td>
    );
  };

  const noModels = modelsLoaded && models.length === 0;
  const hasIndexFeatures = embeddingFields.length > 0 || fulltextFields.length > 0;
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
    const disabledReason = disabled
      ? isEmbedding
        ? t("dataCatalog.build.noModels")
        : t("dataCatalog.build.fulltextTypeHint")
      : "";
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
                  ? t("dataCatalog.build.featureConfiguredCount", { count: groups.length })
                  : t("dataCatalog.build.featureNotEnabled")}
              </span>
            </div>
            <div className={formStyles.fieldHint}>
              {groups.length > 0 ? t("dataCatalog.build.featureGroupHint") : disabledReason || t("dataCatalog.build.featureEnableHint")}
            </div>
          </div>
          <AppButton
            disabled={disabled || groups.length >= 3}
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
                    onChange={(event) => {
                      const copy = [...groups];
                      copy[index] = { ...feature, name: event.target.value };
                      updateFeatureGroups(kind, featureField.name, copy);
                    }}
                    placeholder={t("dataCatalog.build.featureNamePlaceholder")}
                    value={feature.name}
                  />
                  <Input
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

      <div>
        <div className={formStyles.configOverview}>
          <div className={formStyles.configMetric}>
            <span>{t("dataCatalog.build.roleEmbedding")}</span>
            <b>{embeddingFields.length}</b>
          </div>
          <div className={formStyles.configMetric}>
            <span>{t("dataCatalog.build.roleFulltext")}</span>
            <b>{fulltextFields.length}</b>
          </div>
          <div className={formStyles.configMetric}>
            <span>{t("dataCatalog.build.roleBuildKey")}</span>
            <b>{buildKeyFields.length}</b>
          </div>
          <div className={formStyles.configMetricWide}>
            <span>{t("dataCatalog.build.configCanBuild")}</span>
            <b>
              {hasIndexFeatures
                ? t("dataCatalog.build.configCanBuildYes")
                : t("dataCatalog.build.configCannotBuild")}
            </b>
          </div>
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
              <div className={formStyles.resourceDefaultsScope}>{resource.name}</div>
            </div>
            <div className={formStyles.resourceDefaultsGrid}>
                <div className={formStyles.resourceDefaultItem}>
                  <div className={formStyles.resourceDefaultItemHead}>
                    <span className={formStyles.resourceDefaultBadge}>1</span>
                    <span>
                      {t("dataCatalog.build.defaultFulltextAnalyzer")}
                    </span>
                  </div>
                  <Select
                    allowClear
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
                </div>
                <div className={formStyles.resourceDefaultItem}>
                  <div className={formStyles.resourceDefaultItemHead}>
                    <span className={formStyles.resourceDefaultBadge}>1</span>
                    <span>
                      {t("dataCatalog.build.defaultEmbeddingModel")}
                    </span>
                  </div>
                  {noModels ? (
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
                    <Select
                      allowClear
                      onChange={(value) => {
                        setDefaultModelId(value);
                        markDirty();
                      }}
                      options={modelOptions}
                      placeholder={t("dataCatalog.build.defaultEmbeddingModel")}
                      style={{ width: "100%" }}
                      value={defaultModelId}
                    />
                  )}
                  <div className={formStyles.fieldHint}>
                    {t("dataCatalog.build.defaultModelDimensions", {
                      dimensions: defaultModel ? String(defaultModel.dimensions) : "-",
                    })}
                  </div>
                </div>
            </div>
          </div>
        <div className={formStyles.fieldLabel}>
          {t("dataCatalog.build.fieldRole")}
          <span className={formStyles.fieldLabelHint}>{t("dataCatalog.build.roleBuildKeyHintConfig")}</span>
        </div>
        <div className={styles.fieldRoleCard}>
          {schemaLoading ? (
            <div className={styles.frtEmpty}>{t("dataCatalog.build.schemaLoading")}</div>
          ) : schema.length === 0 ? (
            <div className={styles.frtEmpty}>{t("dataCatalog.build.schemaEmpty")}</div>
          ) : (
            <>
              <div className={styles.frtBar}>
                {showFieldSearch ? (
                  <span className={styles.frtSearch}>
                    <span className={styles.frtSearchIcon}>
                      <SearchOutlined />
                    </span>
                    <input
                      onChange={(event) => setFieldFilter(event.target.value)}
                      placeholder={t("dataCatalog.build.fieldFilterPlaceholder")}
                      type="text"
                      value={fieldFilter}
                    />
                  </span>
                ) : (
                  <span className={styles.frtStat}>
                    {t("dataCatalog.build.fieldCount", { count: schema.length })}
                  </span>
                )}
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
                  {roleDefs.map((role) => (
                    <span className={styles.frtStat} key={role.id}>
                      <span className={cx(styles.frtDot, role.dot)} />
                      {role.name}
                      <RoleHintIcon hint={getRoleHint(role.id, t)} />
                      <b>{role.list.length}</b>
                    </span>
                  ))}
                </span>
              </div>
              <div className={styles.frtScroll}>
                <table className={styles.frtTable}>
                  <colgroup>
                    <col className={styles.frtNameCol} />
                    <col className={styles.frtDisplayCol} />
                    <col className={styles.frtTypeCol} />
                    <col className={styles.frtRoleWidthCol} />
                    <col className={styles.frtActionWidthCol} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>{t("dataCatalog.resource.fieldName")}</th>
                      <th>{t("dataCatalog.resource.fieldDisplayName")}</th>
                      <th>{t("dataCatalog.resource.fieldType")}</th>
                      {renderRoleHeader(buildKeyRole)}
                      <th className={cx(styles.frtActionCol, formStyles.featureActionHead)}>{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFields.length === 0 ? (
                      <tr>
                        <td
                          className={styles.frtEmpty}
                          colSpan={5}
                        >
                          {t("dataCatalog.build.fieldNoMatch", { keyword: fieldFilter })}
                        </td>
                      </tr>
                    ) : (
                      visibleFields.map((field) => {
                        const canConfigureFeature = isFeatureConfigField(field.type);
                        const rowActive = roleDefs.some((role) =>
                          role.list.includes(field.name),
                        ) || featureCountOf(field.name) > 0;
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
                            {renderRoleCell(field, buildKeyRole)}
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
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
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
              noModels,
            )}
            {renderFeatureRows(
              "fulltext",
              t("dataCatalog.build.roleFulltext"),
              selectedFulltextGroups,
              analyzerOptions,
              !isTextField(featureField.type),
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
            disabled={actionsLocked || saving || (noModels && embeddingFields.length > 0)}
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
