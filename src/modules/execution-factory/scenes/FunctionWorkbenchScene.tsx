/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  DownOutlined,
  EllipsisOutlined,
  FileTextOutlined,
  PlayCircleFilled,
  PlusOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { Alert, Drawer, Dropdown, Input, Select, Spin, Switch, Tag, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { CodeEditor } from "@/modules/execution-factory/components/CodeEditor";
import { FunctionAiGenerateModal } from "@/modules/execution-factory/components/FunctionAiGenerateModal";
import { FunctionParameterTree } from "@/modules/execution-factory/components/FunctionParameterTree";
import { InlineEditableText } from "@/modules/execution-factory/components/InlineEditableText";
import { listOperatorCategories } from "@/modules/execution-factory/services/category.service";
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
  updateToolboxStatus,
} from "@/modules/execution-factory/services/toolbox.service";
import type { FunctionExecuteResult } from "@/modules/execution-factory/types/function";
import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";
import type { ToolStatus } from "@/modules/execution-factory/types/tool";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
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

/** 函数工具箱按设计就是小集合；真超了这个数说明该拆工具箱，不为它做分页。 */
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
  /** 禁用的函数代码照样能编辑调试，只是 Agent 调不到（后端 execute 直接拒）。 */
  status: ToolStatus;
  /** 没有 toolId 表示还没落库。 */
  toolId?: string;
  useRule: string;
};

