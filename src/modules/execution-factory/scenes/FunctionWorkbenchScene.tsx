/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  BarsOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  DownOutlined,
  EllipsisOutlined,
  FileTextOutlined,
  PlayCircleFilled,
  PlusOutlined,
  ProfileOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  UpOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Drawer, Dropdown, Spin, Switch, Tag, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { CodeEditor } from "@/modules/execution-factory/components/CodeEditor";
import { DetailBasicInfoButton } from "@/modules/execution-factory/components/DetailBasicInfoButton";
import {
  EntityListRail,
  EntityListTag,
} from "@/modules/execution-factory/components/EntityListRail";
import { FunctionAiGenerateModal } from "@/modules/execution-factory/components/FunctionAiGenerateModal";
import { FunctionParameterTree } from "@/modules/execution-factory/components/FunctionParameterTree";
import { InlineEditableText } from "@/modules/execution-factory/components/InlineEditableText";
import { listLlmModels } from "@/modules/model-resources/services/llm.service";
import {
  executeFunction,
  inferFunctionSchema,
} from "@/modules/execution-factory/services/function.service";
import {
  createTool,
  deleteTools,
  getToolDetail,
  listTools,
  updateTool,
  updateToolStatus,
} from "@/modules/execution-factory/services/tool.service";
import {
  getToolbox,
  updateToolbox,
} from "@/modules/execution-factory/services/toolbox.service";
import type { FunctionExecuteResult } from "@/modules/execution-factory/types/function";
import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";
import type { ToolStatus } from "@/modules/execution-factory/types/tool";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import { formatAuditUserDisplay } from "@/modules/execution-factory/utils/audit-user-display";
import { formatOptionalTimestamp } from "@/modules/execution-factory/utils/detail-display";
import { useAuditUserDirectory } from "@/modules/execution-factory/utils/use-audit-user-directory";
import { buildToolboxBasicInfoItems } from "@/modules/execution-factory/utils/toolbox-info-items";
import {
  DEFAULT_FUNCTION_TEMPLATE,
  FUNCTION_TEMPLATES,
  type FunctionTemplateId,
} from "@/modules/execution-factory/utils/function-templates";
import { buildSampleEvent } from "@/modules/execution-factory/utils/function-sample-event";
import { buildJsonSchemaFromParameters } from "@/modules/execution-factory/utils/function-parameter-schema";
import { collectToolboxPublishIssues } from "@/modules/execution-factory/utils/toolbox-publish-preflight";

import { FunctionDependencyPanel } from "./function-workbench/FunctionDependencyPanel";
import styles from "./function-workbench.module.css";

/** Function toolboxes are intentionally small; exceeding this limit means split the toolbox rather than add pagination. */
const MAX_LOADED_FUNCTIONS = 50;

type WorkbenchFunction = {
  code: string;
  dependencies: Array<{ name?: string; version?: string }>;
  description: string;
  dirty: boolean;
  inputs: FunctionParameterDef[];
  key: string;
  name: string;
  outputs: FunctionParameterDef[];
  /** Backend function_content.script_type. Keep absent values empty; list badges display only known values. */
  scriptType?: string;
  /** Disabled function code remains editable and debuggable, but Agents cannot invoke it because backend execute rejects it. */
  status: ToolStatus;
  /** Missing toolId means the function is not persisted yet. */
  toolId?: string;
  useRule: string;
};

/**
 * Compares only persisted fields to determine whether users edited an item during saving. key,
 * toolId, dirty, and status are excluded because the first two are saved back and status has its own API.
 */
function isSamePersistedContent(a: WorkbenchFunction, b: WorkbenchFunction) {
  return (
    a.code === b.code &&
    a.description === b.description &&
    a.name === b.name &&
    a.useRule === b.useRule &&
    JSON.stringify(a.inputs) === JSON.stringify(b.inputs) &&
    JSON.stringify(a.outputs) === JSON.stringify(b.outputs) &&
    JSON.stringify(a.dependencies) === JSON.stringify(b.dependencies)
  );
}

/**
 * Dependency declaration entry point is temporarily disabled.
 *
 * Sandbox sessions use a shared pool and dependency installation is currently unreliable: failures
 * between requested and installed are silent, leaving users with unexplained ModuleNotFoundError.
 * Re-enable this after sandbox dependency installation and session isolation are handled together.
 *
 * Hide only the entry point, not the data path: declared dependencies still save and are sent with execution.
 */
const SHOW_DEPENDENCY_DOCK = false;

/** Dependency-installation notices persist until execution ends and need a stable key for removal in finally. */
const DEPENDENCY_HINT_KEY = "workbench-installing-dependencies";

type OutputTab = "result" | "stdout" | "stderr" | "metrics";

const OUT_TAB_COLORS: Record<OutputTab, string> = {
  result: "#16a34a",
  stdout: "#2563eb",
  stderr: "#dc2626",
  metrics: "#7c3aed",
};

/**
 * Rounds metric values.
 *
 * Backend returns raw floats such as 57.9810839844. Rendering them verbatim wraps in narrow cards
 * and expands an entire row; two decimal places are sufficient for durations and similar metrics.
 */
function formatMetricValue(value: number | string | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return String(value ?? "");
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2);
}

let localKeySeed = 0;
function nextLocalKey() {
  localKeySeed += 1;
  return `local-${localKeySeed}`;
}

/** Backend returns lowercase values such as python; change casing only for display, not the value. */
function formatScriptType(scriptType: string) {
  return scriptType.charAt(0).toUpperCase() + scriptType.slice(1);
}

function emptyFunction(code: string): WorkbenchFunction {
  return {
    code,
    dependencies: [],
    description: "",
    dirty: true,
    inputs: [],
    key: nextLocalKey(),
    name: "",
    outputs: [],
    // Functions created here are intended for Agent use and default to callable. Backend creation
    // always persists tools as disabled, so saving must explicitly restore the desired state.
    status: "enabled",
    useRule: "",
  };
}

type FunctionWorkbenchSceneProps = {
  boxId: string;
  onBack?: () => void;
};

