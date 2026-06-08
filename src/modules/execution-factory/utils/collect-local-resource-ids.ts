import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

const API_PREFIX = "/agent-operator-integration/v1";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";
/** Backend validates page_size with max=100. */
const ID_PAGE_SIZE = 100;
const CACHE_TTL_MS = 2 * 60 * 1000;
const OPERATOR_CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_KEY_PREFIX = "ef-local-ids:";
const inflightRequests = new Map<string, Promise<Set<string>>>();

type PagedListResponse = {
  data?: Array<{
    box_id?: string;
    mcp_id?: string;
    operator_id?: string;
    skill_id?: string;
  }>;
  has_next?: boolean;
  total?: number;
};

const MAX_ID_PAGES = 20;

export type CollectLocalResourceIdsOptions = {
  /** Market installed tags only need the first page of local IDs in most domains. */
  singlePage?: boolean;
  signal?: AbortSignal;
  useCache?: boolean;
};

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
}

function cacheKey(activeTab: ExecutionUnitTab) {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return `${CACHE_KEY_PREFIX}${businessDomainId}:${activeTab}`;
}

function readCachedIds(activeTab: ExecutionUnitTab): Set<string> | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(activeTab));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { at: number; ids: string[] };
    const ttl = activeTab === "operator" ? OPERATOR_CACHE_TTL_MS : CACHE_TTL_MS;
    if (Date.now() - parsed.at > ttl) {
      sessionStorage.removeItem(cacheKey(activeTab));
      return null;
    }

    return new Set(parsed.ids);
  } catch {
    return null;
  }
}

function writeCachedIds(activeTab: ExecutionUnitTab, ids: Set<string>) {
  try {
    sessionStorage.setItem(
      cacheKey(activeTab),
      JSON.stringify({ at: Date.now(), ids: [...ids] }),
    );
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function invalidateLocalResourceIdsCache(activeTab?: ExecutionUnitTab) {
  if (activeTab) {
    sessionStorage.removeItem(cacheKey(activeTab));
    return;
  }

  for (const tab of ["operator", "toolbox", "mcp", "skill"] as const) {
    sessionStorage.removeItem(cacheKey(tab));
  }
}

async function fetchIdPage(
  path: string,
  page: number,
  signal?: AbortSignal,
): Promise<PagedListResponse> {
  const response = await http.get<PagedListResponse>(path, {
    headers: getBusinessDomainHeaders(),
    params: {
      page,
      page_size: ID_PAGE_SIZE,
      sort_by: "update_time",
      sort_order: "desc",
    },
    signal,
    skipErrorToast: true,
    timeout: 45_000,
  });

  return response.data;
}

async function collectPagedIds(
  path: string,
  pickId: (item: NonNullable<PagedListResponse["data"]>[number]) => string | undefined,
  options: CollectLocalResourceIdsOptions = {},
): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 1;
  let total = 0;
  const maxPages = options.singlePage ? 1 : MAX_ID_PAGES;

  do {
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const result = await fetchIdPage(path, page, options.signal);
    total = result.total ?? ids.size;
    const batch = result.data ?? [];

    if (batch.length === 0) {
      break;
    }

    for (const item of batch) {
      const id = pickId(item);
      if (id) {
        ids.add(id);
      }
    }

    if (options.singlePage || result.has_next === false || ids.size >= total) {
      break;
    }

    page += 1;
  } while (page <= maxPages);

  return ids;
}

export async function collectLocalResourceIds(
  activeTab: ExecutionUnitTab,
  options: CollectLocalResourceIdsOptions = {},
): Promise<Set<string>> {
  if (options.useCache !== false) {
    const cached = readCachedIds(activeTab);
    if (cached) {
      return cached;
    }
  }

  const inflightKey = `${cacheKey(activeTab)}:${options.singlePage ? "single" : "all"}`;
  const inflight = inflightRequests.get(inflightKey);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    let ids: Set<string>;

    if (activeTab === "operator") {
      ids = await collectPagedIds(
        `${API_PREFIX}/operator/info/list`,
        (item) => item.operator_id,
        options,
      );
    } else if (activeTab === "toolbox") {
      ids = await collectPagedIds(`${API_PREFIX}/tool-box/list`, (item) => item.box_id, options);
    } else if (activeTab === "mcp") {
      ids = await collectPagedIds(`${API_PREFIX}/mcp/list`, (item) => item.mcp_id, options);
    } else if (activeTab === "skill") {
      ids = await collectPagedIds(`${API_PREFIX}/skills`, (item) => item.skill_id, options);
    } else {
      ids = new Set();
    }

    writeCachedIds(activeTab, ids);
    return ids;
  })().finally(() => {
    inflightRequests.delete(inflightKey);
  });

  inflightRequests.set(inflightKey, request);
  return request;
}
