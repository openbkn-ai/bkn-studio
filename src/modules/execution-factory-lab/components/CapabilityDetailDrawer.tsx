import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Drawer,
  Dropdown,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Upload,
  message,
} from "antd";
import type { MenuProps } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";

import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { CapabilityStatusStepper } from "@/modules/execution-factory-lab/components/CapabilityStatusStepper";
import {
  LabDestructiveImpactAlert,
  type LabDestructiveAction,
  type LabDestructiveConfirmContext,
} from "@/modules/execution-factory-lab/components/LabDestructiveConfirm";
import { LabPermissionHint } from "@/modules/execution-factory-lab/components/LabPermissionHint";
import {
  debugCapability,
  deleteCapability,
  disableOrchestration,
  downloadSkillPackage,
  enableOrchestration,
  getCapability,
  getOrchestrationDetail,
  listCapabilityVersions,
  listMcpTools,
  publishCapability,
  republishCapabilityVersion,
  exportCapabilityPackage,
  updateCapability,
  updateOrchestrationConfig,
  updateSkillPackage,
} from "@/modules/execution-factory-lab/services/capabilities-lab.service";
import { SkillFileTreePanel } from "@/modules/execution-factory-lab/components/SkillFileTreePanel";
import { useLabFeatures } from "@/modules/execution-factory-lab/hooks/useLabFeatures";
import { executionFactoryLabPermissions } from "@/modules/execution-factory-lab/permissions";
import { editPermissionForKind } from "@/modules/execution-factory-lab/utils/create-menu-permissions";
import type {
  CapabilityAudit,
  CapabilityRecord,
  FunctionParameterDef,
  McpToolEntry,
  OrchestrationRuntimeConfig,
  VersionEntry,
} from "@/modules/execution-factory-lab/types/capability";
import {
  formatCapabilityStatusLabel,
  getCapabilityStatusTagColor,
  getCapabilityStatusTagStyle,
} from "@/modules/execution-factory-lab/utils/capability-status";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";

type CapabilityDetailDrawerProps = {
  capability?: CapabilityRecord;
  open: boolean;
  initialTab?: string;
  onClose: () => void;
  onUpdated?: () => void;
};

const DEFAULT_ORCHESTRATION_RUNTIME_CONFIG: OrchestrationRuntimeConfig = {
  timeoutMs: 3_000,
  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 1_000,
    maxDelayMs: 6_000,
    backoffFactor: 2,
    retryStatusCodes: [500, 502, 503, 504],
    retryErrorCodes: [],
  },
};

const ORCHESTRATION_NOTICE_STYLE = {
  background: "var(--color-info-bg)",
  borderColor: "var(--color-info-border)",
};

const ORCHESTRATION_NOTICE_ICON_STYLE = {
  color: "var(--color-info-text)",
};

function orchestrationRuntimeConfigKey(capabilityId: string) {
  return `execution-factory-lab:orchestration-runtime:${capabilityId}`;
}

function readOrchestrationRuntimeConfig(capabilityId: string): OrchestrationRuntimeConfig {
  try {
    const raw = window.localStorage.getItem(orchestrationRuntimeConfigKey(capabilityId));
    if (!raw) {
      return DEFAULT_ORCHESTRATION_RUNTIME_CONFIG;
    }
    const parsed = JSON.parse(raw) as Partial<OrchestrationRuntimeConfig>;
    return {
      ...DEFAULT_ORCHESTRATION_RUNTIME_CONFIG,
      ...parsed,
      retryPolicy: {
        ...DEFAULT_ORCHESTRATION_RUNTIME_CONFIG.retryPolicy,
        ...parsed.retryPolicy,
      },
    };
  } catch {
    return DEFAULT_ORCHESTRATION_RUNTIME_CONFIG;
  }
}

function saveOrchestrationRuntimeConfig(
  capabilityId: string,
  config: OrchestrationRuntimeConfig,
) {
  window.localStorage.setItem(orchestrationRuntimeConfigKey(capabilityId), JSON.stringify(config));
}

function sampleValueForFunctionType(type?: string): unknown {
  switch ((type ?? "string").toLowerCase()) {
    case "number":
    case "integer":
      return 1;
    case "boolean":
      return true;
    case "array":
      return [];
    case "object":
      return {};
    case "null":
      return null;
    default:
      return "string";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) {
    return value;
  }
  return undefined;
}

function firstArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readRecordAt(source: Record<string, unknown>, path: string[]) {
  let cursor: unknown = source;
  for (const key of path) {
    if (!isRecord(cursor)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return firstRecord(cursor);
}

function resolveSchemaRef(
  schema: Record<string, unknown> | undefined,
  root: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const ref = typeof schema?.$ref === "string" ? schema.$ref : "";
  if (!ref.startsWith("#/")) {
    return schema;
  }

  const resolved = readRecordAt(root, ref.slice(2).split("/"));
  return resolved ?? schema;
}

function sampleValueForJsonSchema(
  schema: Record<string, unknown> | undefined,
  root: Record<string, unknown>,
): unknown {
  const resolved = resolveSchemaRef(schema, root);
  const enumValues = firstArray(resolved?.enum);
  if (enumValues.length > 0) {
    return enumValues[0];
  }

  const rawSchemaType = resolved?.type;
  const schemaType = Array.isArray(rawSchemaType)
    ? rawSchemaType.find((item): item is string => typeof item === "string")
    : typeof rawSchemaType === "string"
      ? rawSchemaType
      : undefined;
  switch (schemaType) {
    case "integer":
    case "number":
      return 1;
    case "boolean":
      return true;
    case "array":
      return [sampleValueForJsonSchema(firstRecord(resolved?.items), root)];
    case "object": {
      const properties = firstRecord(resolved?.properties);
      if (!properties) {
        return {};
      }
      return Object.fromEntries(
        Object.entries(properties).map(([key, value]) => [
          key,
          sampleValueForJsonSchema(firstRecord(value), root),
        ]),
      );
    }
    case "null":
      return null;
    case "string":
    default:
      if (firstRecord(resolved?.properties)) {
        return sampleValueForJsonSchema({ ...resolved, type: "object" }, root);
      }
      return "string";
  }
}

function buildFunctionDebugBody(inputs?: FunctionParameterDef[]) {
  const body = Object.fromEntries(
    (inputs ?? [])
      .filter((input) => input.name)
      .map((input) => [input.name, sampleValueForFunctionType(input.type)]),
  );

  return JSON.stringify(Object.keys(body).length > 0 ? body : {}, null, 2);
}

function findOpenApiOperation(
  doc: Record<string, unknown>,
  endpoint?: CapabilityRecord["endpoint"],
): Record<string, unknown> | undefined {
  const paths = firstRecord(doc.paths);
  if (!paths) {
    return doc;
  }

  const method = endpoint?.method?.toLowerCase();
  const path = endpoint?.path;
  const pathItem = path ? firstRecord(paths[path]) : undefined;
  const operation = pathItem && method ? firstRecord(pathItem[method]) : undefined;
  if (operation) {
    return operation;
  }

  for (const candidatePath of Object.values(paths)) {
    const candidatePathItem = firstRecord(candidatePath);
    if (!candidatePathItem) {
      continue;
    }
    for (const candidateOperation of Object.values(candidatePathItem)) {
      const record = firstRecord(candidateOperation);
      if (record) {
        return record;
      }
    }
  }

  return undefined;
}

function sampleRequestBody(
  operation: Record<string, unknown>,
  root: Record<string, unknown>,
): Record<string, unknown> {
  const requestBody = firstRecord(operation.requestBody) ?? firstRecord(operation.request_body);
  const content = firstRecord(requestBody?.content);
  const media =
    firstRecord(content?.["application/json"]) ??
    firstRecord(content?.["application/*+json"]) ??
    firstRecord(Object.values(content ?? {})[0]);
  const schema = firstRecord(media?.schema);
  const sample = sampleValueForJsonSchema(schema, root);

  return isRecord(sample) ? sample : {};
}

function sampleParameters(
  operation: Record<string, unknown>,
  root: Record<string, unknown>,
  location: "query" | "path" | "header",
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const rawParam of firstArray(operation.parameters)) {
    const param = firstRecord(rawParam);
    if (!param || param.in !== location || typeof param.name !== "string") {
      continue;
    }
    params[param.name] = sampleValueForJsonSchema(firstRecord(param.schema), root);
  }

  return params;
}

function buildHttpDebugBody(record: CapabilityRecord) {
  if (!record.openapiSpec) {
    return JSON.stringify({}, null, 2);
  }

  try {
    const doc = JSON.parse(record.openapiSpec) as unknown;
    if (!isRecord(doc)) {
      return JSON.stringify({}, null, 2);
    }

    const operation = findOpenApiOperation(doc, record.endpoint);
    if (!operation) {
      return JSON.stringify({}, null, 2);
    }

    const body = sampleRequestBody(operation, doc);
    const query = sampleParameters(operation, doc, "query");
    const path = sampleParameters(operation, doc, "path");
    const header = sampleParameters(operation, doc, "header");
    const debugInput: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries({ query, path, header, body })) {
      if (Object.keys(value).length > 0) {
        debugInput[key] = value;
      }
    }

    if (Object.keys(debugInput).length === 1 && Object.keys(body).length > 0) {
      return JSON.stringify(body, null, 2);
    }

    return JSON.stringify(debugInput, null, 2);
  } catch {
    return JSON.stringify({}, null, 2);
  }
}

function buildCapabilityDebugBody(record: CapabilityRecord) {
  if (record.kind === "function") {
    return buildFunctionDebugBody(record.inputs);
  }
  if (record.kind === "http") {
    return buildHttpDebugBody(record);
  }
  return JSON.stringify({}, null, 2);
}

function parseDebugInput(record: CapabilityRecord, raw: string): {
  body: Record<string, unknown>;
  query?: Record<string, unknown>;
  path?: Record<string, unknown>;
  header?: Record<string, unknown>;
} {
  const parsed = raw.trim() ? (JSON.parse(raw) as unknown) : {};
  if (!isRecord(parsed)) {
    return { body: {} };
  }

  if (record.kind === "http") {
    const body = firstRecord(parsed.body);
    const query = firstRecord(parsed.query);
    const path = firstRecord(parsed.path);
    const header = firstRecord(parsed.header);
    if (body || query || path || header) {
      return { body: body ?? {}, query, path, header };
    }
  }

  return { body: parsed };
}

function formatFunctionParameters(params?: FunctionParameterDef[]) {
  if (!params?.length) {
    return "-";
  }

  return (
    <Space wrap>
      {params.map((param) => (
        <Tag key={`${param.name}-${param.type ?? ""}`}>
          {param.name}
          {param.type ? `: ${param.type}` : ""}
          {param.description ? ` - ${param.description}` : ""}
        </Tag>
      ))}
    </Space>
  );
}

function formatAuditUser(value?: string) {
  return value && value.trim() ? value : "-";
}

function formatAuditTime(value?: number) {
  return formatExecutionUnitTime(value);
}

function auditDescriptionItems(audit?: CapabilityAudit) {
  return [
    {
      key: "createUser",
      label: "创建人",
      children: formatAuditUser(audit?.createUser),
    },
    {
      key: "createTime",
      label: "创建时间",
      children: formatAuditTime(audit?.createTime),
    },
    {
      key: "updateUser",
      label: "更新人",
      children: formatAuditUser(audit?.updateUser),
    },
    {
      key: "updateTime",
      label: "更新时间",
      children: formatAuditTime(audit?.updateTime),
    },
    {
      key: "releaseUser",
      label: "发布人",
      children: formatAuditUser(audit?.releaseUser),
    },
    {
      key: "releaseTime",
      label: "发布时间",
      children: formatAuditTime(audit?.releaseTime),
    },
  ];
}

