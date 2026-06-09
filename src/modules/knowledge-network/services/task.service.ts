import { http } from "@/framework/request/http";
import {
  unwrapSingleEntryResponse,
  type SingleEntryResponse,
} from "@/framework/request/normalize";
import type { KnowledgeNetworkTaskRecord } from "@/modules/knowledge-network/types/knowledge-network";
import type {
  BackendListResponse,
  BackendTask,
  BackendTaskChild,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  mapTask,
  mapTaskChild,
} from "@/modules/knowledge-network/services/mappers";
import {
  mockTaskChildren,
  mockTasks,
} from "@/modules/knowledge-network/services/mock/state";
import {
  formatTimestamp,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";

export async function listKnowledgeNetworkTasks(networkId: string) {
  if (useMock) {
    return wait(mockTasks[networkId] ?? []);
  }

  const response = await http.get<BackendListResponse<BackendTask>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/jobs`,
    { params: { limit: 200, offset: 0, sort: "create_time", direction: "desc" } },
  );

  return response.data.entries.map(mapTask);
}

export async function createKnowledgeNetworkTask(
  networkId: string,
  input: { jobType: KnowledgeNetworkTaskRecord["jobType"]; name: string },
) {
  if (useMock) {
    const nextTask: KnowledgeNetworkTaskRecord = {
      id: crypto.randomUUID(),
      name: input.name,
      jobType: input.jobType,
      state: "pending",
      startTime: formatTimestamp(Date.now()),
      finishTime: "--",
      duration: "--",
    };

    mockTasks[networkId] = [nextTask, ...(mockTasks[networkId] ?? [])];
    await wait(undefined);
    return nextTask;
  }

  const response = await http.post<BackendTask>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/jobs`,
    {
      job_type: input.jobType,
      name: input.name,
    },
  );

  return mapTask(response.data);
}

export async function deleteKnowledgeNetworkTask(networkId: string, taskId: string) {
  if (useMock) {
    mockTasks[networkId] = (mockTasks[networkId] ?? []).filter((item) => item.id !== taskId);
    delete mockTaskChildren[taskId];
    await wait(undefined);
    return;
  }

  await http.delete(`/bkn-backend/v1/knowledge-networks/${networkId}/jobs/${taskId}`);
}

export async function getKnowledgeNetworkTask(networkId: string, taskId: string) {
  if (useMock) {
    return wait((mockTasks[networkId] ?? []).find((item) => item.id === taskId) ?? null);
  }

  const response = await http.get<SingleEntryResponse<BackendTask>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/jobs/${taskId}`,
  );

  const item = unwrapSingleEntryResponse(response.data);
  return item ? mapTask(item) : null;
}

export async function getKnowledgeNetworkTaskDetail(
  networkId: string,
  taskId: string,
) {
  if (useMock) {
    return wait(mockTaskChildren[taskId] ?? []);
  }

  const response = await http.get<BackendListResponse<BackendTaskChild>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/jobs/${taskId}/tasks`,
    { params: { limit: 200, offset: 0 } },
  );

  return response.data.entries.map(mapTaskChild);
}
