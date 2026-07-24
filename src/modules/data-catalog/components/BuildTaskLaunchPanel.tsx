/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Tooltip } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  extractRequestErrorDetails,
  type RequestErrorDetails,
} from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  BuildTaskConflictError,
  createBuildTask,
  listBuildTasks,
  resumeBuildTask,
  type BuildExecuteType,
} from "@/modules/data-catalog/services/build-task.service";
import type { BuildMode, BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import { indexFormValuesFromResource } from "@/modules/data-catalog/utils/resource-index-config";
import { isActiveBuildTask } from "@/modules/data-catalog/utils/build-task-guards";
import { listSmallModels } from "@/modules/model-resources/services/small-model.service";
import type { SmallModel } from "@/modules/model-resources/types/small-model";

import formStyles from "./BuildTaskFormPanel.module.css";

export type BuildTaskLaunchPanelProps = {
  active: boolean;
  disabled?: boolean;
  onGoConfigure: () => void;
  onStarted: (task: BuildTask) => void;
  resource: CatalogResource;
};

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type BuildTaskLaunchError = RequestErrorDetails;

function formatEmbeddingModelDisplay(
  modelId: string | null | undefined,
  models: SmallModel[],
) {
  const rawModel = modelId?.trim();
  if (!rawModel) {
    return "-";
  }

  const match = models.find(
    (item) => item.modelId === rawModel || item.modelName === rawModel,
  );
  const name = match?.modelName || rawModel;
  return match?.embeddingDim ? `${name} - ${match.embeddingDim}d` : name;
}

export function BuildTaskLaunchPanel({
  active,
  disabled = false,
  onGoConfigure,
  onStarted,
  resource,
}: BuildTaskLaunchPanelProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();

  const [mode, setMode] = useState<BuildMode>("batch");
  const [executeType, setExecuteType] = useState<BuildExecuteType>("full");
  const [existingActive, setExistingActive] = useState<BuildTask | null>(null);
  const [error, setError] = useState<BuildTaskLaunchError | null>(null);
  const [models, setModels] = useState<SmallModel[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!error) {
      return undefined;
    }

    const timer = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const config = useMemo(() => indexFormValuesFromResource(resource), [resource]);
  const hasResourceConfig =
    config.embeddingFields.length > 0 || config.fulltextFields.length > 0;
  const batchNeedsBuildKey = mode === "batch" && config.buildKeyFields.length === 0;
  const streamingNeedsBuildKey = mode === "streaming" && config.buildKeyFields.length === 0;
  const analyzerLabel = config.fulltextFields.length > 0 && config.fulltextAnalyzer
    ? t(`dataCatalog.build.analyzers.${config.fulltextAnalyzer}`, {
        defaultValue: config.fulltextAnalyzer,
      })
    : "-";
  const modelLabel =
    config.embeddingFields.length > 0
      ? formatEmbeddingModelDisplay(config.embeddingModel, models)
      : "-";
  const configSummary = t("dataCatalog.indexWorkspace.launchConfigSummary", {
    analyzer: analyzerLabel,
    buildKey: config.buildKeyFields.length,
    embedding: config.embeddingFields.length,
    fulltext: config.fulltextFields.length,
    model: modelLabel,
  });

  useEffect(() => {
    if (!active) {
      return;
    }

    let alive = true;
    void listSmallModels({ modelType: "embedding", page: 1, size: 200 })
      .then((result) => {
        if (alive) {
          setModels(result.items);
        }
      })
      .catch(() => {
        if (alive) {
          setModels([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }
    setMode("batch");
    setExecuteType("full");
    setError(null);
    void listBuildTasks({ resourceId: resource.id })
      .then((tasks) => {
        setExistingActive(tasks.find((task) => isActiveBuildTask(task)) ?? null);
      })
      .catch(() => {
        setExistingActive(null);
      });
  }, [active, resource.id]);

  const actionsLocked = isActiveBuildTask(existingActive);
  const streamingActive =
    existingActive?.mode === "streaming" && isActiveBuildTask(existingActive);
  const controlsDisabled = disabled || actionsLocked;
  const startDisabled =
    controlsDisabled || !hasResourceConfig || batchNeedsBuildKey || streamingNeedsBuildKey;

  const startBuild = async () => {
    if (!hasResourceConfig) {
      setError({ description: t("dataCatalog.build.needConfigFirst") });
      return;
    }
    if (mode === "batch" && config.buildKeyFields.length === 0) {
      setError({ description: t("dataCatalog.build.buildKeyRequired") });
      return;
    }
    if (streamingNeedsBuildKey) {
      setError({ description: t("dataCatalog.build.streamingBuildKeyRequired") });
      return;
    }
    if (actionsLocked) {
      setError({
        description: streamingActive
          ? t("dataCatalog.build.streamingActiveLocked")
          : t("dataCatalog.build.activeTaskLocked"),
      });
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const task = await createBuildTask({
        mode,
        resourceId: resource.id,
        executeType: mode === "batch" ? executeType : undefined,
      });
      try {
        await resumeBuildTask(task.id);
      } catch {
        // create 后可能已自动 running
      }
      message.success(t("dataCatalog.build.created", { id: task.id }));
      onStarted(task);
    } catch (persistError) {
      if (persistError instanceof BuildTaskConflictError) {
        setError({ description: t("dataCatalog.build.conflict") });
      } else {
        setError(extractRequestErrorDetails(persistError));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!active) {
    return null;
  }

  const executeOptions = [
    {
      description: t("dataCatalog.build.executeFullDescription"),
      key: "full" as const,
      label: t("dataCatalog.build.executeFull"),
    },
    {
      description: t("dataCatalog.build.executeIncrementalDescription"),
      key: "incremental" as const,
      label: t("dataCatalog.build.executeIncremental"),
    },
  ];
  const selectedExecuteOption =
    executeOptions.find((option) => option.key === executeType) ?? executeOptions[0];

  return (
    <div className={formStyles.launchBody}>
      {!hasResourceConfig ? (
        <Alert
          action={
            <AppButton onClick={onGoConfigure} size="small" type="link">
              {t("dataCatalog.indexWorkspace.viewConfig")}
            </AppButton>
          }
          message={t("dataCatalog.build.needConfigFirst")}
          showIcon
          type="warning"
        />
      ) : null}

      {streamingActive ? (
        <Alert message={t("dataCatalog.build.streamingActiveLocked")} showIcon type="warning" />
      ) : null}
      {!streamingActive && actionsLocked ? (
        <Alert message={t("dataCatalog.build.activeTaskLocked")} showIcon type="warning" />
      ) : null}
      {hasResourceConfig && batchNeedsBuildKey ? (
        <Alert
          action={
            <AppButton onClick={onGoConfigure} size="small" type="link">
              {t("dataCatalog.indexWorkspace.viewConfig")}
            </AppButton>
          }
          message={t("dataCatalog.build.buildKeyRequired")}
          showIcon
          type="warning"
        />
      ) : null}
      {hasResourceConfig && streamingNeedsBuildKey ? (
        <Alert message={t("dataCatalog.build.streamingBuildKeyRequired")} showIcon type="warning" />
      ) : null}

      {hasResourceConfig ? (
        <div className={formStyles.launchConfigStrip}>
          <div className={formStyles.launchConfigMain}>
            <span className={formStyles.launchConfigTitle}>
              {t("dataCatalog.indexWorkspace.launchConfigTitle")}
            </span>
            <span className={formStyles.launchConfigText}>{configSummary}</span>
          </div>
          <AppButton onClick={onGoConfigure} size="small" type="link">
            {t("dataCatalog.indexWorkspace.editConfigLink")}
          </AppButton>
        </div>
      ) : null}

      <div className={formStyles.launchModePanel}>
        <div className={formStyles.launchModeHead}>{t("dataCatalog.build.mode")}</div>
        <div className={formStyles.launchModeGrid}>
          <div
            className={cx(
              formStyles.modeCard,
              mode === "batch" && formStyles.modeCardActive,
            )}
          >
            <button
              className={formStyles.modeCardHeader}
              disabled={controlsDisabled}
              onClick={() => {
                setMode("batch");
                setError(null);
              }}
              type="button"
            >
              <span
                aria-hidden
                className={cx(
                  formStyles.modeCardRadio,
                  mode === "batch" && formStyles.modeCardRadioChecked,
                )}
              />
              <span className={formStyles.modeCardText}>
                <span className={formStyles.modeCardTitle}>
                  {t("dataCatalog.build.batchLabel")}
                </span>
                <span className={formStyles.modeCardDesc}>
                  {t("dataCatalog.build.batchDescription")}
                </span>
              </span>
            </button>
            {mode === "batch" ? (
              <div className={formStyles.modeCardExtra}>
                <div className={formStyles.executeRadioGroup}>
                  {executeOptions.map((option) => (
                    <Tooltip key={option.key} title={option.description}>
                      <label
                        className={cx(
                          formStyles.executeRadio,
                          executeType === option.key && formStyles.executeRadioActive,
                        )}
                      >
                        <input
                          checked={executeType === option.key}
                          disabled={controlsDisabled}
                          name="batch-execute-type"
                          onChange={() => {
                            setExecuteType(option.key);
                            setError(null);
                          }}
                          type="radio"
                        />
                        <span>
                          <b>{option.label}</b>
                          <small>{option.description}</small>
                        </span>
                      </label>
                    </Tooltip>
                  ))}
                  <span
                    className={formStyles.executeInlineHint}
                    title={selectedExecuteOption.description}
                  >
                    {selectedExecuteOption.description}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <button
            className={cx(
              formStyles.modeCard,
              formStyles.modeCardSelectable,
              mode === "streaming" && formStyles.modeCardActive,
            )}
            disabled={controlsDisabled}
            onClick={() => {
              setMode("streaming");
              setError(null);
            }}
            type="button"
          >
            <span
              aria-hidden
              className={cx(
                formStyles.modeCardRadio,
                mode === "streaming" && formStyles.modeCardRadioChecked,
              )}
            />
            <span className={formStyles.modeCardText}>
              <span className={formStyles.modeCardTitle}>
                {t("dataCatalog.build.streamingLabel")}
              </span>
              <span className={formStyles.modeCardDesc}>
                {t("dataCatalog.build.streamingDescription")}
              </span>
            </span>
          </button>
        </div>
      </div>

      {error ? (
        <Alert
          description={
            error.code || error.details || error.solution || error.errorLink ? (
              <div>
                {error.code ? <div>{t("dataCatalog.build.errorCode", { value: error.code })}</div> : null}
                {error.details ? <div>{t("dataCatalog.build.errorDetails", { value: error.details })}</div> : null}
                {error.solution ? <div>{t("dataCatalog.build.errorSolution", { value: error.solution })}</div> : null}
                {error.errorLink ? <div>{t("dataCatalog.build.errorLink", { value: error.errorLink })}</div> : null}
              </div>
            ) : undefined
          }
          message={error.description}
          showIcon
          type="error"
        />
      ) : null}

      <div className={formStyles.launchActionBar}>
        <AppButton
          disabled={startDisabled}
          icon={<ThunderboltOutlined />}
          loading={saving}
          onClick={() => void startBuild()}
          type="primary"
        >
          {t("dataCatalog.build.startBuild")}
        </AppButton>
      </div>
    </div>
  );
}
