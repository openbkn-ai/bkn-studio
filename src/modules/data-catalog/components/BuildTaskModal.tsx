/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { SearchOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Input, Modal, Select, Space } from "antd";
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
  updateBuildTask,
} from "@/modules/data-catalog/services/build-task.service";
import { getCatalogResource } from "@/modules/data-catalog/services/resource.service";
import type {
  BuildMode,
  BuildTask,
  CatalogResource,
  EmbeddingModelOption,
  ResourceSchemaField,
} from "@/modules/data-catalog/types/data-catalog";
import { listSmallModels } from "@/modules/model-resources/services/small-model.service";

import styles from "./shared.module.css";

type BuildTaskModalProps = {
  onClose: () => void;
  onCreated: (task: BuildTask) => void;
  open: boolean;
  resource: CatalogResource;
};

const FALLBACK_MODELS: EmbeddingModelOption[] = [
  { id: "bge-m3", name: "BGE-M3", dimensions: 1024 },
  { id: "bge-large-zh-v1.5", name: "BGE-Large-zh v1.5", dimensions: 1024 },
];

const FULLTEXT_ANALYZERS = ["standard", "ik_max_word", "hanlp_index"] as const;

// 全文索引仅支持文本类字段;后端对非文本字段返回 400,前端先置灰拦截
const TEXT_TYPE_RE = /text|string|char|clob/i;
const isTextField = (type: string) => TEXT_TYPE_RE.test(type);

