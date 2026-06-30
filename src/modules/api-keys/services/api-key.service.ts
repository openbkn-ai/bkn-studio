import { http } from "@/framework/request/http";
import type {
  ApiKey,
  IssueApiKeyPayload,
  IssuedApiKey,
} from "@/modules/api-keys/types/api-key";

const API_PREFIX = "/safe/v1/me/api-keys";
const useMock = import.meta.env.VITE_USE_MOCK === "true";

type BackendApiKey = {
  id: string;
  key_id: string;
  name: string;
  key?: string;
  masked?: string;
  enabled: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

function mapApiKey(item: BackendApiKey): ApiKey {
  return {
    id: item.id,
    keyId: item.key_id,
    name: item.name,
    masked: item.masked ?? `bak_${item.key_id}_••••`,
    enabled: item.enabled,
    expiresAt: item.expires_at,
    lastUsedAt: item.last_used_at,
    createdAt: item.created_at,
  };
}

function mapIssued(item: BackendApiKey): IssuedApiKey {
  return { ...mapApiKey(item), key: item.key ?? "" };
}

/* ----------------------------- mock（本地开发） ----------------------------- */
const mockApiKeys: BackendApiKey[] = [
  {
    id: "mock-1",
    key_id: "b3ffa7f4mock",
    name: "我的 Cursor",
    masked: "bak_b3ff****mock",
    enabled: true,
    expires_at: "2027-06-26T11:49:59+08:00",
    last_used_at: "2026-06-20T09:12:00+08:00",
    created_at: "2026-06-01T11:49:59+08:00",
  },
];

/** 由完整明文派生掩码（mock 用；真实环境由后端返回 masked）。 */
function maskFromPlaintext(plain: string): string {
  return plain.length <= 12 ? plain : `${plain.slice(0, 8)}****${plain.slice(-4)}`;
}

function oneYearLater(): string {
  const now = new Date();
  now.setFullYear(now.getFullYear() + 1);
  return now.toISOString();
}

function mockPlaintext(): string {
  const rand = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 36).toString(36)).join("");
  return `bak_${rand(12)}_${rand(24)}`;
}

/* ------------------------------- 接口 ------------------------------- */
export async function listApiKeys(): Promise<ApiKey[]> {
  if (useMock) {
    return mockApiKeys.map(mapApiKey);
  }
  const response = await http.get<{ keys?: BackendApiKey[] }>(API_PREFIX);
  return (response.data.keys ?? []).map(mapApiKey);
}

export async function issueApiKey(payload: IssueApiKeyPayload): Promise<IssuedApiKey> {
  if (useMock) {
    const created = new Date().toISOString();
    const plain = mockPlaintext();
    const item: BackendApiKey = {
      id: `mock-${mockApiKeys.length + 1}-${created}`,
      key_id: `mock${mockApiKeys.length + 1}`,
      name: payload.name,
      key: plain,
      masked: maskFromPlaintext(plain),
      enabled: true,
      expires_at: payload.neverExpire ? null : payload.expiresAt ?? oneYearLater(),
      last_used_at: null,
      created_at: created,
    };
    mockApiKeys.unshift(item);
    return mapIssued(item);
  }
  const body: Record<string, unknown> = { name: payload.name };
  if (payload.neverExpire) {
    body.never_expire = true;
  } else if (payload.expiresAt) {
    body.expires_at = payload.expiresAt;
  }
  const response = await http.post<BackendApiKey>(API_PREFIX, body);
  return mapIssued(response.data);
}

export async function revokeApiKey(id: string): Promise<void> {
  if (useMock) {
    const index = mockApiKeys.findIndex((item) => item.id === id);
    if (index >= 0) {
      mockApiKeys.splice(index, 1);
    }
    return;
  }
  await http.delete(`${API_PREFIX}/${id}`);
}

export async function regenerateApiKey(id: string): Promise<IssuedApiKey> {
  if (useMock) {
    const item = mockApiKeys.find((entry) => entry.id === id);
    if (!item) {
      throw new Error("api key not found");
    }
    item.key = mockPlaintext();
    item.masked = maskFromPlaintext(item.key);
    item.last_used_at = null;
    return mapIssued(item);
  }
  const response = await http.post<BackendApiKey>(`${API_PREFIX}/${id}/regenerate`);
  return mapIssued(response.data);
}
