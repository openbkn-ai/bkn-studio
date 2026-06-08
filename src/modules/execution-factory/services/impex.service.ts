import { http } from "@/framework/request/http";
import {
  parseContentDispositionFilename,
  sanitizeDownloadFilename,
  triggerBrowserDownload,
} from "@/modules/execution-factory/utils/download-file";
import { getExecutionFactoryApiHeaders } from "@/modules/execution-factory/utils/execution-factory-api-headers";
import type {
  ImpexComponentType,
  ImpexExportResult,
  ImpexImportMode,
  ImpexImportResult,
} from "@/modules/execution-factory/types/impex";

const API_PREFIX = "/agent-operator-integration/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const IMPEX_EXPORT_TIMEOUT_MS = 60_000;

function resolveExportFilename(
  contentDisposition: string | undefined,
  displayName: string | undefined,
  fallbackId: string,
) {
  const fromHeader = parseContentDispositionFilename(contentDisposition);
  if (fromHeader) {
    return fromHeader;
  }

  const baseName = sanitizeDownloadFilename(displayName ?? fallbackId, fallbackId);
  return `${baseName}.adp`;
}

export async function exportComponent(
  type: ImpexComponentType,
  id: string,
): Promise<ImpexExportResult> {
  if (useMock) {
    if (type === "operator") {
      return {
        operator: {
          configs: [{ operator_id: id, version: "v1.0.0" }],
        },
      };
    }

    if (type === "toolbox") {
      return {
        toolbox: {
          configs: [{ box_id: id, box_name: `Imported ${id}` }],
        },
      };
    }

    return {
      mcp: {
        configs: [{ mcp_id: id, name: `Imported ${id}` }],
      },
    };
  }

  const response = await http.get<ImpexExportResult>(
    `${API_PREFIX}/impex/export/${type}/${id}`,
    {
      headers: getExecutionFactoryApiHeaders(),
      timeout: IMPEX_EXPORT_TIMEOUT_MS,
      skipErrorToast: true,
    },
  );

  return response.data;
}

export async function downloadComponentExport(
  type: ImpexComponentType,
  id: string,
  displayName?: string,
): Promise<void> {
  if (useMock) {
    const payload = await exportComponent(type, id);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    triggerBrowserDownload(
      blob,
      resolveExportFilename(undefined, displayName, id),
    );
    return;
  }

  const response = await http.get<Blob>(
    `${API_PREFIX}/impex/export/${type}/${id}`,
    {
      headers: getExecutionFactoryApiHeaders(),
      responseType: "blob",
      timeout: IMPEX_EXPORT_TIMEOUT_MS,
      skipErrorToast: true,
    },
  );

  const contentDisposition = response.headers["content-disposition"] as
    | string
    | undefined;

  triggerBrowserDownload(
    response.data,
    resolveExportFilename(contentDisposition, displayName, id),
  );
}

async function postImportFormData(
  type: ImpexComponentType,
  formData: FormData,
): Promise<void> {
  await http.post(`${API_PREFIX}/impex/import/${type}`, formData, {
    headers: {
      ...getExecutionFactoryApiHeaders(),
      "Content-Type": "multipart/form-data",
    },
    timeout: IMPEX_EXPORT_TIMEOUT_MS,
    skipErrorToast: true,
  });
}

export async function importComponent(
  type: ImpexComponentType,
  payload: ImpexExportResult,
  mode: ImpexImportMode,
): Promise<ImpexImportResult> {
  if (useMock) {
    return {
      type,
      id: `imported_${type}_${Date.now()}`,
    };
  }

  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(payload)], { type: "application/json" }));
  formData.append("mode", mode);
  await postImportFormData(type, formData);

  return { type };
}

export async function importComponentFile(
  type: ImpexComponentType,
  file: File,
  mode: ImpexImportMode,
): Promise<ImpexImportResult> {
  if (useMock) {
    return {
      type,
      id: `imported_${type}_${Date.now()}`,
    };
  }

  const formData = new FormData();
  formData.append("data", file);
  formData.append("mode", mode);
  await postImportFormData(type, formData);

  return { type };
}
