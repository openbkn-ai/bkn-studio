/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useContext } from "react";

import { atLeast, type Edition } from "@/framework/entitlement/edition";
import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import { isCommunityBuild } from "@/framework/entitlement/types";

/** 当前集群的授权档位与能力。Provider 缺席时读到社区版兜底。 */
export function useEntitlement() {
  return useContext(EntitlementContext).entitlement;
}

/** 快照是否已经拿到。`loading` 期间「不可用」与「未知」分不开,别据此下结论。 */
export function useEntitlementStatus() {
  return useContext(EntitlementContext).status;
}

/**
 * 重新拉取授权快照。导入 / 激活 / 删除授权成功后调用——后端承诺补证下一个请求即生效,
 * 前端就不该要求用户按 F5。
 */
export function useRefreshEntitlement() {
  return useContext(EntitlementContext).refresh;
}

export type EditionGateVerdict = {
  /** 档位够,正常渲染。 */
  allowed: boolean;
  /**
   * 档位不够,且这是社区镜像——付费实现物理不在这个二进制里,画升级引导是噪音。
   * 直接不渲染入口。
   */
  hidden: boolean;
  /**
   * 档位不够,但这是企业镜像——换一张证就能用。渲染锁定态与升级引导。
   */
  locked: boolean;
};

/**
 * 单个 minEdition 的判定结果,拆成「藏 / 锁 / 放行」三态。
 *
 * 藏与锁的分界用 `extensions[]`:后端刻意把「证里有什么」和「这个二进制装了什么」
 * 分成两个字段,正是为了让人分得清「没授权」和「授权了但镜像不对」。
 */
export function useEditionGate(minEdition: Edition | undefined): EditionGateVerdict {
  const entitlement = useEntitlement();

  if (!minEdition || atLeast(entitlement.edition, minEdition)) {
    return { allowed: true, hidden: false, locked: false };
  }

  const community = isCommunityBuild(entitlement);

  return { allowed: false, hidden: community, locked: !community };
}
