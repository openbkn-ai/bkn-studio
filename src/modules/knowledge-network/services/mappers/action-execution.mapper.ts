import type {
  ActionTypeExecutionLog,
  ActionTypeExecutionLogDetail,
  ActionTypeExecutionLogListResult,
  ActionTypeExecutionLogQuery,
  ActionTypeExecutionLogResultItem,
  ActionTypeExecutionStatus,
} from "@/modules/knowledge-network/types/knowledge-network";
import { formatTimestamp } from "@/modules/knowledge-network/services/shared/runtime";

export type BackendActionExecutionLog = {
  action_type_id?: string;
  action_type_name?: string;
  duration_ms?: number;
  end_time?: number;
  executor?: { id?: string; name?: string };
  failed_count?: number;
  id: string;
  results?: Array<{
    _display?: string;
    duration_ms?: number;
    error_message?: string;
    status?: "failed" | "success";
  }>;
  start_time?: number;
  status?: ActionTypeExecutionStatus;
  success_count?: number;
  total_count?: number;
  trigger_type?: string;
};

export type BackendActionExecutionLogList = {
  entries?: BackendActionExecutionLog[];
  total_count?: number;
};

function mapExecutionLog(item: BackendActionExecutionLog): ActionTypeExecutionLog {
  return {
    actionTypeId: item.action_type_id ?? "",
    actionTypeName: item.action_type_name ?? "",
    durationMs: item.duration_ms ?? 0,
    failedCount: item.failed_count ?? 0,
    id: item.id,
    startTime: formatTimestamp(item.start_time),
    status: item.status ?? "pending",
    successCount: item.success_count ?? 0,
    totalCount: item.total_count ?? 0,
    triggerType: item.trigger_type ?? "manual",
  };
}

function mapExecutionLogResults(
  results?: BackendActionExecutionLog["results"],
): ActionTypeExecutionLogResultItem[] {
  return (results ?? []).map((item) => ({
    displayName: item._display,
    durationMs: item.duration_ms,
    errorMessage: item.error_message,
    status: item.status ?? "success",
  }));
}

export function mapActionTypeExecutionLogList(
  response: BackendActionExecutionLogList,
): ActionTypeExecutionLogListResult {
  return {
    entries: (response.entries ?? []).map(mapExecutionLog),
    totalCount: response.total_count ?? response.entries?.length ?? 0,
  };
}

export function mapActionTypeExecutionLogDetail(
  item: BackendActionExecutionLog,
): ActionTypeExecutionLogDetail {
  return {
    ...mapExecutionLog(item),
    endTime: item.end_time ? formatTimestamp(item.end_time) : undefined,
    executorName: item.executor?.name ?? item.executor?.id,
    results: mapExecutionLogResults(item.results),
  };
}

export function buildActionExecutionLogQueryParams(query: ActionTypeExecutionLogQuery) {
  const params: Record<string, string | number | boolean> = {
    limit: query.limit ?? 10,
    need_total: true,
    offset: query.offset ?? 0,
  };

  if (query.actionTypeId) {
    params.action_type_id = query.actionTypeId;
  }
  if (query.keyword?.trim()) {
    params.keyword = query.keyword.trim();
  }
  if (query.status) {
    params.status = query.status;
  }
  if (query.triggerType) {
    params.trigger_type = query.triggerType;
  }

  return params;
}
