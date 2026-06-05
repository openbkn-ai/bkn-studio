import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type {
  ImpexComponentType,
  ImpexExportResult,
  ImpexImportMode,
  ImpexImportResult,
} from "@/modules/execution-factory/types/impex";

const API_PREFIX = "/agent-operator-integration/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
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
    { headers: getBusinessDomainHeaders() },
  );

  return response.data;
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

  await http.post(`${API_PREFIX}/impex/import/${type}`, formData, {
    headers: {
      ...getBusinessDomainHeaders(),
      "Content-Type": "multipart/form-data",
    },
  });

  return { type };
}
