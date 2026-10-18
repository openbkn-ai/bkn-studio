/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Card, Descriptions, Empty, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { parseMetricParticipantIdentity } from "@/modules/knowledge-network/lib/object-type-instance-identity";
import { getObjectTypeInstanceData } from "@/modules/knowledge-network/services/object-type.service";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";

function displayInstanceValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? "—";
  } catch {
    return "—";
  }
}

type Props = {
  identityParam: string;
  networkId: string;
  objectTypeId: string;
  primaryKeys: string[];
  properties: ObjectTypeDataProperty[];
};

export function ObjectTypeMetricParticipantPanel({
  identityParam,
  networkId,
  objectTypeId,
  primaryKeys,
  properties,
}: Props) {
  const { t } = useTranslation();
  const identity = useMemo(
    () => parseMetricParticipantIdentity(identityParam, primaryKeys),
    [identityParam, primaryKeys],
  );
  const [instance, setInstance] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!identity) return;
    let active = true;
    setInstance(null);
    setLoading(true);
    setFailed(false);
    void getObjectTypeInstanceData(
      networkId,
      objectTypeId,
      identity,
      properties.map((property) => property.name),
    )
      .then((row) => {
        if (active) setInstance(row);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [identity, networkId, objectTypeId, properties]);

  return (
    <Card
      size="small"
      style={{ marginBottom: 16 }}
      title={t("knowledgeNetwork.metricParticipantInstanceTitle")}
    >
      {!identity ? (
        <Alert type="warning" message={t("knowledgeNetwork.metricParticipantInvalidIdentity")} />
      ) : loading ? (
        <Spin />
      ) : failed ? (
        <Alert type="error" message={t("knowledgeNetwork.metricParticipantLoadFailed")} />
      ) : !instance ? (
        <Empty description={t("knowledgeNetwork.metricParticipantNotFound")} />
      ) : (
        <>
          <Alert
            showIcon
            style={{ marginBottom: 12 }}
            type="info"
            message={t("knowledgeNetwork.metricParticipantLiveNotice")}
          />
          <Descriptions
            column={2}
            size="small"
            items={properties
              .filter((property) => Object.hasOwn(instance, property.name))
              .map((property) => ({
                key: property.name,
                label: property.displayName || property.name,
                children: displayInstanceValue(instance[property.name]),
              }))}
          />
        </>
      )}
    </Card>
  );
}
