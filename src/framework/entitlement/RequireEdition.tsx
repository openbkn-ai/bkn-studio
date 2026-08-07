/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CrownOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import type { Edition } from "@/framework/entitlement/edition";
import { capabilitySatisfied, upgradeReason } from "@/framework/entitlement/upgrade-reason";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import { AppButton } from "@/framework/ui/common/AppButton";
import { capabilityServedByBknSafe } from "@/modules/subscription/capability-catalog";

const LICENSE_PORTAL_URL = "https://license.openbkn.ai/";

type RequireEditionProps = {
  /** 能力 key,只用于取文案(`subscription.capabilities.<key>.*`)。 */
  capability: string;
  children: ReactNode;
  minEdition: Edition;
};

/**
 * 整页守卫。放行条件是「证够了 **且** 这项能力真的可用」,与档位徽标闭嘴的条件同一个。
 *
 * 用于 `capabilities[]` 答不了的付费面:业务溯源由 bkn-trace 实现、语义理解在数据目录侧,
 * bkn-safe 的那份清单里从来没有它们(ee-design.md §6「A 答不了 B」)。这类能力**永远**判
 * 为不满足,即使客户已经换过包也照样盖蒙版——等 §6.2 的每服务自述端点落地才解得开。
 *
 * 这条取舍认得清:宁可让买了的人多看一层提示,也好过把付费能力对所有人白开。真正的强制力
 * 始终在服务端,这层只是体验。
 */
export function RequireEdition({ capability, children, minEdition }: RequireEditionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { snapshot } = useEntitlementContext();

  // 快照没到就先不渲染:放行等于白送,拦下又会在拿到快照后闪一下。
  if (!snapshot) {
    return null;
  }

  /*
    放行的条件与徽标闭嘴的条件是同一个:证够了 **且** 这项能力真的可用。只看档位会在
    「证是专业版、跑的还是社区包」时放行到一个用不了的页面——那正是客户最常处在的状态。

    代价:别的服务实现的能力确认不了镜像(§6「A 答不了 B」),所以它们**永远**判为不满足,
    即使客户已经换过包也照样盖蒙版。等 §6.2 的每服务自述端点落地才解得开;在那之前,
    宁可让买了的人多看一层提示,也好过把付费能力对所有人白开。
  */
  if (
    capabilitySatisfied(
      capability,
      snapshot,
      minEdition,
      capabilityServedByBknSafe(capability),
    )
  ) {
    return <>{children}</>;
  }

  const editionName = t(`common.entitlement.editions.${minEdition}`);
  /** 专业档走紫,企业与行业档走暖金——与版本页的卡片同源。 */
  const tierClass = minEdition === "professional" ? "" : "is-enterprise";
  /*
    措辞与升级弹窗共用同一条判定与同一批文案:同一件事在两处说成两样,客户会以为是两个
    问题。这里今天只会走到 buy(档位不够才拦),但判定放在一处,将来 §6.2 的自述端点落地
    后自动跟着变。
  */
  const reason = upgradeReason(
    capability,
    snapshot,
    minEdition,
    capabilityServedByBknSafe(capability),
  );
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
