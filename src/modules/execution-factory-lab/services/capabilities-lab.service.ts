import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";

import type {
  CapabilityListResult,
  CapabilityRecord,
  CreateHttpCapabilityInput,
  DebugCapabilityInput,
  DebugCapabilityResult,
  ImportOpenApiInput,
  OrchestrationDetail,
  RegisterMcpCapabilityInput,
  RegisterSkillCapabilityInput,
  CreateFunctionCapabilityInput,
  ExecutePythonInput,
  ExecutePythonResult,
  SkillContentResult,
  SkillFileSummary,
  ParseMcpSseInput,
  McpParsedTool,
  UpdateHttpCapabilityInput,
  UpdateCapabilityInput,
  CategoryEntry,
  McpToolEntry,
  VersionEntry,
  FunctionParameterDef,
  OrchestrationRuntimeConfig,
  CapabilityAudit,
} from "@/modules/execution-factory-lab/types/capability";
import type {
  CatalogKind,
  CatalogListResult,
  InstallCatalogInput,
  InstallCatalogResult,
} from "@/modules/execution-factory-lab/types/catalog";
import type { LabMeta } from "@/modules/execution-factory-lab/types/lab-meta";

const API_PREFIX = "/capabilities-lab/v1";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
}

type BackendCapability = {
  id: string;
  kind: string;
  name: string;
  description?: string;
  status?: string;
  group?: {
    id: string;
    name: string;
    service_url?: string;
    status?: string;
  };
  endpoint?: { method?: string; path?: string };
  orchestration?: {
    enabled?: boolean;
    operator_id?: string;
    operator_name?: string;
    audit?: BackendAudit;
  };
  audit?: BackendAudit;
  update_time?: number;
  tool_id?: string;
  box_id?: string;
  mcp_id?: string;
  skill_id?: string;
  version?: string;
  openapi_spec?: string;
  url?: string;
  code?: string;
  inputs?: FunctionParameterDef[];
  outputs?: FunctionParameterDef[];
};

type BackendAudit = {
  create_user?: string;
  create_time?: number;
  update_user?: string;
  update_time?: number;
  release_user?: string;
  release_time?: number;
};

function mapAudit(audit?: BackendAudit): CapabilityAudit | undefined {
  if (!audit) {
    return undefined;
  }

  return {
    createUser: audit.create_user,
    createTime: audit.create_time,
    updateUser: audit.update_user,
    updateTime: audit.update_time,
    releaseUser: audit.release_user,
    releaseTime: audit.release_time,
  };
}

function mapCapability(item: BackendCapability): CapabilityRecord {
  return {
    id: item.id,
    kind: (item.kind as CapabilityRecord["kind"]) ?? "http",
    name: item.name,
    description: item.description,
    status: item.status ?? "draft",
    group: item.group
      ? {
          id: item.group.id,
          name: item.group.name,
          serviceUrl: item.group.service_url,
          status: item.group.status,
        }
      : undefined,
    endpoint: item.endpoint,
    orchestration: item.orchestration
      ? {
        enabled: Boolean(item.orchestration.enabled),
        operatorId: item.orchestration.operator_id,
        operatorName: item.orchestration.operator_name,
        audit: mapAudit(item.orchestration.audit),
      }
    : undefined,
    audit: mapAudit(item.audit),
    updateTime: item.update_time,
    toolId: item.tool_id,
    boxId: item.box_id,
    mcpId: item.mcp_id,
    skillId: item.skill_id,
    version: item.version,
    openapiSpec: item.openapi_spec,
    url: item.url,
    code: item.code,
    inputs: item.inputs,
    outputs: item.outputs,
  };
}

