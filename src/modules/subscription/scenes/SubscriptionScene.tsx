/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckOutlined, LeftOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { atLeast, type Edition } from "@/framework/entitlement/edition";
import { capabilityState } from "@/framework/entitlement/capability-state";
import { isCommunityBuild, type CapabilityState } from "@/framework/entitlement/types";
import {
  useEntitlement,
  useEntitlementContext,
} from "@/framework/entitlement/use-entitlement";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  CAPABILITY_CATEGORIES,
  capabilitiesByCategory,
  capabilitiesIntroducedBy,
  type CapabilityCatalogEntry,
} from "@/modules/subscription/capability-catalog";
import { SUBSCRIPTION_PLANS } from "@/modules/subscription/subscription-plans";
import { systemAdminPermissions } from "@/modules/system-admin/permissions";

import styles from "./SubscriptionScene.module.css";

const TIER_COLUMNS: Edition[] = ["community", "professional", "enterprise"];

/**
 * 版本与服务方案的对外说明。企业版与行业版没有自助购买路径,报价与交付形态由商务侧
 * 维护,产品页只负责把人送过去——在这里复制一份价格表,改价那天两边必然对不上。
 */
const SUBSCRIPTION_DETAIL_URL =
  "https://openbkn-ai.feishu.cn/wiki/BqXZw5UXtisE5Ikc2Sfc1J6JnCb";

/**
 * 授权门户。社区版注册即发,商业档走审批(license-server `license-service.md` §1.5:
 * 商业版一律双人复核),两条路径都从这里开始。
 *
 * 产品页只把人送过去,不在自己这边收表单——申请要填的客户/项目信息、审批状态、证书
 * 下载都在门户侧,复制一套只会两边不一致。
 */
const LICENSE_PORTAL_URL = "https://license.openbkn.ai/";

const CLUSTER_TAG_COLOR: Record<CapabilityState, string | undefined> = {
  available: "success",
  "not-installed": undefined,
  "not-licensed": "warning",
  unknown: undefined,
};

