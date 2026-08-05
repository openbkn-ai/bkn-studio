/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";
import { buildLogicPropertyTrialBody } from "@/modules/knowledge-network/lib/build-logic-property-trial-request";
import {
  createBknLifecycle,
  lifecycleEnv,
  memoryExternalKeyStore,
  withManagedTurn,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import {
  CONTEXT_LOADER_OPS,
  parseContextLoaderPayload,
  sendRequest,
  type ContextLoaderEnv,
  type McpAuth,
} from "@/modules/knowledge-network/services/context-loader.service";
import { useMock, wait } from "@/modules/knowledge-network/services/shared/runtime";
import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/knowledge-network";

const LOGIC_PROPERTY_OP = CONTEXT_LOADER_OPS.find((op) => op.id === "get_logic_properties_values");

export type ObjectTypeLogicPropertyTrialRequest = {
  instanceIdentities: Array<Record<string, string | number>>;
  /** Agent-retrieval `kn_id`；缺省时回退为 `networkId`。 */
  knId?: string;
  logicProperties: ObjectTypeLogicProperty[];
  /** 路由 / bkn-backend 使用的网络 id。 */
  networkId: string;
  objectTypeId: string;
  returnDebug?: boolean;
};

export type ObjectTypeLogicPropertyTrialRow = {
  instanceIdentity: Record<string, string | number>;
  values: Record<string, unknown>;
};

function resolveTrialKnId(request: ObjectTypeLogicPropertyTrialRequest) {
  return request.knId?.trim() || request.networkId;
}

function resolveTrialPropertyNames(logicProperties: ObjectTypeLogicProperty[]) {
  return logicProperties.map((property) => property.name);
}

function resolveTrialReturnDebug(explicit?: boolean) {
  return explicit ?? import.meta.env.DEV;
}

function normalizeLogicPropertyTrialRows(
  instanceIdentities: Array<Record<string, string | number>>,
  propertyNames: string[],
  payload: unknown,
): ObjectTypeLogicPropertyTrialRow[] {
  if (!payload || typeof payload !== "object") {
    return instanceIdentities.map((instanceIdentity) => ({
      instanceIdentity,
      values: Object.fromEntries(propertyNames.map((name) => [name, null])),
    }));
  }

  const root = payload as {
    datas?: unknown;
    data?: unknown;
    entries?: unknown;
    results?: unknown;
  };

  const rows = root.datas ?? root.data ?? root.entries ?? root.results;
  if (!Array.isArray(rows)) {
    return instanceIdentities.map((instanceIdentity, index) => ({
      instanceIdentity,
      values:
        index === 0 && !Array.isArray(rows)
          ? (payload as Record<string, unknown>)
          : Object.fromEntries(propertyNames.map((name) => [name, null])),
    }));
  }

  return instanceIdentities.map((instanceIdentity, index) => {
    const row: unknown = rows[index];
    if (!row || typeof row !== "object") {
      return {
        instanceIdentity,
        values: Object.fromEntries(propertyNames.map((name) => [name, null])),
      };
    }

    const record = row as Record<string, unknown>;
    const values: Record<string, unknown> = Object.fromEntries(
      propertyNames.map((name) => {
        if (name in record) {
          return [name, record[name]];
        }

        const properties = record.properties;
        if (properties && typeof properties === "object" && name in properties) {
          return [name, (properties as Record<string, unknown>)[name]];
        }

        return [name, null];
      }),
    );

    return { instanceIdentity, values };
  });
}

function createTrialAuth(): McpAuth {
  const runtimeConfig = getRuntimeConfig();
  return {
    getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
    refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
  };
}

function createTrialEnv(knId: string): ContextLoaderEnv {
  const runtimeConfig = getRuntimeConfig();
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return {
    base,
    knId,
    token: runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
  };
}

async function invokeLogicPropertyTrial(
  request: ObjectTypeLogicPropertyTrialRequest,
): Promise<unknown> {
  if (!LOGIC_PROPERTY_OP) {
    throw new Error("get_logic_properties_values is not configured.");
  }

  const knId = resolveTrialKnId(request);
  const env = createTrialEnv(knId);
  const auth = createTrialAuth();
  const lifecycle = createBknLifecycle(lifecycleEnv(env.base, knId), auth, {
    externalKeyStore: memoryExternalKeyStore(),
    oneShot: true,
  });
  const bodyText = JSON.stringify(
    buildLogicPropertyTrialBody({
      instanceIdentities: request.instanceIdentities,
      knId,
      logicProperties: request.logicProperties,
      objectTypeId: request.objectTypeId,
      returnDebug: resolveTrialReturnDebug(request.returnDebug),
    }),
  );
  const queryValues = { response_format: "json" };

  return withManagedTurn(
    lifecycle,
    "对象类逻辑属性试算",
    async (turn) => {
      const sent = await sendRequest(
        env,
        LOGIC_PROPERTY_OP,
        "rest",
        queryValues,
        bodyText,
        auth,
        undefined,
        turn?.nextContext(LOGIC_PROPERTY_OP.id),
      );
      turn?.recordReceipt(sent.receipt);

      if (!sent.ok || sent.status >= 400) {
        throw new Error(sent.text.trim() || `HTTP ${sent.status} ${sent.statusText}`);
      }

      return parseContextLoaderPayload("rest", sent.text);
    },
    () => "ok",
  );
}

export async function getObjectTypeLogicPropertyValues(
  request: ObjectTypeLogicPropertyTrialRequest,
): Promise<ObjectTypeLogicPropertyTrialRow[]> {
  const propertyNames = resolveTrialPropertyNames(request.logicProperties);

  if (propertyNames.length === 0 || request.instanceIdentities.length === 0) {
    return [];
  }

  if (useMock) {
    return wait(
      request.instanceIdentities.map((instanceIdentity) => ({
        instanceIdentity,
        values: Object.fromEntries(
          propertyNames.map((name) => [
            name,
            `mock:${name}:${Object.entries(instanceIdentity)
              .map(([key, value]) => `${key}=${String(value)}`)
              .join(",")}`,
          ]),
        ),
      })),
    );
  }

  const payload = await invokeLogicPropertyTrial(request);

  return normalizeLogicPropertyTrialRows(request.instanceIdentities, propertyNames, payload);
}
