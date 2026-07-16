/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { QuestionCircleOutlined, SearchOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Input, Select, Space, Tooltip } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  BuildTaskConflictError,
  createBuildTask,
  listBuildTasks,
} from "@/modules/data-catalog/services/build-task.service";
import {
  getCatalogResource,
  updateCatalogResource,
} from "@/modules/data-catalog/services/resource.service";
import type {
  BuildMode,
  BuildTask,
  CatalogResource,
  EmbeddingModelOption,
  ResourceSchemaField,
} from "@/modules/data-catalog/types/data-catalog";
import {
  applyIndexFormToSchema,
  indexFormValuesFromResource,
} from "@/modules/data-catalog/utils/resource-index-config";
import { listSmallModels } from "@/modules/model-resources/services/small-model.service";

import formStyles from "./BuildTaskFormPanel.module.css";
import styles from "./shared.module.css";

export type BuildTaskFormPanelProps = {
  active: boolean;
  onCancel?: () => void;
  onSubmitted: (task: BuildTask) => void;
  resource: CatalogResource;
  showResourceSummary?: boolean;
};

const FALLBACK_MODELS: EmbeddingModelOption[] = [
  { id: "bge-m3", name: "BGE-M3", dimensions: 1024 },
  { id: "bge-large-zh-v1.5", name: "BGE-Large-zh v1.5", dimensions: 1024 },
];

const FULLTEXT_ANALYZERS = ["standard", "ik_max_word", "hanlp_index"] as const;

const TEXT_TYPE_RE = /text|string|char|clob/i;
const isTextField = (type: string) => TEXT_TYPE_RE.test(type);

type FieldRoleId = "emb" | "key" | "ft";

