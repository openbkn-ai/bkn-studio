/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CrownOutlined } from "@ant-design/icons";
import { Result, Skeleton } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import type { Edition } from "@/framework/entitlement/edition";
import { capabilitySatisfied, upgradeReason } from "@/framework/entitlement/upgrade-reason";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import { AppButton } from "@/framework/ui/common/AppButton";
import { capabilityReportedByEndpoint } from "@/modules/subscription/capability-catalog";

const LICENSE_PORTAL_URL = "https://license.openbkn.ai/";

type RequireEditionProps = {
  /** 能力 key,只用于取文案(`subscription.capabilities.<key>.*`)。 */
  capability: string;
  children: ReactNode;
  minEdition: Edition;
};

/**
 * 整页守卫。放行条件与档位徽标闭嘴的条件同一个:`capabilitySatisfied`。
 *
 * 用于 `capabilities[]` 答不了的付费面:业务溯源由 bkn-trace 实现、语义理解在数据目录侧,
 * bkn-safe 的那份清单里从来没有它们(ee-design.md §6「A 答不了 B」)。这类能力核实不了
 * 镜像,判据退到证书:档位够就放行。前端核实不了别人的包,不等于那个包没装——把「核实
 * 不了」当「没装」,买了企业版证、也换了企业版包的客户会被自己付过钱的功能挡在门外。
 *
 * 真正的强制力始终在服务端,这层只是体验。等 §6.2 的每服务自述端点落地,这里就能和
 * bkn-safe 自己的能力走同一条判据。
 */
export function RequireEdition({ capability, children, minEdition }: RequireEditionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loading, snapshot } = useEntitlementContext();

  /*
    快照没到不能白屏。null 有两种来路:这一次请求还在飞,以及 fetchEntitlement() 抛错后
    Provider 落成 null——后者没有重试触发点,会一直停在 null。整块内容区空着,用户既看
    不到功能也看不到原因,只能去查路由配置。与 RequireCapability 同一套下场。
  */
  if (!snapshot) {
    return loading ? (
      <Skeleton active paragraph={{ rows: 6 }} />
    ) : (
      <Result
        status="warning"
        subTitle={t("common.entitlement.unknownDescription")}
        title={t("common.entitlement.unknownTitle")}
      />
    );
  }

  const reportedByEndpoint = capabilityReportedByEndpoint(capability);
  /*
    与升级弹窗共用同一条判定和同一批文案:同一件事在两处说成两样,客户会以为是两个问题。
  */
  const reason = upgradeReason(capability, snapshot, minEdition, reportedByEndpoint);

  if (capabilitySatisfied(capability, snapshot, minEdition, reportedByEndpoint)) {
    return <>{children}</>;
  }

  const editionName = t(`common.entitlement.editions.${minEdition}`);
  /** 专业档走紫,企业与行业档走暖金——与版本页的卡片同源。 */
  const tierClass = minEdition === "professional" ? "" : "is-enterprise";
  const imageIssue = reason !== "buy";
  const currentEditionName = t(
    `common.entitlement.editions.${snapshot?.edition ?? "community"}`,
  );

  return (
    <div className="console-upgrade-locked">
      {/*
        底下照常渲染真实页面,盖一层蒙版:客户看得见这块功能长什么样,才知道自己在买什么。
        内容层不可点、不可选、焦点也进不去——但蒙版只是体验层,真正的强制力在服务端。
      */}
      <div aria-hidden className="console-upgrade-locked-content" inert>
        {children}
      </div>
      <div className="console-upgrade-mask">
        <div className={`console-upgrade-card ${tierClass ? "console-upgrade-enterprise" : ""}`}>
          <div className={`console-upgrade-hero ${tierClass}`}>
            <span className="console-upgrade-hero-icon" aria-hidden>
              <CrownOutlined />
            </span>
            <div>
              <div className="console-upgrade-hero-title">
                {t(`subscription.capabilities.${capability}.name`)}
                <EditionBadge alwaysShow edition={minEdition} />
              </div>
              <p className="console-upgrade-hero-desc">
                {t(`subscription.capabilities.${capability}.description`)}
              </p>
            </div>
          </div>

          <h3 className="console-upgrade-card-title">
            {imageIssue
              ? t("common.entitlement.imageMissingTitle", { edition: currentEditionName })
              : t("common.entitlement.unlockTitle", { edition: editionName })}
          </h3>

          <div className="console-upgrade-page-actions">
            {imageIssue ? null : (
              <AppButton
                href={LICENSE_PORTAL_URL}
                rel="noopener noreferrer"
                target="_blank"
                type="primary"
              >
                {t("common.entitlement.upgradeTo", { edition: editionName })}
              </AppButton>
            )}
            <AppButton
              onClick={() => {
                void navigate("/system/subscription");
              }}
            >
              {t("common.entitlement.compareEditions")}
            </AppButton>
          </div>
          <p className="console-upgrade-note">
            {reason === "image"
              ? t("common.entitlement.imageMissingHint", { edition: currentEditionName })
              : reason === "image-likely"
                ? t("common.entitlement.imageLikelyHint", { edition: currentEditionName })
                : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
