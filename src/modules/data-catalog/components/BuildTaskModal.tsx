import { ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Input, Modal, Select, Space, Tag } from "antd";
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

  const fieldChips = (
    selected: string[],
    onToggle: (field: string) => void,
    opts?: { textOnly?: boolean },
  ) => {
    if (schemaLoading) {
      return (
        <span style={{ color: "#8b98ac", fontSize: 12 }}>
          {t("dataCatalog.build.schemaLoading")}
        </span>
      );
    }
    if (schema.length === 0) {
      return (
        <span style={{ color: "#8b98ac", fontSize: 12 }}>
          {t("dataCatalog.build.schemaEmpty")}
        </span>
      );
    }
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {schema.map((field) => {
          const disabled = opts?.textOnly && !isTextField(field.type);
          const checked = selected.includes(field.name);
          return (
            <Tag.CheckableTag
              checked={checked}
              key={field.name}
              onChange={() => {
                if (disabled) {
                  return;
                }
                onToggle(field.name);
              }}
              style={{
                border: "1px solid",
                borderColor: checked ? "#2e68ff" : "#d9d9d9",
                borderRadius: 999,
                padding: "3px 12px",
                userSelect: "none",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.4 : 1,
              }}
              title={disabled ? t("dataCatalog.build.fulltextTypeHint") : undefined}
            >
              <code style={{ fontSize: 12 }}>{field.name}</code>{" "}
              <span style={{ fontSize: 11, opacity: 0.65 }}>{field.type}</span>
            </Tag.CheckableTag>
          );
        })}
      </div>
    );
  };

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
      width={680}
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
            {t("dataCatalog.build.embeddingFields")}
            <span style={{ marginLeft: 6, fontWeight: 400, color: "#8b98ac", fontSize: 12 }}>
              {t("dataCatalog.build.embeddingFieldsHint")}
            </span>
          </div>
          {fieldChips(embeddingFields, (field) =>
            toggleField(field, embeddingFields, setEmbeddingFields),
          )}
        </div>

        <div>
          <div style={{ marginBottom: 7, fontWeight: 600, fontSize: 13, color: "#3e4d66" }}>
            {t("dataCatalog.build.buildKeyFields")}
            <span style={{ marginLeft: 6, fontWeight: 400, color: "#8b98ac", fontSize: 12 }}>
              {t("dataCatalog.build.buildKeyFieldsHint")}
            </span>
          </div>
          {fieldChips(buildKeyFields, (field) =>
            toggleField(field, buildKeyFields, setBuildKeyFields),
          )}
        </div>

        <div>
          <div style={{ marginBottom: 7, fontWeight: 600, fontSize: 13, color: "#3e4d66" }}>
            {t("dataCatalog.build.fulltextFields")}
            <span style={{ marginLeft: 6, fontWeight: 400, color: "#8b98ac", fontSize: 12 }}>
              {t("dataCatalog.build.fulltextFieldsHint")}
            </span>
          </div>
          {fieldChips(
            fulltextFields,
            (field) => toggleField(field, fulltextFields, setFulltextFields),
            { textOnly: true },
          )}
          {fulltextFields.length > 0 ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ marginBottom: 7, fontWeight: 600, fontSize: 13, color: "#3e4d66" }}>
                {t("dataCatalog.build.fulltextAnalyzer")}
                <span
                  style={{ marginLeft: 6, fontWeight: 400, color: "#8b98ac", fontSize: 12 }}
                >
                  {t("dataCatalog.build.fulltextAnalyzerHint")}
                </span>
              </div>
              <Select
                onChange={(value) => setFulltextAnalyzer(value)}
                options={FULLTEXT_ANALYZERS.map((analyzer) => ({
                  label: t(`dataCatalog.build.analyzers.${analyzer}`),
                  value: analyzer,
                }))}
                style={{ width: 260 }}
                value={fulltextAnalyzer}
              />
            </div>
          ) : null}
        </div>

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
