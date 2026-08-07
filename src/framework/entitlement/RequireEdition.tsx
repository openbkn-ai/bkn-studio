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
import { atLeast, type Edition } from "@/framework/entitlement/edition";
import { upgradeReason } from "@/framework/entitlement/upgrade-reason";
import {
  useEntitlement,
  useEntitlementContext,
} from "@/framework/entitlement/use-entitlement";
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
 * 按**档位**守卫整页。只用于 `capabilities[]` 答不了的付费面。
 *
 * 正常的门控判据是服务端算好的 `capabilities[]`(ee-design.md §3.2「不让客户端自己推」)。
 * 但那份清单只描述 bkn-safe 自己的镜像:业务溯源由 bkn-trace 实现(走临时分叉),这个
 * 端点永远不报它的 key(§6「A 答不了 B」)——拿 capability 去挡会把页面永久隐藏,不管
 * 客户买没买。
 *
 * 所以这里退到唯一拿得到的信号:证书档位。代价要认清——**它答不了「那个服务的镜像里
 * 有没有这段代码」**:企业证 + 社区版 bkn-trace 的集群会放行到一个取不到数据的页面。
 * 真正的门控要等 §6.2 的每服务自述端点,或者 bkn-trace 自己按档位伪装 404;在那之前,
 * 前端这层至少让付费能力不再对所有人白开。
 */
export function RequireEdition({ capability, children, minEdition }: RequireEditionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const entitlement = useEntitlement();
  const { snapshot } = useEntitlementContext();

  // 快照没到就先不渲染:放行等于白送,拦下又会在拿到快照后闪一下。
  if (!snapshot) {
    return null;
  }

  if (atLeast(entitlement.edition, minEdition)) {
    return <>{children}</>;
  }

  const editionName = t(`common.entitlement.editions.${minEdition}`);
  /** 企业与行业档走紫,专业档走暖金——与版本页的卡片同源。 */
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
                : t("common.entitlement.upgradeEffect")}
          </p>
        </div>
      </div>
    </div>
  );
}
