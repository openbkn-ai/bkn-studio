import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

const API_PREFIX = "/agent-operator-integration/v1";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";
/** Backend validates page_size with max=100. */
const ID_PAGE_SIZE = 100;

type PagedListResponse = {
  data?: Array<{ box_id?: string; mcp_id?: string; operator_id?: string }>;
  total?: number;
};

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
}

async function fetchIdPage(path: string, page: number): Promise<PagedListResponse> {
  const response = await http.get<PagedListResponse>(path, {
    headers: getBusinessDomainHeaders(),
    params: {
      page,
      page_size: ID_PAGE_SIZE,
      sort_by: "update_time",
      sort_order: "desc",
    },
    skipErrorToast: true,
  });

  return response.data;
}

async function collectPagedIds(
  path: string,
  pickId: (item: NonNullable<PagedListResponse["data"]>[number]) => string | undefined,
): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 1;
  let total = 0;

  do {
    const result = await fetchIdPage(path, page);
    total = result.total ?? 0;

    for (const item of result.data ?? []) {
      const id = pickId(item);
      if (id) {
        ids.add(id);
      }
    }

    page += 1;
  } while (ids.size < total);

  return ids;
}

export async function collectLocalResourceIds(
  activeTab: ExecutionUnitTab,
): Promise<Set<string>> {
  if (activeTab === "operator") {
    return collectPagedIds(`${API_PREFIX}/operator/info/list`, (item) => item.operator_id);
  }

  if (activeTab === "toolbox") {
    return collectPagedIds(`${API_PREFIX}/tool-box/list`, (item) => item.box_id);
  }

  if (activeTab === "mcp") {
    return collectPagedIds(`${API_PREFIX}/mcp/list`, (item) => item.mcp_id);
  }

  return new Set();
}
