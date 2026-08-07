/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckOutlined, CrownOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import type { Edition } from "@/framework/entitlement/edition";
import { AppButton } from "@/framework/ui/common/AppButton";

/** 授权门户。与版本页同一个去处:申请与续期都在那边办。 */
const LICENSE_PORTAL_URL = "https://license.openbkn.ai/";

type CapabilityUpgradeDialogProps = {
  /** 能力 key(登记表拼写)。文案走 `subscription.capabilities.<key>.*`。 */
  capability: string;
  minEdition: Edition;
  onClose: () => void;
  open: boolean;
};

/** 卖点最多四条,`subscription.capabilities.<key>.bullets.b1..b4`,缺省即不渲染。 */
const BULLET_KEYS = ["b1", "b2", "b3", "b4"];

/**
 * 付费能力的升级引导弹窗。
 *
 * 只在「装了没买」或「这一版不含」的入口上弹——它讲的是**这项能力是什么、要哪一档**,
 * 不讲价格:报价随优惠期滚动,印在弹窗里改一次价就要发一次版,所以底部两个出口分别指向
 * 版本对比页与授权门户。
 *
 * 文案取自能力登记表的镜像(name / description),卖点是产品侧补的,缺省时只显示描述。
 */
export function CapabilityUpgradeDialog({
  capability,
  minEdition,
  onClose,
  open,
}: CapabilityUpgradeDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const editionName = t(`common.entitlement.editions.${minEdition}`);
  const bullets = BULLET_KEYS.map((key) =>
    t(`subscription.capabilities.${capability}.bullets.${key}`, { defaultValue: "" }),
  ).filter(Boolean);

  return (
    <Modal
      footer={
        <div className="console-upgrade-footer">
          <span className="console-upgrade-note">{t("common.entitlement.upgradeEffect")}</span>
          <AppButton
            onClick={() => {
              onClose();
              void navigate("/system/subscription");
            }}
          >
            {t("common.entitlement.compareEditions")}
          </AppButton>
          <AppButton
            href={LICENSE_PORTAL_URL}
            rel="noopener noreferrer"
            target="_blank"
            type="primary"
          >
            {t("common.entitlement.upgradeTo", { edition: editionName })}
          </AppButton>
        </div>
      }
      onCancel={onClose}
      open={open}
      title={t("common.entitlement.unlockTitle", { edition: editionName })}
      width={560}
    >
      <div className="console-upgrade-hero">
        <span className="console-upgrade-hero-icon" aria-hidden>
          <CrownOutlined />
        </span>
        <div>
          <div className="console-upgrade-hero-title">
            {t(`subscription.capabilities.${capability}.name`)}
            <EditionBadge edition={minEdition} />
          </div>
          <p className="console-upgrade-hero-desc">
            {t(`subscription.capabilities.${capability}.description`)}
          </p>
        </div>
      </div>

      {bullets.length > 0 ? (
        <ul className="console-upgrade-list">
          {bullets.map((text) => (
            <li key={text}>
              <CheckOutlined />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      ) : null}

    </Modal>
  );
}