export function SubscriptionScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const entitlement = useEntitlement();
  const { snapshot } = useEntitlementContext();
  const runtimeConfig = useRuntimeConfig();

  const canManageLicense = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    mode: "any",
    requiredPermissions: systemAdminPermissions.license,
  });

  /**
   * 社区镜像里付费实现物理不存在,「你的集群」整列会是清一色的不可用——一列全灰只是噪音,
   * 而且等于对着一台装不上这些能力的机器铺开一份它永远拿不到的清单。企业镜像才有意义:
   * 那里「需升级」与「不可用」真的会同时出现,正是支持要的那个区分。
   */
  const showClusterColumn = !isCommunityBuild(entitlement);

  function editionName(edition: Edition) {
    return t(`common.entitlement.editions.${edition}`);
  }

  function capabilityRow(entry: CapabilityCatalogEntry) {
    // 只有 bkn-safe 自己实现的能力才有实况可报:capabilities/extensions 是它自己进程的
    // 装配表,别的服务的能力在这个端点里永远缺席(ee-design.md §6「A 答不了 B」)。
    const clusterStatus =
      entry.servedBy === "bkn-safe" ? capabilityState(entry.key, snapshot) : null;

    return (
      <tr key={entry.key}>
        <td>
          <span className={styles.capName}>
            {t(`subscription.capabilities.${entry.key}.name`)}
            {entry.sinceVersion ? (
              <Tag
                color="blue"
                title={t("subscription.matrix.sinceVersion", {
                  version: entry.sinceVersion,
                })}
              >
                {t("subscription.matrix.new")}
              </Tag>
            ) : null}
          </span>
          <p className={styles.capDesc}>
            {t(`subscription.capabilities.${entry.key}.description`)}
          </p>
        </td>
        {TIER_COLUMNS.map((tier) => (
          <td className={styles.tier} key={tier}>
            {atLeast(tier, entry.minEdition) ? (
              <CheckOutlined className={styles.tick} />
            ) : (
              <span className={styles.no}>—</span>
            )}
          </td>
        ))}
        {showClusterColumn ? (
          <td className={styles.tier}>
            {clusterStatus ? (
              <Tag color={CLUSTER_TAG_COLOR[clusterStatus]}>
                {t(
                  `subscription.cluster.${
                    clusterStatus === "not-licensed"
                      ? "notLicensed"
                      : clusterStatus === "not-installed"
                        ? "notInstalled"
                        : clusterStatus
                  }`,
                )}
              </Tag>
            ) : (
              <span className={styles.no} title={t("subscription.cluster.otherService")}>
                —
              </span>
            )}
          </td>
        ) : null}
      </tr>
    );
  }

  return (
    <section className={styles.scene}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          {/*
            菜单里没有这一项(它对所有登录用户开放,而「系统管理」分组的含义是「你管得着
            系统」),入口是顶栏档位芯片和锁定态的升级引导。所以页面自己得给一条回去的路。
          */}
          <AppButton
            icon={<LeftOutlined />}
            onClick={() => {
              void navigate(-1);
            }}
          >
            {t("common.back")}
          </AppButton>
          <h2 className={styles.title}>{t("subscription.title")}</h2>
        </div>
        <p className={styles.subtitle}>
          {t("subscription.subtitle")}{" "}
          {t("subscription.current.edition", {
            edition: editionName(entitlement.edition),
          })}
          {entitlement.licensed ? null : ` ${t("subscription.current.unlicensed")}`}
        </p>
      </header>

      <div className={styles.planGrid}>
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = plan.edition === entitlement.edition;
          const introduced = capabilitiesIntroducedBy(plan.edition);
          const className = [
            styles.plan,
            plan.featured ? styles.planFeatured : "",
            plan.edition === "enterprise" ? styles.planEnterprise : "",
            isCurrent ? styles.planCurrent : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <article className={className} key={plan.edition}>
              <div className={styles.planHead}>
                <span className={styles.planName}>{editionName(plan.edition)}</span>
                {isCurrent ? (
                  <Tag color="blue">{t("subscription.current.badge")}</Tag>
                ) : null}
              </div>

              {/*
                价格暂不展示。对外口径在「查看详情」指向的版本说明里:标准价
                ¥99,600/年,2026-12-31 前五折 ¥49,800/年(3 年起订),之后还有六折、八折
                两档,各带截止日期。正因为这套东西按日期滚动,才不复制进产品页——
                license-server 设计文档 §1.5 记的那个 ¥49,800/项目/年 就是这么漂掉的。
              */}

              <p className={styles.planAudience}>
                {t(`subscription.plans.${plan.edition}.audience`)}
              </p>

              {/*
                配额(用户数/节点数)暂不展示。数据链路是通的——`resolveQuota` 与它的
                用例都留着,证书里的真值也已经解析进快照——只是卡片上先不铺开。
                要恢复:把 quotaTags(plan, isCurrent) 放回这里。
              */}

              <ul className={styles.planFeats}>
                {plan.edition === "community" ? (
                  ["catalog", "index", "model"].map((key) => (
                    <li key={key}>
                      <CheckOutlined className={styles.tick} />
                      <span>{t(`subscription.plans.community.highlights.${key}`)}</span>
                    </li>
                  ))
                ) : (
                  <li>
                    <CheckOutlined className={styles.tick} />
                    <span>
                      {t("subscription.plans.inheritsFrom", {
                        edition: editionName(
                          plan.edition === "enterprise" ? "professional" : "community",
                        ),
                      })}
                    </span>
                  </li>
                )}
                {introduced.map((entry) => (
                  <li key={entry.key}>
                    <CheckOutlined className={styles.tick} />
                    <span>{t(`subscription.capabilities.${entry.key}.name`)}</span>
                  </li>
                ))}
              </ul>

              {/*
                每张卡都给这两个动作,不按档位裁剪:
                - 导入授权文件:社区版同样可能只是「还没导过证」,而不是不想买;当前档位
                  也要留着——换一张更高档的证走的是同一条路。
                - 查看详情:三档的商务形态都在同一篇版本说明里,专业版客户也要看得到
                  企业档讲什么。
              */}
              <div className={styles.actions}>
                {/*
                  三张卡的按钮层级一律相同:申请为主、导入为次、查看详情压成链接。
                  按 isCurrent 换主次会让当前档位那张卡看起来是另一套控件——用户看到的
                  是「这张卡怎么和别的不一样」,而不是「这张是我当前的档位」,后者由卡头
                  的「当前」标签表达就够了。
                */}
                <AppButton
                  href={LICENSE_PORTAL_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                  type="primary"
                >
                  {t("subscription.cta.apply")}
                </AppButton>
                {canManageLicense ? (
                  <AppButton
                    onClick={() => {
                      void navigate("/system/license");
                    }}
                    title={t("subscription.cta.importHint")}
                  >
                    {t("subscription.cta.import")}
                  </AppButton>
                ) : null}
              </div>
              <AppButton
                className={styles.detailLink}
                href={SUBSCRIPTION_DETAIL_URL}
                rel="noopener noreferrer"
                target="_blank"
                type="link"
              >
                {t("subscription.cta.details")}
              </AppButton>
              {canManageLicense ? null : (
                // 没有授权管理权限的人点进去只会撞 403,给一句能照做的话比给一个死按钮强。
                <p className={styles.note}>{t("subscription.cta.needAdmin")}</p>
              )}
            </article>
          );
        })}
      </div>

      <div className={styles.industry}>
        <span className={styles.industryTitle}>
          {editionName("industry")} · {t("subscription.industry.title")}
        </span>
        <p className={styles.industryBody}>{t("subscription.industry.body")}</p>
      </div>

      <div className={styles.matrix}>
        <h3 className={styles.matrixTitle}>{t("subscription.matrix.title")}</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("subscription.matrix.capability")}</th>
                {TIER_COLUMNS.map((tier) => (
                  <th className={styles.tier} key={tier}>
                    {editionName(tier)}
                  </th>
                ))}
                {showClusterColumn ? (
                  <th className={styles.tier} title={t("subscription.cluster.hint")}>
                    {t("subscription.cluster.title")}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {CAPABILITY_CATEGORIES.map((category) => {
                const rows = capabilitiesByCategory(category);

                if (rows.length === 0) {
                  return null;
                }

                return (
                  <Fragment key={category}>
                    <tr className={styles.groupRow}>
                      <td colSpan={TIER_COLUMNS.length + (showClusterColumn ? 2 : 1)}>
                        {t(`subscription.categories.${category}`)}
                      </td>
                    </tr>
                    {rows.map(capabilityRow)}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={styles.note}>{t("subscription.contact")}</p>
        {showClusterColumn ? (
          <>
            <p className={styles.note}>{t("subscription.cluster.hint")}</p>
            <p className={styles.note}>{t("subscription.cluster.otherService")}</p>
          </>
        ) : null}
      </div>

    </section>
  );
}