export function BuildTaskModal({ onClose, onCreated, open, resource }: BuildTaskModalProps) {
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
    if (!open) {
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

    // 列表接口不返回 schema_definition,字段为空时补拉资源详情,
    // 否则 embedding / build key 无候选字段,无法创建任务
    if (resource.schema.length === 0) {
      setSchemaLoading(true);
      void getCatalogResource(resource.id)
        .then((detail) => {
          if (detail?.schema.length) {
            setSchema(detail.schema);
          }
        })
        .finally(() => setSchemaLoading(false));
    }

    void (async () => {
      // 资源已有构建任务时预填其配置(一个资源对应一个任务),方便查看/重建
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
        setEmbeddingFields(existing.embeddingFields);
        setBuildKeyFields(existing.buildKeyFields);
        setFulltextFields(existing.fulltextFields);
        if (existing.fulltextAnalyzer) {
          setFulltextAnalyzer(existing.fulltextAnalyzer);
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
        // 预填已有任务的模型;模型已下线则回退到首个可选
        const preferred = existing?.embeddingModel;
        setModelId(
          preferred && list.some((item) => item.id === preferred)
            ? preferred
            : list[0]?.id,
        );
      } catch {
        setModels(FALLBACK_MODELS);
        const preferred = existing?.embeddingModel;
        setModelId(
          preferred && FALLBACK_MODELS.some((item) => item.id === preferred)
            ? preferred
            : FALLBACK_MODELS[0].id,
        );
      } finally {
        setModelsLoaded(true);
      }
    })();
  }, [open, resource]);

  const selectedModel = useMemo(
    () => models.find((item) => item.id === modelId) ?? null,
    [modelId, models],
  );

  // 已有 batch 任务 → 编辑模式(保存走 PUT + full 重建);streaming 暂不支持编辑
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

  const handleSubmit = async () => {
    // embedding 与 fulltext 都是可选能力,至少选一种字段
    if (embeddingFields.length === 0 && fulltextFields.length === 0) {
      setError(t("dataCatalog.build.fieldsRequired"));
      return;
    }
    if (mode === "batch" && buildKeyFields.length === 0) {
      setError(t("dataCatalog.build.buildKeyRequired"));
      return;
    }
    // 仅向量化才需要 embedding 模型;纯全文任务不要求
    if (embeddingFields.length > 0 && !selectedModel) {
      setError(t("dataCatalog.build.modelRequired"));
      return;
    }

    const useEmbedding = embeddingFields.length > 0 && selectedModel;
    const payload = {
      buildKeyFields,
      embeddingFields,
      embeddingModel: useEmbedding ? selectedModel.id : "",
      modelDimensions: useEmbedding ? selectedModel.dimensions : 0,
      fulltextFields,
      fulltextAnalyzer: fulltextFields.length > 0 ? fulltextAnalyzer : undefined,
    };

    // 编辑:改字段会重建索引,二次确认后走 PUT
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
            await updateBuildTask(existingTask.id, payload);
            message.success(t("dataCatalog.build.edited"));
            onCreated(existingTask);
            onClose();
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
      const task = await createBuildTask({
        ...payload,
        mode,
        resourceId: resource.id,
      });
      message.success(t("dataCatalog.build.created", { id: task.id }));
      onCreated(task);
      onClose();
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

  // 字段角色矩阵:一字段一行,三角色列勾选(替代原先三段重复字段网格)
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
      schema.filter((field) => !filterText || field.name.toLowerCase().includes(filterText)),
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

  return (
    <Modal
      footer={
        <Space style={{ display: "flex", width: "100%" }}>
          <span style={{ marginRight: "auto", color: "#8b98ac", fontSize: 12 }}>
            {isEditable
              ? "PUT /vega-backend/v1/build-tasks/:id"
              : "POST /vega-backend/v1/build-tasks"}
          </span>
          <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
          <AppButton
            disabled={streamingLocked || (noModels && embeddingFields.length > 0)}
            icon={<ThunderboltOutlined />}
            loading={saving}
            onClick={() => void handleSubmit()}
            type="primary"
          >
            {isEditable
              ? t("dataCatalog.build.editSubmit")
              : t("dataCatalog.build.submit")}
          </AppButton>
        </Space>
      }
      onCancel={onClose}
      open={open}
      title={isEditable ? t("dataCatalog.build.editTitle") : t("dataCatalog.build.title")}
      width={880}
    >
      <div style={{ display: "grid", gap: 18 }}>
        {streamingLocked ? (
          <Alert message={t("dataCatalog.build.streamingEditLocked")} showIcon type="info" />
        ) : null}
        <div>
          <div style={{ marginBottom: 7, fontWeight: 600, fontSize: 13, color: "#3e4d66" }}>
            {t("dataCatalog.build.resource")}
          </div>
          <span className={styles.chipRow}>
            <span className={styles.tag}>{resource.name}</span>
            <span className={styles.slugChip}>{resource.id}</span>
          </span>
          <div style={{ marginTop: 6, color: "#8b98ac", fontSize: 12 }}>
            {t("dataCatalog.build.resourceHint")}
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 7, fontWeight: 600, fontSize: 13, color: "#3e4d66" }}>
            {t("dataCatalog.build.mode")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
                key={option.key}
                onClick={() => {
                  setMode(option.key);
                  setError(null);
                }}
                style={{
                  display: "grid",
                  gap: 4,
                  padding: "12px 14px",
                  border: "1px solid",
                  borderColor: mode === option.key ? "#2e68ff" : "#d9d9d9",
                  borderRadius: 12,
                  background: mode === option.key ? "rgba(46,104,255,0.05)" : "#fff",
                  boxShadow: mode === option.key ? "inset 0 0 0 1px #2e68ff" : "none",
                  textAlign: "left",
                  cursor: "pointer",
                }}
                type="button"
              >
                <span
                  style={{
                    color: mode === option.key ? "#1f4fd4" : "#152239",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {option.label}
                </span>
                <span style={{ color: "#8b98ac", fontSize: 12, lineHeight: 1.6 }}>
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 7, fontWeight: 600, fontSize: 13, color: "#3e4d66" }}>
            <span style={{ color: "#ef4444", marginRight: 4 }}>*</span>
            {t("dataCatalog.build.fieldRole")}
            <span style={{ marginLeft: 6, fontWeight: 400, color: "#8b98ac", fontSize: 12 }}>
              {t("dataCatalog.build.fieldRoleHint")}
            </span>
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
                        {role.name} <b>{role.list.length}</b>
                      </span>
                    ))}
                  </span>
                </div>
                <div className={styles.frtScroll}>
                  <table className={styles.frtTable}>
                    <thead>
                      <tr>
                        <th>{t("dataCatalog.resource.field")}</th>
                        {roleDefs.map((role) => {
                          const allOn = columnAllOn(role);
                          return (
                            <th className={styles.frtRoleCol} key={role.id}>
                              <span
                                className={styles.frtRoleHead}
                                onClick={() => toggleColumn(role)}
                              >
                                <span className={styles.frtRoleName}>
                                  <span className={cx(styles.frtDot, role.dot)} />
                                  {role.name}
                                  {role.required ? (
                                    <span className={styles.frtReq}>*</span>
                                  ) : null}
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
                          <td className={styles.frtEmpty} colSpan={4}>
                            {t("dataCatalog.build.fieldNoMatch", { keyword: fieldFilter })}
                          </td>
                        </tr>
                      ) : (
                        visibleFields.map((field) => {
                          const active = roleDefs.some((role) =>
                            role.list.includes(field.name),
                          );
                          return (
                            <tr
                              className={active ? styles.frtRowActive : undefined}
                              key={field.name}
                            >
                              <td className={styles.frtField}>
                                <code>{field.name}</code>
                                <span className={styles.frtFieldType}>{field.type}</span>
                              </td>
                              {roleDefs.map((role) => {
                                const disabled =
                                  role.textOnly && !isTextField(field.type);
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
                                        disabled
                                          ? t("dataCatalog.build.fulltextTypeHint")
                                          : undefined
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
          <div className={styles.frtLegend}>
            <span>
              <span className={cx(styles.frtDot, styles.frtDotEmb)} />
              {t("dataCatalog.build.roleEmbedding")} ＝ {t("dataCatalog.build.legendEmbedding")}；
            </span>
            <span>
              <span className={cx(styles.frtDot, styles.frtDotKey)} />
              {t("dataCatalog.build.roleBuildKey")} ＝{" "}
              {mode === "batch"
                ? t("dataCatalog.build.legendBuildKeyBatch")
                : t("dataCatalog.build.legendBuildKeyStreaming")}
              ；
            </span>
            <span>
              <span className={cx(styles.frtDot, styles.frtDotFt)} />
              {t("dataCatalog.build.roleFulltext")} ＝ {t("dataCatalog.build.legendFulltext")}。
            </span>
          </div>
        </div>

        {fulltextFields.length > 0 ? (
          <div>
            <div style={{ marginBottom: 7, fontWeight: 600, fontSize: 13, color: "#3e4d66" }}>
              <span style={{ color: "#ef4444", marginRight: 4 }}>*</span>
              {t("dataCatalog.build.fulltextAnalyzer")}
              <span style={{ marginLeft: 6, fontWeight: 400, color: "#8b98ac", fontSize: 12 }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ marginBottom: 7, fontWeight: 600, fontSize: 13, color: "#3e4d66" }}>
              {t("dataCatalog.build.model")}
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
            <div style={{ marginBottom: 7, fontWeight: 600, fontSize: 13, color: "#3e4d66" }}>
              {t("dataCatalog.build.dimensions")}
              <span style={{ marginLeft: 6, fontWeight: 400, color: "#8b98ac", fontSize: 12 }}>
                {t("dataCatalog.build.dimensionsHint")}
              </span>
            </div>
            <Input disabled value={selectedModel ? String(selectedModel.dimensions) : "—"} />
          </div>
        </div>

        {error ? <Alert message={error} showIcon type="error" /> : null}
      </div>
    </Modal>
  );
}