export function FunctionWorkbenchScene({ boxId, onBack }: FunctionWorkbenchSceneProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();

  const [toolbox, setToolbox] = useState<ToolboxRecord | null>(null);
  const [boxName, setBoxName] = useState("");
  const auditUserDirectory = useAuditUserDirectory();
  const [boxCategory, setBoxCategory] = useState<string | undefined>();
  const [functions, setFunctions] = useState<WorkbenchFunction[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [railKeyword, setRailKeyword] = useState("");
  /** Function keys selected for bulk operations, including local unpersisted items. */
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [dockTab, setDockTab] = useState<"params" | "deps" | null>(null);
  const [ioTab, setIoTab] = useState<"inputs" | "outputs">("inputs");
  const [aiOpen, setAiOpen] = useState(false);
  const [hasDefaultLlm, setHasDefaultLlm] = useState(false);
  const [paramsView, setParamsView] = useState<"form" | "json">("form");
  const [deriving, setDeriving] = useState(false);
  /** Code used when parameters were last inferred for each function; changed code may make the contract stale and requires reinference. */
  const derivedCodeRef = useRef<Record<string, string>>({});

  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [eventText, setEventText] = useState("{}");
  /** Stores the last auto-generated content to detect manual user edits. */
  const autoEventRef = useRef("{}");
  /**
   * Key of the currently selected function. Runs are asynchronous and can take up to 330 seconds
   * with dependencies; users can change the unlocked left rail, so verify this ref before applying results.
   */
  const activeKeyRef = useRef<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<FunctionExecuteResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [outTab, setOutTab] = useState<OutputTab>("result");

  const active = useMemo(
    () => functions.find((item) => item.key === activeKey) ?? null,
    [activeKey, functions],
  );

  const patchActive = useCallback(
    (partial: Partial<WorkbenchFunction>) => {
      setFunctions((current) =>
        current.map((item) =>
          item.key === activeKey ? { ...item, ...partial, dirty: true } : item,
        ),
      );
    },
    [activeKey],
  );

  // AI generation needs a default LLM; hide the button when absent instead of letting users trigger an error.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await listLlmModels({ page: 1, size: 200 });
        if (!cancelled) {
          setHasDefaultLlm(result.items.some((item) => item.default));
        }
      } catch {
        if (!cancelled) {
          setHasDefaultLlm(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const record = await getToolbox(boxId);
        const listResult = await listTools(boxId, { page: 1, pageSize: MAX_LOADED_FUNCTIONS });
        const details = await Promise.all(
          listResult.items.map(async (item) => {
            try {
              return await getToolDetail(boxId, item.toolId);
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) {
          return;
        }

        const loaded: WorkbenchFunction[] = details.flatMap((detail) =>
          detail
            ? [
                {
                  code: detail.functionInput?.code ?? DEFAULT_FUNCTION_TEMPLATE,
                  dependencies: detail.functionInput?.dependencies ?? [],
                  description: detail.description ?? "",
                  dirty: false,
                  inputs: detail.functionInput?.inputs ?? [],
                  key: detail.toolId,
                  name: detail.name,
                  outputs: detail.functionInput?.outputs ?? [],
                  scriptType: detail.functionInput?.script_type,
                  status: detail.status,
                  toolId: detail.toolId,
                  useRule: detail.useRule ?? "",
                },
              ]
            : [],
        );

        setToolbox(record);
        setBoxName(record.name);
        setBoxCategory(record.categoryType ?? record.categoryName);
        setFunctions(loaded.length > 0 ? loaded : [emptyFunction(DEFAULT_FUNCTION_TEMPLATE)]);
        setActiveKey(loaded[0]?.key ?? null);
      } catch (error) {
        if (!cancelled) {
          setLoadError(extractRequestErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [boxId]);

  useEffect(() => {
    if (!activeKey && functions.length > 0) {
      setActiveKey(functions[0].key);
    }
  }, [activeKey, functions]);

  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  const handleBack = () => {
    const leave = () => {
      if (onBack) {
        onBack();
        return;
      }

      // Function workbench can only come from Function sets, so do not return to API toolboxes.
      void navigate("/execution-factory/units?activeTab=toolbox&toolboxView=function");
    };

    // This discards the entire function body, not just a few form fields. Drafts live only in memory and are lost on exit.
    if (!hasUnsavedChanges) {
      leave();
      return;
    }

    void modal.confirm({
      title: t("executionFactory.workbenchLeaveConfirmTitle"),
      content: t("executionFactory.workbenchLeaveConfirmDescription"),
      okText: t("executionFactory.workbenchLeaveConfirmOk"),
      cancelText: t("common.cancel"),
      onOk: leave,
    });
  };

  const persistFunction = useCallback(
    async (
      item: WorkbenchFunction,
      onCreated?: (toolId: string) => void,
      onEnableFailed?: (toolId: string) => void,
    ) => {
      const functionInput = {
        code: item.code,
        description: item.description,
        inputs: item.inputs,
        name: item.name,
        outputs: item.outputs,
        script_type: "python" as const,
        // Backend updates the complete metadata only when code is nonempty, so always send the full structure.
        dependencies: item.dependencies,
      };

      if (item.toolId) {
        await updateTool(boxId, item.toolId, {
          description: item.description,
          functionInput,
          metadataType: "function",
          name: item.name,
          useRule: item.useRule,
        });
        return item.toolId;
      }

      const created = await createTool(boxId, {
        description: item.description,
        functionInput,
        metadataType: "function",
        name: item.name,
        useRule: item.useRule,
      });

      const createdId = created.successIds[0];
      if (!createdId) {
        throw new Error(created.failures[0]?.error ?? t("common.error"));
      }

      // The tool has been persisted. Record its ID before changing status so a later
      // failure cannot cause a retry to create the same function again.
      onCreated?.(createdId);

      // The backend creates tools as disabled, while execution accepts only enabled tools.
      // Re-enable it here so agents can invoke newly published functions.
      if (item.status === "enabled") {
        try {
          await updateToolStatus(boxId, [createdId], "enabled");
        } catch (error) {
          // Creation succeeded but enabling failed, so the server remains disabled. Restore
          // the local status to match it before clearing dirty state, then rethrow to stop
          // the batch and prevent a published but unreachable agent function.
          onEnableFailed?.(createdId);
          throw error;
        }
      }

      return createdId;
    },
    [boxId, t],
  );

  const saveToolboxMeta = useCallback(async () => {
    if (!toolbox) {
      return;
    }

    const nameChanged = boxName.trim() !== toolbox.name;
    const categoryChanged = boxCategory !== (toolbox.categoryType ?? toolbox.categoryName);

    if (!nameChanged && !categoryChanged) {
      return;
    }

    await updateToolbox({
      boxId,
      category: boxCategory,
      description: toolbox.description,
      metadataType: toolbox.metadataType ?? "function",
      name: boxName.trim() || toolbox.name,
      serviceUrl: toolbox.serviceUrl,
    });
  }, [boxCategory, boxId, boxName, toolbox]);

  const saveAll = useCallback(async () => {
    await saveToolboxMeta();

    // The editor remains editable while saving. Merge only items persisted in this pass by
    // key, rather than replacing the latest state with the stale click-time snapshot.
    const persisted = new Map<
      string,
      { snapshot: WorkbenchFunction; statusOverride?: ToolStatus; toolId: string }
    >();

    // Write back IDs created before an error as well. Leaving them undefined would cause a
    // retry to create duplicates, or repeatedly fail on a backend uniqueness constraint.
    const flushPersisted = () => {
      if (persisted.size === 0) {
        return;
      }

      setFunctions((current) =>
        current.map((item) => {
          const hit = persisted.get(item.key);
          if (!hit) {
            return item;
          }

          // Accept the persisted ID but retain dirty when the item changed while saving.
          return {
            ...item,
            dirty: !isSamePersistedContent(item, hit.snapshot),
            key: hit.toolId,
            toolId: hit.toolId,
            // Restore only failed enablements to the server's disabled state, preserving
            // concurrent status changes to the other items.
            ...(hit.statusOverride ? { status: hit.statusOverride } : {}),
          };
        }),
      );
      setActiveKey((current) => (current ? (persisted.get(current)?.toolId ?? current) : current));
    };

    try {
      for (const item of functions) {
        if (!item.dirty) {
          continue;
        }

        const toolId = await persistFunction(
          item,
          (createdId) => {
            persisted.set(item.key, { snapshot: item, toolId: createdId });
          },
          (createdId) => {
            // Record the created ID and align the local state with the disabled server state.
            persisted.set(item.key, {
              snapshot: item,
              statusOverride: "disabled",
              toolId: createdId,
            });
          },
        );
        persisted.set(item.key, { snapshot: item, toolId });
      }
    } finally {
      flushPersisted();
    }
  }, [functions, persistFunction, saveToolboxMeta]);

  /**
   * Toggle enabled status. Persisted items call the API immediately; local items are saved
   * by persistFunction later.
   */
  const handleToggleStatus = (target: WorkbenchFunction) => {
    const nextStatus: ToolStatus = target.status === "enabled" ? "disabled" : "enabled";
    const applyLocal = () => {
      setFunctions((current) =>
        current.map((item) =>
          item.key === target.key ? { ...item, status: nextStatus } : item,
        ),
      );
    };

    const { toolId } = target;
    if (!toolId) {
      applyLocal();
      return;
    }

    void modal.confirm({
      title: t("executionFactory.toolStatusChangeConfirmTitle"),
      content: t("executionFactory.toolStatusChangeConfirmDescription", {
        name: target.name || t("executionFactory.workbenchUnnamedFunction"),
        status: t(`executionFactory.toolStatuses.${nextStatus}`),
      }),
      okText: t("common.save"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await updateToolStatus(boxId, [toolId], nextStatus);
        applyLocal();
        void message.success(t("common.success"));
      },
    });
  };

  /**
   * Duplicate locally without persisting. Names must be unique in the toolbox, and copies
   * start disabled to avoid exposing incomplete functions to agents.
   */
  const handleDuplicateFunction = (target: WorkbenchFunction) => {
    const copy: WorkbenchFunction = {
      ...target,
      // The parameter tree is nested, so use a deep copy to avoid sharing nodes.
      dependencies: structuredClone(target.dependencies),
      dirty: true,
      inputs: structuredClone(target.inputs),
      key: nextLocalKey(),
      name: target.name ? `${target.name}_copy` : "",
      outputs: structuredClone(target.outputs),
      status: "disabled",
      toolId: undefined,
    };

    setFunctions((current) => [...current, copy]);
    setActiveKey(copy.key);
    setRunResult(null);
    setRunError(null);
  };

  /**
   * Remove functions from the local list. Single and batch deletion share placeholder and
   * focus handling so deleting every item never leaves the editor empty.
   *
   * 落库的删除由调用方先打完接口再进来。
   */
  const removeFunctions = useCallback(
    (keys: string[]) => {
      const dropped = new Set(keys);

      setFunctions((current) => {
        // Move focus only when the active item was deleted.
        const index = current.findIndex((item) => item.key === activeKey);
        const rest = current.filter((item) => !dropped.has(item.key));

        if (rest.length === 0) {
          const placeholder = emptyFunction(DEFAULT_FUNCTION_TEMPLATE);
          setActiveKey(placeholder.key);
          return [placeholder];
        }

        if (activeKey && dropped.has(activeKey)) {
          setActiveKey(rest[Math.min(Math.max(index, 0), rest.length - 1)].key);
        }

        return rest;
      });

      for (const key of keys) {
        delete derivedCodeRef.current[key];
      }
      setSelectedKeys((current) => current.filter((key) => !dropped.has(key)));
      setRunResult(null);
      setRunError(null);
    },
    [activeKey],
  );

  /**
   * Delete a function. Unpersisted items are removed locally; after deletion, focus moves
   * to a neighbor, or a blank function is created to keep the editor usable.
   */
  const handleDeleteFunction = (target: WorkbenchFunction) => {
    const runDelete = async () => {
      try {
        if (target.toolId) {
          await deleteTools(boxId, [target.toolId]);
        }

        removeFunctions([target.key]);

        if (target.toolId) {
          void message.success(t("common.success"));
        }
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      }
    };

    // A local-only placeholder can be discarded without confirmation.
    if (!target.toolId) {
      void runDelete();
      return;
    }

    void modal.confirm({
      title: t("executionFactory.workbenchDeleteFunctionConfirmTitle"),
      content: t("executionFactory.workbenchDeleteFunctionConfirmContent", {
        name: target.name || t("executionFactory.workbenchUnnamedFunction"),
      }),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      onOk: runDelete,
    });
  };

  const toggleFunctionSelection = (key: string, checked: boolean) => {
    setSelectedKeys((current) =>
      checked ? [...new Set([...current, key])] : current.filter((item) => item !== key),
    );
  };

  /**
   * Change status in bulk. Local-only functions change locally and persist on save; persisted
   * functions are sent in one API request.
   */
  const handleBatchStatus = (nextStatus: ToolStatus) => {
    const targets = functions.filter((item) => selectedKeys.includes(item.key));
    if (targets.length === 0) {
      return;
    }

    const applyLocal = () => {
      const keys = new Set(targets.map((item) => item.key));
      setFunctions((current) =>
        current.map((item) => (keys.has(item.key) ? { ...item, status: nextStatus } : item)),
      );
    };

    void modal.confirm({
      title: t("executionFactory.toolBatchStatusConfirmTitle"),
      content: t("executionFactory.toolBatchStatusConfirmDescription", {
        count: targets.length,
        status: t(`executionFactory.toolStatuses.${nextStatus}`),
      }),
      okText: t("common.save"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        try {
          const toolIds = targets.flatMap((item) => (item.toolId ? [item.toolId] : []));
          if (toolIds.length > 0) {
            await updateToolStatus(boxId, toolIds, nextStatus);
          }
          applyLocal();
          setSelectedKeys([]);
          void message.success(t("common.success"));
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        }
      },
    });
  };

  /** Delete in bulk: persisted items use batch delete, while local items are removed directly. */
  const handleBatchDelete = () => {
    const targets = functions.filter((item) => selectedKeys.includes(item.key));
    if (targets.length === 0) {
      return;
    }

    void modal.confirm({
      title: t("executionFactory.toolBatchDeleteConfirmTitle"),
      content: t("executionFactory.toolBatchDeleteConfirmDescription", {
        count: targets.length,
      }),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        try {
          const toolIds = targets.flatMap((item) => (item.toolId ? [item.toolId] : []));
          if (toolIds.length > 0) {
            await deleteTools(boxId, toolIds);
          }
          removeFunctions(targets.map((item) => item.key));
          void message.success(t("common.success"));
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        }
      },
    });
  };

  /**
   * Check publish readiness. Missing names, descriptions, or code produce warnings rather
   * than hard blocks. Saving a published toolbox follows the same check.
   */
  const confirmPublishIssues = (options: { hint?: string; okText: string; title: string }) => {
    const issues = collectToolboxPublishIssues(
      functions.map((item) => ({
        code: item.code,
        description: item.description,
        metadataType: "function",
        name: item.name,
        status: item.status,
      })),
    );

    return new Promise<boolean>((resolve) => {
      if (issues.length === 0 && !options.hint) {
        resolve(true);
        return;
      }

      void modal.confirm({
        title: options.title,
        content: (
          <>
            {options.hint ? <p style={{ marginBottom: 4 }}>{options.hint}</p> : null}
            {issues.length > 0 ? (
              <>
                <p style={{ marginBottom: 4 }}>
                  {t("executionFactory.publishPreflightSummary", { count: issues.length })}
                </p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {issues.map((issue, index) => (
                    <li key={`${issue.key}-${index}`}>
                      {t(`executionFactory.publishIssues.${issue.key}`, issue.params)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ),
        okButtonProps: { danger: issues.length > 0 },
        okText: issues.length > 0 ? t("executionFactory.publishAnyway") : options.okText,
        cancelText: t("common.cancel"),
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  };

  const handleSaveDraft = async () => {
    if (isPublished) {
      const confirmed = await confirmPublishIssues({
        hint: t("executionFactory.workbenchSavePublishedContent"),
        okText: t("common.save"),
        title: t("executionFactory.workbenchSavePublishedTitle"),
      });

      if (!confirmed) {
        return;
      }
    }

    setSaving(true);
    try {
      await saveAll();
      void message.success(t("common.success"));
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Derive the contract from code on the backend. This is deterministic and does not consume
   * model quota. Return inputs immediately so callers can build test data without waiting for
   * state updates; silent suppresses messages for implicit derivations.
   */
  const handleDeriveParams = async (
    options?: { silent?: boolean },
  ): Promise<FunctionParameterDef[] | null> => {
    if (!active) {
      return null;
    }

    setDeriving(true);
    try {
      const inferred = await inferFunctionSchema(active.code);

      if (!inferred.supported) {
        if (!options?.silent) {
          void message.warning(
            inferred.reason ?? t("executionFactory.functionDeriveUnsupported"),
          );
        }
        return null;
      }

      derivedCodeRef.current[active.key] = active.code;
      patchActive({
        ...(inferred.name && !active.name ? { name: inferred.name } : {}),
        ...(inferred.description && !active.description
          ? { description: inferred.description }
          : {}),
        // Supported derivation is authoritative: no-argument functions can return [] or omit
        // the field, and both must clear inputs to avoid retaining parameters from a prior function.
        inputs: inferred.inputs ?? [],
        ...(inferred.outputs ? { outputs: inferred.outputs } : {}),
      });
      if (!options?.silent) {
        void message.success(t("executionFactory.functionDeriveApplied"));
      }
      return inferred.inputs ?? [];
    } catch (error) {
      if (!options?.silent) {
        void message.error(extractRequestErrorMessage(error));
      }
      return null;
    } finally {
      setDeriving(false);
    }
  };

  const hasUnsavedChanges = useMemo(
    () =>
      functions.some((item) => item.dirty) ||
      (toolbox ? boxName.trim() !== toolbox.name : false) ||
      (toolbox ? boxCategory !== (toolbox.categoryType ?? toolbox.categoryName) : false),
    [boxCategory, boxName, functions, toolbox],
  );
  const isPublished = toolbox?.status === "published";

  // Refreshing or closing a tab bypasses handleBack, so protect unsaved changes with beforeunload.
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome requires an explicit returnValue to show the browser-controlled confirmation.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const codeIsUntouched = useMemo(() => {
    const current = active?.code.trim() ?? "";
    return !current || Object.values(FUNCTION_TEMPLATES).some((tpl) => tpl.trim() === current);
  }, [active?.code]);

  /** Templates replace all code, so confirm before overwriting user-authored content. */
  const applyTemplate = (id: FunctionTemplateId) => {
    if (!active) {
      return;
    }

    if (codeIsUntouched) {
      patchActive({ code: FUNCTION_TEMPLATES[id] });
      return;
    }

    void modal.confirm({
      title: t("executionFactory.functionTemplateOverwriteTitle"),
      content: t("executionFactory.functionTemplateOverwriteContent"),
      okButtonProps: { danger: true },
      okText: t("executionFactory.functionTemplateOverwriteOk"),
      cancelText: t("common.cancel"),
      onOk: () => patchActive({ code: FUNCTION_TEMPLATES[id] }),
    });
  };

  /** Re-derive when code has changed since the last derivation, or has never been derived. */
  const needsDerive = (item: WorkbenchFunction) =>
    Boolean(item.code.trim()) && derivedCodeRef.current[item.key] !== item.code;

  const handleRun = async () => {
    if (!active) {
      return;
    }

    const runKey = active.key;

    setRunning(true);
    setRunError(null);
    setRunResult(null);
    setConsoleCollapsed(false);

    try {
      // Re-derive changed code before execution to avoid sending stale parameters.
      let inputs = active.inputs;
      if (needsDerive(active)) {
        const derived = await handleDeriveParams({ silent: true });
        if (derived) {
          inputs = derived;
        }
      }

      let payloadText = eventText;
      const isBlankShell = !payloadText.trim() || payloadText.trim() === "{}";
      // Regenerate an empty or untouched auto-generated sample from the current contract, while
      // preserving manually edited input.
      const untouchedAuto = payloadText.trim() === autoEventRef.current.trim();
      if (isBlankShell || untouchedAuto) {
        payloadText = buildSampleEvent(inputs);
        autoEventRef.current = payloadText;
        setEventText(payloadText);
      }

      let event: Record<string, unknown> | undefined;
      if (payloadText.trim()) {
        event = JSON.parse(payloadText) as Record<string, unknown>;
      }

      // Send dependencies with the execution request. Sandbox images do not preinstall third-
      // party packages, while the published agent path installs them from persisted metadata.
      // Keep the installation notice visible for the entire run because dependency installs can
      // take up to the extended 330-second timeout.
      if (active.dependencies.some((item) => item.name?.trim())) {
        void message.info({
          content: t("executionFactory.workbenchInstallingDependencies"),
          duration: 0,
          key: DEPENDENCY_HINT_KEY,
        });
      }

      const result = await executeFunction({
        code: active.code,
        dependencies: active.dependencies,
        event,
      });

      // Users can switch functions while a long execution runs. Only apply its result to the
      // function that initiated it.
      if (runKey !== activeKeyRef.current) {
        return;
      }

      setRunResult(result);
      setOutTab(result.error ? "stderr" : "result");
    } catch (error) {
      if (runKey !== activeKeyRef.current) {
        return;
      }

      setRunError(extractRequestErrorMessage(error));
      setOutTab("stderr");
    } finally {
      message.destroy(DEPENDENCY_HINT_KEY);
      setRunning(false);
    }
  };

  /**
   * Rebuild test input from declared parameters. This explicit action always replaces the
   * contents with a clean sample. It replaces the former focus-triggered behavior, which could
   * overwrite manual edits or fail to fill input after derivation.
   */
  const handleFillSampleEvent = async () => {
    if (!active) {
      return;
    }

    let inputs = active.inputs;
    if (needsDerive(active)) {
      // This explicit action must surface derivation failures. Keep the current input unchanged
      // rather than silently replacing it with stale parameters.
      const derived = await handleDeriveParams();
      if (!derived) {
        return;
      }

      inputs = derived;
    }

    const next = buildSampleEvent(inputs);
    autoEventRef.current = next;
    setEventText(next);
  };

  const sampleEvent = useMemo(() => buildSampleEvent(active?.inputs), [active?.inputs]);
  // The JSON view shows the schema received by agents, not the internal parameter structure.
  const paramsJsonPreview = useMemo(() => {
    const schema = buildJsonSchemaFromParameters(
      ioTab === "inputs" ? active?.inputs : active?.outputs,
    );
    return schema ? JSON.stringify(schema, null, 2) : "{}";
  }, [active?.inputs, active?.outputs, ioTab]);

  const eventSchema = useMemo(
    () => buildJsonSchemaFromParameters(active?.inputs),
    [active?.inputs],
  );

  useEffect(() => {
    // 用户动过测试入参就别再覆盖；只在还是上次自动生成的内容时才跟着参数走。
    setEventText((current) => {
      if (current.trim() && current !== autoEventRef.current) {
        return current;
      }

      autoEventRef.current = sampleEvent;
      return sampleEvent;
    });
  }, [sampleEvent]);

  const visibleFunctions = useMemo(() => {
    const keyword = railKeyword.trim().toLowerCase();
    return keyword
      ? functions.filter((item) => item.name.toLowerCase().includes(keyword))
      : functions;
  }, [functions, railKeyword]);

  const basicInfoItems = useMemo(
    () =>
      toolbox
        ? buildToolboxBasicInfoItems(toolbox, {
            t,
            auditUserDirectory,
            toolCount: functions.length || toolbox.toolCount || 0,
          })
        : [],
    [auditUserDirectory, functions.length, t, toolbox],
  );

  if (loading) {
    return (
      <div className={styles.centered}>
        <Spin size="large" />
      </div>
    );
  }

  if (loadError) {
    return <Alert message={loadError} showIcon type="error" />;
  }

  return (
    <div className={styles.app}>
      <div className={styles.bar}>
        <button
          aria-label={t("common.back")}
          className={styles.backButton}
          onClick={handleBack}
          type="button"
        >
          <ArrowLeftOutlined />
        </button>
        <span className={styles.titleIcon}>
          <CodeOutlined />
        </span>
        <div className={styles.titleMain}>
          {/* 工具箱改名统一走工具箱编辑表单（卡片菜单「编辑」入口），工作台标题只读。 */}
          <h1 className={styles.titleEditable}>{boxName || t("executionFactory.toolboxName")}</h1>
          <div className={styles.titleMeta}>
            {/*
              不放「函数」「Python」标签：前者与页头 Code 图标、工作台本身重复，
              后者是写死的 script_type，全平台没有第二种语言。只留真会变的发布状态。
            */}
            <Tag color={toolbox?.status === "published" ? "green" : "default"}>
              {t(`executionFactory.toolboxStatuses.${toolbox?.status ?? "unpublish"}`)}
            </Tag>
          </div>
        </div>
        <div className={styles.barActions}>
          {/* 保存挪到代码区工具条，与「接口参数」同排；页头只剩基础信息入口。
              函数工具箱保存即对 Agent 生效；发布/下线走列表卡片的生命周期菜单。 */}
          <DetailBasicInfoButton items={basicInfoItems} />
        </div>
      </div>

      {toolbox ? (
        <div className={styles.subline}>
          {toolbox.description ? <span>{toolbox.description}</span> : null}
          <span>
            <ThunderboltOutlined />{" "}
            {t("executionFactory.toolCountLabel", { count: functions.length })}
          </span>
          <span>
            <ClockCircleOutlined /> {formatOptionalTimestamp(toolbox.updateTime)}
          </span>
          {toolbox.updateUser ? (
            <span>
              <UserOutlined />{" "}
              {formatAuditUserDisplay({ directory: auditUserDirectory, id: toolbox.updateUser })}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* 批量操作栏放在列表区上方全宽处，窄侧栏放不下会换行。与工具箱工具列表同一处理。 */}
      {selectedKeys.length > 0 ? (
        <div className={styles.batchBar}>
          <span>
            {t("executionFactory.toolBatchSelectedCount", { count: selectedKeys.length })}
          </span>
          <span className={styles.batchBarActions}>
            <AppButton onClick={() => setSelectedKeys([])} size="small">
              {t("common.cancel")}
            </AppButton>
            <PermissionGate permissions="execution-factory:tool:edit">
              {/*
                保存期间锁住：还没落库的函数扳状态只改本地 status，而 persistFunction
                建工具用的是保存开始那一刻的快照状态，保存途中翻转会被静默吞掉。
                与右侧单个开关同口径。
              */}
              <AppButton
                disabled={saving}
                onClick={() => handleBatchStatus("enabled")}
                size="small"
              >
                {t("executionFactory.enable")}
              </AppButton>
              <AppButton
                disabled={saving}
                onClick={() => handleBatchStatus("disabled")}
                size="small"
              >
                {t("executionFactory.disable")}
              </AppButton>
              <AppButton
                danger
                disabled={saving}
                icon={<DeleteOutlined />}
                onClick={handleBatchDelete}
                size="small"
              >
                {t("common.delete")}
              </AppButton>
            </PermissionGate>
          </span>
        </div>
      ) : null}

      <div className={styles.body}>
        <div className={styles.rail}>
          <EntityListRail
            activeId={activeKey}
            emptyText={t("executionFactory.workbenchFunctionListEmptyFiltered")}
            footer={
              <PermissionGate permissions="execution-factory:tool:create">
                <AppButton
                  block
                  className={styles.railAdd}
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const created = emptyFunction(DEFAULT_FUNCTION_TEMPLATE);
                    setFunctions((current) => [...current, created]);
                    setActiveKey(created.key);
                    setRunResult(null);
                  }}
                >
                  {t("executionFactory.workbenchNewFunction")}
                </AppButton>
              </PermissionGate>
            }
            icon={<BarsOutlined />}
            items={visibleFunctions.map((item) => ({
              /*
                只画后端 function_content 里真回来的 script_type。写死 "Python" 是
                前端凭空生成的展示值，也和本页页头「不放写死的 Python 标签」自相矛盾；
                未落库的新函数还没有这个值，那就不画。
              */
              badge: item.scriptType ? (
                <span className={styles.langBadge}>{formatScriptType(item.scriptType)}</span>
              ) : null,
              id: item.key,
              muted: item.status === "disabled",
              name: item.name || t("executionFactory.workbenchUnnamedFunction"),
              status: {
                checked: item.status === "enabled",
                disabled: saving,
                label: t(`executionFactory.toolStatuses.${item.status}`),
                onChange: () => handleToggleStatus(item),
              },
              tags: (
                <>
                  <EntityListTag>
                    {t("executionFactory.ioInCount", { count: item.inputs.length })}
                  </EntityListTag>
                  <EntityListTag>
                    {t("executionFactory.ioOutCount", { count: item.outputs.length })}
                  </EntityListTag>
                  {item.dirty ? (
                    <EntityListTag variant="warning">
                      {t("executionFactory.workbenchUnsaved")}
                    </EntityListTag>
                  ) : null}
                </>
              ),
            }))}
            onSelect={(key) => {
              const target = functions.find((item) => item.key === key);
              if (!target) {
                return;
              }
              setActiveKey(key);
              setRunResult(null);
              setRunError(null);
              const next = buildSampleEvent(target.inputs);
              autoEventRef.current = next;
              setEventText(next);
            }}
            onToggleSelect={toggleFunctionSelection}
            search={{
              onChange: setRailKeyword,
              placeholder: t("executionFactory.workbenchFilterFunctions"),
              value: railKeyword,
            }}
            selectable
            selectedIds={selectedKeys}
            statusPermission="execution-factory:tool:edit"
            title={t("executionFactory.workbenchFunctionList", { count: functions.length })}
          />
        </div>

        <div className={styles.main}>
          {active ? (
            <>
              <div className={styles.fnHead}>
                <div className={styles.fnHeadBar}>
                  <span className={styles.fnHeadTitle}>
                    <span className={styles.fxBadge}>fx</span>
                    <InlineEditableText
                      autoEdit={!active.toolId && !active.name}
                      className={styles.fnHeadFx}
                      emptyLabel={t("executionFactory.workbenchClickToName")}
                      key={active.key}
                      onChange={(name) => patchActive({ name })}
                      placeholder="high_value_customers"
                      value={active.name}
                    />
                  </span>
                  <span className={styles.fnHeadActions}>
                    <PermissionGate permissions="execution-factory:tool:edit">
                      <Tooltip title={t("executionFactory.workbenchStatusHint")}>
                        <span className={styles.fnStatusToggle}>
                          <Switch
                            checked={active.status === "enabled"}
                            /*
                             * Lock toggles while saving. Local-only status changes would not be
                             * reflected in the creation snapshot and could diverge from the server.
                             */
                            disabled={saving}
                            onChange={() => handleToggleStatus(active)}
                            size="small"
                          />
                          <span
                            className={
                              active.status === "enabled"
                                ? styles.fnStatusOn
                                : styles.fnStatusOff
                            }
                          >
                            {t(`executionFactory.toolStatuses.${active.status}`)}
                          </span>
                        </span>
                      </Tooltip>
                    </PermissionGate>
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: "duplicate",
                            label: t("executionFactory.workbenchDuplicateFunction"),
                            onClick: () => handleDuplicateFunction(active),
                          },
                          {
                            key: "delete",
                            danger: true,
                            label: t("executionFactory.workbenchDeleteFunction"),
                            onClick: () => handleDeleteFunction(active),
                          },
                        ],
                      }}
                      trigger={["click"]}
                    >
                      <AppButton
                        aria-label={t("executionFactory.cardMenu.more")}
                        icon={<EllipsisOutlined />}
                        type="text"
                      />
                    </Dropdown>
                  </span>
                </div>
                <div className={styles.fnHeadDesc}>
                  <InlineEditableText
                    block
                    emptyLabel={t("executionFactory.workbenchAddDescription")}
                    multiline
                    onChange={(description) => patchActive({ description })}
                    placeholder={t("executionFactory.workbenchDescriptionPlaceholder")}
                    rows={2}
                    value={active.description}
                  />
                </div>
              </div>
              {/*
                停用横幅移出 .fnHead：头部高度被那条贯穿分隔线钉死了（见
                --entity-rail-head-height），横幅留在里面会把内容顶到线下面去。
              */}
              {active.status === "disabled" ? (
                <Alert
                  banner
                  message={t("executionFactory.workbenchDisabledBanner")}
                  type="warning"
                />
              ) : null}

              <div className={styles.editorArea}>
                <div className={styles.editor}>
                  <div className={styles.editorBar}>
                    <span className={styles.editorIcon}>
                      <ThunderboltOutlined />
                    </span>
                    <span className={styles.editorTitle}>
                      {t("executionFactory.functionLogic")}
                    </span>
                    <div className={styles.editorTools}>
                      <Dropdown
                        menu={{
                          items: (["standard", "pydantic"] as FunctionTemplateId[]).map((id) => ({
                            key: id,
                            label: (
                              <span className={styles.templateOption}>
                                <span className={styles.templateOptionTitle}>
                                  {t(`executionFactory.functionTemplates.${id}.title`)}
                                </span>
                                <span className={styles.templateOptionDesc}>
                                  {t(`executionFactory.functionTemplates.${id}.desc`)}
                                </span>
                              </span>
                            ),
                            onClick: () => applyTemplate(id),
                          })),
                        }}
                      >
                        <AppButton icon={<FileTextOutlined />}>
                          {t("executionFactory.functionInsertTemplate")}
                        </AppButton>
                      </Dropdown>
                      {hasDefaultLlm ? (
                        <AppButton
                          icon={<ThunderboltOutlined />}
                          onClick={() => setAiOpen(true)}
                          type="primary"
                        >
                          {t("executionFactory.functionAiGenerate")}
                        </AppButton>
                      ) : null}
                      <span className={styles.toolsDivider} />
                      <AppButton
                        icon={<ProfileOutlined />}
                        onClick={() => {
                          setDockTab("params");
                          if (needsDerive(active)) {
                            void handleDeriveParams();
                          }
                        }}
                      >
                        {t("executionFactory.workbenchParamsTab")}
                        <span
                          className={`${styles.toolCount} ${
                            active.inputs.length === 0 ? styles.toolCountEmpty : ""
                          }`}
                        >
                          {active.inputs.length + active.outputs.length}
                        </span>
                      </AppButton>
                      {SHOW_DEPENDENCY_DOCK ? (
                        <AppButton icon={<AppstoreOutlined />} onClick={() => setDockTab("deps")}>
                          {t("executionFactory.workbenchDepsTab")}
                          <span className={styles.toolCount}>{active.dependencies.length}</span>
                        </AppButton>
                      ) : null}
                      {/*
                        保存挪到这里：改动几乎都发生在代码区，原来放在页头意味着每写完
                        一段就要把视线甩到屏幕最上面。注意它保存的是整个工具箱（箱名、
                        分类和全部函数），不是当前这一个函数——所以「未保存」角标跟着它，
                        统计的也是全部函数。
                      */}
                      <span className={styles.toolsDivider} />
                      {hasUnsavedChanges ? (
                        <span className={styles.dirtyBadge}>
                          {t("executionFactory.workbenchDirty")}
                        </span>
                      ) : null}
                      <PermissionGate permissions="execution-factory:tool:edit">
                        <AppButton
                          disabled={!hasUnsavedChanges}
                          loading={saving}
                          onClick={() => void handleSaveDraft()}
                          type={hasUnsavedChanges ? "primary" : "default"}
                        >
                          {t("common.save")}
                        </AppButton>
                      </PermissionGate>
                    </div>
                  </div>
                  <div className={styles.editorSurface}>
                    <CodeEditor
                      height="fill"
                      language="python"
                      onChange={(code) => patchActive({ code })}
                      value={active.code}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.console}>
                <div
                  className={styles.consoleHead}
                  onClick={() => setConsoleCollapsed((current) => !current)}
                  role="presentation"
                >
                  {consoleCollapsed ? <DownOutlined /> : <UpOutlined />}
                  <span className={styles.consoleTitle}>
                    {t("executionFactory.workbenchConsoleTitle")}
                  </span>
                  <span className={styles.consoleNote}>
                    {t("executionFactory.workbenchConsoleNote")}
                  </span>
                  <span className={styles.consoleRun}>
                    <PermissionGate permissions="execution-factory:tool:debug">
                      <Tooltip title={t("executionFactory.workbenchRunShortcut")}>
                        <AppButton
                          className={styles.runButton}
                          icon={<PlayCircleFilled />}
                          loading={running}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            void handleRun();
                          }}
                          type="primary"
                        >
                          {t("executionFactory.workbenchRun")}
                        </AppButton>
                      </Tooltip>
                    </PermissionGate>
                  </span>
                </div>
                {consoleCollapsed ? null : (
                  <div className={styles.consoleInner}>
                    <div className={styles.consolePane}>
                      <span className={styles.consoleCaption}>
                        {t("executionFactory.workbenchEventCaption")}
                        <span className={styles.consoleCaptionHint}>
                          {t(
                            active.inputs.length > 0
                              ? "executionFactory.workbenchEventAuto"
                              : "executionFactory.workbenchEventEmpty",
                          )}
                        </span>
                        <AppButton
                          disabled={running}
                          loading={deriving}
                          onClick={() => void handleFillSampleEvent()}
                          size="small"
                          type="link"
                        >
                          {t("executionFactory.workbenchEventFill")}
                        </AppButton>
                      </span>
                      <div className={styles.eventEditor}>
                        <CodeEditor
                          height={200}
                          jsonSchema={eventSchema}
                          language="json"
                          onChange={setEventText}
                          value={eventText}
                        />
                      </div>
                    </div>
                    <div className={styles.consolePane}>
                      <div className={styles.tabStrip}>
                        {(["result", "stdout", "stderr", "metrics"] as OutputTab[]).map((tab) => (
                          <button
                            className={`${styles.tab} ${outTab === tab ? styles.tabActive : ""}`}
                            key={tab}
                            onClick={() => setOutTab(tab)}
                            type="button"
                          >
                            <span
                              className={styles.tabDot}
                              style={{ background: OUT_TAB_COLORS[tab] }}
                            />
                            {t(`executionFactory.workbenchOutTabs.${tab}`)}
                          </button>
                        ))}
                      </div>
                      <RunOutput error={runError} result={runResult} tab={outTab} />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.centered}>{t("executionFactory.workbenchNoFunction")}</div>
          )}
        </div>
      </div>

      <Drawer
        extra={
          <AppButton
            icon={<ReloadOutlined />}
            loading={deriving}
            onClick={() => void handleDeriveParams()}
          >
            {t("executionFactory.functionDeriveParams")}
          </AppButton>
        }
        onClose={() => setDockTab(null)}
        open={dockTab === "params"}
        title={t("executionFactory.workbenchParamsTab")}
        width={480}
      >
        <div className={styles.segmented}>
          <button
            className={`${styles.segment} ${ioTab === "inputs" ? styles.segmentActive : ""}`}
            onClick={() => setIoTab("inputs")}
            type="button"
          >
            {t("executionFactory.functionInputs")} · {active?.inputs.length ?? 0}
          </button>
          <button
            className={`${styles.segment} ${ioTab === "outputs" ? styles.segmentActive : ""}`}
            onClick={() => setIoTab("outputs")}
            type="button"
          >
            {t("executionFactory.functionOutputs")} · {active?.outputs.length ?? 0}
          </button>
        </div>
        <div className={styles.paramsViewSwitch}>
          <button
            className={`${styles.segment} ${paramsView === "form" ? styles.segmentActive : ""}`}
            onClick={() => setParamsView("form")}
            type="button"
          >
            {t("executionFactory.workbenchParamsViewForm")}
          </button>
          <button
            className={`${styles.segment} ${paramsView === "json" ? styles.segmentActive : ""}`}
            onClick={() => setParamsView("json")}
            type="button"
          >
            {t("executionFactory.workbenchParamsViewJson")}
          </button>
        </div>
        {paramsView === "form" ? (
          <FunctionParameterTree
            addLabel={t(
              ioTab === "inputs"
                ? "executionFactory.addInputParameter"
                : "executionFactory.addOutputParameter",
            )}
            emptyText={t("executionFactory.workbenchNoParameters")}
            onChange={(next) =>
              patchActive(ioTab === "inputs" ? { inputs: next } : { outputs: next })
            }
            value={ioTab === "inputs" ? active?.inputs : active?.outputs}
          />
        ) : (
          <CodeEditor
            height={360}
            language="json"
            readOnly
            value={paramsJsonPreview}
          />
        )}
        <div className={styles.dockHint}>{t("executionFactory.workbenchParamsHint")}</div>
      </Drawer>

      {SHOW_DEPENDENCY_DOCK ? (
        <Drawer
          onClose={() => setDockTab(null)}
          open={dockTab === "deps"}
          title={t("executionFactory.workbenchDepsTab")}
          width={480}
        >
          <FunctionDependencyPanel
            onChange={(dependencies) => patchActive({ dependencies })}
            value={active?.dependencies ?? []}
          />
        </Drawer>
      ) : null}

      <FunctionAiGenerateModal
        initialCode={active?.code}
        onApply={(result) => {
          if (result.type === "code") {
            patchActive({ code: result.code });
            return;
          }

          patchActive({
            ...(result.name ? { name: result.name } : {}),
            ...(result.description ? { description: result.description } : {}),
            ...(result.useRule ? { useRule: result.useRule } : {}),
            ...(result.inputs ? { inputs: result.inputs } : {}),
            ...(result.outputs ? { outputs: result.outputs } : {}),
          });
          setDockTab("params");
        }}
        onClose={() => setAiOpen(false)}
        open={aiOpen}
      />

    </div>
  );
}

function RunOutput({
  error,
  result,
  tab,
}: {
  error: string | null;
  result: FunctionExecuteResult | null;
  tab: OutputTab;
}) {
  const { t } = useTranslation();

  if (error) {
    return <pre className={`${styles.outBody} ${styles.outError}`}>{error}</pre>;
  }

  if (!result) {
    return (
      <pre className={styles.outBody}>
        <span className={styles.outEmpty}>{t("executionFactory.workbenchConsoleEmpty")}</span>
      </pre>
    );
  }

  if (tab === "metrics") {
    // Do not render placeholders for metrics omitted by the backend.
    const metrics = (
      [
        ["duration", result.metrics?.durationMs ?? result.durationMs, "ms"],
        ["cpuTime", result.metrics?.cpuTimeMs, "ms"],
        ["memoryPeak", result.metrics?.memoryPeakMb, "MB"],
        ["exitCode", result.exitCode, ""],
      ] as const
    ).filter(([, value]) => value !== undefined);

    if (metrics.length === 0) {
      return (
        <pre className={styles.outBody}>
          <span className={styles.outEmpty}>{t("executionFactory.workbenchMetricsAbsent")}</span>
        </pre>
      );
    }

    return (
      <div className={`${styles.outBody} ${styles.metrics}`}>
        {metrics.map(([key, value, unit]) => (
          <div className={styles.metric} key={key}>
            <div className={styles.metricValue}>
              {formatMetricValue(value)}
              {unit ? <span className={styles.metricUnit}> {unit}</span> : null}
            </div>
            <div className={styles.metricLabel}>
              {t(`executionFactory.workbenchMetrics.${key}`)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tab === "stdout" || tab === "stderr") {
    const value = tab === "stdout" ? result.stdout : result.stderr;
    const fallback = tab === "stderr" ? result.error : undefined;
    const text = value ?? fallback;

    return (
      <pre className={`${styles.outBody} ${tab === "stderr" ? styles.outError : ""}`}>
        {text ?? (
          <span className={styles.outEmpty}>
            {t("executionFactory.workbenchStreamAbsent")}
          </span>
        )}
      </pre>
    );
  }

  return (
    <pre className={styles.outBody}>
      {result.output === undefined
        ? <span className={styles.outEmpty}>{t("executionFactory.workbenchStreamAbsent")}</span>
        : JSON.stringify(result.output, null, 2)}
    </pre>
  );
}
