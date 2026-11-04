/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Result, Skeleton } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { atLeast } from "@/framework/entitlement/edition";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";

/** Licence guidance only. The actual knowledge base implementation stays in its extension. */
export function KnowledgeBaseLicensePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { snapshot, loading } = useEntitlementContext();
  if (!snapshot)
    return loading ? (
      <Skeleton active />
    ) : (
      <Result
        status="warning"
        title={t("common.entitlement.unknownTitle")}
        subTitle={t("common.entitlement.unknownDescription")}
      />
    );
  const licensed = snapshot.licensed && atLeast(snapshot.edition, "professional");
  return (
    <Result
      status="info"
      title={t(
        licensed
          ? "common.entitlement.knowledgeBaseLicense.enableTitle"
          : "common.entitlement.knowledgeBaseLicense.title",
      )}
      subTitle={t(
        licensed
          ? "common.entitlement.knowledgeBaseLicense.enableDescription"
          : "common.entitlement.knowledgeBaseLicense.description",
      )}
      extra={
        <Button type="primary" onClick={() => void navigate("/system/subscription")}>
          {t("subscription.title")}
        </Button>
      }
    />
  );
}
