import { http } from "@/framework/request/http";
import type {
  StarterListQuery,
  StarterListResult,
  StarterMutationInput,
  StarterRecord,
} from "@/modules/starter/types/starter";

let mockRecords: StarterRecord[] = [
  {
    id: "1",
    name: "User Center",
    owner: "Alice",
    status: "enabled",
    updatedAt: "2026-06-02 10:30",
  },
  {
    id: "2",
    name: "Data Catalog",
    owner: "Bob",
    status: "enabled",
    updatedAt: "2026-06-01 16:45",
  },
  {
    id: "3",
    name: "Asset Workflow",
    owner: "Carol",
    status: "disabled",
    updatedAt: "2026-05-30 09:20",
  },
];

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 180);
  });

export async function listStarterRecords(
  query: StarterListQuery,
): Promise<StarterListResult> {
  if (!useMock) {
    const response = await http.get<StarterListResult>("/starter/records", {
      params: query,
    });

    return response.data;
  }

  const filtered = mockRecords.filter((record) =>
    record.name.toLowerCase().includes(query.keyword.toLowerCase()),
  );
  const startIndex = (query.page - 1) * query.pageSize;
  const items = filtered.slice(startIndex, startIndex + query.pageSize);

  return wait({
    items,
    total: filtered.length,
  });
}

export async function getStarterRecord(id: string) {
  if (!useMock) {
    const response = await http.get<StarterRecord>(`/starter/records/${id}`);
    return response.data;
  }

  return wait(mockRecords.find((record) => record.id === id) ?? null);
}

export async function createStarterRecord(input: StarterMutationInput) {
  if (!useMock) {
    await http.post("/starter/records", input);
    return;
  }

  mockRecords = [
    {
      id: crypto.randomUUID(),
      name: input.name,
      owner: input.owner,
      status: "enabled",
      updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    },
    ...mockRecords,
  ];

  await wait(undefined);
}

export async function updateStarterRecord(
  id: string,
  input: StarterMutationInput,
) {
  if (!useMock) {
    await http.put(`/starter/records/${id}`, input);
    return;
  }

  mockRecords = mockRecords.map((record) =>
    record.id === id
      ? {
          ...record,
          name: input.name,
          owner: input.owner,
          updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        }
      : record,
  );

  await wait(undefined);
}

export async function toggleStarterRecord(id: string) {
  if (!useMock) {
    await http.patch(`/starter/records/${id}/status`);
    return;
  }

  mockRecords = mockRecords.map((record) =>
    record.id === id
      ? {
          ...record,
          status: record.status === "enabled" ? "disabled" : "enabled",
          updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        }
      : record,
  );

  await wait(undefined);
}
