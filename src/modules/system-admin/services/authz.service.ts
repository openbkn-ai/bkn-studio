import { http } from "@/framework/request/http";
import {
  listDomainObjects,
  resolveGrantNames,
} from "@/modules/system-admin/services/authz-objects.service";
import type {
  AuthorizableObject,
  AuthzSummary,
  ObjectGrant,
  ObjectGrantInput,
} from "@/modules/system-admin/types/authz";

/**
 * 对象级授权服务层 —— 对接 bkn-safe `/api/safe/v1/admin/object-grants`
 * (GET/POST/DELETE, 管理员 Bearer Token)。默认走前端 mock；
 * `VITE_USE_MOCK=false` 时打真实后端。契约见
 * kowell-core/bkn-safe/docs/frontend-object-grants-integration.md。
 *
 *   - 授权模型 = {accessor_id, resource:{type,id}, operations[]}，被授权方只支持用户。
 *   - POST = 整套替换（set 语义）；operations 非空；resource.id 必须具体，无 `*`。
 *   - DELETE 按 {accessor_id, resource} 撤单个用户在该对象上的授权。
 *   - bkn-safe 不存资源名：真实模式下对象名需前端从各领域服务解析（见
 *     listAuthorizableObjects 的 TODO）。
 */
const useMock = import.meta.env.VITE_USE_MOCK === "true";

const ADMIN = "/safe/v1/admin";

const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 160);
  });

// ---- mock store -------------------------------------------------------------

// 可授权对象（演示用；真实模式从各领域服务取）。名字反范式化进 grant，列表直接用。
const authzObjects: AuthorizableObject[] = [
  { type: "knowledge_network", id: "kn-customer-360", name: "客户 360 知识网络", sub: "customer" },
  { type: "knowledge_network", id: "kn-finance-risk", name: "金融风险知识网络", sub: "finance" },
  { type: "catalog", id: "cat-customer-mysql", name: "客户主数据 · MySQL", sub: "mysql" },
  { type: "catalog", id: "cat-events-kafka", name: "行为事件 · Kafka", sub: "kafka" },
  { type: "small_model", id: "bge-m3", name: "BGE-M3", sub: "bge · embedding" },
  { type: "large_model", id: "qwen3-72b", name: "Qwen3-72B-Instruct", sub: "qwen · chat" },
  { type: "operator", id: "op-text-clean", name: "文本清洗算子", sub: "transform" },
  { type: "tool_box", id: "tb-web-search", name: "联网搜索工具箱", sub: "toolbox" },
  { type: "mcp", id: "mcp-filesystem", name: "Filesystem MCP", sub: "mcp" },
  { type: "skill", id: "sk-sql-gen", name: "SQL 生成技能", sub: "skill" },
];

const objMeta = (type: string, id: string) =>
  authzObjects.find((item) => item.type === type && item.id === id);

const seed = (
  objType: string,
  objId: string,
  accessorId: string,
  operations: string[],
): ObjectGrant => {
  const meta = objMeta(objType, objId);
  return { accessorId, objType, objId, objName: meta?.name ?? objId, objSub: meta?.sub, operations };
};

let grants: ObjectGrant[] = [
  seed("knowledge_network", "kn-customer-360", "u-li", ["view_detail", "modify", "data_query"]),
  seed("knowledge_network", "kn-finance-risk", "u-li", ["view_detail"]),
  seed("catalog", "cat-customer-mysql", "u-li", ["view_detail", "modify", "task_manage"]),
  seed("catalog", "cat-customer-mysql", "u-chen", ["view_detail"]),
  seed("small_model", "bge-m3", "u-chen", ["display", "execute"]),
  seed("large_model", "qwen3-72b", "u-chen", ["display", "execute"]),
  seed("operator", "op-text-clean", "u-wang", ["view", "execute"]),
  seed("tool_box", "tb-web-search", "u-wang", ["view", "execute", "publish"]),
  seed("mcp", "mcp-filesystem", "u-wang", ["view", "execute"]),
  seed("skill", "sk-sql-gen", "u-chen", ["view", "execute"]),
];

const sameTarget = (
  grant: ObjectGrant,
  input: Pick<ObjectGrantInput, "accessorId" | "objType" | "objId">,
) => grant.accessorId === input.accessorId && grant.objType === input.objType && grant.objId === input.objId;

const clone = (grant: ObjectGrant): ObjectGrant => ({ ...grant, operations: [...grant.operations] });

// ---- reads ------------------------------------------------------------------

export async function listObjectGrants(): Promise<ObjectGrant[]> {
  if (useMock) {
    return wait(grants.map(clone));
  }
  const response = await http.get<{ entries?: BackendEntry[] }>(`${ADMIN}/object-grants`);
  const mapped = (response.data.entries ?? []).map(mapEntry);
  // bkn-safe 只返 type:id，对象名从各领域服务解析回填。
  return resolveGrantNames(mapped);
}

export async function listAuthorizableObjects(objType?: string): Promise<AuthorizableObject[]> {
  if (useMock) {
    return wait(authzObjects.filter((item) => !objType || item.type === objType).map((item) => ({ ...item })));
  }
  const objects = await listDomainObjects();
  return objType ? objects.filter((item) => item.type === objType) : objects;
}

export function summarizeGrants(list: ObjectGrant[]): AuthzSummary {
  const objects = new Set(list.map((g) => `${g.objType}:${g.objId}`));
  const grantees = new Set(list.map((g) => g.accessorId));
  return { grants: list.length, objects: objects.size, grantees: grantees.size };
}

// ---- writes -----------------------------------------------------------------

/** 新增/更新（整套替换该用户在该对象上的操作）。operations 为空 = 撤销。 */
export async function upsertObjectGrant(input: ObjectGrantInput): Promise<void> {
  if (!input.operations.length) {
    await revokeObjectGrant(input.accessorId, input.objType, input.objId);
    return;
  }
  if (useMock) {
    const existing = grants.find((g) => sameTarget(g, input));
    if (existing) {
      existing.operations = [...input.operations];
      existing.objName = input.objName;
      existing.objSub = input.objSub;
    } else {
      grants = [
        ...grants,
        {
          accessorId: input.accessorId,
          objType: input.objType,
          objId: input.objId,
          objName: input.objName,
          objSub: input.objSub,
          operations: [...input.operations],
        },
      ];
    }
    await wait(undefined);
    return;
  }
  await http.post(`${ADMIN}/object-grants`, {
    accessor_id: input.accessorId,
    resource: { type: input.objType, id: input.objId },
    operations: input.operations,
  });
}

export async function revokeObjectGrant(
  accessorId: string,
  objType: string,
  objId: string,
): Promise<void> {
  if (useMock) {
    grants = grants.filter(
      (g) => !(g.accessorId === accessorId && g.objType === objType && g.objId === objId),
    );
    await wait(undefined);
    return;
  }
  await http.request({
    url: `${ADMIN}/object-grants`,
    method: "DELETE",
    data: { accessor_id: accessorId, resource: { type: objType, id: objId } },
  });
}

// ---- backend mapper (real path) --------------------------------------------

type BackendEntry = {
  accessor_id?: string;
  operations?: string[];
  resource?: { id?: string; type?: string };
};

function mapEntry(item: BackendEntry): ObjectGrant {
  const objId = item.resource?.id ?? "";
  return {
    accessorId: item.accessor_id ?? "",
    objType: item.resource?.type ?? "",
    objId,
    // 后端不返资源名；真实模式下名字由调用方用 listAuthorizableObjects 解析覆盖。
    objName: objId,
    operations: item.operations ?? [],
  };
}
