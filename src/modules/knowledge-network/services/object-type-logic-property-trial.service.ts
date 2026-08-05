/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { buildLogicPropertyTrialBody } from "@/modules/knowledge-network/lib/build-logic-property-trial-request";
import { useMock, wait } from "@/modules/knowledge-network/services/shared/runtime";
import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/knowledge-network";

export type ObjectTypeLogicPropertyTrialRequest = {
  instanceIdentities: Array<Record<string, string | number>>;
  logicProperties: ObjectTypeLogicProperty[];
  networkId: string;
  objectTypeId: string;
};

export type ObjectTypeLogicPropertyTrialRow = {
  instanceIdentity: Record<string, string | number>;
  values: Record<string, unknown>;
};

function emptyTrialRows(
  instanceIdentities: Array<Record<string, string | number>>,
  propertyNames: string[],
): ObjectTypeLogicPropertyTrialRow[] {
  return instanceIdentities.map((instanceIdentity) => ({
    instanceIdentity,
    values: Object.fromEntries(propertyNames.map((name) => [name, null])),
  }));
}

function normalizeLogicPropertyTrialRows(
  instanceIdentities: Array<Record<string, string | number>>,
  propertyNames: string[],
  payload: unknown,
): ObjectTypeLogicPropertyTrialRow[] {
  if (!payload || typeof payload !== "object") {
    return emptyTrialRows(instanceIdentities, propertyNames);
  }

  const root = payload as { datas?: unknown[] };
  if (!Array.isArray(root.datas)) {
    return emptyTrialRows(instanceIdentities, propertyNames);
  }

  const datas = root.datas;
  return instanceIdentities.map((instanceIdentity, index) => {
    const row = datas[index];
    const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};

    return {
      instanceIdentity,
      values: Object.fromEntries(
        propertyNames.map((name) => [name, record[name] ?? null]),
      ),
    };
  });
}

async function invokeLogicPropertyTrial(
  request: ObjectTypeLogicPropertyTrialRequest,
): Promise<unknown> {
  const response = await http.post(
    `/ontology-query/v1/knowledge-networks/${request.networkId}/object-types/${request.objectTypeId}/properties`,
    buildLogicPropertyTrialBody({
      instanceIdentities: request.instanceIdentities,
      logicProperties: request.logicProperties,
    }),
    { headers: { "X-HTTP-Method-Override": "GET" } },
  );

  return response.data;
}

export async function getObjectTypeLogicPropertyValues(
  request: ObjectTypeLogicPropertyTrialRequest,
): Promise<ObjectTypeLogicPropertyTrialRow[]> {
  const propertyNames = request.logicProperties.map((property) => property.name);

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
