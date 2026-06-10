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
} from "@/modules/data-catalog/services/build-task.service";
import type {
  BuildMode,
  BuildTask,
  CatalogResource,
  EmbeddingModelOption,
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

export function BuildTaskModal({ onClose, onCreated, open, resource }: BuildTaskModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();

  const [mode, setMode] = useState<BuildMode>("batch");
  const [embeddingFields, setEmbeddingFields] = useState<string[]>([]);
  const [buildKeyFields, setBuildKeyFields] = useState<string[]>([]);
  const [models, setModels] = useState<EmbeddingModelOption[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelId, setModelId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setMode("batch");
    setEmbeddingFields([]);
    setBuildKeyFields([]);
    setError(null);
    setModelsLoaded(false);

    void (async () => {
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
        setModels(options.length > 0 ? options : FALLBACK_MODELS);
        setModelId((options.length > 0 ? options : FALLBACK_MODELS)[0]?.id);
      } catch {
        setModels(FALLBACK_MODELS);
        setModelId(FALLBACK_MODELS[0].id);
      } finally {
        setModelsLoaded(true);
      }
    })();
  }, [open]);

  const selectedModel = useMemo(
    () => models.find((item) => item.id === modelId) ?? null,
    [modelId, models],
  );

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
    if (embeddingFields.length === 0) {
      setError(t("dataCatalog.build.embeddingRequired"));
      return;
    }
    if (mode === "batch" && buildKeyFields.length === 0) {
      setError(t("dataCatalog.build.buildKeyRequired"));
      return;
    }
    if (!selectedModel) {
      setError(t("dataCatalog.build.modelRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const task = await createBuildTask({
        buildKeyFields,
        embeddingFields,
        embeddingModel: selectedModel.id,
        mode,
        modelDimensions: selectedModel.dimensions,
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

  const fieldChips = (selected: string[], onToggle: (field: string) => void) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {resource.schema.map((field) => (
        <Tag.CheckableTag
          checked={selected.includes(field.name)}
          key={field.name}
          onChange={() => onToggle(field.name)}
          style={{
            border: "1px solid",
            borderColor: selected.includes(field.name) ? "#2e68ff" : "#d9d9d9",
            borderRadius: 999,
            padding: "3px 12px",
            userSelect: "none",
          }}
        >
          <code style={{ fontSize: 12 }}>{field.name}</code>{" "}
          <span style={{ fontSize: 11, opacity: 0.65 }}>{field.type}</span>
        </Tag.CheckableTag>
      ))}
    </div>
  );

  const noModels = modelsLoaded && models.length === 0;

  return (
    <Modal
      footer={
        <Space style={{ display: "flex", width: "100%" }}>
          <span style={{ marginRight: "auto", color: "#8b98ac", fontSize: 12 }}>
            POST /vega-backend/v1/build-tasks
          </span>
          <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
          <AppButton
            disabled={noModels}
            icon={<ThunderboltOutlined />}
            loading={saving}
            onClick={() => void handleSubmit()}
            type="primary"
          >
            {t("dataCatalog.build.submit")}
          </AppButton>
        </Space>
      }
      onCancel={onClose}
      open={open}
      title={t("dataCatalog.build.title")}
      width={680}
    >
      <div style={{ display: "grid", gap: 18 }}>
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
