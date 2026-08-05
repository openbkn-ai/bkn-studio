/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckOutlined } from "@ant-design/icons";
import { Modal, Tag } from "antd";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { atLeast, type Edition } from "@/framework/entitlement/edition";
import { isCommunityBuild } from "@/framework/entitlement/types";
import {
  useEntitlement,
  useEntitlementStatus,
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
import {
  clusterCapabilityStatus,
  type ClusterCapabilityStatus,
} from "@/modules/subscription/cluster-capability-status";
import { SUBSCRIPTION_PLANS } from "@/modules/subscription/subscription-plans";
import { systemAdminPermissions } from "@/modules/system-admin/permissions";

import styles from "./SubscriptionScene.module.css";

const TIER_COLUMNS: Edition[] = ["community", "professional", "enterprise"];

const CLUSTER_TAG_COLOR: Record<ClusterCapabilityStatus, string | undefined> = {
  available: "success",
  "not-installed": undefined,
  "not-licensed": "warning",
  unknown: undefined,
};

export function SubscriptionScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const entitlement = useEntitlement();
  const status = useEntitlementStatus();
  const runtimeConfig = useRuntimeConfig();
  const [salesOpen, setSalesOpen] = useState(false);

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
    const clusterStatus = clusterCapabilityStatus(entry.key, entitlement, status);

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
          </td>
        ) : null}
      </tr>
    );
  }

  return (
    <section className={styles.scene}>
      <header className={styles.head}>
        <h2 className={styles.title}>{t("subscription.title")}</h2>
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

              <div className={styles.planPrice}>
                <span className={styles.planPriceNum}>
                  {t(`subscription.plans.${plan.edition}.price`)}
                </span>
                <span className={styles.planPriceUnit}>
                  {t(`subscription.plans.${plan.edition}.unit`)}
                </span>
              </div>

              <p className={styles.planAudience}>
                {t(`subscription.plans.${plan.edition}.audience`)}
              </p>

              {plan.limits ? (
                <div className={styles.quota}>
                  <Tag>
                    {t("subscription.plans.quota.maxUsers", {
                      value:
                        plan.limits.maxUsers === null
                          ? t("subscription.plans.quota.unlimited")
                          : plan.limits.maxUsers,
                    })}
                  </Tag>
                  <Tag>
                    {t("subscription.plans.quota.maxNodes", {
                      value:
                        plan.limits.maxNodes === null
                          ? t("subscription.plans.quota.unlimited")
                          : plan.limits.maxNodes,
                    })}
                  </Tag>
                </div>
              ) : null}

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

              {isCurrent ? (
                <AppButton disabled>{t("subscription.cta.current")}</AppButton>
              ) : plan.edition === "community" ? null : plan.edition === "enterprise" ? (
                // 企业版没有自助路径:合同签完才有证书,页面上放一个「立即升级」是假的。
                <AppButton
                  onClick={() => {
                    setSalesOpen(true);
                  }}
                  type={atLeast(entitlement.edition, "professional") ? "primary" : "default"}
                >
                  {t("subscription.cta.sales")}
                </AppButton>
              ) : canManageLicense ? (
                <AppButton
                  onClick={() => {
                    void navigate("/system/license");
                  }}
                  title={t("subscription.cta.importHint")}
                  type="primary"
                >
                  {t("subscription.cta.import")}
                </AppButton>
              ) : (
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
        {showClusterColumn ? (
          <p className={styles.note}>{t("subscription.cluster.hint")}</p>
        ) : null}
        <p className={styles.note}>{t("subscription.priceNote")}</p>
      </div>

      <Modal
        footer={null}
        onCancel={() => {
          setSalesOpen(false);
        }}
        open={salesOpen}
        title={t("subscription.contact.title")}
      >
        <p className={styles.note}>{t("subscription.contact.body")}</p>
      </Modal>
    </section>
  );
}
