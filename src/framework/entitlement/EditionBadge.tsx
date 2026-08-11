/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import type { Edition } from "@/framework/entitlement/edition";
import { capabilitySatisfied } from "@/framework/entitlement/upgrade-reason";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import { capabilityReportedByEndpoint } from "@/modules/subscription/capability-catalog";

/**
 * 「这项能力从哪一档起提供」的标签。
 *
 * **这是产品目录里的事实,不是运行期判定**——它回答「要买哪一档」,不回答「你现在能不能
 * 用」。所以它不看快照,也不随档位消失:一个已经买了企业版的客户看到「Enterprise」标签,
 * 读到的仍是「这项属于企业档」,并没有错。
 *
 * 能不能用由 `capabilityState` 决定(菜单藏/锁、按钮置灰、路由守卫)。两者刻意分开:
 * 有些面**整页是社区能力、只有写操作收费**(角色管理),整项藏掉是错的;有些面由别的
 * 服务实现,bkn-safe 的 `capabilities[]` 永远报不出来(业务溯源),拿它门控会永久隐藏
 * (ee-design.md §6「A 答不了 B」)。这两种都只能标,不能挡。
 */
export function EditionBadge({
  alwaysShow = false,
  capability,
  edition,
}: {
  /** 讲解语境(升级弹窗的 hero)里即使已经可用也要标出这项属于哪一档。 */
  alwaysShow?: boolean;
  /**
   * 能力 key。不给等于「这项由谁实现都说不上」,`capabilitySatisfied` 于是恒为假,徽标
   * 常驻。这是有意的保守侧:少给一次标记不如多给一次——但别指望它会随档位消失,要那种
   * 行为就得把 key 传进来。
   */
  capability?: string;
  edition: Edition;
}) {
  const { t } = useTranslation();
  const { snapshot } = useEntitlementContext();
  const label = t(`common.entitlement.editionsShort.${edition}`);

  /*
    徽标闭嘴的条件是**两个都满足**:证够了、镜像里也有。只满足一半时仍要标——客户
    此刻还用不了,这时候把标记撤掉等于让他以为一切正常。
  */
  const satisfied = capabilitySatisfied(
    capability ?? "",
    snapshot,
    edition,
    capability ? capabilityReportedByEndpoint(capability) : false,
  );

  if (!alwaysShow && satisfied) {
    return null;
  }

  return (
    <Tooltip
      title={t("common.entitlement.paidHint", {
        edition: t(`common.entitlement.editions.${edition}`),
      })}
    >
      {/* 配色统一走 global.css 的 .console-edition-badge-*,与版本页卡片同源。 */}
      <span className={`console-edition-badge console-edition-badge-${edition}`}>{label}</span>
    </Tooltip>
  );
}