export function CapabilityDetailDrawer({
  capability,
  open,
  initialTab = "overview",
  onClose,
  onUpdated,
}: CapabilityDetailDrawerProps) {
  const { t } = useTranslation();
  const { features } = useLabFeatures();
  const { runtimeConfig } = useAppServices();
  const userPermissions = runtimeConfig.currentUser.permissions ?? [];
  const [detail, setDetail] = useState<CapabilityRecord | undefined>(capability);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [orchestration, setOrchestration] = useState<{
    enabled: boolean;
    operatorId?: string;
    audit?: CapabilityAudit;
  }>({ enabled: false });
  const [orchestrationRuntime, setOrchestrationRuntime] =
    useState<OrchestrationRuntimeConfig>(DEFAULT_ORCHESTRATION_RUNTIME_CONFIG);
  const [debugBody, setDebugBody] = useState("{}");
  const [mcpToolName, setMcpToolName] = useState("");
  const [debugResult, setDebugResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editOpenApi, setEditOpenApi] = useState("");
  const [editMcpUrl, setEditMcpUrl] = useState("");
  const [editFunctionCode, setEditFunctionCode] = useState("");
  const [mcpTools, setMcpTools] = useState<McpToolEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [skillReplaceOpen, setSkillReplaceOpen] = useState(false);
  const [skillReplaceFile, setSkillReplaceFile] = useState<File | null>(null);
  const [destructiveConfirm, setDestructiveConfirm] = useState<{
    action: LabDestructiveAction;
    okText: string;
    onOk: () => Promise<void> | void;
    targetVersion?: string;
    title: string;
  } | null>(null);

  const isEditableKind =
    detail?.kind === "http" ||
    detail?.kind === "mcp" ||
    detail?.kind === "skill" ||
    detail?.kind === "function";

  useEffect(() => {
    if (!open || !capability) {
      return;
    }

    setDetail(capability);
    setEditName(capability.name);
    setEditDescription(capability.description ?? "");
    setEditing(false);
    setActiveTab(initialTab);
    setError(null);
    setDebugResult(null);
    setOrchestrationRuntime(readOrchestrationRuntimeConfig(capability.id));

    void (async () => {
      try {
        const fresh = await getCapability(capability.id);
        setDetail(fresh);
        setEditName(fresh.name);
        setEditDescription(fresh.description ?? "");
        setEditOpenApi(fresh.openapiSpec ?? "");
        setEditMcpUrl(fresh.url ?? "");
        setEditFunctionCode(fresh.code ?? "");
        setDebugBody(buildCapabilityDebugBody(fresh));
        const versionList = await listCapabilityVersions(capability.id);
        setVersions(versionList);
        const orch = await getOrchestrationDetail(capability.id);
        setOrchestration({
          enabled: orch.enabled,
          operatorId: orch.operatorId,
          audit: orch.audit ?? fresh.orchestration?.audit,
        });

        if (fresh.kind === "mcp") {
          const tools = await listMcpTools(capability.id);
          setMcpTools(tools);
          if (tools[0]?.name) {
            setMcpToolName(tools[0].name);
          }
        } else {
          setMcpTools([]);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      }
    })();
  }, [capability, initialTab, open]);

  if (!detail) {
    return null;
  }

  const resetEditFields = (record: CapabilityRecord) => {
    setEditName(record.name);
    setEditDescription(record.description ?? "");
    setEditOpenApi(record.openapiSpec ?? "");
    setEditMcpUrl(record.url ?? "");
    setEditFunctionCode(record.code ?? "");
  };

  const startEdit = () => {
    resetEditFields(detail);
    setEditing(true);
  };

  const cancelEdit = () => {
    resetEditFields(detail);
    setEditing(false);
  };

  const pickSkillReplaceFile = () => {
    setSkillReplaceFile(null);
    setSkillReplaceOpen(true);
  };

  const destructiveContext = (targetVersion?: string): LabDestructiveConfirmContext => ({
    kind: detail.kind,
    name: detail.name,
    orchestrationEnabled: orchestration.enabled,
    status: detail.status,
    targetVersion,
    version: detail.version,
  });

  const showDestructiveConfirm = (params: {
    action: LabDestructiveAction;
    okText: string;
    onOk: () => Promise<void> | void;
    targetVersion?: string;
    title: string;
  }) => {
    setDestructiveConfirm(params);
  };

  const handleDestructiveConfirmOk = async () => {
    if (!destructiveConfirm) {
      return;
    }
    await destructiveConfirm.onOk();
    setDestructiveConfirm(null);
  };

  const confirmOffline = () => {
    showDestructiveConfirm({
      action: "offline",
      okText: t("executionFactoryLab.offlineAction"),
      onOk: () => handleOffline(),
      title: t("executionFactoryLab.offlineConfirm"),
    });
  };

  const confirmRepublish = (version: string) => {
    showDestructiveConfirm({
      action: "republish",
      okText: t("executionFactoryLab.republishAction"),
      onOk: () => handleRepublish(version),
      targetVersion: version,
      title: t("executionFactoryLab.republishConfirm"),
    });
  };

  const handleOffline = async () => {
    setLoading(true);
    setError(null);
    try {
      await publishCapability(detail.id, "offline");
      message.success(t("executionFactoryLab.offlineSuccess"));
      onUpdated?.();
      setDetail(await getCapability(detail.id));
    } catch (offlineError) {
      setError(offlineError instanceof Error ? offlineError.message : String(offlineError));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteCapability(detail.id);
      onUpdated?.();
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMeta = async () => {
    if (!isEditableKind) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload =
        detail.kind === "http"
          ? {
              name: editName.trim(),
              description: editDescription.trim(),
              ...(editOpenApi.trim() ? { openapiSpec: editOpenApi.trim() } : {}),
            }
          : detail.kind === "mcp"
            ? {
                name: editName.trim(),
                description: editDescription.trim(),
                ...(editMcpUrl.trim() ? { url: editMcpUrl.trim() } : {}),
              }
            : detail.kind === "function"
              ? {
                  name: editName.trim(),
                  description: editDescription.trim(),
                  ...(editFunctionCode.trim() ? { code: editFunctionCode.trim() } : {}),
                  inputs: detail.inputs,
                  outputs: detail.outputs,
                }
              : {
                  name: editName.trim(),
                  description: editDescription.trim(),
                };

      const fresh = await updateCapability(detail.id, payload);
      setDetail(fresh);
      resetEditFields(fresh);
      setEditing(false);
      message.success(t("executionFactoryLab.saveSuccess"));
      onUpdated?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSkill = async () => {
    setLoading(true);
    setError(null);
    try {
      await downloadSkillPackage(detail.id, detail.name);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : String(downloadError));
    } finally {
      setLoading(false);
    }
  };

  const handleReplaceSkillPackage = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await updateSkillPackage(detail.id, file);
      setDetail(fresh);
      setSkillReplaceOpen(false);
      setSkillReplaceFile(null);
      message.success(t("executionFactoryLab.skillReplaceSuccess"));
      onUpdated?.();
    } catch (replaceError) {
      setError(replaceError instanceof Error ? replaceError.message : String(replaceError));
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    setLoading(true);
    setError(null);
    try {
      await publishCapability(detail.id, "published");
      message.success(t("executionFactoryLab.publishSuccess"));
      onUpdated?.();
      setDetail(await getCapability(detail.id));
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : String(publishError));
    } finally {
      setLoading(false);
    }
  };

  const handleEnableOrchestration = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await enableOrchestration(detail.id, orchestrationRuntime);
      saveOrchestrationRuntimeConfig(detail.id, orchestrationRuntime);
      setOrchestration({
        enabled: true,
        operatorId: result.operatorId,
        audit: result.audit ?? orchestration.audit,
      });
      onUpdated?.();
      message.success(t("executionFactoryLab.enableOrchestrationSuccess"));
    } catch (orchError) {
      setError(orchError instanceof Error ? orchError.message : String(orchError));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrchestrationRuntime = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateOrchestrationConfig(detail.id, orchestrationRuntime);
      saveOrchestrationRuntimeConfig(detail.id, orchestrationRuntime);
      setOrchestration({
        enabled: result.enabled,
        operatorId: result.operatorId,
        audit: result.audit ?? orchestration.audit,
      });
      onUpdated?.();
      message.success(t("executionFactoryLab.orchestrationConfigSaved"));
    } catch (orchError) {
      setError(orchError instanceof Error ? orchError.message : String(orchError));
    } finally {
      setLoading(false);
    }
  };

  const handleDisableOrchestration = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await disableOrchestration(detail.id);
      setOrchestration({ enabled: result.enabled, operatorId: result.operatorId });
      onUpdated?.();
      message.success(t("executionFactoryLab.disableOrchestrationSuccess"));
    } catch (orchError) {
      setError(orchError instanceof Error ? orchError.message : String(orchError));
    } finally {
      setLoading(false);
    }
  };

  const confirmDisableOrchestration = () => {
    showDestructiveConfirm({
      action: "disableOrchestration",
      okText: t("executionFactoryLab.disableOrchestrationAction"),
      onOk: () => handleDisableOrchestration(),
      title: t("executionFactoryLab.disableOrchestrationConfirm"),
    });
  };

  const updateOrchestrationRuntime = (patch: Partial<OrchestrationRuntimeConfig>) => {
    setOrchestrationRuntime((current) => ({ ...current, ...patch }));
  };

  const updateOrchestrationRetryPolicy = (
    patch: Partial<OrchestrationRuntimeConfig["retryPolicy"]>,
  ) => {
    setOrchestrationRuntime((current) => ({
      ...current,
      retryPolicy: { ...current.retryPolicy, ...patch },
    }));
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      await exportCapabilityPackage(detail.id, detail.name);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : String(exportError));
    } finally {
      setLoading(false);
    }
  };

  const handleRepublish = async (version: string) => {
    setLoading(true);
    setError(null);
    try {
      await republishCapabilityVersion(detail.id, version, "publish");
      message.success(t("executionFactoryLab.republishSuccess"));
      setVersions(await listCapabilityVersions(detail.id));
      onUpdated?.();
    } catch (republishError) {
      setError(republishError instanceof Error ? republishError.message : String(republishError));
    } finally {
      setLoading(false);
    }
  };

  const handleDebug = async () => {
    setLoading(true);
    setError(null);
    try {
      const debugInput = parseDebugInput(detail, debugBody);
      const result = await debugCapability(detail.id, {
        body: debugInput.body,
        query: debugInput.query,
        path: debugInput.path,
        header: debugInput.header,
        toolName: detail.kind === "mcp" ? mcpToolName : undefined,
      });
      setDebugResult(JSON.stringify(result, null, 2));
    } catch (debugError) {
      setError(debugError instanceof Error ? debugError.message : String(debugError));
    } finally {
      setLoading(false);
    }
  };

  const publishPermission =
    detail.kind === "mcp"
      ? executionFactoryLabPermissions.mcpPublish
      : detail.kind === "skill"
        ? executionFactoryLabPermissions.skillPublish
        : executionFactoryLabPermissions.capabilityPublish;

  const deletePermission =
    detail.kind === "mcp"
      ? executionFactoryLabPermissions.mcpDelete
      : detail.kind === "skill"
        ? executionFactoryLabPermissions.skillDelete
        : executionFactoryLabPermissions.capabilityDelete;

  const debugPermission =
    detail.kind === "function"
      ? executionFactoryLabPermissions.functionDebug
      : detail.kind === "mcp"
        ? executionFactoryLabPermissions.mcpDebug
        : executionFactoryLabPermissions.capabilityDebug;

  const canDelete = hasPermissions({
    currentPermissions: userPermissions,
    requiredPermissions: deletePermission,
  });

  const confirmDelete = () => {
    if (!canDelete) {
      return;
    }
    showDestructiveConfirm({
      action: "delete",
      okText: t("executionFactoryLab.deleteAction"),
      onOk: () => handleDelete(),
      title: t("executionFactoryLab.deleteConfirm"),
    });
  };

  const canLifecycle =
    detail.kind === "http" ||
    detail.kind === "function" ||
    detail.kind === "mcp" ||
    detail.kind === "skill";

  const moreMenuItems: MenuProps["items"] = [
    ...(detail.kind === "skill"
      ? [
          {
            key: "download",
            label: t("executionFactoryLab.skillDownloadAction"),
            onClick: () => void handleDownloadSkill(),
          },
          {
            key: "replace",
            label: t("executionFactoryLab.skillReplacePackageTitle"),
            onClick: pickSkillReplaceFile,
          },
        ]
      : []),
    ...(canLifecycle &&
    features.impex &&
    hasPermissions({
      currentPermissions: userPermissions,
      requiredPermissions: executionFactoryLabPermissions.impexExport,
    })
      ? [
          {
            key: "export",
            label: t("executionFactoryLab.exportImpexAction"),
            onClick: () => void handleExport(),
          },
        ]
      : []),
  ];

  if (moreMenuItems.length > 0) {
    moreMenuItems.push({ type: "divider" as const });
  }

  moreMenuItems.push({
    key: "delete",
    danger: true,
    disabled: !canDelete,
    label: t("executionFactoryLab.deleteAction"),
    onClick: () => confirmDelete(),
  });

  return (
    <>
    <Drawer
      onClose={onClose}
      open={open}
      styles={{
        body: { background: "var(--color-bg-surface)" },
        mask: { background: "rgba(15, 23, 42, 0.45)" },
      }}
      title={t("executionFactoryLab.detailTitle")}
      width={720}
    >
      {error ? <Alert message={error} showIcon style={{ marginBottom: 12 }} type="error" /> : null}

      <Tabs
        activeKey={activeTab}
        items={[
          {
            key: "overview",
            label: t("executionFactoryLab.tabOverview"),
            children: (
              <>
                <CapabilityStatusStepper kind={detail.kind} status={detail.status} />
                <Alert
                  description={
                    <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
                      <li>{t("executionFactoryLab.operationDescPublish")}</li>
                      <li>{t("executionFactoryLab.operationDescOffline")}</li>
                      <li>{t("executionFactoryLab.operationDescEdit")}</li>
                      <li>{t("executionFactoryLab.operationDescVersion")}</li>
                      <li>{t("executionFactoryLab.operationDescDelete")}</li>
                    </ul>
                  }
                  message={t("executionFactoryLab.operationDescTitle")}
                  showIcon={false}
                  style={{ marginBottom: 16 }}
                  type="info"
                />
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label={t("executionFactoryLab.summaryLabel")}>
                    {editing && isEditableKind ? (
                      <Input onChange={(e) => setEditName(e.target.value)} value={editName} />
                    ) : (
                      detail.name
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("executionFactoryLab.kindLabel")}>
                    <Tag>{detail.kind.toUpperCase()}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t("executionFactoryLab.descriptionLabel")}>
                    {editing && isEditableKind ? (
                      <Input.TextArea
                        autoSize={{ minRows: 2, maxRows: 4 }}
                        onChange={(e) => setEditDescription(e.target.value)}
                        value={editDescription}
                      />
                    ) : (
                      detail.description || "-"
                    )}
                  </Descriptions.Item>
                  {detail.kind === "http" && editing ? (
                    <Descriptions.Item label={t("executionFactoryLab.httpOpenApiLabel")}>
                      <Input.TextArea
                        autoSize={{ minRows: 4, maxRows: 12 }}
                        onChange={(e) => setEditOpenApi(e.target.value)}
                        placeholder={t("executionFactoryLab.importOpenApiPlaceholder")}
                        value={editOpenApi}
                      />
                    </Descriptions.Item>
                  ) : null}
                  {detail.kind === "mcp" && editing ? (
                    <Descriptions.Item label={t("executionFactoryLab.mcpUrlLabel")}>
                      <Input
                        onChange={(e) => setEditMcpUrl(e.target.value)}
                        placeholder="http://ef-mcp-mock:8096/sse"
                        value={editMcpUrl}
                      />
                    </Descriptions.Item>
                  ) : null}
                  {detail.kind === "function" && editing ? (
                    <Descriptions.Item label={t("executionFactoryLab.functionCodeLabel")}>
                      <Input.TextArea
                        autoSize={{ minRows: 8, maxRows: 16 }}
                        onChange={(e) => setEditFunctionCode(e.target.value)}
                        value={editFunctionCode}
                      />
                    </Descriptions.Item>
                  ) : null}
                  {detail.kind === "function" ? (
                    <Descriptions.Item label={t("executionFactoryLab.functionInputExampleLabel")}>
                      {formatFunctionParameters(detail.inputs)}
                    </Descriptions.Item>
                  ) : null}
                  {detail.kind === "function" ? (
                    <Descriptions.Item label={t("executionFactoryLab.functionOutputExampleLabel")}>
                      {formatFunctionParameters(detail.outputs)}
                    </Descriptions.Item>
                  ) : null}
                  <Descriptions.Item label={t("executionFactoryLab.detailStatus")}>
                    <Tag
                      color={getCapabilityStatusTagColor(detail.status)}
                      style={getCapabilityStatusTagStyle(detail.status)}
                    >
                      {formatCapabilityStatusLabel(detail.status, t)}
                    </Tag>
                  </Descriptions.Item>
                  {detail.group ? (
                    <Descriptions.Item label={t("executionFactoryLab.detailGroup")}>
                      {detail.group.name}
                    </Descriptions.Item>
                  ) : null}
                  {detail.endpoint ? (
                    <Descriptions.Item label="Endpoint">
                      {`${detail.endpoint.method ?? ""} ${detail.endpoint.path ?? ""}`.trim()}
                    </Descriptions.Item>
                  ) : null}
                  {detail.version ? (
                    <Descriptions.Item label={t("executionFactoryLab.versionLabel")}>
                      {detail.version}
                    </Descriptions.Item>
                  ) : null}
                  {features.catalog ? (
                    <Descriptions.Item label={t("executionFactoryLab.catalogSourceLabel")}>
                      <Link
                        state={{ catalogKeyword: detail.name }}
                        to="/execution-factory-lab/catalog"
                      >
                        {t("executionFactoryLab.viewInCatalogAction")}
                      </Link>
                    </Descriptions.Item>
                  ) : null}
                </Descriptions>
                <div style={{ marginTop: 16 }}>
                  <h4>{t("executionFactoryLab.auditInfoTitle")}</h4>
                  <Descriptions
                    bordered
                    column={2}
                    items={auditDescriptionItems(detail.audit).map((item) => ({
                      ...item,
                      label: t(`executionFactoryLab.${item.key}`),
                    }))}
                    size="small"
                  />
                </div>
                <Space direction="vertical" style={{ marginTop: 16, width: "100%" }}>
                  <Space wrap>
                    <LabPermissionHint permissions={publishPermission}>
                      {canLifecycle && detail.status !== "published" ? (
                        <Popconfirm
                          onConfirm={() => void handlePublish()}
                          title={t("executionFactoryLab.publishConfirm")}
                        >
                          <Button loading={loading} type="primary">
                            {t("executionFactoryLab.publishAction")}
                          </Button>
                        </Popconfirm>
                      ) : null}
                      {canLifecycle && detail.status === "published" ? (
                        <Button loading={loading} onClick={confirmOffline}>
                          {t("executionFactoryLab.offlineAction")}
                        </Button>
                      ) : null}
                    </LabPermissionHint>
                    <LabPermissionHint permissions={editPermissionForKind(detail.kind)}>
                      {isEditableKind && !editing ? (
                        <Button onClick={startEdit}>{t("executionFactoryLab.editAction")}</Button>
                      ) : null}
                      {isEditableKind && editing ? (
                        <>
                          <Button loading={loading} onClick={() => void handleSaveMeta()} type="primary">
                            {t("executionFactoryLab.saveAction")}
                          </Button>
                          <Button disabled={loading} onClick={cancelEdit}>
                            {t("executionFactoryLab.cancelEditAction")}
                          </Button>
                        </>
                      ) : null}
                    </LabPermissionHint>
                    {canLifecycle ? (
                      <Dropdown menu={{ items: moreMenuItems }}>
                        <Button loading={loading}>{t("executionFactoryLab.moreActions")}</Button>
                      </Dropdown>
                    ) : null}
                  </Space>
                </Space>
                {detail.kind === "mcp" && mcpTools.length > 0 ? (
                  <div style={{ marginTop: 24 }}>
                    <h4>{t("executionFactoryLab.mcpToolsTitle")}</h4>
                    <Table
                      columns={[
                        { title: t("executionFactoryLab.mcpToolNamePlaceholder"), dataIndex: "name" },
                        { title: t("executionFactoryLab.descriptionLabel"), dataIndex: "description" },
                      ]}
                      dataSource={mcpTools.map((tool, index) => ({
                        ...tool,
                        key: tool.name ?? String(index),
                        name: tool.name ?? "-",
                        description: tool.description ?? "-",
                      }))}
                      pagination={false}
                      size="small"
                    />
                  </div>
                ) : null}
                {detail.kind === "skill" && features.skill_files ? (
                  <div style={{ marginTop: 24 }}>
                    <h4>{t("executionFactoryLab.skillFilesTitle")}</h4>
                    <SkillFileTreePanel capabilityId={detail.id} />
                  </div>
                ) : null}
              </>
            ),
          },
          {
            key: "debug",
            label:
              detail.kind === "skill" ? (
                <Tooltip title={t("executionFactoryLab.tabDebugSkillHint")}>
                  <span>{t("executionFactoryLab.tabDebug")}</span>
                </Tooltip>
              ) : (
                t("executionFactoryLab.tabDebug")
              ),
            disabled: detail.kind !== "http" && detail.kind !== "mcp" && detail.kind !== "function",
            children: (
              <Space direction="vertical" style={{ width: "100%" }}>
                {detail.kind === "mcp" ? (
                  <Select
                    onChange={setMcpToolName}
                    options={mcpTools.map((tool) => ({
                      value: tool.name ?? "",
                      label: tool.name ?? "-",
                    }))}
                    placeholder={t("executionFactoryLab.mcpToolNamePlaceholder")}
                    style={{ width: "100%" }}
                    value={mcpToolName || undefined}
                  />
                ) : null}
                {detail.kind === "function" || detail.kind === "http" ? (
                  <Button
                    onClick={() =>
                      setDebugBody(buildCapabilityDebugBody(detail))
                    }
                    size="small"
                    type="link"
                  >
                    {t("executionFactoryLab.debugFillExample")}
                  </Button>
                ) : null}
                <Collapse
                  ghost
                  items={[
                    {
                      key: "payload",
                      label: t("executionFactoryLab.debugAdvancedJson"),
                      children: (
                        <Input.TextArea
                          autoSize={{ minRows: 4, maxRows: 10 }}
                          onChange={(event) => setDebugBody(event.target.value)}
                          value={debugBody}
                        />
                      ),
                    },
                  ]}
                />
                <LabPermissionHint permissions={debugPermission}>
                  <Button loading={loading} onClick={() => void handleDebug()} type="primary">
                    {t("executionFactoryLab.debugAction")}
                  </Button>
                </LabPermissionHint>
                {debugResult ? (
                  <pre
                    style={{
                      background: "var(--color-hover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      color: "var(--color-text-primary)",
                      padding: 12,
                    }}
                  >
                    {debugResult}
                  </pre>
                ) : null}
              </Space>
            ),
          },
          {
            key: "versions",
            label: t("executionFactoryLab.tabVersions"),
            children: (
              <Table
                columns={[
                  { title: t("executionFactoryLab.versionLabel"), dataIndex: "version" },
                  {
                    title: t("executionFactoryLab.detailStatus"),
                    render: (_, row) => (
                      <Tag
                        color={getCapabilityStatusTagColor(row.status ?? "draft")}
                        style={getCapabilityStatusTagStyle(row.status ?? "draft")}
                      >
                        {formatCapabilityStatusLabel(row.status ?? "draft", t)}
                      </Tag>
                    ),
                  },
                  {
                    title: t("executionFactoryLab.releaseUser"),
                    render: (_, row) => formatAuditUser(row.releaseUser),
                  },
                  {
                    title: t("executionFactoryLab.releaseTime"),
                    render: (_, row) => formatAuditTime(row.releaseTime ?? row.updateTime),
                  },
                  {
                    title: t("executionFactoryLab.versionAction"),
                    render: (_, row) =>
                      detail.kind === "skill" ||
                      (detail.kind === "http" && orchestration.enabled) ? (
                        <LabPermissionHint
                          permissions={
                            detail.kind === "skill"
                              ? executionFactoryLabPermissions.skillPublish
                              : executionFactoryLabPermissions.capabilityPublish
                          }
                        >
                          <Button onClick={() => confirmRepublish(row.version)} size="small" type="link">
                            {t("executionFactoryLab.republishAction")}
                          </Button>
                        </LabPermissionHint>
                      ) : (
                        "-"
                      ),
                  },
                ]}
                dataSource={versions.map((item) => ({ ...item, key: item.version }))}
                pagination={false}
                size="small"
              />
            ),
          },
          {
            key: "orchestration",
            label:
              detail.kind !== "http" ? (
                <Tooltip title={t("executionFactoryLab.tabOrchestrationHint")}>
                  <span>{t("executionFactoryLab.tabOrchestration")}</span>
                </Tooltip>
              ) : (
                t("executionFactoryLab.tabOrchestration")
              ),
            disabled: detail.kind !== "http",
            children: (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Alert
                  description={
                    orchestration.enabled
                      ? t("executionFactoryLab.orchestrationEnabledDescription")
                      : t("executionFactoryLab.orchestrationDisabledDescription")
                  }
                  message={
                    orchestration.enabled
                      ? t("executionFactoryLab.orchestrationEnabledTitle")
                      : t("executionFactoryLab.orchestrationDisabledTitle")
                  }
                  icon={<InfoCircleOutlined style={ORCHESTRATION_NOTICE_ICON_STYLE} />}
                  showIcon
                  style={ORCHESTRATION_NOTICE_STYLE}
                  type={orchestration.enabled ? "success" : "info"}
                />
                <Alert
                  description={
                    <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
                      <li>{t("executionFactoryLab.operationDescEnableOrchestration")}</li>
                      <li>{t("executionFactoryLab.operationDescSaveOrchestration")}</li>
                      <li>{t("executionFactoryLab.operationDescDisableOrchestration")}</li>
                    </ul>
                  }
                  icon={<InfoCircleOutlined style={ORCHESTRATION_NOTICE_ICON_STYLE} />}
                  message={t("executionFactoryLab.operationDescTitle")}
                  showIcon
                  style={ORCHESTRATION_NOTICE_STYLE}
                  type="info"
                />
                <Descriptions bordered column={1} size="small">
                  {orchestration.enabled ? (
                    <Descriptions.Item label={t("executionFactoryLab.orchestrationOperatorId")}>
                      {orchestration.operatorId ?? "-"}
                    </Descriptions.Item>
                  ) : null}
                  <Descriptions.Item label={t("executionFactoryLab.orchestrationTimeoutMs")}>
                    <InputNumber
                      min={0}
                      onChange={(value) =>
                        updateOrchestrationRuntime({
                          timeoutMs: typeof value === "number" ? value : undefined,
                        })
                      }
                      step={1_000}
                      style={{ width: 180 }}
                      value={orchestrationRuntime.timeoutMs}
                    />
                  </Descriptions.Item>
                </Descriptions>
                {orchestration.enabled ? (
                  <div>
                    <h4>{t("executionFactoryLab.operatorAuditInfoTitle")}</h4>
                    <Descriptions
                      bordered
                      column={2}
                      items={auditDescriptionItems(orchestration.audit).map((item) => ({
                        ...item,
                        label: t(`executionFactoryLab.${item.key}`),
                      }))}
                      size="small"
                    />
                  </div>
                ) : null}
                <Collapse
                  ghost
                  items={[
                    {
                      key: "retry",
                      label: t("executionFactoryLab.orchestrationRetryPolicy"),
                      children: (
                        <Descriptions bordered column={1} size="small">
                          <Descriptions.Item label={t("executionFactoryLab.orchestrationMaxAttempts")}>
                            <InputNumber
                              min={0}
                              onChange={(value) =>
                                updateOrchestrationRetryPolicy({
                                  maxAttempts: typeof value === "number" ? value : undefined,
                                })
                              }
                              style={{ width: 180 }}
                              value={orchestrationRuntime.retryPolicy.maxAttempts}
                            />
                          </Descriptions.Item>
                          <Descriptions.Item label={t("executionFactoryLab.orchestrationInitialDelayMs")}>
                            <InputNumber
                              min={0}
                              onChange={(value) =>
                                updateOrchestrationRetryPolicy({
                                  initialDelayMs: typeof value === "number" ? value : undefined,
                                })
                              }
                              step={100}
                              style={{ width: 180 }}
                              value={orchestrationRuntime.retryPolicy.initialDelayMs}
                            />
                          </Descriptions.Item>
                          <Descriptions.Item label={t("executionFactoryLab.orchestrationMaxDelayMs")}>
                            <InputNumber
                              min={0}
                              onChange={(value) =>
                                updateOrchestrationRetryPolicy({
                                  maxDelayMs: typeof value === "number" ? value : undefined,
                                })
                              }
                              step={100}
                              style={{ width: 180 }}
                              value={orchestrationRuntime.retryPolicy.maxDelayMs}
                            />
                          </Descriptions.Item>
                          <Descriptions.Item label={t("executionFactoryLab.orchestrationBackoffFactor")}>
                            <InputNumber
                              min={1}
                              onChange={(value) =>
                                updateOrchestrationRetryPolicy({
                                  backoffFactor: typeof value === "number" ? value : undefined,
                                })
                              }
                              style={{ width: 180 }}
                              value={orchestrationRuntime.retryPolicy.backoffFactor}
                            />
                          </Descriptions.Item>
                          <Descriptions.Item label={t("executionFactoryLab.orchestrationRetryStatusCodes")}>
                            <Select
                              mode="tags"
                              onChange={(values) =>
                                updateOrchestrationRetryPolicy({
                                  retryStatusCodes: values
                                    .map((value) => Number(value))
                                    .filter((value) => !Number.isNaN(value)),
                                })
                              }
                              placeholder="500, 502"
                              style={{ width: "100%" }}
                              tokenSeparators={[","]}
                              value={orchestrationRuntime.retryPolicy.retryStatusCodes?.map(String)}
                            />
                          </Descriptions.Item>
                          <Descriptions.Item label={t("executionFactoryLab.orchestrationRetryErrorCodes")}>
                            <Select
                              mode="tags"
                              onChange={(values) =>
                                updateOrchestrationRetryPolicy({ retryErrorCodes: values.map(String) })
                              }
                              placeholder="TIMEOUT"
                              style={{ width: "100%" }}
                              tokenSeparators={[","]}
                              value={orchestrationRuntime.retryPolicy.retryErrorCodes}
                            />
                          </Descriptions.Item>
                        </Descriptions>
                      ),
                    },
                  ]}
                />
                <Space wrap>
                  <LabPermissionHint permissions={editPermissionForKind(detail.kind)}>
                    <Space wrap>
                      <Button
                        disabled={orchestration.enabled}
                        loading={!orchestration.enabled && loading}
                        onClick={() => void handleEnableOrchestration()}
                        type="primary"
                      >
                        {t("executionFactoryLab.enableOrchestrationAction")}
                      </Button>
                      <Button
                        disabled={!orchestration.enabled}
                        loading={orchestration.enabled && loading}
                        onClick={() => void handleSaveOrchestrationRuntime()}
                        type="primary"
                      >
                        {t("executionFactoryLab.orchestrationSaveConfigAction")}
                      </Button>
                      <Button
                        danger
                        disabled={!orchestration.enabled || loading}
                        onClick={confirmDisableOrchestration}
                      >
                        {t("executionFactoryLab.disableOrchestrationAction")}
                      </Button>
                    </Space>
                  </LabPermissionHint>
                </Space>
              </Space>
            ),
          },
        ]}
        onChange={setActiveTab}
      />
    </Drawer>

      <Modal
        cancelText={t("common.cancel")}
        confirmLoading={loading}
        okButtonProps={{ danger: true }}
        okText={destructiveConfirm?.okText}
        onCancel={() => setDestructiveConfirm(null)}
        onOk={() => void handleDestructiveConfirmOk()}
        open={Boolean(destructiveConfirm)}
        title={destructiveConfirm?.title}
        width={520}
      >
        {destructiveConfirm ? (
          <LabDestructiveImpactAlert
            action={destructiveConfirm.action}
            context={destructiveContext(destructiveConfirm.targetVersion)}
            t={t}
          />
        ) : null}
      </Modal>

      <Modal
        confirmLoading={loading}
        data-testid="skill-replace-modal"
        okButtonProps={{ disabled: !skillReplaceFile }}
        onCancel={() => {
          setSkillReplaceOpen(false);
          setSkillReplaceFile(null);
        }}
        onOk={() => {
          if (!skillReplaceFile) {
            return;
          }
          void handleReplaceSkillPackage(skillReplaceFile);
        }}
        open={skillReplaceOpen}
        title={t("executionFactoryLab.skillReplaceConfirm")}
      >
        <LabDestructiveImpactAlert action="skillReplace" context={destructiveContext()} t={t} />
        <p style={{ marginBottom: 16 }}>{t("executionFactoryLab.skillReplacePackageHint")}</p>
        <Upload
          accept=".zip"
          beforeUpload={(file) => {
            setSkillReplaceFile(file);
            return false;
          }}
          fileList={
            skillReplaceFile
              ? [{ uid: skillReplaceFile.name, name: skillReplaceFile.name }]
              : []
          }
          maxCount={1}
          onRemove={() => setSkillReplaceFile(null)}
        >
          <Button>{t("executionFactoryLab.importImpexChooseFile")}</Button>
        </Upload>
      </Modal>
    </>
  );
}