/**
 * 只比较会落库的字段,用来判断「保存期间用户又改了这一项没有」。
 * key/toolId/dirty/status 不参与:前两个正是保存要写回的,status 走的是独立接口。
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

type OutputTab = "result" | "stdout" | "stderr" | "metrics";

const OUT_TAB_COLORS: Record<OutputTab, string> = {
  result: "#16a34a",
  stdout: "#2563eb",
  stderr: "#dc2626",
  metrics: "#7c3aed",
};

/**
 * 指标数值取整。
 *
 * 后端回的是浮点原值（57.9810839844），原样渲染会在窄卡片里折成两行，
 * 把整排卡片的高度顶起来。耗时这类量级，两位小数已经够看。
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
    // 在这个页面里新建函数就是奔着给 Agent 用去的，默认可调用。
    // 后端建工具一律落 disabled（toolbox_create.go:260），所以保存时要显式扳回来。
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
  const [boxCategory, setBoxCategory] = useState<string | undefined>();
  const [categoryOptions, setCategoryOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [functions, setFunctions] = useState<WorkbenchFunction[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [railKeyword, setRailKeyword] = useState("");
  const [dockTab, setDockTab] = useState<"params" | "deps" | null>(null);
  const [ioTab, setIoTab] = useState<"inputs" | "outputs">("inputs");
  const [aiOpen, setAiOpen] = useState(false);
  const [hasDefaultLlm, setHasDefaultLlm] = useState(false);
  const [paramsView, setParamsView] = useState<"form" | "json">("form");
  const [deriving, setDeriving] = useState(false);
  /** 每个函数上次识别参数时用的代码；代码变了说明契约可能过期，要重推。 */
  const derivedCodeRef = useRef<Record<string, string>>({});

  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [eventText, setEventText] = useState("{}");
  /** 记住上次自动生成的内容，用来判断用户是否手改过。 */
  const autoEventRef = useRef("{}");
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

  // AI 生成要调默认大模型；没配就别把按钮摆出来让人点了报错。
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
    void (async () => {
      try {
        const items = await listOperatorCategories();
        setCategoryOptions(items.map((item) => ({ label: item.name, value: item.categoryType })));
      } catch {
        setCategoryOptions([]);
      }
    })();
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

  const handleBack = () => {
    const leave = () => {
      if (onBack) {
        onBack();
        return;
      }

      // 函数工作台只可能从「函数集」进来，回退别落到 API 工具集。
      void navigate("/execution-factory/units?activeTab=toolbox&toolboxView=function");
    };

    // 这里丢的不是表单里一两个字段，是整个函数体——草稿只在内存里，退出去就没了。
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
    async (item: WorkbenchFunction, onCreated?: (toolId: string) => void) => {
      const functionInput = {
        code: item.code,
        description: item.description,
        inputs: item.inputs,
        name: item.name,
        outputs: item.outputs,
        script_type: "python" as const,
        // 后端只在 code 非空时才更新整段元数据，所以每次都要带上完整结构。
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

      // 工具已经落库了，先把 id 交给调用方记下来：下面扳状态那一步再抛错，也不能让
      // 这个 id 丢掉——丢了重试就会对同一个函数再建一遍（撞重名则永远存不下去）。
      onCreated?.(createdId);

      // 后端建工具一律落 disabled，而 execute 只放行 enabled（execute.go:142）。
      // 不在这里扳回来的话，新写的函数发布了 Agent 也调不到。
      if (item.status === "enabled") {
        await updateToolStatus(boxId, [createdId], "enabled");
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

    // 保存期间编辑器并不上锁,用户还能改代码、还能新建函数。所以不能拿点击那一刻的
    // functions 快照整体 setFunctions 覆盖回去——那会连同这期间的改动和 dirty 标记
    // 一起抹掉。改成按 key 把「这一轮真落库了的项」合并进最新 state。
    const persisted = new Map<string, { snapshot: WorkbenchFunction; toolId: string }>();

    // 中途抛错也必须把已经建好的 toolId 写回去:createTool 那几项其实已经落库了,
    // state 里还留着 toolId: undefined 的话,用户重试会对同一个函数再建一遍——
    // 后端不校验重名就多出重复工具,校验了就每次都撞名、这个函数再也存不下去。
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

          // 落库期间用户又改了这一项 → 认下 toolId 但保留 dirty,别把没存的新改动
          // 标成已保存。
          return {
            ...item,
            dirty: !isSamePersistedContent(item, hit.snapshot),
            key: hit.toolId,
            toolId: hit.toolId,
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

        const toolId = await persistFunction(item, (createdId) => {
          persisted.set(item.key, { snapshot: item, toolId: createdId });
        });
        persisted.set(item.key, { snapshot: item, toolId });
      }
    } finally {
      flushPersisted();
    }
  }, [functions, persistFunction, saveToolboxMeta]);

  /**
   * 启用 / 禁用。已落库的立刻调接口（跟 ToolboxToolsScene 的工具状态开关同口径，
   * 确认框也用同一套措辞）；没落库的只改本地，保存时由 persistFunction 落下去。
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
   * 复制一份到本地，不落库——照着现成函数改出下一个是这里最常见的起手式。
   * 名字在工具箱内要唯一，所以加后缀；复制品一律从禁用起步，避免半成品被 Agent 撞上。
   */
  const handleDuplicateFunction = (target: WorkbenchFunction) => {
    const copy: WorkbenchFunction = {
      ...target,
      // 参数树是嵌套结构，浅拷贝会让副本和原函数共享同一批节点，改一个动两个。
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
   * 删函数。还没落库的（无 toolId）只从本地列表摘掉，不打接口。
   * 删完把焦点挪到相邻一项，避免右侧编辑区空掉；全删光则补一个空白函数，
   * 保持「进来就能写」的初始态。
   */
  const handleDeleteFunction = (target: WorkbenchFunction) => {
    const runDelete = async () => {
      try {
        if (target.toolId) {
          await deleteTools(boxId, [target.toolId]);
        }

        setFunctions((current) => {
          const index = current.findIndex((item) => item.key === target.key);
          const rest = current.filter((item) => item.key !== target.key);

          if (rest.length === 0) {
            const placeholder = emptyFunction(DEFAULT_FUNCTION_TEMPLATE);
            setActiveKey(placeholder.key);
            return [placeholder];
          }

          if (target.key === activeKey) {
            setActiveKey(rest[Math.min(index, rest.length - 1)].key);
          }

          return rest;
        });

        delete derivedCodeRef.current[target.key];
        setRunResult(null);
        setRunError(null);

        if (target.toolId) {
          void message.success(t("common.success"));
        }
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      }
    };

    // 没落库的空壳没什么可确认的，直接扔掉。
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

  /**
   * 发布前体检。名称/描述/代码缺失只提示不硬拦，让人自己决定要不要带病上线。
   * 已发布的箱子保存即生效，所以那条路径也走同一套体检。
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

  const handlePublish = async () => {
    const confirmed = await confirmPublishIssues({
      okText: t("executionFactory.publish"),
      title: t("executionFactory.toolboxStatusChangeConfirmTitle"),
    });

    if (!confirmed) {
      return;
    }

    setPublishing(true);
    try {
      await saveAll();
      await updateToolboxStatus(boxId, "published");
      setToolbox((current) => (current ? { ...current, status: "published" } : current));
      void message.success(t("common.success"));
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  /**
   * 让后端从代码推导契约：确定性比 AI 生成器高，也不烧模型额度。
   * 返回推导出的入参，方便调用方（比如「运行」）立刻拿来造测试入参，
   * 不用等 state 回流。silent 用于隐式触发，避免每次运行都弹一次成功提示。
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
        // supported 的推导对契约是权威的:零参函数后端会给 [] 或省略字段,两种都
        // 得把 inputs 落成 []。用 `inferred.inputs ?` 守卫会让"省略=undefined"漏过,
        // active.inputs 卡在上个函数的旧参,测试入参框跟着刷不掉(见 handleRun 注释)。
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

  // 刷新 / 关标签页走不到 handleBack 的确认框，单独挂一次 beforeunload 兜住。
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome 要求显式设 returnValue 才会弹原生确认框，文案由浏览器决定。
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

  /** 模版会整段替换代码；用户已经写过东西时先问一句，别默默抹掉。 */
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

  /** 代码相对上次识别有变化（或从没识别过）就该重推一次。 */
  const needsDerive = (item: WorkbenchFunction) =>
    Boolean(item.code.trim()) && derivedCodeRef.current[item.key] !== item.code;

  const handleRun = async () => {
    if (!active) {
      return;
    }

    setRunning(true);
    setRunError(null);
    setRunResult(null);
    setConsoleCollapsed(false);

    try {
      // 代码改过就先重推一次契约，避免拿过期参数去跑。没改过则不打这一趟。
      let inputs = active.inputs;
      if (needsDerive(active)) {
        const derived = await handleDeriveParams({ silent: true });
        if (derived) {
          inputs = derived;
        }
      }

      let payloadText = eventText;
      const isBlankShell = !payloadText.trim() || payloadText.trim() === "{}";
      // 空壳,或框里还是上次自动生成的样例(用户没手改)→ 按最新契约重造,免得
      // 改了参数后拿改前的旧入参去跑。用户手动改过的入参保持不动。
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

      // 依赖得跟着这次执行一起发过去：沙箱镜像不预装三方库，而保存后 Agent 那条
      // 路径是从库里读依赖装的。这里不带的话就会出现"调试报 ModuleNotFoundError、
      // 发布后反而能跑"，用户只会以为自己函数写错了。
      if (active.dependencies.some((item) => item.name?.trim())) {
        void message.info(t("executionFactory.workbenchInstallingDependencies"));
      }

      const result = await executeFunction({
        code: active.code,
        dependencies: active.dependencies,
        event,
      });
      setRunResult(result);
      setOutTab(result.error ? "stderr" : "result");
    } catch (error) {
      setRunError(extractRequestErrorMessage(error));
      setOutTab("stderr");
    } finally {
      setRunning(false);
    }
  };

  /**
   * 按已声明参数重造一份测试入参。这是显式动作，所以无条件覆盖——用户点它就是
   * 想要一份干净样例。
   *
   * 原来挂在入参框的 onFocus 上，有两个毛病：点进去想手改反而被覆盖；而且代码
   * 改过时那条分支推导完就直接 return、这一次并不填，指望后面的 effect 补，可
   * effect 又把「内容 ≠ 上次自动值」判成用户手改而拒绝覆盖，两边互相让，结果谁
   * 都不填，表现就是「点了半天填不出来」。
   */
  const handleFillSampleEvent = async () => {
    if (!active) {
      return;
    }

    let inputs = active.inputs;
    if (needsDerive(active)) {
      const derived = await handleDeriveParams({ silent: true });
      if (derived) {
        inputs = derived;
      }
    }

    const next = buildSampleEvent(inputs);
    autoEventRef.current = next;
    setEventText(next);
  };

  const sampleEvent = useMemo(() => buildSampleEvent(active?.inputs), [active?.inputs]);
  // JSON 视图给的就是 Agent 实际拿到的 schema，不是我们内部的参数结构。
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
          <ThunderboltOutlined />
        </span>
        <div className={styles.titleMain}>
          <InlineEditableText
            className={styles.titleEditable}
            emptyLabel={t("executionFactory.toolboxName")}
            onChange={setBoxName}
            placeholder={t("executionFactory.toolboxName")}
            value={boxName}
          />
          <div className={styles.titleMeta}>
            <Tag color="blue">{t("executionFactory.metadataTypes.function")}</Tag>
            <Tag>Python</Tag>
            <Tag color={toolbox?.status === "published" ? "green" : "default"}>
              {t(`executionFactory.toolboxStatuses.${toolbox?.status ?? "unpublish"}`)}
            </Tag>
            <Select
              className={styles.categorySelect}
              onChange={setBoxCategory}
              options={categoryOptions}
              placeholder={t("executionFactory.category")}
              style={{ minWidth: 116 }}
              value={boxCategory}
              variant="borderless"
            />
          </div>
        </div>
        <div className={styles.barActions}>
          {hasUnsavedChanges ? (
            <span className={styles.dirtyBadge}>{t("executionFactory.workbenchDirty")}</span>
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
          {/*
            已发布的工具箱没有「重新发布」这回事：后端状态机不允许 published → published
            （status_manage.go 的 statusTransitions），而工具改动保存即对 Agent 生效，
            本来也不需要再发一次。所以这里只在未发布/已下架时给发布按钮。
          */}
          {isPublished ? (
            <Tooltip title={t("executionFactory.workbenchPublishedLiveHint")}>
              <span className={styles.publishedHint}>
                {t("executionFactory.workbenchPublishedLive")}
              </span>
            </Tooltip>
          ) : (
            <PermissionGate permissions="execution-factory:toolbox:edit">
              <AppButton
                loading={publishing}
                onClick={() => void handlePublish()}
                type="primary"
              >
                {t("executionFactory.publish")}
              </AppButton>
            </PermissionGate>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.rail}>
          <div className={styles.railHead}>
            <div className={styles.railTitle}>
              <span>{t("executionFactory.workbenchFunctionList")}</span>
              <span>{functions.length}</span>
            </div>
            <Input
              allowClear
              onChange={(event) => setRailKeyword(event.target.value)}
              placeholder={t("executionFactory.workbenchFilterFunctions")}
              prefix={<SearchOutlined />}
              value={railKeyword}
            />
          </div>
          <div className={styles.railList}>
            {visibleFunctions.map((item) => (
              <button
                className={`${styles.railItem} ${
                  item.key === activeKey ? styles.railItemActive : ""
                } ${item.status === "disabled" ? styles.railItemOff : ""}`}
                key={item.key}
                onClick={() => {
                  setActiveKey(item.key);
                  setRunResult(null);
                  setRunError(null);
                  const next = buildSampleEvent(item.inputs);
                  autoEventRef.current = next;
                  setEventText(next);
                }}
                type="button"
              >
                <span className={styles.railItemName}>
                  {item.name || t("executionFactory.workbenchUnnamedFunction")}
                  {item.status === "disabled" ? (
                    <span className={styles.railItemOffTag}>
                      {t("executionFactory.toolStatuses.disabled")}
                    </span>
                  ) : null}
                </span>
                <span className={`${styles.railItemMeta} ${item.dirty ? styles.railItemDirty : ""}`}>
                  {t("executionFactory.workbenchIoCount", {
                    inputs: item.inputs.length,
                    outputs: item.outputs.length,
                  })}
                  {item.dirty ? ` · ${t("executionFactory.workbenchUnsaved")}` : ""}
                </span>
              </button>
            ))}
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
          </div>
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
                             * 保存期间锁住：还没落库的函数扳开关只改本地 status，而
                             * persistFunction 建工具用的是保存开始那一刻的快照状态。
                             * 保存途中翻转会被静默吞掉——界面显示"已禁用"，服务端却是
                             * enabled，Agent 照样调得到。锁掉这段窗口最省事也最稳。
                             */
                            disabled={saving || publishing}
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
                {active.status === "disabled" ? (
                  <Alert
                    banner
                    message={t("executionFactory.workbenchDisabledBanner")}
                    type="warning"
                  />
                ) : null}
              </div>

              <div className={styles.editorArea}>
                <div className={styles.editor}>
                  <div className={styles.editorBar}>
                    <span className={styles.editorIcon}>
                      <ThunderboltOutlined />
                    </span>
                    <span className={styles.editorTitle}>
                      {t("executionFactory.functionLogic")}
                    </span>
                    <span className={styles.editorLang}>handler.py · Python</span>
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
                      <AppButton icon={<AppstoreOutlined />} onClick={() => setDockTab("deps")}>
                        {t("executionFactory.workbenchDepsTab")}
                        <span className={styles.toolCount}>{active.dependencies.length}</span>
                      </AppButton>
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
                      <div
                        className={styles.eventEditor}
                        onKeyDown={(keyEvent) => {
                          if ((keyEvent.metaKey || keyEvent.ctrlKey) && keyEvent.key === "Enter") {
                            keyEvent.preventDefault();
                            void handleRun();
                          }
                        }}
                      >
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
    // 后端没返回的指标不占位——一排「未返回」比空着更吵。
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