export async function listCapabilities(query: {
  kind?: string;
  keyword?: string;
  groupId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<CapabilityListResult> {
  const response = await http.get<{
    data?: BackendCapability[];
    total?: number;
    page?: number;
    page_size?: number;
  }>(`${API_PREFIX}/capabilities`, {
    headers: getBusinessDomainHeaders(),
    params: {
      kind: query.kind ?? "all",
      keyword: query.keyword || undefined,
      group_id: query.groupId || undefined,
      status: query.status && query.status !== "all" ? query.status : undefined,
      page: query.page ?? 1,
      page_size: query.pageSize ?? 20,
    },
  });

  const body = response.data;
  const items = (body.data ?? []).map(mapCapability);

  return {
    items,
    total: body.total ?? items.length,
    page: body.page ?? query.page ?? 1,
    pageSize: body.page_size ?? query.pageSize ?? 20,
  };
}

export async function getCapability(capabilityId: string): Promise<CapabilityRecord> {
  const response = await http.get<BackendCapability>(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}`,
    { headers: getBusinessDomainHeaders() },
  );

  return mapCapability(response.data);
}

export async function createHttpCapability(
  input: CreateHttpCapabilityInput,
): Promise<CapabilityRecord> {
  const response = await http.post<{ capability?: BackendCapability }>(
    `${API_PREFIX}/capabilities/http`,
    {
      openapi_spec: input.openapiSpec,
      service_url: input.serviceUrl,
      name: input.name,
      description: input.description,
      orchestration_enabled: input.orchestrationEnabled ?? false,
      group: { mode: "auto" },
    },
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  if (!response.data.capability) {
    throw new Error("创建 HTTP 能力失败");
  }

  return mapCapability(response.data.capability);
}

export async function importOpenApiCapabilities(input: ImportOpenApiInput) {
  const response = await http.post<{
    box_id?: string;
    capabilities?: BackendCapability[];
  }>(
    `${API_PREFIX}/capabilities/http/import`,
    {
      openapi_spec: input.openapiSpec,
      service_url: input.serviceUrl,
      description: input.description,
      orchestration_enabled: input.orchestrationEnabled ?? false,
      group: { mode: "auto" },
    },
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  return {
    boxId: response.data.box_id,
    capabilities: (response.data.capabilities ?? []).map(mapCapability),
  };
}

export async function debugCapability(
  capabilityId: string,
  input: DebugCapabilityInput,
): Promise<DebugCapabilityResult> {
  const response = await http.post<DebugCapabilityResult>(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/debug`,
    {
      body: input.body,
      query: input.query,
      path: input.path,
      header: input.header,
      tool_name: input.toolName,
    },
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  return response.data;
}

export async function listCapabilityVersions(capabilityId: string): Promise<VersionEntry[]> {
  const response = await http.get<{ versions?: VersionEntry[] }>(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/versions`,
    { headers: getBusinessDomainHeaders() },
  );

  return (response.data.versions ?? []).map((item) => ({
    version: item.version,
    status: item.status,
    releaseUser: item.releaseUser ?? (item as { release_user?: string }).release_user,
    releaseTime: item.releaseTime ?? (item as { release_time?: number }).release_time,
    updateTime: item.updateTime ?? (item as { update_time?: number }).update_time,
  }));
}

export async function republishCapabilityVersion(
  capabilityId: string,
  version: string,
  mode: "publish" | "republish" = "republish",
) {
  await http.post(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/versions/republish`,
    { version, mode },
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );
}

export async function publishCapability(capabilityId: string, status = "published") {
  await http.post(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/publish`,
    { status },
    { headers: getBusinessDomainHeaders() },
  );
}

function serializeOrchestrationRuntimeConfig(config?: OrchestrationRuntimeConfig) {
  if (!config) {
    return {};
  }

  return {
    operator_execute_control: {
      timeout: config.timeoutMs,
      retry_policy: {
        max_attempts: config.retryPolicy.maxAttempts,
        initial_delay: config.retryPolicy.initialDelayMs,
        max_delay: config.retryPolicy.maxDelayMs,
        backoff_factor: config.retryPolicy.backoffFactor,
        retry_conditions: {
          status_code: config.retryPolicy.retryStatusCodes,
          error_codes: config.retryPolicy.retryErrorCodes,
        },
      },
    },
  };
}

export async function enableOrchestration(
  capabilityId: string,
  config?: OrchestrationRuntimeConfig,
): Promise<OrchestrationDetail> {
  const response = await http.post<{ operator_id?: string; audit?: BackendAudit }>(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/orchestration/enable`,
    serializeOrchestrationRuntimeConfig(config),
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  return {
    enabled: true,
    operatorId: response.data.operator_id,
    audit: mapAudit(response.data.audit),
  };
}

export async function updateOrchestrationConfig(
  capabilityId: string,
  config: OrchestrationRuntimeConfig,
): Promise<OrchestrationDetail> {
  const response = await http.post<{
    enabled?: boolean;
    operator_id?: string;
    tool_id?: string;
    box_id?: string;
    audit?: BackendAudit;
  }>(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/orchestration/config`,
    serializeOrchestrationRuntimeConfig(config),
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  return {
    enabled: Boolean(response.data.enabled),
    operatorId: response.data.operator_id,
    toolId: response.data.tool_id,
    boxId: response.data.box_id,
    audit: mapAudit(response.data.audit),
  };
}

export async function disableOrchestration(capabilityId: string): Promise<OrchestrationDetail> {
  const response = await http.post<{ enabled?: boolean; operator_id?: string }>(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/orchestration/disable`,
    {},
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  return { enabled: Boolean(response.data.enabled), operatorId: response.data.operator_id };
}

export async function getOrchestrationDetail(capabilityId: string): Promise<OrchestrationDetail> {
  const response = await http.get<{
    enabled?: boolean;
    operator_id?: string;
    tool_id?: string;
    box_id?: string;
    audit?: BackendAudit;
  }>(`${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/orchestration`, {
    headers: getBusinessDomainHeaders(),
  });

  return {
    enabled: Boolean(response.data.enabled),
    operatorId: response.data.operator_id,
    toolId: response.data.tool_id,
    boxId: response.data.box_id,
    audit: mapAudit(response.data.audit),
  };
}

export async function listGroups(query?: { keyword?: string; page?: number; pageSize?: number }) {
  const response = await http.get<{
    data?: Array<{
      id: string;
      name: string;
      service_url?: string;
      status?: string;
      tool_count?: number;
    }>;
  }>(`${API_PREFIX}/groups`, {
    headers: getBusinessDomainHeaders(),
    params: {
      keyword: query?.keyword || undefined,
      page: query?.page ?? 1,
      page_size: query?.pageSize ?? 50,
    },
  });

  return (response.data.data ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    serviceUrl: group.service_url,
    status: group.status,
    toolCount: group.tool_count,
  }));
}

export async function updateHttpCapability(
  capabilityId: string,
  input: UpdateHttpCapabilityInput,
): Promise<CapabilityRecord> {
  return updateCapability(capabilityId, input);
}

export async function updateCapability(
  capabilityId: string,
  input: UpdateCapabilityInput,
): Promise<CapabilityRecord> {
  const response = await http.patch<BackendCapability>(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}`,
    {
      name: input.name,
      description: input.description,
      openapi_spec: input.openapiSpec,
      url: input.url,
      mode: input.mode,
      headers: input.headers,
      category: input.category,
      code: input.code,
      inputs: input.inputs,
      outputs: input.outputs,
    },
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  return mapCapability(response.data);
}

export async function listCategories(): Promise<CategoryEntry[]> {
  const response = await http.get<{ data?: Array<{ category_type?: string; name?: string }> }>(
    `${API_PREFIX}/categories`,
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  return (response.data.data ?? []).map((item) => ({
    categoryType: item.category_type ?? "other_category",
    name: item.name ?? item.category_type ?? "other_category",
  }));
}

export async function listMcpTools(capabilityId: string): Promise<McpToolEntry[]> {
  const response = await http.get<{ tools?: McpToolEntry[] }>(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/mcp/tools`,
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  return response.data.tools ?? [];
}

export async function downloadSkillPackage(
  capabilityId: string,
  displayName?: string,
): Promise<void> {
  const response = await http.get<Blob>(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/skill/download`,
    {
      headers: getBusinessDomainHeaders(),
      responseType: "blob",
      timeout: 60_000,
      skipErrorToast: true,
    },
  );

  const { parseContentDispositionFilename, sanitizeDownloadFilename, triggerBrowserDownload } =
    await import("@/modules/execution-factory/utils/download-file");

  const contentDisposition = response.headers["content-disposition"] as string | undefined;
  const fromHeader = parseContentDispositionFilename(contentDisposition);
  const filename =
    fromHeader ?? `${sanitizeDownloadFilename(displayName ?? capabilityId, capabilityId)}.zip`;

  triggerBrowserDownload(response.data, filename);
}

export async function updateSkillPackage(capabilityId: string, file: File): Promise<CapabilityRecord> {
  const formData = new FormData();
  formData.append("file_type", "zip");
  formData.append("file", file);

  const response = await http.put<{ capability?: BackendCapability }>(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/skill/package`,
    formData,
    { headers: getBusinessDomainHeaders(), skipErrorToast: true, timeout: 120_000 },
  );

  if (!response.data.capability) {
    throw new Error("Skill package update failed");
  }

  return mapCapability(response.data.capability);
}

export async function deleteCapability(capabilityId: string) {
  await http.delete(`${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}`, {
    headers: getBusinessDomainHeaders(),
  });
}

export async function registerMcpCapability(
  input: RegisterMcpCapabilityInput,
): Promise<CapabilityRecord> {
  const response = await http.post<{ capability?: BackendCapability }>(
    `${API_PREFIX}/capabilities/mcp`,
    {
      name: input.name,
      description: input.description,
      mode: input.mode ?? "sse",
      url: input.url,
      headers: input.headers,
      creation_type: "custom",
      category: input.category ?? "other_category",
    },
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  if (!response.data.capability) {
    throw new Error("MCP 能力注册失败");
  }

  return mapCapability(response.data.capability);
}

export async function registerSkillCapability(
  input: RegisterSkillCapabilityInput,
): Promise<CapabilityRecord> {
  const formData = new FormData();
  const fileType = input.fileType ?? (input.content ? "content" : "zip");
  formData.append("file_type", fileType);
  formData.append("category", input.category ?? "other_category");
  formData.append("source", "custom");

  if (fileType === "content") {
    const content = input.content ?? "";
    const blob = new Blob([content], { type: "text/markdown" });
    formData.append("file", blob, "SKILL.md");
  } else if (input.file) {
    formData.append("file", input.file);
  } else {
    throw new Error("Skill file or content is required");
  }

  const response = await http.post<{ capability?: BackendCapability }>(
    `${API_PREFIX}/capabilities/skill`,
    formData,
    {
      headers: getBusinessDomainHeaders(),
      skipErrorToast: true,
    },
  );

  if (!response.data.capability) {
    throw new Error("Skill 能力注册失败");
  }

  return mapCapability(response.data.capability);
}

export type ImpexImportMode = "create" | "upsert";

export async function exportCapabilityPackage(
  capabilityId: string,
  displayName?: string,
): Promise<void> {
  const response = await http.get<Blob>(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/export`,
    {
      headers: getBusinessDomainHeaders(),
      responseType: "blob",
      timeout: 60_000,
      skipErrorToast: true,
    },
  );

  const { parseContentDispositionFilename, sanitizeDownloadFilename, triggerBrowserDownload } =
    await import("@/modules/execution-factory/utils/download-file");

  const contentDisposition = response.headers["content-disposition"] as string | undefined;
  const fromHeader = parseContentDispositionFilename(contentDisposition);
  const filename =
    fromHeader ?? `${sanitizeDownloadFilename(displayName ?? capabilityId, capabilityId)}.adp.json`;

  triggerBrowserDownload(response.data, filename);
}

export async function importCapabilityPackage(
  file: File,
  mode: ImpexImportMode = "create",
  type?: string,
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);
  if (type) {
    formData.append("type", type);
  }

  const response = await http.post<{ component_type?: string; mode?: string }>(
    `${API_PREFIX}/capabilities/import`,
    formData,
    {
      headers: getBusinessDomainHeaders(),
      timeout: 60_000,
      skipErrorToast: true,
    },
  );

  return {
    componentType: response.data.component_type ?? type ?? "toolbox",
    mode: (response.data.mode as ImpexImportMode | undefined) ?? mode,
  };
}

type BackendCatalogEntry = {
  id: string;
  kind: string;
  name: string;
  description?: string;
  status?: string;
  update_time?: number;
  installed?: boolean;
  version?: string;
};

export async function listCatalog(query?: {
  kind?: CatalogKind;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): Promise<CatalogListResult> {
  const params = new URLSearchParams({
    kind: query?.kind ?? "all",
    page: String(query?.page ?? 1),
    page_size: String(query?.pageSize ?? 20),
  });
  if (query?.keyword) {
    params.set("keyword", query.keyword);
  }

  const response = await http.get<{
    data?: BackendCatalogEntry[];
    total?: number;
    page?: number;
    page_size?: number;
  }>(`${API_PREFIX}/catalog?${params.toString()}`, {
    headers: getBusinessDomainHeaders(),
    skipErrorToast: true,
  });

  return {
    items: (response.data.data ?? []).map((item) => ({
      id: item.id,
      kind: (item.kind as CatalogListResult["items"][number]["kind"]) ?? "http",
      name: item.name,
      description: item.description,
      status: item.status ?? "published",
      updateTime: item.update_time,
      installed: Boolean(item.installed),
      version: item.version,
    })),
    total: response.data.total ?? 0,
    page: response.data.page ?? 1,
    pageSize: response.data.page_size ?? 20,
  };
}

export async function installFromCatalog(input: InstallCatalogInput): Promise<InstallCatalogResult> {
  const response = await http.post<{
    component_type?: string;
    mode?: string;
    capabilities?: Array<{
      id?: string;
      name?: string;
      kind?: string;
      box_id?: string;
      mcp_id?: string;
      skill_id?: string;
    }>;
  }>(
    `${API_PREFIX}/catalog/install`,
    {
      kind: input.kind,
      source_id: input.sourceId,
      mode: input.mode ?? "create",
      name: input.name,
    },
    {
      headers: getBusinessDomainHeaders(),
      timeout: 120_000,
      skipErrorToast: true,
    },
  );

  return {
    componentType: response.data.component_type ?? input.kind,
    mode: response.data.mode ?? input.mode ?? "create",
    capabilities: (response.data.capabilities ?? []).map((item) => ({
      id: item.id ?? "",
      name: item.name ?? "",
      kind: item.kind ?? input.kind,
      boxId: item.box_id,
      mcpId: item.mcp_id,
      skillId: item.skill_id,
    })),
  };
}

export async function createFunctionCapability(input: CreateFunctionCapabilityInput) {
  const response = await http.post<{ capability?: BackendCapability }>(
    `${API_PREFIX}/capabilities/function`,
    {
      name: input.name,
      description: input.description,
      code: input.code,
      inputs: input.inputs,
      outputs: input.outputs,
      group: { mode: "auto" },
    },
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  if (!response.data.capability) {
    throw new Error("Function capability creation failed");
  }

  return mapCapability(response.data.capability);
}

export async function executePython(input: ExecutePythonInput): Promise<ExecutePythonResult> {
  const response = await http.post<{
    output?: unknown;
    stdout?: string;
    stderr?: string;
    error?: string;
    duration_ms?: number;
  }>(`${API_PREFIX}/function/execute`, input, {
    headers: getBusinessDomainHeaders(),
    skipErrorToast: true,
    timeout: 60_000,
  });

  return {
    output: response.data.output,
    stdout: response.data.stdout,
    stderr: response.data.stderr,
    error: response.data.error,
    durationMs: response.data.duration_ms,
  };
}

export async function getPythonTemplate() {
  const response = await http.get<{ template?: string }>(`${API_PREFIX}/template/python`, {
    headers: getBusinessDomainHeaders(),
    skipErrorToast: true,
  });

  return response.data.template ?? "";
}

export async function parseMcpSse(input: ParseMcpSseInput): Promise<McpParsedTool[]> {
  const response = await http.post<{ tools?: McpParsedTool[] }>(
    `${API_PREFIX}/capabilities/mcp/parse-sse`,
    {
      url: input.url,
      mode: input.mode ?? "sse",
      headers: input.headers,
    },
    { headers: getBusinessDomainHeaders(), skipErrorToast: true, timeout: 60_000 },
  );

  return response.data.tools ?? [];
}

export async function getSkillContent(capabilityId: string): Promise<SkillContentResult> {
  const response = await http.get<{
    content?: string;
    file_type?: string;
    files?: Array<{
      rel_path?: string;
      file_type?: string;
      mime_type?: string;
      size?: number;
    }>;
    download_url?: string;
  }>(`${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/skill/content`, {
    headers: getBusinessDomainHeaders(),
    skipErrorToast: true,
  });

  const files: SkillFileSummary[] = (response.data.files ?? [])
    .filter((item) => item.rel_path)
    .map((item) => ({
      relPath: item.rel_path!,
      fileType: item.file_type,
      mimeType: item.mime_type,
      size: item.size,
    }));

  return {
    content: response.data.content,
    fileType: response.data.file_type,
    files,
    downloadUrl: response.data.download_url,
  };
}

export async function readSkillFile(capabilityId: string, relPath: string) {
  const response = await http.post<{
    rel_path?: string;
    content?: string;
    url?: string;
    mime_type?: string;
    file_type?: string;
    size?: number;
  }>(
    `${API_PREFIX}/capabilities/${encodeURIComponent(capabilityId)}/skill/files/read`,
    { rel_path: relPath, response_mode: "content" },
    { headers: getBusinessDomainHeaders(), skipErrorToast: true },
  );

  return {
    relPath: response.data.rel_path ?? relPath,
    content: response.data.content,
    url: response.data.url,
    mimeType: response.data.mime_type,
    fileType: response.data.file_type,
    size: response.data.size,
  };
}

export async function getLabMeta(): Promise<LabMeta> {
  const response = await http.get<LabMeta>(`${API_PREFIX}/meta`, {
    headers: getBusinessDomainHeaders(),
    skipErrorToast: true,
  });

  return response.data;
}