function getRoleHint(roleId: FieldRoleId, mode: BuildMode, t: (key: string) => string): string {
  switch (roleId) {
    case "emb":
      return t("dataCatalog.build.roleEmbeddingHint");
    case "key":
      return mode === "batch"
        ? t("dataCatalog.build.roleBuildKeyHintBatch")
        : t("dataCatalog.build.roleBuildKeyHintStreaming");
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

export function BuildTaskFormPanel({
  active,
  onCancel,
  onSubmitted,
  resource,
  showResourceSummary = true,
}: BuildTaskFormPanelProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();

  const [existingTask, setExistingTask] = useState<BuildTask | null>(null);
  const [mode, setMode] = useState<BuildMode>("batch");
  const [schema, setSchema] = useState<ResourceSchemaField[]>(resource.schema);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [embeddingFields, setEmbeddingFields] = useState<string[]>([]);
  const [buildKeyFields, setBuildKeyFields] = useState<string[]>([]);
  const [fulltextFields, setFulltextFields] = useState<string[]>([]);
  const [fulltextAnalyzer, setFulltextAnalyzer] = useState<string>("standard");
  const [fieldFilter, setFieldFilter] = useState("");
  const [models, setModels] = useState<EmbeddingModelOption[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelId, setModelId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }

    setExistingTask(null);
    setMode("batch");
    setEmbeddingFields([]);
    setBuildKeyFields([]);
    setFulltextFields([]);
    setFulltextAnalyzer("standard");
    setFieldFilter("");
    setError(null);
    setModelsLoaded(false);
    setSchema(resource.schema);

    const hydrateFromResource = (detail: CatalogResource) => {
      setSchema(detail.schema);
      const form = indexFormValuesFromResource(detail);
      setEmbeddingFields(form.embeddingFields);
      setBuildKeyFields(form.buildKeyFields);
      setFulltextFields(form.fulltextFields);
      if (form.fulltextAnalyzer) {
        setFulltextAnalyzer(form.fulltextAnalyzer);
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

      let existing: BuildTask | null = null;
      try {
        const tasks = await listBuildTasks({ resourceId: resource.id });
        existing = tasks[0] ?? null;
      } catch {
        existing = null;
      }
      if (existing) {
        setExistingTask(existing);
        setMode(existing.mode);
        // 无 resource 配置时，回退展示最近任务快照
        if (!preferredModel && existing.embeddingFields.length + existing.fulltextFields.length > 0) {
          setEmbeddingFields(existing.embeddingFields);
          setBuildKeyFields(existing.buildKeyFields);
          setFulltextFields(existing.fulltextFields);
          if (existing.fulltextAnalyzer) {
            setFulltextAnalyzer(existing.fulltextAnalyzer);
          }
          preferredModel = existing.embeddingModel;
        }
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
        setModelId(
          preferredModel && list.some((item) => item.id === preferredModel)
            ? preferredModel
            : list[0]?.id,
        );
      } catch {
        setModels(FALLBACK_MODELS);
        setModelId(
          preferredModel && FALLBACK_MODELS.some((item) => item.id === preferredModel)
            ? preferredModel
            : FALLBACK_MODELS[0].id,
        );
      } finally {
        setModelsLoaded(true);
      }
    })();
  }, [active, resource]);

  const selectedModel = useMemo(
    () => models.find((item) => item.id === modelId) ?? null,
    [modelId, models],
  );

  const isEditable = existingTask !== null && existingTask.mode === "batch";
  const streamingLocked = existingTask !== null && existingTask.mode === "streaming";

  const toggleField = (
    field: string,
    list: string[],
    setList: (next: string[]) => void,
  ) => {
    setError(null);
    if (list.includes(field)) {
      setList(list.filter((item) => item !== field));
    } else {
      setList([...list, field]);
    }
  };

  const submitTask = async () => {
    const useEmbedding = embeddingFields.length > 0 && selectedModel;
    const detail =
      (await getCatalogResource(resource.id)) ??
      ({
        ...resource,
        schema,
      } satisfies CatalogResource);

    const { schema: nextSchema, indexConfig } = applyIndexFormToSchema(detail.schema.length ? detail.schema : schema, {
      buildKeyFields,
      embeddingFields,
      embeddingModel: useEmbedding ? selectedModel.id : "",
      fulltextFields,
      fulltextAnalyzer: fulltextFields.length > 0 ? fulltextAnalyzer : undefined,
    });

    // 先写 resource 索引配置，再创建构建任务（任务只触发执行）。
    await updateCatalogResource(resource.id, {
      catalogId: detail.catalogId,
      category: detail.category,
      description: detail.description,
      name: detail.name,
      sourceIdentifier: detail.sourceIdentifier,
      schema: nextSchema,
      indexConfig,
    });

    const task = await createBuildTask({
      mode,
      resourceId: resource.id,
      executeType: mode === "batch" ? "full" : undefined,
    });
    message.success(
      isEditable
        ? t("dataCatalog.build.edited")
        : t("dataCatalog.build.created", { id: task.id }),
    );
    onSubmitted(task);
  };

  const handleSubmit = async () => {
    if (embeddingFields.length === 0 && fulltextFields.length === 0) {
      setError(t("dataCatalog.build.fieldsRequired"));
      return;
    }
    if (mode === "batch" && buildKeyFields.length === 0) {
      setError(t("dataCatalog.build.buildKeyRequired"));
      return;
    }
    if (embeddingFields.length > 0 && !selectedModel) {
      setError(t("dataCatalog.build.modelRequired"));
      return;
    }

    if (isEditable && existingTask) {
      void modal.confirm({
        title: t("dataCatalog.build.editConfirmTitle"),
        content: t("dataCatalog.build.editConfirmContent"),
        okText: t("dataCatalog.build.editConfirmOk"),
        cancelText: t("common.cancel"),
        onOk: async () => {
          setSaving(true);
          setError(null);
          try {
            await submitTask();
          } catch (submitError) {
            setError(extractRequestErrorMessage(submitError));
          } finally {
            setSaving(false);
          }
        },
      });
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await submitTask();
    } catch (submitError) {
      if (submitError instanceof BuildTaskConflictError) {
        setError(t("dataCatalog.build.conflict"));
      } else {
        setError(extractRequestErrorMessage(submitError));
      }
    } finally {
      setSaving(false);
    }
  };

  const roleDefs = [
    {
      box: styles.frtBoxEmb,
      dot: styles.frtDotEmb,
      id: "emb",
      list: embeddingFields,
      name: t("dataCatalog.build.roleEmbedding"),
      required: true,
      set: setEmbeddingFields,
      textOnly: false,
    },
    {
      box: styles.frtBoxKey,
      dot: styles.frtDotKey,
      id: "key",
      list: buildKeyFields,
      name: t("dataCatalog.build.roleBuildKey"),
      required: mode === "batch",
      set: setBuildKeyFields,
      textOnly: false,
    },
    {
      box: styles.frtBoxFt,
      dot: styles.frtDotFt,
      id: "ft",
      list: fulltextFields,
      name: t("dataCatalog.build.roleFulltext"),
      required: false,
      set: setFulltextFields,
      textOnly: true,
    },
  ] as const;

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
    setError(null);
    const eligible = eligibleFields(role);
    if (columnAllOn(role)) {
      const drop = new Set(eligible.map((field) => field.name));
      role.set(role.list.filter((name) => !drop.has(name)));
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

  const noModels = modelsLoaded && models.length === 0;

  if (!active) {
    return null;
  }

  return (
    <div className={formStyles.formCard}>
      {streamingLocked ? (
        <Alert message={t("dataCatalog.build.streamingEditLocked")} showIcon type="info" />
      ) : null}

      {showResourceSummary ? (
        <div>
          <div className={formStyles.fieldLabel}>{t("dataCatalog.build.resource")}</div>
          <span className={styles.chipRow}>
            <span className={styles.tag}>{resource.name}</span>
            <span className={styles.slugChip}>{resource.id}</span>
          </span>
          <div className={formStyles.fieldHint}>{t("dataCatalog.build.resourceHint")}</div>
        </div>
      ) : null}

      <div>
        <div className={formStyles.fieldLabel}>{t("dataCatalog.build.mode")}</div>
        <div className={formStyles.modeGrid}>
          {(
            [
              {
                description: t("dataCatalog.build.batchDescription"),
                key: "batch" as const,
                label: t("dataCatalog.build.batchLabel"),
              },
              {
                description: t("dataCatalog.build.streamingDescription"),
                key: "streaming" as const,
                label: t("dataCatalog.build.streamingLabel"),
              },
            ] as const
          ).map((option) => (
            <button
              className={cx(formStyles.modeOption, mode === option.key && formStyles.modeOptionActive)}
              key={option.key}
              onClick={() => {
                setMode(option.key);
                setError(null);
              }}
              type="button"
            >
              <span className={formStyles.modeOptionLabel}>{option.label}</span>
              <span className={formStyles.modeOptionDesc}>{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={formStyles.fieldLabel}>
          <span className={formStyles.requiredMark}>*</span>
          {t("dataCatalog.build.fieldRole")}
          <span className={formStyles.fieldLabelHint}>{t("dataCatalog.build.fieldRoleHint")}</span>
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
                  {roleDefs.map((role) => (
                    <span className={styles.frtStat} key={role.id}>
                      <span className={cx(styles.frtDot, role.dot)} />
                      {role.name}
                      <RoleHintIcon hint={getRoleHint(role.id, mode, t)} />
                      <b>{role.list.length}</b>
                    </span>
                  ))}
                </span>
              </div>
              <div className={styles.frtScroll}>
                <table className={styles.frtTable}>
                  <thead>
                    <tr>
                      <th>{t("dataCatalog.resource.fieldName")}</th>
                      <th>{t("dataCatalog.resource.fieldDisplayName")}</th>
                      <th>{t("dataCatalog.resource.fieldType")}</th>
                      {roleDefs.map((role) => {
                        const allOn = columnAllOn(role);
                        return (
                          <th className={styles.frtRoleCol} key={role.id}>
                            <span className={styles.frtRoleHead} onClick={() => toggleColumn(role)}>
                              <span className={styles.frtRoleName}>
                                <span className={cx(styles.frtDot, role.dot)} />
                                {role.name}
                                {role.required ? <span className={styles.frtReq}>*</span> : null}
                                <RoleHintIcon hint={getRoleHint(role.id, mode, t)} />
                              </span>
                              <span className={cx(styles.frtAll, allOn && styles.frtAllOn)}>
                                {allOn
                                  ? t("dataCatalog.build.clearAll")
                                  : t("dataCatalog.build.selectAll")}
                              </span>
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFields.length === 0 ? (
                      <tr>
                        <td className={styles.frtEmpty} colSpan={6}>
                          {t("dataCatalog.build.fieldNoMatch", { keyword: fieldFilter })}
                        </td>
                      </tr>
                    ) : (
                      visibleFields.map((field) => {
                        const rowActive = roleDefs.some((role) =>
                          role.list.includes(field.name),
                        );
                        return (
                          <tr
                            className={rowActive ? styles.frtRowActive : undefined}
                            key={field.name}
                          >
                            <td className={styles.frtField}>
                              <code>{field.name}</code>
                            </td>
                            <td className={styles.frtFieldMeta}>{field.displayName || "—"}</td>
                            <td className={styles.frtFieldMeta}>{field.type}</td>
                            {roleDefs.map((role) => {
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
                                      toggleField(field.name, role.list, role.set);
                                    }}
                                    title={
                                      disabled ? t("dataCatalog.build.fulltextTypeHint") : undefined
                                    }
                                  >
                                    <span className={styles.frtMark}>{checkIcon}</span>
                                  </span>
                                </td>
                              );
                            })}
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

      {fulltextFields.length > 0 ? (
        <div>
          <div className={formStyles.fieldLabel}>
            <span className={formStyles.requiredMark}>*</span>
            {t("dataCatalog.build.fulltextAnalyzer")}
            <span className={formStyles.fieldLabelHint}>
              {t("dataCatalog.build.fulltextAnalyzerHint")}
            </span>
          </div>
          <Select
            onChange={(value) => setFulltextAnalyzer(value)}
            options={FULLTEXT_ANALYZERS.map((analyzer) => ({
              label: t(`dataCatalog.build.analyzers.${analyzer}`),
              value: analyzer,
            }))}
            style={{ width: 420 }}
            value={fulltextAnalyzer}
          />
        </div>
      ) : null}

      <div className={formStyles.modelGrid}>
        <div>
          <div className={formStyles.fieldLabel}>{t("dataCatalog.build.model")}</div>
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
              onChange={(value) => setModelId(value)}
              options={models.map((model) => ({
                label: `${model.name} · ${model.dimensions}d`,
                value: model.id,
              }))}
              style={{ width: "100%" }}
              value={modelId}
            />
          )}
        </div>
        <div>
          <div className={formStyles.fieldLabel}>
            {t("dataCatalog.build.dimensions")}
            <span className={formStyles.fieldLabelHint}>
              {t("dataCatalog.build.dimensionsHint")}
            </span>
          </div>
          <Input disabled value={selectedModel ? String(selectedModel.dimensions) : "—"} />
        </div>
      </div>

      {error ? <Alert message={error} showIcon type="error" /> : null}

      <div className={formStyles.footer}>
        {onCancel ? <AppButton onClick={onCancel}>{t("common.cancel")}</AppButton> : null}
        <Space style={{ marginLeft: "auto" }}>
          <AppButton
            disabled={streamingLocked || (noModels && embeddingFields.length > 0)}
            icon={<ThunderboltOutlined />}
            loading={saving}
            onClick={() => void handleSubmit()}
            type="primary"
          >
            {isEditable ? t("dataCatalog.build.editSubmit") : t("dataCatalog.build.submit")}
          </AppButton>
        </Space>
      </div>
    </div>
  );
}
